import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { clients, clientUsers, firmInvites, users, type FirmInvite } from "@shared/schema";
import { renderBrandedEmail, sendEmail } from "./email-service";

// Team: a firm's members and its pending invites. Every function is scoped by
// the firm (clientId); callers check that the actor is a firm admin.

const INVITE_DAYS = 7;
const INVITES_PER_DAY = 25; // per firm

export class TeamError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const normEmail = (email: string) => email.trim().toLowerCase();
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function findUserByEmail(email: string) {
  const [u] = await db.select().from(users).where(sql`lower(${users.email}) = ${normEmail(email)}`).limit(1);
  return u ?? null;
}

async function membershipOf(userId: string) {
  const [m] = await db.select().from(clientUsers).where(eq(clientUsers.userId, userId)).limit(1);
  return m ?? null;
}

export async function listTeam(clientId: string) {
  const [members, invites] = await Promise.all([
    db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: clientUsers.role,
        joinedAt: clientUsers.createdAt,
      })
      .from(clientUsers)
      .innerJoin(users, eq(users.id, clientUsers.userId))
      .where(eq(clientUsers.clientId, clientId))
      .orderBy(clientUsers.createdAt),
    db
      .select()
      .from(firmInvites)
      .where(and(eq(firmInvites.clientId, clientId), isNull(firmInvites.acceptedAt), isNull(firmInvites.revokedAt)))
      .orderBy(desc(firmInvites.createdAt)),
  ]);
  return {
    members,
    invites: invites.map(({ tokenHash: _t, ...i }) => ({ ...i, expired: i.expiresAt < new Date() })),
  };
}

async function sendInviteEmail(invite: FirmInvite, token: string, baseUrl: string, inviterName: string) {
  const [firm] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, invite.clientId)).limit(1);
  const firmName = escapeHtml(firm?.name ?? "your firm");
  const result = await sendEmail({
    to: invite.email,
    subject: `${firm?.name ?? "Your firm"} invited you to GovernmentAffairs.io`,
    html: renderBrandedEmail({
      kicker: "Team invite",
      heading: `Join ${firmName}`,
      bodyHtml: `
        <p style="margin:0 0 12px 0;">${escapeHtml(inviterName)} invited you to join <strong>${firmName}</strong> on GovernmentAffairs.io${
          invite.role === "admin" ? " as an admin" : ""
        }.</p>
        <p style="margin:0;">Set your name and password to get started. This link works once and expires in ${INVITE_DAYS} days.</p>`,
      cta: { label: "Accept the invite", url: `${baseUrl}/accept-invite?token=${token}` },
      footerNote: "Not expecting this? You can ignore this email.",
    }),
  });
  if (!result.success) throw new TeamError("The invite was saved, but the email didn't send. Try Resend.", 502);
}

export async function createInvite(opts: {
  clientId: string;
  inviterId: string;
  inviterName: string;
  email: string;
  role: "member" | "admin";
  baseUrl: string;
}) {
  const email = normEmail(opts.email);
  const existing = await findUserByEmail(email);
  if (existing) {
    const m = await membershipOf(existing.id);
    if (m?.clientId === opts.clientId) throw new TeamError(`${email} is already on your team.`, 409);
    if (m) throw new TeamError(`${email} already uses GovernmentAffairs.io with another firm. Email support@governmentaffairs.io to move them.`, 409);
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ n }] = await db
    .select({ n: count() })
    .from(firmInvites)
    .where(and(eq(firmInvites.clientId, opts.clientId), gte(firmInvites.createdAt, since)));
  if (Number(n) >= INVITES_PER_DAY) throw new TeamError("That's a lot of invites for one day. Try again tomorrow.", 429);

  // One live invite per person: replace any earlier pending one.
  await db
    .update(firmInvites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(firmInvites.clientId, opts.clientId),
        eq(firmInvites.email, email),
        isNull(firmInvites.acceptedAt),
        isNull(firmInvites.revokedAt),
      ),
    );

  const token = randomBytes(32).toString("hex");
  const [invite] = await db
    .insert(firmInvites)
    .values({
      clientId: opts.clientId,
      email,
      role: opts.role,
      tokenHash: hashToken(token),
      invitedByUserId: opts.inviterId,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning();
  await sendInviteEmail(invite, token, opts.baseUrl, opts.inviterName);
  const { tokenHash: _t, ...safe } = invite;
  return safe;
}

async function pendingInvite(clientId: string, id: string) {
  const [invite] = await db
    .select()
    .from(firmInvites)
    .where(and(eq(firmInvites.id, id), eq(firmInvites.clientId, clientId), isNull(firmInvites.acceptedAt), isNull(firmInvites.revokedAt)))
    .limit(1);
  if (!invite) throw new TeamError("Invite not found.", 404);
  return invite;
}

// New link (the old one stops working), fresh 7 days, email again.
export async function resendInvite(clientId: string, id: string, baseUrl: string, inviterName: string) {
  const invite = await pendingInvite(clientId, id);
  const token = randomBytes(32).toString("hex");
  const [updated] = await db
    .update(firmInvites)
    .set({ tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000) })
    .where(eq(firmInvites.id, invite.id))
    .returning();
  await sendInviteEmail(updated, token, baseUrl, inviterName);
}

export async function revokeInvite(clientId: string, id: string) {
  const invite = await pendingInvite(clientId, id);
  await db.update(firmInvites).set({ revokedAt: new Date() }).where(eq(firmInvites.id, invite.id));
}

async function adminCount(clientId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(clientUsers)
    .where(and(eq(clientUsers.clientId, clientId), eq(clientUsers.role, "admin")));
  return Number(n);
}

export async function setMemberRole(clientId: string, userId: string, role: "member" | "admin") {
  const [m] = await db.select().from(clientUsers).where(and(eq(clientUsers.clientId, clientId), eq(clientUsers.userId, userId))).limit(1);
  if (!m) throw new TeamError("That person isn't on your team.", 404);
  if (m.role === "admin" && role !== "admin" && (await adminCount(clientId)) <= 1) {
    throw new TeamError("Your firm needs at least one admin. Make someone else an admin first.", 409);
  }
  await db.update(clientUsers).set({ role }).where(eq(clientUsers.id, m.id));
}

// Removes the person from the firm (their login stays, but opens nothing).
export async function removeMember(clientId: string, userId: string) {
  const [m] = await db.select().from(clientUsers).where(and(eq(clientUsers.clientId, clientId), eq(clientUsers.userId, userId))).limit(1);
  if (!m) throw new TeamError("That person isn't on your team.", 404);
  if (m.role === "admin" && (await adminCount(clientId)) <= 1) {
    throw new TeamError("You can't remove the only admin.", 409);
  }
  await db.delete(clientUsers).where(eq(clientUsers.id, m.id));
}

async function liveInviteByToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const [invite] = await db.select().from(firmInvites).where(eq(firmInvites.tokenHash, hashToken(token))).limit(1);
  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

// What the accept page needs to show. Never reveals anything without a valid token.
export async function describeInvite(token: string) {
  const invite = await liveInviteByToken(token);
  if (!invite) return null;
  const [firm] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, invite.clientId)).limit(1);
  const [inviter] = invite.invitedByUserId
    ? await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, invite.invitedByUserId)).limit(1)
    : [];
  const existing = await findUserByEmail(invite.email);
  return {
    firmName: firm?.name ?? "your firm",
    email: invite.email,
    role: invite.role,
    inviterName: [inviter?.firstName, inviter?.lastName].filter(Boolean).join(" ") || null,
    // An account that already has a password must sign in first rather than
    // set a new password through the invite.
    needsSignIn: !!existing?.passwordHash,
  };
}

// Accepts an invite. New people get an account (with the invited email); an
// existing account joins only when it's the one signed in. Returns the user
// to sign in.
export async function acceptInvite(
  token: string,
  input: { firstName?: string; lastName?: string; password?: string },
  signedInUserId: string | null,
) {
  const invite = await liveInviteByToken(token);
  if (!invite) throw new TeamError("This invite link has expired or was already used. Ask for a new one.", 410);

  let user = await findUserByEmail(invite.email);
  if (user?.passwordHash) {
    if (user.id !== signedInUserId) {
      throw new TeamError(`You already have an account. Sign in as ${invite.email}, then open this link again.`, 409);
    }
  } else {
    const firstName = input.firstName?.trim();
    const password = input.password ?? "";
    if (!firstName) throw new TeamError("Add your first name.");
    if (password.length < 8) throw new TeamError("Use a password of at least 8 characters.");
    const passwordHash = await bcrypt.hash(password, 10);
    if (user) {
      [user] = await db
        .update(users)
        .set({ firstName, lastName: input.lastName?.trim() || null, passwordHash, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
    } else {
      [user] = await db
        .insert(users)
        .values({ email: invite.email, firstName, lastName: input.lastName?.trim() || null, passwordHash })
        .returning();
    }
  }

  const current = await membershipOf(user.id);
  if (current && current.clientId !== invite.clientId) {
    throw new TeamError("This account already belongs to another firm. Email support@governmentaffairs.io to move it.", 409);
  }

  // Claim the invite once, even if the link is opened twice at the same moment.
  const claimed = await db
    .update(firmInvites)
    .set({ acceptedAt: new Date(), acceptedUserId: user.id })
    .where(and(eq(firmInvites.id, invite.id), isNull(firmInvites.acceptedAt), isNull(firmInvites.revokedAt)))
    .returning({ id: firmInvites.id });
  if (claimed.length === 0) throw new TeamError("This invite was just used. Try signing in.", 410);

  if (!current) await db.insert(clientUsers).values({ userId: user.id, clientId: invite.clientId, role: invite.role });
  return user;
}

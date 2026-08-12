// Path Builder: find warm routes from the firm's own contacts to a target
// office using co-tenure — two people who served in the same office at the
// same time. Position histories come from legistorm_staffers.positions
// (officeId + start/end dates), so overlap is computed in memory over two
// small sets: the firm's matched contacts and the target office's staff.
import { db } from "../db";
import { contacts as contactsTable, legistormStaffers } from "@shared/schema";
import { and, eq, ilike, or } from "drizzle-orm";

type Position = {
  id: number;
  title: string;
  isCurrent: boolean;
  startDate: string | null;
  endDate: string | null;
  memberName: string | null;
  memberId: number | null;
  officeName: string | null;
  officeId: number | null;
  chamber: string | null;
  state: string | null;
  district: number | null;
};

export interface NetworkPath {
  kind: "insider" | "co-tenure" | "alumni";
  contact: { id: string; name: string; title: string | null; organization: string | null };
  sharedOffice: string;
  overlapStart: string | null;
  overlapEnd: string | null;
  overlapYears: number;
  contactRoleThen: string | null;
  targetStafferRoleThen: string | null;
  targetStaffer: {
    legistormId: number;
    fullName: string;
    currentTitle: string | null;
    email: string | null;
  } | null;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function positionWindow(p: Position): { start: number; end: number } | null {
  const start = p.startDate ? Date.parse(p.startDate) : NaN;
  if (Number.isNaN(start)) return null; // unknown start → skip, avoid false positives
  const end = p.endDate ? Date.parse(p.endDate) : p.isCurrent ? Date.now() : NaN;
  if (Number.isNaN(end)) return null;
  return { start, end };
}

function overlapWindow(a: Position, b: Position): { start: number; end: number } | null {
  const wa = positionWindow(a);
  const wb = positionWindow(b);
  if (!wa || !wb) return null;
  const start = Math.max(wa.start, wb.start);
  const end = Math.min(wa.end, wb.end);
  // Require at least ~3 months of overlap for a credible relationship.
  return end - start >= MS_PER_YEAR / 4 ? { start, end } : null;
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function findNetworkPaths(clientId: string, target: string): Promise<NetworkPath[]> {
  const targetStaffers = await db.select().from(legistormStaffers)
    .where(and(
      eq(legistormStaffers.isCurrentStaff, true),
      or(
        ilike(legistormStaffers.currentMemberName, `%${target}%`),
        ilike(legistormStaffers.currentOffice, `%${target}%`),
      ),
    ))
    .limit(60);
  if (targetStaffers.length === 0) return [];

  const firmContacts = await db.select().from(contactsTable)
    .where(eq(contactsTable.clientId, clientId))
    .limit(200);
  if (firmContacts.length === 0) return [];

  // Match contacts to directory records by full name in ONE query.
  const matched = await db.select().from(legistormStaffers)
    .where(or(...firmContacts.map((c) => ilike(legistormStaffers.fullName, `${c.firstName} ${c.lastName}`))))
    .limit(300);
  const stafferByName = new Map(matched.map((s) => [s.fullName?.toLowerCase(), s]));

  const paths: NetworkPath[] = [];
  const targetLower = target.toLowerCase();

  for (const c of firmContacts) {
    const contactInfo = {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      title: c.title,
      organization: c.organization,
    };
    const record = stafferByName.get(`${c.firstName} ${c.lastName}`.toLowerCase());
    const cPositions = (record?.positions ?? []) as Position[];

    // Alumni: the contact themself once worked for the target member/office.
    const alumniPosition = cPositions.find(
      (p) =>
        !p.isCurrent &&
        ((p.memberName && p.memberName.toLowerCase().includes(targetLower)) ||
          (p.officeName && p.officeName.toLowerCase().includes(targetLower))),
    );
    if (alumniPosition) {
      const w = positionWindow(alumniPosition);
      paths.push({
        kind: "alumni",
        contact: contactInfo,
        sharedOffice: alumniPosition.officeName || alumniPosition.memberName || target,
        overlapStart: w ? iso(w.start) : alumniPosition.startDate,
        overlapEnd: w ? iso(w.end) : alumniPosition.endDate,
        overlapYears: w ? Math.round(((w.end - w.start) / MS_PER_YEAR) * 10) / 10 : 0,
        contactRoleThen: alumniPosition.title,
        targetStafferRoleThen: null,
        targetStaffer: null,
      });
    }

    for (const t of targetStaffers) {
      // The contact IS currently on the target's staff.
      if (record && record.legistormId === t.legistormId) {
        paths.push({
          kind: "insider",
          contact: contactInfo,
          sharedOffice: t.currentOffice || target,
          overlapStart: null,
          overlapEnd: null,
          overlapYears: 0,
          contactRoleThen: t.currentTitle,
          targetStafferRoleThen: t.currentTitle,
          targetStaffer: {
            legistormId: t.legistormId,
            fullName: t.fullName,
            currentTitle: t.currentTitle,
            email: t.email,
          },
        });
        continue;
      }

      // Co-tenure: contact and a current target staffer once shared an office.
      const tPositions = (t.positions ?? []) as Position[];
      let best: { ov: { start: number; end: number }; pc: Position; pt: Position } | null = null;
      for (const pc of cPositions) {
        if (!pc.officeId) continue;
        for (const pt of tPositions) {
          if (pt.officeId !== pc.officeId) continue;
          const ov = overlapWindow(pc, pt);
          if (ov && (!best || ov.end - ov.start > best.ov.end - best.ov.start)) {
            best = { ov, pc, pt };
          }
        }
      }
      if (best) {
        paths.push({
          kind: "co-tenure",
          contact: contactInfo,
          sharedOffice: best.pc.officeName || best.pt.officeName || "shared office",
          overlapStart: iso(best.ov.start),
          overlapEnd: iso(best.ov.end),
          overlapYears: Math.round(((best.ov.end - best.ov.start) / MS_PER_YEAR) * 10) / 10,
          contactRoleThen: best.pc.title,
          targetStafferRoleThen: best.pt.title,
          targetStaffer: {
            legistormId: t.legistormId,
            fullName: t.fullName,
            currentTitle: t.currentTitle,
            email: t.email,
          },
        });
      }
    }
  }

  // Insider beats co-tenure beats alumni; longer overlaps first within a tier.
  const tier = { insider: 0, "co-tenure": 1, alumni: 2 } as const;
  paths.sort((a, b) => tier[a.kind] - tier[b.kind] || b.overlapYears - a.overlapYears);
  return paths.slice(0, 12);
}

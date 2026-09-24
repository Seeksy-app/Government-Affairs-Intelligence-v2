// Global search (header search box / ⌘K). One query fans out to every place a
// user might mean, in parallel:
// - firm-scoped: tracked bills, contacts, research projects (matters),
//   Decision Briefs, client portals
// - shared: the LegiStorm staffer directory (current staff only)
// Each source is capped so the palette stays fast and scannable.
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { briefs, clientPortals, contacts, legistormStaffers, matters, trackedBills } from "@shared/schema";
import { jurisdictionName, trackedBillLabel } from "@shared/bill-label";

export interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

export interface SearchGroup {
  type: "bills" | "staffers" | "contacts" | "projects" | "briefs" | "portals";
  label: string;
  items: SearchItem[];
}

// ilike treats % and _ as wildcards; match them literally.
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function compact(...parts: Array<string | null | undefined>): string | undefined {
  const s = parts.filter(Boolean).join(" · ");
  return s || undefined;
}

export async function globalSearch(clientId: string | null, rawQuery: string): Promise<SearchGroup[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const pat = likePattern(q);
  const startsWith = `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const digits = q.match(/\d+/)?.[0];

  const firm = async <T,>(fn: (cid: string) => Promise<T[]>): Promise<T[]> => (clientId ? fn(clientId) : []);

  const [bills, staffers, people, projects, briefRows, portals] = await Promise.all([
    firm((cid) => {
      const match: SQL[] = [
        ilike(trackedBills.title, pat),
        ilike(trackedBills.billLabel, pat),
        ilike(trackedBills.sponsor, pat),
        ilike(trackedBills.policyArea, pat),
        sql`array_to_string(${trackedBills.tags}, ' ') ilike ${pat}`,
      ];
      // "HR 123", "hb 2508", "123" → match the bill number too.
      if (digits) match.push(sql`${trackedBills.billNumber}::text = ${digits}`);
      return db.select().from(trackedBills).where(and(eq(trackedBills.clientId, cid), or(...match))).limit(6);
    }),
    db
      .select({
        legistormId: legistormStaffers.legistormId,
        fullName: legistormStaffers.fullName,
        currentTitle: legistormStaffers.currentTitle,
        currentOffice: legistormStaffers.currentOffice,
        currentMemberName: legistormStaffers.currentMemberName,
      })
      .from(legistormStaffers)
      .where(
        and(
          eq(legistormStaffers.isCurrentStaff, true),
          or(
            ilike(legistormStaffers.fullName, pat),
            ilike(legistormStaffers.currentMemberName, pat),
            ilike(legistormStaffers.currentOffice, pat),
            ilike(legistormStaffers.currentTitle, pat),
          ),
        ),
      )
      // Name matches first (prefix before substring), then office/title matches.
      .orderBy(
        sql`case when ${legistormStaffers.fullName} ilike ${startsWith} then 0
                 when ${legistormStaffers.fullName} ilike ${pat} then 1
                 else 2 end`,
        legistormStaffers.fullName,
      )
      .limit(6),
    firm((cid) =>
      db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.clientId, cid),
            or(
              sql`(${contacts.firstName} || ' ' || ${contacts.lastName}) ilike ${pat}`,
              ilike(contacts.organization, pat),
              ilike(contacts.title, pat),
              ilike(contacts.email, pat),
            ),
          ),
        )
        .limit(6),
    ),
    firm((cid) =>
      db
        .select()
        .from(matters)
        .where(and(eq(matters.clientId, cid), or(ilike(matters.name, pat), ilike(matters.description, pat))))
        .limit(5),
    ),
    firm((cid) =>
      db
        .select({ id: briefs.id, title: briefs.title, status: briefs.status, clientContext: briefs.clientContext })
        .from(briefs)
        .where(and(eq(briefs.clientId, cid), or(ilike(briefs.title, pat), ilike(briefs.clientContext, pat))))
        .orderBy(desc(briefs.createdAt))
        .limit(5),
    ),
    firm((cid) =>
      db
        .select()
        .from(clientPortals)
        .where(and(eq(clientPortals.clientId, cid), or(ilike(clientPortals.name, pat), ilike(clientPortals.description, pat))))
        .limit(5),
    ),
  ]);

  const groups: SearchGroup[] = [
    {
      type: "bills",
      label: "Tracked bills",
      items: bills.map((b) => ({
        id: b.id,
        title: `${trackedBillLabel(b)} — ${b.title ?? ""}`.trim(),
        subtitle: compact(jurisdictionName(b), b.status, b.latestAction),
        href: `/bills?open=${b.id}`,
      })),
    },
    {
      type: "staffers",
      label: "Congressional staff",
      items: staffers.map((s) => ({
        id: String(s.legistormId),
        title: s.fullName,
        subtitle: compact(s.currentTitle, s.currentMemberName || s.currentOffice),
        href: `/staffers?staffer=${s.legistormId}`,
      })),
    },
    {
      type: "contacts",
      label: "Contacts",
      items: people.map((c) => {
        const name = `${c.firstName} ${c.lastName}`.trim();
        return {
          id: c.id,
          title: name,
          subtitle: compact(c.title, c.organization),
          href: `/contacts?q=${encodeURIComponent(name)}`,
        };
      }),
    },
    {
      type: "projects",
      label: "Research projects",
      items: projects.map((m) => ({ id: m.id, title: m.name, subtitle: m.description ?? undefined, href: `/matters/${m.id}` })),
    },
    {
      type: "briefs",
      label: "Decision Briefs",
      items: briefRows.map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: compact(b.status === "ready" ? undefined : b.status, b.clientContext),
        href: `/briefs/${b.id}`,
      })),
    },
    {
      type: "portals",
      label: "Client portals",
      items: portals.map((p) => ({ id: p.id, title: p.name, subtitle: p.description ?? undefined, href: "/portals" })),
    },
  ];

  return groups.filter((g) => g.items.length > 0);
}

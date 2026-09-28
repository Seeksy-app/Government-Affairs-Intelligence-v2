import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { orgProfiles, type OrgProfileData } from "@shared/schema";
import { POLICY_AREAS } from "@shared/onboarding";

// Organization profiles for contacts: one Parallel Responses call (medium
// effort, ~10–60 s, ~2¢) with a JSON schema. Parallel draws on its licensed
// company-data partners (Crunchbase and others) by default. Profiles are
// public facts, cached by normalized name and shared across firms; a refresh
// is only made on request (or when the copy is over 30 days old and asked for).

const RESPONSES_URL = "https://api.parallel.ai/v1/responses";
const FRESH_PER_DAY = 40; // per firm
const freshToday = new Map<string, number[]>();

export class OrgProfileError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const orgNameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|llc|ltd|corp|corporation|co|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function cachedOrgProfile(name: string) {
  const key = orgNameKey(name);
  if (!key) return null;
  const [row] = await db.select().from(orgProfiles).where(eq(orgProfiles.nameKey, key)).limit(1);
  return row ?? null;
}

const KINDS = ["company", "trade_association", "nonprofit", "congressional_office", "committee", "federal_agency", "state_or_local_government", "other"];
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function researchOrgProfile(clientId: string, name: string) {
  if (!process.env.PARALLEL_API_KEY) throw new OrgProfileError("Organization profiles aren't available right now.", 503);
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = (freshToday.get(clientId) ?? []).filter((t) => t > dayAgo);
  if (recent.length >= FRESH_PER_DAY) throw new OrgProfileError("That's a lot of new profiles for one day. Try again tomorrow.", 429);
  freshToday.set(clientId, [...recent, Date.now()]);

  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PARALLEL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "parallel",
      reasoning: { effort: "medium" },
      input:
        `Build a short profile of the organization "${name.replace(/"/g, "'")}" for a government affairs professional (today is ${today}). ` +
        "It may be a company, trade association, nonprofit, a member of Congress's office, a congressional committee, or a government agency. " +
        "summary: at most 45 words on what it is and does. sector: a few words. size: employees, members or budget if known. " +
        "leaders: up to 4 key people (for a congressional office, the member and chief of staff if known). " +
        "governmentAffairs: at most 45 words on its lobbying and policy activity (registered lobbying spend or firms, PAC, issues it lobbies or legislates on, committee assignments for an office). " +
        "recentDevelopments: up to 4 notable items from the last 12 months with ISO date, one-line headline and source URL. " +
        "policyAreas: choose only from the allowed list. Use empty strings or arrays for anything unknown; never guess. " +
        "If you can't tell which organization this is, set found to false.",
      text: {
        format: {
          type: "json_schema",
          name: "org_profile",
          schema: {
            type: "object",
            properties: {
              found: { type: "boolean" },
              officialName: { type: "string" },
              kind: { type: "string", enum: KINDS },
              summary: { type: "string" },
              sector: { type: "string" },
              headquarters: { type: "string" },
              website: { type: "string" },
              size: { type: "string" },
              leaders: {
                type: "array",
                items: { type: "object", properties: { name: { type: "string" }, title: { type: "string" } }, required: ["name", "title"], additionalProperties: false },
              },
              governmentAffairs: { type: "string" },
              recentDevelopments: {
                type: "array",
                items: {
                  type: "object",
                  properties: { date: { type: "string" }, headline: { type: "string" }, url: { type: "string" } },
                  required: ["date", "headline", "url"],
                  additionalProperties: false,
                },
              },
              policyAreas: { type: "array", items: { type: "string", enum: POLICY_AREAS } },
            },
            required: ["found", "officialName", "kind", "summary", "sector", "headquarters", "website", "size", "leaders", "governmentAffairs", "recentDevelopments", "policyAreas"],
            additionalProperties: false,
          },
        },
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[org-profile] Parallel error", res.status, JSON.stringify(body).slice(0, 300));
    throw new OrgProfileError("The profile didn't come back. Try again in a minute.", 502);
  }
  const part = (body.output ?? []).find((o: any) => o.type === "message")?.content?.find((c: any) => c.type === "output_text");
  let d: any;
  try {
    d = JSON.parse(part?.text ?? "");
  } catch {
    throw new OrgProfileError("The profile didn't come back. Try again in a minute.", 502);
  }
  const isUrl = (u: string) => /^https?:\/\/\S+$/i.test(u);
  const data: OrgProfileData = {
    found: !!d.found && !!str(d.summary, 10),
    officialName: str(d.officialName, 200),
    kind: KINDS.includes(d.kind) ? d.kind : "other",
    summary: str(d.summary, 600),
    sector: str(d.sector, 120),
    headquarters: str(d.headquarters, 120),
    website: str(d.website, 200),
    size: str(d.size, 120),
    leaders: (Array.isArray(d.leaders) ? d.leaders : []).slice(0, 4).map((l: any) => ({ name: str(l?.name, 100), title: str(l?.title, 120) })).filter((l: any) => l.name),
    governmentAffairs: str(d.governmentAffairs, 600),
    recentDevelopments: (Array.isArray(d.recentDevelopments) ? d.recentDevelopments : [])
      .slice(0, 4)
      .map((r: any) => ({ date: str(r?.date, 20), headline: str(r?.headline, 240), url: str(r?.url, 500) }))
      .filter((r: any) => r.headline && isUrl(r.url)),
    policyAreas: Array.from(new Set<string>((Array.isArray(d.policyAreas) ? d.policyAreas : []).filter((a: string) => POLICY_AREAS.includes(a)))).slice(0, 5),
    sources: Array.from(new Set<string>((part?.annotations ?? []).map((a: any) => a?.url).filter((u: unknown): u is string => typeof u === "string" && isUrl(u)))).slice(0, 6),
  };

  const key = orgNameKey(name);
  const [row] = await db
    .insert(orgProfiles)
    .values({ nameKey: key, name: name.trim().slice(0, 200), data, fetchedAt: new Date() })
    .onConflictDoUpdate({ target: orgProfiles.nameKey, set: { data, name: name.trim().slice(0, 200), fetchedAt: sql`now()` } })
    .returning();
  console.log(`[org-profile] ${key}: ${data.found ? data.kind : "not found"}, ${data.recentDevelopments.length} developments, ${data.sources.length} sources`);
  return row;
}

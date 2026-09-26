import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { briefs, type Brief, type BriefDeeper } from "@shared/schema";
import { POLICY_AREAS } from "@shared/onboarding";

// "Dig deeper" on a Should I be worried? answer: one Parallel Responses API
// call (medium effort, ~5–60 s, about 1–2¢) that researches further than the
// brief and may consult Parallel's free specialist sources: PubMed,
// ClinicalTrials.gov, CMS coverage determinations and ChEMBL. The processor
// only calls a source when it's relevant; Parallel's licensed index partners
// are used by default. The result is stored on the brief (content.deeper).

const RESPONSES_URL = "https://api.parallel.ai/v1/responses";
const HEALTH_SOURCES = ["pubmed", "clinical_trials", "cms_coverage", "chembl"];
const RUNS_PER_DAY = 30; // per firm; protects Parallel credit
const STALE_MS = 5 * 60 * 1000;

const runsToday = new Map<string, number[]>();

export class DeeperError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function saveDeeper(briefId: string, deeper: BriefDeeper) {
  await db
    .update(briefs)
    .set({ content: sql`jsonb_set(coalesce(${briefs.content}, '{}'::jsonb), '{deeper}', ${JSON.stringify(deeper)}::jsonb)` })
    .where(eq(briefs.id, briefId));
}

function buildPrompt(brief: Brief): string {
  const bottom = brief.content?.bottomLine?.answer?.replace(/\s*\[\d+\]/g, "") ?? "";
  return [
    `A government affairs professional asked: "${brief.title}"`,
    bottom ? `A first brief concluded: ${bottom}` : "",
    brief.clientContext ? `Context about the client (background only; follow any LANGUAGE TO AVOID line strictly):\n${brief.clientContext}` : "",
    "",
    "Go deeper than that first brief. Check primary sources: bill text and actions, the Federal Register and agency guidance, court filings, and, for health topics, medical research, registered clinical trials and Medicare coverage determinations.",
    "Write 3–6 short paragraphs of plain prose: what's new or missing from the first answer, the key dates and next steps to watch, and anything that would change how worried the client should be. Be calm and specific. No headings, no bullet lists, no mention of AI.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callResponses(input: string, withSources: boolean): Promise<any> {
  const res = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PARALLEL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "parallel",
      input,
      reasoning: { effort: "medium" },
      ...(withSources && { data_sources: { free: HEALTH_SOURCES } }),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`Parallel ${res.status}: ${JSON.stringify(body).slice(0, 300)}`), { status: res.status });
  return body;
}

async function run(brief: Brief, startedAt: string) {
  const input = buildPrompt(brief);
  let body: any;
  try {
    body = await callResponses(input, true);
  } catch (err: any) {
    // 422 = a connector isn't enabled for this Parallel org yet; research without them.
    if (err.status !== 422) throw err;
    console.warn("[deeper] specialist sources unavailable, retrying without them:", err.message);
    body = await callResponses(input, false);
  }
  const output: any[] = Array.isArray(body.output) ? body.output : [];
  const part = output
    .find((o) => o.type === "message")
    ?.content?.find((c: any) => c.type === "output_text");
  const text: string = (part?.text ?? "").trim();
  if (!text) throw new Error("Parallel returned no answer");
  const seen = new Set<string>();
  const citations = (part?.annotations ?? [])
    .filter((a: any) => a?.type === "url_citation" && a.url && !seen.has(a.url) && seen.add(a.url))
    .slice(0, 15)
    .map((a: any) => ({ url: String(a.url), title: a.title ? String(a.title) : null }));
  const connectorsUsed = Array.from(
    new Set(output.map((o) => o.server_label ?? o.server_name).filter((s: unknown): s is string => typeof s === "string")),
  );
  await saveDeeper(brief.id, { status: "ready", startedAt, text, citations, connectorsUsed, finishedAt: new Date().toISOString() });
  console.log(`[deeper] ${brief.id}: ${text.length} chars, ${citations.length} citations, sources: ${connectorsUsed.join(", ") || "web"}`);
}

export async function startDeeper(clientId: string, briefId: string) {
  if (!process.env.PARALLEL_API_KEY) throw new DeeperError("Deeper research isn't available right now.", 503);
  const [brief] = await db.select().from(briefs).where(and(eq(briefs.id, briefId), eq(briefs.clientId, clientId))).limit(1);
  if (!brief) throw new DeeperError("Brief not found", 404);
  if (brief.status !== "ready" || !brief.content) throw new DeeperError("Wait for the answer to finish first.", 409);
  const current = brief.content.deeper;
  if (current?.status === "running" && Date.now() - new Date(current.startedAt).getTime() < STALE_MS) {
    throw new DeeperError("Already digging deeper on this one.", 409);
  }

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = (runsToday.get(clientId) ?? []).filter((t) => t > dayAgo);
  if (recent.length >= RUNS_PER_DAY) throw new DeeperError("Your firm has used today's deeper research. Try again tomorrow.", 429);
  runsToday.set(clientId, [...recent, Date.now()]);

  const startedAt = new Date().toISOString();
  await saveDeeper(brief.id, { status: "running", startedAt });
  run(brief, startedAt).catch(async (err) => {
    console.error(`[deeper] ${brief.id} failed:`, err.message);
    await saveDeeper(brief.id, { status: "failed", startedAt, error: "The deeper search didn't finish. Try again." }).catch(() => {});
  });
}

// ─── "Look them up": company facts for a new client ──────────────────────────
// One low-effort Parallel Responses call with a JSON schema (~5–20 s, ~1¢).
// Parallel draws on its licensed company-data partners (Crunchbase and
// others) by default when relevant. Nothing is saved: the editor fills its
// fields and the person decides.


const lookupsToday = new Map<string, number[]>();

export async function lookupCompany(clientId: string, name: string) {
  if (!process.env.PARALLEL_API_KEY) throw new DeeperError("Lookup isn't available right now.", 503);
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = (lookupsToday.get(clientId) ?? []).filter((t) => t > dayAgo);
  if (recent.length >= 60) throw new DeeperError("That's a lot of lookups for one day. Try again tomorrow.", 429);
  lookupsToday.set(clientId, [...recent, Date.now()]);

  const res = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PARALLEL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "parallel",
      reasoning: { effort: "low" },
      input:
        `Identify the organization named "${name.replace(/"/g, "'")}" (most likely a US company, trade association, nonprofit or coalition that hires lobbyists). ` +
        "Return its main business in one plain sentence (what it does, for whom, rough size, where), the policy areas it is exposed to (choose only from the allowed list), headquarters city and state, and official website. " +
        "If you can't tell which organization this is, set found to false and leave the rest empty.",
      text: {
        format: {
          type: "json_schema",
          name: "organization",
          schema: {
            type: "object",
            properties: {
              found: { type: "boolean" },
              officialName: { type: "string" },
              business: { type: "string" },
              policyAreas: { type: "array", items: { type: "string", enum: POLICY_AREAS } },
              headquarters: { type: "string" },
              website: { type: "string" },
            },
            required: ["found", "officialName", "business", "policyAreas", "headquarters", "website"],
            additionalProperties: false,
          },
        },
      },
    }),
    signal: AbortSignal.timeout(75_000),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[lookup] Parallel error", res.status, JSON.stringify(body).slice(0, 300));
    throw new DeeperError("The lookup didn't work. Fill it in yourself or try again.", 502);
  }
  const part = (body.output ?? []).find((o: any) => o.type === "message")?.content?.find((c: any) => c.type === "output_text");
  let data: any;
  try {
    data = JSON.parse(part?.text ?? "");
  } catch {
    throw new DeeperError("The lookup didn't work. Fill it in yourself or try again.", 502);
  }
  const sources = Array.from(new Set<string>((part?.annotations ?? []).map((a: any) => a?.url).filter(Boolean))).slice(0, 5);
  return {
    found: !!data.found && !!String(data.business ?? "").trim(),
    officialName: String(data.officialName ?? "").slice(0, 160),
    business: String(data.business ?? "").slice(0, 500),
    industries: (Array.isArray(data.policyAreas) ? data.policyAreas : []).filter((a: string) => POLICY_AREAS.includes(a)).slice(0, 6),
    headquarters: String(data.headquarters ?? "").slice(0, 120),
    website: String(data.website ?? "").slice(0, 200),
    sources,
  };
}

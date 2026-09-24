// "Should I be worried?" — turn a free-text question, headline, link, or bill
// number into a cited Decision Brief with no manual source hunting.
//
// Pipeline (runs in the background; the brief page polls status):
//   1. plan      — one small Claude call: search queries, federal bill refs,
//                  agency press-release keywords, a clean title
//   2. discover  — in parallel: Congress.gov bill data, stored agency press
//                  releases, Parallel web search; plus any links pasted in
//   3. select    — ≤ MAX_SOURCES, mixed across kinds, ≤2 per domain
//   4. generate  — the existing brief-service pipeline (extract → Claude)

import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import {
  briefs,
  briefSources,
  clientProfiles,
  governmentPressReleases,
} from "@shared/schema";
import { and, desc, eq, gte, ilike, or } from "drizzle-orm";
import { CongressAPI, formatBillId } from "./congress-api";
import { webSearch, isParallelConfigured, extractDomain } from "./parallel-service";
import { generateBrief } from "./brief-service";
import { trackedBillUrl } from "@shared/bill-label";

const MODEL = "claude-sonnet-4-6";
const MAX_SOURCES = 6;
const MAX_PER_DOMAIN = 2;

// Social/video pages extract poorly; LegiScan's terms prohibit scraping its site.
const EXCLUDED_DOMAINS = [
  "youtube.com", "facebook.com", "x.com", "twitter.com", "instagram.com",
  "tiktok.com", "reddit.com", "linkedin.com", "legiscan.com",
];

const BILL_TYPES = ["hr", "s", "hjres", "sjres", "hres", "sres", "hconres", "sconres"] as const;
export type FederalBillType = (typeof BILL_TYPES)[number];

export interface BillRef {
  congress: number | null;
  type: FederalBillType;
  number: number;
}

export interface AskPlan {
  title: string | null;
  objective: string;
  searchQueries: string[];
  bills: BillRef[];
  pressKeywords: string[];
}

export interface Candidate {
  url: string;
  title: string | null;
  publication: string | null;
  publishDate: string | null;
  extractedContent: string | null;
  excerpts: string[];
}

// ─── Pure helpers (unit-tested) ───────────────────────────────────────────────

export function currentCongress(now = new Date()): number {
  return Math.floor((now.getUTCFullYear() - 1789) / 2) + 1;
}

export function urlsInText(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"'`]+/gi) ?? [];
  const cleaned = found.map((u) => u.replace(/[.,;:!?)\]}]+$/, ""));
  return Array.from(new Set(cleaned)).filter((u) => {
    try {
      new URL(u);
      return true;
    } catch {
      return false;
    }
  });
}

// Federal bill references written the usual ways: "H.R. 2508", "HR2508",
// "S. 1234", "H.J.Res. 7", "S Res 12". State bills (AB/SB/HB…) are not matched.
// The lookbehind keeps "U.S. 2026" from reading as Senate bill 2026.
const BILL_PATTERN =
  /(?<![\w.])(H\.?\s?R|S|H\.?\s?J\.?\s?Res|S\.?\s?J\.?\s?Res|H\.?\s?Con\.?\s?Res|S\.?\s?Con\.?\s?Res|H\.?\s?Res|S\.?\s?Res)\.?\s?(\d{1,5})\b/gi;

export function detectBillRefs(text: string): BillRef[] {
  const refs: BillRef[] = [];
  const withoutUrls = text.replace(/https?:\/\/\S+/gi, " ");
  for (const m of Array.from(withoutUrls.matchAll(BILL_PATTERN))) {
    const type = m[1].replace(/[.\s]/g, "").toLowerCase() as FederalBillType;
    // A bare "S" needs the dot or a space-free digit run to count ("S. 12", "S12") —
    // avoids reading prose like "Section S 5" or "plan S 2" as a bill.
    if (type === "s" && !/^S(\.|\d)/i.test(m[0])) continue;
    if (!BILL_TYPES.includes(type)) continue;
    refs.push({ congress: null, type, number: parseInt(m[2], 10) });
  }
  return dedupeBills(refs);
}

function dedupeBills(refs: BillRef[]): BillRef[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const key = `${r.type}${r.number}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function stripHtml(html: string): string {
  return html
    .replace(/<\/(p|li|h\d)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parsePlan(raw: string, question: string): AskPlan {
  const fallback: AskPlan = {
    title: null,
    objective: question,
    searchQueries: [question.replace(/https?:\/\/\S+/gi, "").trim().slice(0, 120) || question.slice(0, 120)],
    bills: [],
    pressKeywords: [],
  };

  let p: any;
  try {
    const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    p = JSON.parse(json);
  } catch {
    return fallback;
  }
  if (!p || typeof p !== "object") return fallback;

  const strings = (v: unknown, max: number, maxLen: number) =>
    Array.isArray(v)
      ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim().slice(0, maxLen)).slice(0, max)
      : [];

  const bills: BillRef[] = Array.isArray(p.bills)
    ? p.bills
        .map((b: any) => ({
          congress: Number.isInteger(b?.congress) && b.congress >= 93 && b.congress <= 130 ? b.congress : null,
          type: String(b?.type ?? "").toLowerCase().replace(/[.\s]/g, "") as FederalBillType,
          number: Number(b?.number),
        }))
        .filter((b: BillRef) => BILL_TYPES.includes(b.type) && Number.isInteger(b.number) && b.number > 0)
    : [];

  const searchQueries = strings(p.searchQueries, 4, 120);
  return {
    title: typeof p.title === "string" && p.title.trim() ? p.title.trim().slice(0, 140) : null,
    objective: typeof p.objective === "string" && p.objective.trim() ? p.objective.trim().slice(0, 1000) : question,
    searchQueries: searchQueries.length > 0 ? searchQueries : fallback.searchQueries,
    bills: dedupeBills(bills).slice(0, 2),
    pressKeywords: strings(p.pressKeywords, 3, 60).filter((k) => k.length >= 4),
  };
}

// Web results in rank order, minus excluded/duplicate URLs, ≤ MAX_PER_DOMAIN each.
export function pickWebResults(
  results: Array<{ url: string; title: string | null; publishDate: string | null; excerpts: string[] }>,
  alreadyUsed: string[],
): Candidate[] {
  const used = new Set(alreadyUsed.map(normalizeUrl));
  const perDomain = new Map<string, number>();
  for (const u of alreadyUsed) {
    const d = extractDomain(u);
    perDomain.set(d, (perDomain.get(d) ?? 0) + 1);
  }

  const out: Candidate[] = [];
  for (const r of results) {
    const domain = extractDomain(r.url);
    if (!domain || EXCLUDED_DOMAINS.some((x) => domain === x || domain.endsWith(`.${x}`))) continue;
    const key = normalizeUrl(r.url);
    if (used.has(key)) continue;
    if ((perDomain.get(domain) ?? 0) >= MAX_PER_DOMAIN) continue;
    used.add(key);
    perDomain.set(domain, (perDomain.get(domain) ?? 0) + 1);
    out.push({
      url: r.url,
      title: r.title,
      publication: null,
      publishDate: r.publishDate,
      extractedContent: null,
      excerpts: r.excerpts.slice(0, 5),
    });
  }
  return out;
}

function normalizeUrl(u: string): string {
  return u.replace(/^https?:\/\/(www\.)?/i, "").replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase();
}

// Mix: pasted links first, then bill data and press releases, then the web —
// leaving the web at least two slots when it has results.
export function selectSources(groups: {
  pasted: Candidate[];
  bills: Candidate[];
  press: Candidate[];
  web: Candidate[];
}): Candidate[] {
  const primary = [...groups.pasted.slice(0, 3), ...groups.bills.slice(0, 2), ...groups.press.slice(0, 2)];
  const head = primary.slice(0, groups.web.length >= 2 ? MAX_SOURCES - 2 : MAX_SOURCES);
  const seen = new Set<string>();
  return [...head, ...groups.web]
    .filter((c) => {
      const key = normalizeUrl(c.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_SOURCES);
}

// ─── Step 1: plan ─────────────────────────────────────────────────────────────

async function planQuestion(question: string): Promise<AskPlan> {
  const today = new Date().toISOString().slice(0, 10);
  const system = `You plan source research for a government affairs analyst. A client has asked a question, pasted a headline or link, or named a bill. Decide what to look up.

TODAY: ${today} (the ${currentCongress()}th Congress)

Return ONLY a JSON object:
{
  "title": "<neutral 4-12 word title for the brief, e.g. 'Proposed DOL overtime rule for salaried workers'>",
  "objective": "<1-2 sentences: what to find — latest facts, status, who is driving it, and likely impact>",
  "searchQueries": ["<3-6 word web query>", "..."],
  "bills": [{"type": "hr|s|hjres|sjres|hres|sres|hconres|sconres", "number": 1234, "congress": 119}],
  "pressKeywords": ["<2-4 word phrase likely to appear in a federal agency press release title>"]
}

Rules:
- searchQueries: 2-4 distinct queries aimed at recent reporting and official sources.
- bills: only FEDERAL bills that are explicitly named or unambiguously identifiable; congress null if unsure. Empty array otherwise. Never include state bills.
- pressKeywords: 0-3 distinctive phrases (not generic words like "policy" or "rule"). Empty if the topic isn't agency-driven.`;

  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) return parsePlan("", question);

  try {
    const client = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined,
    });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: question }],
    });
    const raw = message.content.find((b) => b.type === "text")?.text ?? "";
    return parsePlan(raw, question);
  } catch (err: any) {
    console.warn("[ask] plan step failed, using the question as the search:", err.message);
    return parsePlan("", question);
  }
}

// ─── Step 2: discovery sources ────────────────────────────────────────────────

async function fetchBill(api: CongressAPI, ref: BillRef): Promise<Candidate | null> {
  const tryCongresses = ref.congress ? [ref.congress] : [currentCongress(), currentCongress() - 1];

  for (const congress of tryCongresses) {
    let bill: any;
    try {
      bill = (await api.getBillDetails(congress, ref.type, ref.number)).bill;
    } catch {
      continue; // 404 → try the previous Congress
    }
    if (!bill) continue;

    const [summaries, actions] = await Promise.allSettled([
      api.getBillSummaries(congress, ref.type, ref.number),
      api.getBillActions(congress, ref.type, ref.number, 10),
    ]);

    const label = formatBillId(congress, ref.type, ref.number);
    const sponsor = bill.sponsors?.[0];
    const lines = [
      `# ${label} (${congress}th Congress): ${bill.title}`,
      "",
      sponsor ? `Sponsor: ${sponsor.fullName}` : null,
      bill.introducedDate ? `Introduced: ${bill.introducedDate}` : null,
      bill.policyArea?.name ? `Policy area: ${bill.policyArea.name}` : null,
      typeof bill.cosponsors?.count === "number" ? `Cosponsors: ${bill.cosponsors.count}` : null,
      bill.latestAction ? `Latest action (${bill.latestAction.actionDate}): ${bill.latestAction.text}` : null,
    ].filter((l): l is string => l !== null);

    if (summaries.status === "fulfilled") {
      const list = summaries.value.summaries ?? [];
      const latest = list[list.length - 1];
      if (latest?.text) {
        lines.push("", `## Congressional Research Service summary (${latest.actionDate ?? "latest"})`, stripHtml(latest.text).slice(0, 6000));
      }
    }
    if (actions.status === "fulfilled" && actions.value.actions?.length) {
      lines.push("", "## Recent actions");
      for (const a of actions.value.actions.slice(0, 10)) lines.push(`- ${a.actionDate}: ${a.text}`);
    }

    return {
      url: trackedBillUrl({ congress, billType: ref.type, billNumber: ref.number, jurisdiction: "US" }),
      title: `${label}: ${bill.title}`,
      publication: "Congress.gov",
      publishDate: bill.latestAction?.actionDate ?? bill.introducedDate ?? null,
      extractedContent: lines.join("\n"),
      excerpts: [],
    };
  }
  return null;
}

async function findBills(refs: BillRef[]): Promise<Candidate[]> {
  const apiKey = process.env.CONGRESS_API_KEY;
  if (!apiKey || refs.length === 0) return [];
  const api = new CongressAPI(apiKey);
  const found = await Promise.all(refs.slice(0, 2).map((r) => fetchBill(api, r).catch(() => null)));
  return found.filter((c): c is Candidate => c !== null);
}

function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

async function findPressReleases(keywords: string[]): Promise<Candidate[]> {
  if (keywords.length === 0) return [];
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(governmentPressReleases)
    .where(
      and(
        gte(governmentPressReleases.publishedAt, since),
        or(
          ...keywords.flatMap((k) => [
            ilike(governmentPressReleases.title, likePattern(k)),
            ilike(governmentPressReleases.summary, likePattern(k)),
          ]),
        ),
      ),
    )
    .orderBy(desc(governmentPressReleases.publishedAt))
    .limit(2);

  return rows.map((r) => ({
    url: r.url,
    title: r.title,
    publication: `${r.departmentSlug.toUpperCase()} press release`,
    publishDate: r.publishedAt ? r.publishedAt.toISOString().slice(0, 10) : null,
    // Short summaries aren't enough to cite from — let Extract fetch the page.
    extractedContent: r.fullText && r.fullText.length > 400 ? r.fullText : null,
    excerpts: r.summary ? [r.summary] : [],
  }));
}

async function findOnWeb(plan: AskPlan, exclude: string[]): Promise<Candidate[]> {
  if (!isParallelConfigured()) return [];
  const afterDate = new Date(Date.now() - 548 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // ~18 months
  const results = await webSearch({
    objective: plan.objective,
    searchQueries: plan.searchQueries,
    maxResults: 10,
    afterDate,
    excludeDomains: EXCLUDED_DOMAINS,
  });
  return pickWebResults(results, exclude);
}

async function firmContext(clientId: string): Promise<string | null> {
  const [profile] = await db
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.clientId, clientId))
    .limit(1);
  if (!profile) return null;
  const parts = [
    profile.industries.length ? `Industries: ${profile.industries.join(", ")}` : null,
    profile.watchlistTopics.length ? `Watchlist topics: ${profile.watchlistTopics.join(", ")}` : null,
    profile.relevantAgencies.length ? `Agencies: ${profile.relevantAgencies.join(", ")}` : null,
    profile.relevantCommittees.length ? `Committees: ${profile.relevantCommittees.join(", ")}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return `Our firm's focus areas — ${parts.join(". ")}`.slice(0, 1200);
}

// ─── Main export ──────────────────────────────────────────────────────────────

// Runs discovery for a brief created by POST /api/briefs/ask, then generates it.
// Always leaves the brief in a terminal state (ready | failed).
export async function answerQuestion(briefId: string): Promise<void> {
  const [brief] = await db.select().from(briefs).where(eq(briefs.id, briefId)).limit(1);
  if (!brief) throw new Error(`Brief ${briefId} not found`);

  const question = brief.title;
  const started = Date.now();

  try {
    const plan = await planQuestion(question);
    const billRefs = dedupeBills([...detectBillRefs(question), ...plan.bills]).slice(0, 2);

    const pasted: Candidate[] = urlsInText(question).slice(0, 3).map((url) => ({
      url, title: null, publication: null, publishDate: null, extractedContent: null, excerpts: [],
    }));

    const [bills, press, clientContext] = await Promise.all([
      findBills(billRefs).catch((err) => { console.warn("[ask] Congress.gov lookup failed:", err.message); return []; }),
      findPressReleases(plan.pressKeywords).catch((err) => { console.warn("[ask] press search failed:", err.message); return []; }),
      brief.clientContext ? Promise.resolve(brief.clientContext) : firmContext(brief.clientId).catch(() => null),
    ]);

    // Web search runs after we know which URLs are already covered.
    const covered = [...pasted, ...bills, ...press].map((c) => c.url);
    const web = await findOnWeb(plan, covered).catch((err) => {
      console.warn("[ask] web search failed:", err.message);
      return [] as Candidate[];
    });

    const chosen = selectSources({ pasted, bills, press, web });
    console.log(
      `[ask] ${briefId}: plan ${plan.searchQueries.length}q/${billRefs.length} bills/${plan.pressKeywords.length} press kw → ` +
        `pasted ${pasted.length}, bills ${bills.length}, press ${press.length}, web ${web.length} → using ${chosen.length} (${Date.now() - started}ms)`,
    );

    if (chosen.length === 0) {
      throw new Error(
        "We couldn't find sources for this yet. Try adding a link to the article, or a bill number like H.R. 1234.",
      );
    }

    // A pasted URL or long headline makes a poor title; the planner's is cleaner.
    const title =
      plan.title && (pasted.length > 0 || question.length > 140) ? plan.title : question;

    await db.transaction(async (tx) => {
      await tx.delete(briefSources).where(eq(briefSources.briefId, briefId));
      await tx.insert(briefSources).values(
        chosen.map((c, i) => ({
          briefId,
          citationNumber: i + 1,
          url: c.url,
          title: c.title,
          publication: c.publication,
          publishDate: c.publishDate,
          tier: 3, // recomputed from the domain during generation
          excerpts: c.excerpts,
          extractedContent: c.extractedContent,
        })),
      );
      await tx
        .update(briefs)
        .set({ title, clientContext: clientContext ?? null, updatedAt: new Date() })
        .where(eq(briefs.id, briefId));
    });
  } catch (err: any) {
    await db
      .update(briefs)
      .set({ status: "failed", generationError: err.message ?? "Unknown error", updatedAt: new Date() })
      .where(eq(briefs.id, briefId));
    throw err;
  }

  // generateBrief records its own failures on the brief row.
  await generateBrief(briefId);
  console.log(`[ask] ${briefId}: done in ${Date.now() - started}ms`);
}

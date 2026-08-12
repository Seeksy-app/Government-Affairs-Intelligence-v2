import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import {
  governmentPressReleases,
  newsArticles,
  clientProfiles,
  clients,
  legistormStaffers,
} from "@shared/schema";
import { eq, gte, and, ilike, or, desc, isNotNull } from "drizzle-orm";

const MODEL = "claude-sonnet-4-6";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FocusPerson {
  name: string;
  title: string;
  office: string;
}

export interface RankedItem {
  id: string;
  type: "press_release" | "news";
  title: string;
  summary: string | null;
  source: string;
  url: string;
  publishedAt: Date | null;
  score: number;
  whyItMatters: string;
  whoToFocusOn: FocusPerson[];
}

export interface RankedBriefResult {
  clientId: string;
  clientName: string;
  industries: string[];
  watchlistTopics: string[];
  highRelevance: RankedItem[];
  worthWatching: RankedItem[];
  generatedAt: string;
  scoringMetadata: {
    totalItemsConsidered: number;
    highRelevanceCount: number;
    worthWatchingCount: number;
    ignoredCount: number;
    claudeCallsMadeThisRender: number;
    windowUsedHours: number;
  };
}

// ─── In-memory cache (10-min TTL per clientId) ────────────────────────────────

interface CacheEntry {
  result: RankedBriefResult;
  cachedAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function getCached(clientId: string): RankedBriefResult | null {
  const entry = cache.get(clientId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(clientId);
    return null;
  }
  return entry.result;
}

// ─── Client profile fetch ─────────────────────────────────────────────────────

async function getClientProfile(clientId: string) {
  const [row] = await db
    .select({
      clientName: clients.name,
      industries: clientProfiles.industries,
      watchlistTopics: clientProfiles.watchlistTopics,
      relevantAgencies: clientProfiles.relevantAgencies,
      relevantCommittees: clientProfiles.relevantCommittees,
    })
    .from(clientProfiles)
    .innerJoin(clients, eq(clients.id, clientProfiles.clientId))
    .where(eq(clientProfiles.clientId, clientId))
    .limit(1);
  return row ?? null;
}

// ─── Fetch recent items, with fallback window ─────────────────────────────────

async function fetchRecentItems(clientId: string, windowHours: number) {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const pressReleases = await db
    .select({
      id: governmentPressReleases.id,
      title: governmentPressReleases.title,
      summary: governmentPressReleases.summary,
      url: governmentPressReleases.url,
      publishedAt: governmentPressReleases.publishedAt,
      departmentSlug: governmentPressReleases.departmentSlug,
    })
    .from(governmentPressReleases)
    .where(
      and(
        isNotNull(governmentPressReleases.publishedAt),
        gte(governmentPressReleases.publishedAt, since),
      ),
    )
    .orderBy(desc(governmentPressReleases.publishedAt));

  const articles = await db
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      summary: newsArticles.summary,
      url: newsArticles.url,
      publishedAt: newsArticles.publishedAt,
      source: newsArticles.source,
    })
    .from(newsArticles)
    .where(
      and(
        isNotNull(newsArticles.publishedAt),
        gte(newsArticles.publishedAt, since),
      ),
    )
    .orderBy(desc(newsArticles.publishedAt));

  return { pressReleases, articles };
}

// ─── Claude ranking call ──────────────────────────────────────────────────────

interface InputItem {
  id: string;
  type: "press_release" | "news";
  title: string;
  summary: string | null;
  source: string;
  url: string;
  publishedAt: Date | null;
}

interface ClaudeRanking {
  id: string;
  score: number;
  whyItMatters: string;
}

function buildRankingPrompt(
  profile: {
    clientName: string;
    industries: string[];
    watchlistTopics: string[];
    relevantAgencies: string[];
    relevantCommittees: string[];
  },
  items: InputItem[],
): { system: string; user: string } {
  const system = `You are a government affairs analyst scoring news items and press releases for client relevance.

Return ONLY a valid JSON array. No markdown fences, no preamble, no explanation.

Include ONLY items scoring 40 or higher (omit the rest entirely), as:
{
  "i": <item number as shown in brackets>,
  "score": <integer 40-100>,
  "why": "<ONE short sentence, max 20 words, on why this matters to the client>"
}

Scoring guide:
- 70-100: Actionable development on the client's agencies, topics, or committees — funding decisions, rule changes, votes, hearings, enforcement, major legislation. Naming a relevant agency is NOT enough on its own.
- 40-69: Adjacent topic, loosely related agency, or background context worth tracking.
- Below 40: omit from the array.
- Routine administrative notices (OMB information-collection/paperwork notices, form renewals, comment-period housekeeping, routine meeting announcements) score at most 45 even when they name the client's agencies.

Keep the output small: at most 15 entries, ranked by relevance.`;

  const clientBlock = `CLIENT: ${profile.clientName}
Industries: ${profile.industries.join(", ")}
Watchlist topics: ${profile.watchlistTopics.join(", ")}
Relevant agencies: ${profile.relevantAgencies.join(", ")}
Relevant committees: ${profile.relevantCommittees.join(", ")}`;

  const itemsBlock = items
    .map((item, i) => {
      const summary = item.summary?.slice(0, 220) ?? "(no summary)";
      return `[${i + 1}] (${item.source}) ${item.title} — ${summary}`;
    })
    .join("\n");

  const user = `${clientBlock}

Score each of the following ${items.length} items for relevance to this client:

${itemsBlock}`;

  return { system, user };
}

async function callClaudeForRanking(
  system: string,
  user: string,
  items: InputItem[],
): Promise<ClaudeRanking[]> {
  const client = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined,
  });

  // Compact output format ({i, score, why}, relevant items only) keeps the
  // response small enough to finish well inside proxy timeouts. 16k-token
  // UUID-echoing responses were taking 1-2 minutes and getting killed at the
  // proxy (~100s), which the UI experienced as an endless loading skeleton.
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: user }],
  });

  const raw = message.content.find((b) => b.type === "text")?.text ?? "";
  const jsonText = raw
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Claude returned non-JSON: ${raw.slice(0, 300)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Claude response was not an array: ${jsonText.slice(0, 200)}`);
  }

  // Map 1-based item indexes back to item IDs; drop anything out of range.
  return (parsed as any[])
    .map((entry) => {
      const idx = Number(entry.i ?? entry.index ?? 0) - 1;
      const item = items[idx];
      if (!item) return null;
      return {
        id: item.id,
        score: Number(entry.score ?? 0),
        whyItMatters: String(entry.why ?? entry.whyItMatters ?? ""),
      };
    })
    .filter((r): r is ClaudeRanking => r !== null);
}

// ─── "Who to focus on" lookup ─────────────────────────────────────────────────

async function findRelevantStaffers(
  committees: string[],
  itemTitle: string,
): Promise<FocusPerson[]> {
  if (committees.length === 0) return [];

  // Build ilike conditions: match currentOffice against each committee keyword
  // Also try matching on the item title words against careerResearch/currentOffice
  const titleWords = itemTitle
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 5);

  const committeeConditions = committees.map((c) =>
    ilike(legistormStaffers.currentOffice, `%${c}%`),
  );

  const titleConditions = titleWords.map((w) =>
    or(
      ilike(legistormStaffers.currentOffice, `%${w}%`),
      ilike(legistormStaffers.currentTitle, `%${w}%`),
    ),
  );

  const allConditions = [...committeeConditions, ...titleConditions].filter(
    Boolean,
  );

  if (allConditions.length === 0) return [];

  const rows = await db
    .select({
      fullName: legistormStaffers.fullName,
      currentTitle: legistormStaffers.currentTitle,
      currentOffice: legistormStaffers.currentOffice,
      currentMemberName: legistormStaffers.currentMemberName,
    })
    .from(legistormStaffers)
    .where(
      and(
        eq(legistormStaffers.isCurrentStaff, true),
        or(...allConditions),
      ),
    )
    .limit(3);

  return rows.map((r) => ({
    name: r.fullName,
    title: r.currentTitle ?? "",
    office: r.currentOffice ?? r.currentMemberName ?? "",
  }));
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function rankItemsForClient(clientId: string): Promise<RankedBriefResult> {
  const cached = getCached(clientId);
  if (cached) return cached;

  const profile = await getClientProfile(clientId);
  if (!profile) {
    throw new Error(`No client_profiles row found for clientId: ${clientId}`);
  }

  // Try 48h window first; expand to 7 days if fewer than 5 items
  let windowHours = 48;
  let { pressReleases, articles } = await fetchRecentItems(clientId, windowHours);

  if (pressReleases.length + articles.length < 5) {
    windowHours = 168; // 7 days
    ({ pressReleases, articles } = await fetchRecentItems(clientId, windowHours));
  }

  // Combine into a flat list
  const inputItems: InputItem[] = [
    ...pressReleases.map((pr) => ({
      id: pr.id,
      type: "press_release" as const,
      title: pr.title,
      summary: pr.summary,
      source: pr.departmentSlug.toUpperCase(),
      url: pr.url,
      publishedAt: pr.publishedAt,
    })),
    ...articles.map((a) => ({
      id: a.id,
      type: "news" as const,
      title: a.title,
      summary: a.summary,
      source: a.source ?? "News",
      url: a.url ?? "",
      publishedAt: a.publishedAt,
    })),
  ];

  if (inputItems.length === 0) {
    const empty: RankedBriefResult = {
      clientId,
      clientName: profile.clientName,
      industries: profile.industries ?? [],
      watchlistTopics: profile.watchlistTopics ?? [],
      highRelevance: [],
      worthWatching: [],
      generatedAt: new Date().toISOString(),
      scoringMetadata: {
        totalItemsConsidered: 0,
        highRelevanceCount: 0,
        worthWatchingCount: 0,
        ignoredCount: 0,
        claudeCallsMadeThisRender: 0,
        windowUsedHours: windowHours,
      },
    };
    cache.set(clientId, { result: empty, cachedAt: Date.now() });
    return empty;
  }

  // Single Claude call to score all items.
  // Cap the batch so the prompt stays bounded (and can't blow past rate limits
  // or silently truncate the JSON ranking output as the corpus grows).
  const MAX_ITEMS_PER_RENDER = 40;
  if (inputItems.length > MAX_ITEMS_PER_RENDER) {
    console.log(`[morning-brief] ${clientId}: capping ${inputItems.length} items to ${MAX_ITEMS_PER_RENDER}`);
    inputItems.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
    inputItems.length = MAX_ITEMS_PER_RENDER;
  }

  const { system, user } = buildRankingPrompt(profile, inputItems);
  console.log(`[morning-brief] ${clientId}: ranking ${inputItems.length} items (window ${windowHours}h)...`);
  const rankStart = Date.now();
  let rankings: ClaudeRanking[];
  try {
    rankings = await callClaudeForRanking(system, user, inputItems);
    console.log(`[morning-brief] ${clientId}: Claude ranked ${rankings.length} items in ${Date.now() - rankStart}ms`);
  } catch (err: any) {
    console.error(`[morning-brief] ${clientId}: Claude ranking FAILED after ${Date.now() - rankStart}ms:`, err?.message || err);
    throw err;
  }
  const claudeCallsMadeThisRender = 1;

  // Build a lookup map from rankings
  const rankMap = new Map<string, ClaudeRanking>();
  for (const r of rankings) {
    rankMap.set(r.id, r);
  }

  // Attach scores back to items, filter out any unranked
  const scored = inputItems.map((item) => {
    const r = rankMap.get(item.id);
    return {
      ...item,
      score: r?.score ?? 0,
      whyItMatters: r?.whyItMatters ?? "",
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Bucket into high/worth-watching
  let highRelevanceRaw = scored.filter((i) => i.score >= 70);
  let worthWatchingRaw = scored.filter((i) => i.score >= 40 && i.score < 70);

  // Fallback: if high-relevance empty, take top 3 regardless of score
  if (highRelevanceRaw.length === 0 && scored.length > 0) {
    highRelevanceRaw = scored.slice(0, 3);
    worthWatchingRaw = scored.slice(3).filter((i) => i.score >= 40 && i.score < 70);
  }

  // Cap sizes
  const highRelevanceCapped = highRelevanceRaw.slice(0, 5);
  const worthWatchingCapped = worthWatchingRaw.slice(0, 10);

  // "Who to focus on" for high-relevance items only
  const highRelevance: RankedItem[] = await Promise.all(
    highRelevanceCapped.map(async (item) => ({
      ...item,
      whoToFocusOn: await findRelevantStaffers(
        profile.relevantCommittees,
        item.title,
      ),
    })),
  );

  const worthWatching: RankedItem[] = worthWatchingCapped.map((item) => ({
    ...item,
    whoToFocusOn: [],
  }));

  const result: RankedBriefResult = {
    clientId,
    clientName: profile.clientName,
    industries: profile.industries,
    watchlistTopics: profile.watchlistTopics,
    highRelevance,
    worthWatching,
    generatedAt: new Date().toISOString(),
    scoringMetadata: {
      totalItemsConsidered: inputItems.length,
      highRelevanceCount: highRelevance.length,
      worthWatchingCount: worthWatching.length,
      ignoredCount: inputItems.length - highRelevance.length - worthWatching.length,
      claudeCallsMadeThisRender,
      windowUsedHours: windowHours,
    },
  };

  cache.set(clientId, { result, cachedAt: Date.now() });
  return result;
}

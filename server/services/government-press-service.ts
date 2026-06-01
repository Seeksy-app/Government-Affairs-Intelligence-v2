import { createHash } from "crypto";
import Parser from "rss-parser";
import { db } from "../db";
import {
  governmentPressSources,
  governmentPressReleases,
  governmentPressSyncRuns,
  type GovernmentPressSource,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

// GOV_PRESS_USER_AGENT allows overriding the RSS fetch User-Agent.
// Some .gov CDNs (Akamai) block default Node.js fetch UAs but allow
// identified RSS reader bots. Set in .env — defaults to NewsBlur string
// which is known to work for dol.gov.
const RSS_USER_AGENT =
  process.env.GOV_PRESS_USER_AGENT ??
  "NewsBlur Feed Fetcher - 1 subscriber (http://www.newsblur.com/)";

const rssParser = new Parser({
  timeout: 15_000,
  headers: { "User-Agent": RSS_USER_AGENT },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedRelease {
  title: string;
  url: string;
  publishedAt: Date | null;
  summary: string | null;
  fullText: string | null;
  rawMetadata: Record<string, unknown> | null;
}

export interface SyncSummary {
  departmentSlug: string;
  status: "success" | "error" | "partial";
  releasesFound: number;
  releasesInserted: number;
  releasesUpdated: number;
  error?: string;
}

// ─── Hash ─────────────────────────────────────────────────────────────────────

export function generateContentHash(title: string, url: string, publishedAt: string | null): string {
  return createHash("sha256")
    .update(`${title}|${url}|${publishedAt ?? ""}`)
    .digest("hex");
}

// ─── Data access ──────────────────────────────────────────────────────────────

export async function loadActiveSources(departmentSlug?: string): Promise<GovernmentPressSource[]> {
  if (departmentSlug) {
    return db
      .select()
      .from(governmentPressSources)
      .where(
        and(
          eq(governmentPressSources.departmentSlug, departmentSlug),
          eq(governmentPressSources.isActive, true),
        ),
      );
  }
  return db
    .select()
    .from(governmentPressSources)
    .where(eq(governmentPressSources.isActive, true));
}

// ─── RSS parser ───────────────────────────────────────────────────────────────

export async function parseRss(source: GovernmentPressSource): Promise<ParsedRelease[]> {
  const feed = await rssParser.parseURL(source.feedUrl);
  return (feed.items ?? []).map((item) => ({
    title: item.title?.trim() ?? "(no title)",
    url: item.link?.trim() ?? item.guid?.trim() ?? "",
    publishedAt: item.pubDate ? new Date(item.pubDate) : item.isoDate ? new Date(item.isoDate) : null,
    summary: item.contentSnippet?.trim() ?? item.content?.trim() ?? null,
    fullText: item.content?.trim() ?? null,
    rawMetadata: {
      guid: item.guid,
      categories: item.categories,
      author: item.creator,
    },
  }));
}

// ─── HTML parsers ─────────────────────────────────────────────────────────────

export async function parseHtml(source: GovernmentPressSource): Promise<ParsedRelease[]> {
  const { departmentSlug } = source;
  if (departmentSlug === "treasury") {
    const { parseTreasury } = await import("./press-parsers/treasury");
    return parseTreasury(source.feedUrl);
  }
  if (departmentSlug === "dhs") {
    const { parseDhs } = await import("./press-parsers/dhs");
    return parseDhs(source.feedUrl);
  }
  return [];
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function fetchSource(source: GovernmentPressSource): Promise<ParsedRelease[]> {
  if (source.fetchType === "rss") {
    return parseRss(source);
  }
  return parseHtml(source);
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

export async function upsertRelease(
  source: GovernmentPressSource,
  release: ParsedRelease,
): Promise<"inserted" | "updated" | "skipped"> {
  if (!release.url) return "skipped";

  const contentHash = generateContentHash(
    release.title,
    release.url,
    release.publishedAt?.toISOString() ?? null,
  );

  const [existing] = await db
    .select({ id: governmentPressReleases.id, contentHash: governmentPressReleases.contentHash })
    .from(governmentPressReleases)
    .where(eq(governmentPressReleases.url, release.url))
    .limit(1);

  if (existing) {
    if (existing.contentHash === contentHash) return "skipped";
    await db
      .update(governmentPressReleases)
      .set({
        title: release.title,
        contentHash,
        publishedAt: release.publishedAt,
        summary: release.summary,
        fullText: release.fullText,
        rawMetadata: release.rawMetadata,
        updatedAt: new Date(),
      })
      .where(eq(governmentPressReleases.id, existing.id));
    return "updated";
  }

  await db.insert(governmentPressReleases).values({
    sourceId: source.id,
    departmentSlug: source.departmentSlug,
    title: release.title,
    url: release.url,
    contentHash,
    publishedAt: release.publishedAt,
    summary: release.summary,
    fullText: release.fullText,
    rawMetadata: release.rawMetadata,
  });
  return "inserted";
}

// ─── Sync one source ──────────────────────────────────────────────────────────

export async function syncSource(source: GovernmentPressSource): Promise<SyncSummary> {
  const [run] = await db
    .insert(governmentPressSyncRuns)
    .values({
      sourceId: source.id,
      departmentSlug: source.departmentSlug,
      status: "running",
    })
    .returning();

  let releasesFound = 0;
  let releasesInserted = 0;
  let releasesUpdated = 0;
  let status: SyncSummary["status"] = "success";
  let errorMessage: string | undefined;

  try {
    const releases = await fetchSource(source);
    releasesFound = releases.length;

    for (const release of releases) {
      const result = await upsertRelease(source, release);
      if (result === "inserted") releasesInserted++;
      else if (result === "updated") releasesUpdated++;
    }
  } catch (err: any) {
    status = "error";
    errorMessage = err.message ?? String(err);
  }

  if (status === "success" && releasesFound === 0 && source.fetchType === "html") {
    status = "partial";
    errorMessage = `No HTML parser implemented for ${source.departmentSlug}`;
  }

  await db
    .update(governmentPressSyncRuns)
    .set({
      status,
      releasesFound,
      releasesInserted,
      releasesUpdated,
      errorMessage: errorMessage ?? null,
      completedAt: new Date(),
    })
    .where(eq(governmentPressSyncRuns.id, run.id));

  await db
    .update(governmentPressSources)
    .set({
      lastSyncedAt: new Date(),
      lastSyncStatus: status,
      lastSyncError: errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(governmentPressSources.id, source.id));

  return {
    departmentSlug: source.departmentSlug,
    status,
    releasesFound,
    releasesInserted,
    releasesUpdated,
    error: errorMessage,
  };
}

// ─── Sync all (or one) ────────────────────────────────────────────────────────

export async function syncAllSources(departmentSlug?: string): Promise<SyncSummary[]> {
  const sources = await loadActiveSources(departmentSlug);
  const results: SyncSummary[] = [];
  for (const source of sources) {
    results.push(await syncSource(source));
  }
  return results;
}

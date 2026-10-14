import { and, count, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { briefs, clientProfiles, governmentPressReleases, newsArticles } from "@shared/schema";
import { agencySlugsFor } from "./government-press-service";

// One definition of "new" for the top-bar badges and the "New since you last
// looked" strips, so the number and the list always agree: arrived today
// (Eastern) and after the browser's last visit to that page.
export type Feed = "news" | "press" | "questions";
export const FEEDS: Feed[] = ["news", "press", "questions"];

export interface FeedItem {
  id: string;
  title: string;
  url: string | null;
  meta: string | null;
  at: Date | null;
}

async function easternMidnight(): Promise<Date> {
  const [{ since }] = (await db.execute(
    sql`select (date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York') as since`,
  )).rows as Array<{ since: Date }>;
  return new Date(since);
}

// The later of midnight and the last visit; junk or future values are ignored.
function cutoff(lastVisit: unknown, midnight: Date): Date {
  const v = typeof lastVisit === "string" ? new Date(lastVisit) : null;
  return v && !isNaN(v.getTime()) && v > midnight && v <= new Date() ? v : midnight;
}

function conditions(clientId: string, feed: Feed, since: Date, midnight: Date, slugs: string[]) {
  switch (feed) {
    case "news":
      return and(eq(newsArticles.clientId, clientId), gt(newsArticles.createdAt, since), gte(newsArticles.relevanceScore, 50));
    case "press":
      // Collected since the last visit decides "new" (some agencies publish
      // date-only times). The publish-date floor keeps a source's backfill of
      // old releases out; a day's slack covers date-only values stored as UTC
      // midnight, which falls on the previous Eastern evening.
      return and(
        gt(governmentPressReleases.createdAt, since),
        gte(governmentPressReleases.publishedAt, new Date(midnight.getTime() - 24 * 60 * 60 * 1000)),
        ...(slugs.length > 0 ? [inArray(governmentPressReleases.departmentSlug, slugs)] : []),
      );
    case "questions":
      return and(eq(briefs.clientId, clientId), gt(briefs.generatedAt, since));
  }
}

async function firmSlugs(clientId: string): Promise<string[]> {
  const [profile] = await db.select().from(clientProfiles).where(eq(clientProfiles.clientId, clientId)).limit(1);
  return agencySlugsFor(profile?.relevantAgencies ?? []);
}

export async function feedCounts(clientId: string, lastVisits: Record<string, unknown>): Promise<Record<Feed, number>> {
  const [midnight, slugs] = await Promise.all([easternMidnight(), firmSlugs(clientId)]);
  const where = (f: Feed) => conditions(clientId, f, cutoff(lastVisits[f], midnight), midnight, slugs);
  const [[news], [press], [questions]] = await Promise.all([
    db.select({ n: count() }).from(newsArticles).where(where("news")),
    db.select({ n: count() }).from(governmentPressReleases).where(where("press")),
    db.select({ n: count() }).from(briefs).where(where("questions")),
  ]);
  return { news: news.n, press: press.n, questions: questions.n };
}

export async function feedItems(clientId: string, feed: "news" | "press", lastVisit: unknown): Promise<FeedItem[]> {
  const [midnight, slugs] = await Promise.all([easternMidnight(), firmSlugs(clientId)]);
  const where = conditions(clientId, feed, cutoff(lastVisit, midnight), midnight, slugs);
  if (feed === "news") {
    return db
      .select({ id: newsArticles.id, title: newsArticles.title, url: newsArticles.url, meta: newsArticles.source, at: newsArticles.createdAt })
      .from(newsArticles)
      .where(where)
      .orderBy(desc(newsArticles.relevanceScore), desc(newsArticles.createdAt))
      .limit(50);
  }
  return db
    .select({
      id: governmentPressReleases.id,
      title: governmentPressReleases.title,
      url: governmentPressReleases.url,
      meta: governmentPressReleases.departmentSlug,
      at: governmentPressReleases.createdAt,
    })
    .from(governmentPressReleases)
    .where(where)
    .orderBy(desc(governmentPressReleases.createdAt))
    .limit(50);
}

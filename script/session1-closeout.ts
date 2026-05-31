/**
 * Session 1 close-out:
 *   1. Upsert NIST source (confirmed RSS, is_active=true)
 *   2. Sync NIST — confirm ≥5 press releases land
 *   3. Set is_active=false for 6 blocked agencies with reason in last_sync_error
 *
 * Run: node --env-file=.env --import tsx/esm script/session1-closeout.ts
 *   or: npx tsx script/session1-closeout.ts  (if .env auto-loads)
 */
import { db } from "../server/db";
import { governmentPressSources, governmentPressReleases } from "../shared/schema";
import { syncSource } from "../server/services/government-press-service";
import { sql, eq } from "drizzle-orm";

// ── 1. Upsert NIST ──────────────────────────────────────────────────────────

const NIST = {
  departmentSlug: "nist",
  departmentName: "National Institute of Standards and Technology",
  feedUrl: "https://www.nist.gov/news-events/news/rss.xml",
  fetchType: "rss" as const,
  isActive: true,
};

// ── 2. Agencies to deactivate with block reasons ────────────────────────────

const BLOCKED = [
  {
    slug: "epa",
    reason:
      "No RSS feed exists on epa.gov. All /rss/* and /feed/* paths return 404. " +
      "Newsroom page (epa.gov/newsroom/browse-news-releases) returns HTML 200 " +
      "but requires a Session 2 HTML parser. Not UA-bypassable.",
  },
  {
    slug: "commerce",
    reason:
      "commerce.gov returns 403 (Cloudflare block). No main-site RSS found. " +
      "Sub-agency NIST feed (nist.gov/news-events/news/rss.xml) seeded separately. " +
      "NOAA feed paths (noaa.gov/media-releases/rss.xml, /news/rss.xml) return 404.",
  },
  {
    slug: "doe",
    reason:
      "energy.gov/rss.xml returns HTTP 200 but contains historical/archival content " +
      "(timelines, secretary bios), not press releases. All newsroom-specific RSS paths " +
      "(/newsroom/rss.xml, /news/feed) return 404. Requires Session 2 HTML parser.",
  },
  {
    slug: "treasury",
    reason:
      "home.treasury.gov/news/press-releases is HTML-only. No RSS feed confirmed. " +
      "Requires Session 2 HTML parser.",
  },
  {
    slug: "doj",
    reason:
      "justice.gov/news/press-releases is HTML-only. No RSS feed confirmed. " +
      "Requires Session 2 HTML parser.",
  },
  {
    slug: "dot",
    reason:
      "transportation.gov/newsroom/press-releases is HTML-only. No RSS feed confirmed. " +
      "Requires Session 2 HTML parser.",
  },
  {
    slug: "dhs",
    reason:
      "dhs.gov/news-releases/press-releases is HTML-only. No RSS feed confirmed. " +
      "Requires Session 2 HTML parser.",
  },
];

async function main() {
  // 1. Upsert NIST
  console.log("Upserting NIST source...");
  await db
    .insert(governmentPressSources)
    .values(NIST)
    .onConflictDoUpdate({
      target: governmentPressSources.departmentSlug,
      set: {
        departmentName: sql`excluded.department_name`,
        feedUrl: sql`excluded.feed_url`,
        fetchType: sql`excluded.fetch_type`,
        isActive: true,
        updatedAt: new Date(),
      },
    });
  console.log("  ✓ NIST upserted");

  // 2. Sync NIST
  console.log("Syncing NIST...");
  const [nistSource] = await db
    .select()
    .from(governmentPressSources)
    .where(eq(governmentPressSources.departmentSlug, "nist"))
    .limit(1);

  const summary = await syncSource(nistSource);
  console.log(`  ✓ Sync result: ${JSON.stringify(summary)}`);

  if (summary.releasesInserted < 5) {
    console.error(`  ✗ Only ${summary.releasesInserted} releases inserted — expected ≥5`);
    process.exit(1);
  }

  // 3. Deactivate blocked sources
  console.log("Deactivating blocked sources...");
  for (const { slug, reason } of BLOCKED) {
    const result = await db
      .update(governmentPressSources)
      .set({
        isActive: false,
        lastSyncError: reason,
        updatedAt: new Date(),
      })
      .where(eq(governmentPressSources.departmentSlug, slug))
      .returning({ slug: governmentPressSources.departmentSlug });

    if (result.length === 0) {
      console.log(`  ⚠  ${slug} — not found in DB (may not be seeded yet), skipping`);
    } else {
      console.log(`  ✓ ${slug} → is_active=false`);
    }
  }

  // 4. Final counts
  console.log("\nFinal press release counts:");
  const counts = await db
    .select({
      dept: governmentPressReleases.departmentSlug,
      count: sql<number>`count(*)::int`,
    })
    .from(governmentPressReleases)
    .groupBy(governmentPressReleases.departmentSlug);
  console.log(JSON.stringify(counts, null, 2));

  console.log("\nSource status:");
  const sources = await db
    .select({
      slug: governmentPressSources.departmentSlug,
      active: governmentPressSources.isActive,
      type: governmentPressSources.fetchType,
      status: governmentPressSources.lastSyncStatus,
      error: governmentPressSources.lastSyncError,
    })
    .from(governmentPressSources)
    .orderBy(governmentPressSources.departmentSlug);
  for (const s of sources) {
    const syncResult = s.active
      ? `working (${s.status})`
      : s.error?.includes("Session 2")
        ? "deferred"
        : "blocked";
    console.log(`  ${s.slug.padEnd(10)} active=${String(s.active).padEnd(5)} type=${s.type.padEnd(4)} → ${syncResult}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

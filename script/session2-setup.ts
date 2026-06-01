/**
 * Session 2 setup:
 *   1. Activate treasury + dhs (set is_active=true, clear last_sync_error)
 *   2. Set block_reason on doj + dot (confirmed bot-blocked in Session 2 investigation)
 *      - DOJ: justice.gov returns Akamai JavaScript interstitial challenge for all UAs
 *      - DOT: transportation.gov/newsroom/press-releases returns 403 for all UAs
 *   3. Migrate existing block notes: copy last_sync_error → block_reason for epa/commerce/doe
 *      (those were set in session1-closeout; clear last_sync_error so it's not stale)
 *   4. Run initial sync for treasury + dhs
 *   5. Print final counts
 *
 * Run: node --env-file=.env --import tsx/esm script/session2-setup.ts
 */
import { db } from "../server/db";
import { governmentPressSources, governmentPressReleases } from "../shared/schema";
import { syncSource } from "../server/services/government-press-service";
import { eq, sql, inArray } from "drizzle-orm";

async function main() {
  // 1. Activate treasury + dhs
  console.log("Activating treasury and dhs sources...");
  for (const slug of ["treasury", "dhs"] as const) {
    await db
      .update(governmentPressSources)
      .set({ isActive: true, lastSyncError: null, blockReason: null, updatedAt: new Date() })
      .where(eq(governmentPressSources.departmentSlug, slug));
    console.log(`  ✓ ${slug} → is_active=true`);
  }

  // 2. Mark doj + dot as permanently blocked
  const BOT_BLOCKED = [
    {
      slug: "doj",
      reason:
        "justice.gov/news/press-releases returns an Akamai JavaScript interstitial challenge " +
        "for all tested User-Agents (NewsBlur, Googlebot, curl default). Requires a real browser " +
        "session with JS execution. No RSS feed exists at any confirmed path.",
    },
    {
      slug: "dot",
      reason:
        "transportation.gov/newsroom/press-releases returns HTTP 403 for all tested User-Agents. " +
        "Akamai CDN blocks server-side fetches. No public RSS feed confirmed.",
    },
  ];
  console.log("Setting block_reason on doj and dot...");
  for (const { slug, reason } of BOT_BLOCKED) {
    await db
      .update(governmentPressSources)
      .set({ isActive: false, blockReason: reason, lastSyncError: null, updatedAt: new Date() })
      .where(eq(governmentPressSources.departmentSlug, slug));
    console.log(`  ✓ ${slug} → block_reason set`);
  }

  // 3. Migrate existing block notes from last_sync_error → block_reason for epa/commerce/doe
  console.log("Migrating block notes from last_sync_error → block_reason for epa/commerce/doe...");
  const deferred = await db
    .select()
    .from(governmentPressSources)
    .where(inArray(governmentPressSources.departmentSlug, ["epa", "commerce", "doe"]));
  for (const source of deferred) {
    if (source.lastSyncError && !source.blockReason) {
      await db
        .update(governmentPressSources)
        .set({ blockReason: source.lastSyncError, lastSyncError: null, updatedAt: new Date() })
        .where(eq(governmentPressSources.id, source.id));
      console.log(`  ✓ ${source.departmentSlug} → migrated`);
    }
  }

  // 4. Sync treasury + dhs
  console.log("\nSyncing treasury...");
  const [treasurySource] = await db
    .select()
    .from(governmentPressSources)
    .where(eq(governmentPressSources.departmentSlug, "treasury"))
    .limit(1);
  const treasurySummary = await syncSource(treasurySource);
  console.log(`  treasury: ${JSON.stringify(treasurySummary)}`);

  console.log("Syncing dhs...");
  const [dhsSource] = await db
    .select()
    .from(governmentPressSources)
    .where(eq(governmentPressSources.departmentSlug, "dhs"))
    .limit(1);
  const dhsSummary = await syncSource(dhsSource);
  console.log(`  dhs: ${JSON.stringify(dhsSummary)}`);

  // 5. Final counts
  console.log("\nFinal press release counts by department:");
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
    .select()
    .from(governmentPressSources)
    .orderBy(governmentPressSources.departmentSlug);
  for (const s of sources) {
    const state = s.isActive ? "ACTIVE" : s.blockReason ? "BLOCKED" : "inactive";
    console.log(`  ${s.departmentSlug.padEnd(10)} ${state.padEnd(8)} type=${s.fetchType.padEnd(4)} status=${s.lastSyncStatus ?? "never"}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

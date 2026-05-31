/**
 * Seeds government_press_sources with the 8 initial agencies.
 * Run: npx tsx script/seed-press-sources.ts
 */
import { db } from "../server/db";
import { governmentPressSources } from "../shared/schema";
import { sql } from "drizzle-orm";

// ── Feed investigation notes (Session 1, 2026-05-31) ──────────────────────
//
// DOL: dol.gov/rss/releases.xml → HTTP 200, valid RSS, 10 items ingested.
//   Works with NewsBlur User-Agent (GOV_PRESS_USER_AGENT env var).
//
// NIST (Commerce sub-agency): nist.gov/news-events/news/rss.xml → HTTP 200,
//   valid RSS, 40 items ingested. Seeded separately as 'nist' slug.
//   commerce.gov main site → 403 (Cloudflare). NOAA RSS paths tried:
//   noaa.gov/media-releases/rss.xml and /news/rss.xml → both 404.
//   Commerce main slug left as html/is_active=false placeholder.
//
// EPA: all RSS paths tried → 404 (epa.gov/rss/newsreleases.xml,
//   /feed/news-releases/rss.xml, /rss/news.xml, /rss/pressreleases.xml,
//   /feeds/news, GovDelivery). Newsroom HTML page accessible at
//   epa.gov/newsroom/browse-news-releases (200, 69 KB).
//   Session 2: build HTML parser for the newsroom listing page.
//
// DOE: energy.gov/rss.xml → HTTP 200 but content is historical/archival
//   (timelines, secretary bios) — not press releases. All newsroom-specific
//   paths (/newsroom/rss.xml, /news/feed) return 404.
//   Session 2: build HTML parser for energy.gov/newsroom.
//
// Treasury, DOJ, DOT, DHS: HTML-only newsrooms, no RSS feed confirmed.
//   Session 2: each needs a bespoke HTML parser.
//   Alternatives to investigate: GovDelivery email digests, api.regulations.gov
//   for Treasury/DOJ, data.transportation.gov for DOT.
// ──────────────────────────────────────────────────────────────────────────

const SOURCES = [
  {
    departmentSlug: "dol",
    departmentName: "Department of Labor",
    feedUrl: "https://www.dol.gov/rss/releases.xml",
    fetchType: "rss",
  },
  {
    departmentSlug: "epa",
    departmentName: "Environmental Protection Agency",
    // No RSS. HTML newsroom at epa.gov/newsroom/browse-news-releases is accessible.
    // Session 2: HTML parser.
    feedUrl: "https://www.epa.gov/newsroom/browse-news-releases",
    fetchType: "html",
  },
  {
    departmentSlug: "commerce",
    departmentName: "Department of Commerce",
    // commerce.gov → 403 (Cloudflare). NIST sub-agency RSS seeded separately.
    // NOAA paths tried, both 404. Session 2: NOAA govdelivery or HTML scrape.
    feedUrl: "https://www.commerce.gov/news/press-releases",
    fetchType: "html",
  },
  {
    departmentSlug: "doe",
    departmentName: "Department of Energy",
    // energy.gov/rss.xml is archival content, not press releases.
    // No newsroom-specific RSS found. Session 2: HTML parser for energy.gov/newsroom.
    feedUrl: "https://www.energy.gov/newsroom",
    fetchType: "html",
  },
  {
    departmentSlug: "treasury",
    departmentName: "Department of the Treasury",
    feedUrl: "https://home.treasury.gov/news/press-releases",
    fetchType: "html",
  },
  {
    departmentSlug: "doj",
    departmentName: "Department of Justice",
    feedUrl: "https://www.justice.gov/news/press-releases",
    fetchType: "html",
  },
  {
    departmentSlug: "dot",
    departmentName: "Department of Transportation",
    feedUrl: "https://www.transportation.gov/newsroom/press-releases",
    fetchType: "html",
  },
  {
    departmentSlug: "dhs",
    departmentName: "Department of Homeland Security",
    feedUrl: "https://www.dhs.gov/news-releases/press-releases",
    fetchType: "html",
  },
] as const;

async function main() {
  console.log("Seeding government_press_sources...");
  for (const source of SOURCES) {
    await db
      .insert(governmentPressSources)
      .values(source)
      .onConflictDoUpdate({
        target: governmentPressSources.departmentSlug,
        set: {
          departmentName: sql`excluded.department_name`,
          feedUrl: sql`excluded.feed_url`,
          fetchType: sql`excluded.fetch_type`,
          updatedAt: new Date(),
        },
      });
    console.log(`  ✓ ${source.departmentSlug} (${source.fetchType})`);
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

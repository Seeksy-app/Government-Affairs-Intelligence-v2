import Parser from "rss-parser";
import axios from "axios";
import { db } from "../db";
import { rssFeeds, newsArticles, clientProfiles } from "@shared/schema";
import { and, eq, desc, gte, inArray, sql } from "drizzle-orm";

interface AggregatedArticle {
  externalId: string;
  title: string;
  summary: string;
  content?: string;
  url: string;
  source: string;
  sourceName: string;
  author?: string;
  publishedAt: Date;
  category: string;
  imageUrl?: string;
  rssFeedId?: string;
}

// Default RSS feeds - comprehensive list for political intelligence
const defaultRssFeeds = [
  // TIER 1: Essential Political News
  { name: "Politico", feedUrl: "https://rss.politico.com/congress.xml", category: "politics", tier: 1 },
  { name: "The Hill", feedUrl: "https://thehill.com/feed/", category: "politics", tier: 1 },
  { name: "Roll Call", feedUrl: "https://www.rollcall.com/feed/", category: "legislative", tier: 1 },
  
  // TIER 2: Defense & Military
  { name: "Department of Defense", feedUrl: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945", category: "defense", tier: 2 },
  { name: "Military Times", feedUrl: "https://www.militarytimes.com/arc/outboundfeeds/rss/", category: "defense", tier: 2 },
  { name: "Defense News", feedUrl: "https://www.defensenews.com/arc/outboundfeeds/rss/", category: "defense", tier: 2 },
  
  // TIER 3: Think Tanks & Policy
  { name: "Brookings Institution", feedUrl: "https://www.brookings.edu/topic/politics-government/feed/", category: "policy", tier: 3 },
  { name: "CSIS", feedUrl: "https://www.csis.org/analysis/feed", category: "policy", tier: 3 },
  { name: "Heritage Foundation", feedUrl: "https://www.heritage.org/rss/all-research.xml", category: "policy", tier: 3 },
  
  // TIER 4: Federal Agencies
  { name: "White House", feedUrl: "https://www.whitehouse.gov/news/feed/", category: "politics", tier: 4 },
  { name: "Federal News Network", feedUrl: "https://federalnewsnetwork.com/feed/", category: "politics", tier: 4 },
  { name: "VA News", feedUrl: "https://news.va.gov/feed/", category: "defense", tier: 4 },
  
  // TIER 5: Specialized
  { name: "Task & Purpose", feedUrl: "https://taskandpurpose.com/feed/", category: "defense", tier: 5 },
  { name: "AP Politics", feedUrl: "https://rss.app/feeds/p6tKgOOzqpQnkKlW.xml", category: "politics", tier: 5 },
  { name: "Reuters Politics", feedUrl: "https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best", category: "politics", tier: 5 },
];

const parser = new Parser({
  timeout: 15000,
  customFields: {
    item: [
      ["media:content", "media"],
      ["media:thumbnail", "thumbnail"],
      ["content:encoded", "contentEncoded"],
      ["dc:creator", "dcCreator"],
    ],
  },
});

function categorizeArticle(title: string, description?: string): string {
  const text = `${title} ${description || ""}`.toLowerCase();
  
  if (text.match(/white house|president|executive order|administration|biden|trump/)) {
    return "executive";
  }
  if (text.match(/bill|legislation|congress|senate|house|vote|amendment|committee|hearing/)) {
    return "legislation";
  }
  if (text.match(/campaign|election|candidate|poll|primary|midterm/)) {
    return "campaign";
  }
  if (text.match(/pentagon|military|defense|army|navy|air force|marine|veteran/)) {
    return "defense";
  }
  return "policy";
}

function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function normalizeSourceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50);
}

// Initialize RSS feeds in database if not exists
export async function initializeRssFeeds(): Promise<void> {
  const existingFeeds = await db.select().from(rssFeeds);
  
  if (existingFeeds.length === 0) {
    console.log("Initializing default RSS feeds...");
    for (const feed of defaultRssFeeds) {
      try {
        await db.insert(rssFeeds).values({
          name: feed.name,
          feedUrl: feed.feedUrl,
          category: feed.category,
          tier: feed.tier,
          isActive: true,
        });
      } catch (error: any) {
        console.error(`Error adding feed ${feed.name}:`, error.message);
      }
    }
    console.log(`Initialized ${defaultRssFeeds.length} RSS feeds`);
  }
}

// Fetch articles from a single RSS feed
export async function fetchSingleRssFeed(
  feedUrl: string,
  sourceName: string,
  rssFeedId?: string,
  hoursBack: number = 168 // 7 days
): Promise<AggregatedArticle[]> {
  const articles: AggregatedArticle[] = [];
  const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  
  try {
    const feed = await parser.parseURL(feedUrl);
    
    for (const item of feed.items || []) {
      const pubDate = new Date(item.pubDate || item.isoDate || new Date());
      
      if (pubDate >= cutoffDate && item.title && item.link) {
        const itemAny = item as any;
        
        // Extract content from multiple possible fields
        let content = "";
        if (itemAny.contentEncoded) {
          content = cleanText(itemAny.contentEncoded);
        } else if (item.content) {
          content = cleanText(item.content);
        }
        
        // Extract image URL from multiple possible fields
        let imageUrl = null;
        if (itemAny.media?.["$"]?.url) {
          imageUrl = itemAny.media["$"].url;
        } else if (itemAny.thumbnail?.["$"]?.url) {
          imageUrl = itemAny.thumbnail["$"].url;
        } else if (itemAny.enclosure?.url) {
          imageUrl = itemAny.enclosure.url;
        }
        
        articles.push({
          externalId: `rss_${normalizeSourceName(sourceName)}_${item.guid || item.link}`,
          title: cleanText(item.title),
          summary: cleanText(item.contentSnippet || item.content?.substring(0, 500) || ""),
          content: content,
          url: item.link,
          source: normalizeSourceName(sourceName),
          sourceName: sourceName,
          author: item.creator || itemAny.dcCreator || itemAny.author,
          publishedAt: pubDate,
          category: categorizeArticle(item.title || "", item.contentSnippet),
          imageUrl: imageUrl || undefined,
          rssFeedId: rssFeedId,
        });
      }
    }
  } catch (error: any) {
    console.error(`Error fetching RSS ${sourceName}:`, error.message);
    throw error;
  }
  
  return articles;
}

// Fetch from all active RSS feeds in database
export async function fetchAllRssFeeds(hoursBack: number = 168): Promise<AggregatedArticle[]> {
  await initializeRssFeeds();
  
  const activeFeeds = await db
    .select()
    .from(rssFeeds)
    .where(eq(rssFeeds.isActive, true));
  
  const allArticles: AggregatedArticle[] = [];
  
  console.log(`Fetching from ${activeFeeds.length} active RSS feeds...`);
  
  for (const feed of activeFeeds) {
    try {
      console.log(`Fetching RSS: ${feed.name}...`);
      const articles = await fetchSingleRssFeed(feed.feedUrl, feed.name, feed.id, hoursBack);
      allArticles.push(...articles);
      
      // Update feed status
      await db
        .update(rssFeeds)
        .set({
          lastFetchedAt: new Date(),
          lastFetchStatus: "success",
          lastFetchError: null,
          articleCount: sql`${rssFeeds.articleCount} + ${articles.length}`,
          updatedAt: new Date(),
        })
        .where(eq(rssFeeds.id, feed.id));
      
      console.log(`  ✓ ${feed.name}: ${articles.length} articles`);
    } catch (error: any) {
      console.error(`  ✗ ${feed.name}: ${error.message}`);
      
      // Update feed error status
      await db
        .update(rssFeeds)
        .set({
          lastFetchedAt: new Date(),
          lastFetchStatus: "error",
          lastFetchError: error.message,
          updatedAt: new Date(),
        })
        .where(eq(rssFeeds.id, feed.id));
    }
  }
  
  return allArticles;
}

// Fetch from Congress.gov API
export async function fetchCongressGov(hoursBack: number = 168): Promise<AggregatedArticle[]> {
  const articles: AggregatedArticle[] = [];
  const apiKey = process.env.CONGRESS_API_KEY;
  const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  
  if (!apiKey) {
    console.log("Congress.gov API key not found, skipping...");
    return articles;
  }
  
  try {
    console.log("Fetching Congress.gov bills...");
    
    const response = await axios.get(
      `https://api.congress.gov/v3/bill?format=json&limit=100&api_key=${apiKey}`,
      { timeout: 15000 }
    );
    
    for (const bill of response.data.bills || []) {
      const updateDate = new Date(bill.updateDate);
      
      if (updateDate >= cutoffDate) {
        articles.push({
          externalId: `congress_bill_${bill.congress}_${bill.type}_${bill.number}`,
          title: `${bill.type}${bill.number}: ${bill.title}`,
          summary: bill.latestAction?.text || "Bill updated in Congress",
          content: "",
          url: bill.url || `https://www.congress.gov/bill/${bill.congress}th-congress/${bill.type.toLowerCase()}-bill/${bill.number}`,
          source: "congress_gov",
          sourceName: "Congress.gov",
          author: bill.sponsors?.[0]?.fullName,
          publishedAt: updateDate,
          category: "legislation",
        });
      }
    }
    
    console.log(`  ✓ Congress.gov: ${articles.length} bills`);
  } catch (error: any) {
    console.error("Error fetching Congress.gov:", error.message);
  }
  
  return articles;
}

// Fetch from Federal Register API
export async function fetchFederalRegister(hoursBack: number = 168): Promise<AggregatedArticle[]> {
  const articles: AggregatedArticle[] = [];
  const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  
  try {
    console.log("Fetching Federal Register...");
    const dateStr = cutoffDate.toISOString().split("T")[0];
    
    const response = await axios.get(
      `https://www.federalregister.gov/api/v1/documents.json`,
      {
        params: {
          per_page: 100,
          order: "newest",
          "conditions[publication_date][gte]": dateStr,
        },
        timeout: 15000,
      }
    );
    
    for (const doc of response.data.results || []) {
      articles.push({
        externalId: `fedreg_${doc.document_number}`,
        title: doc.title,
        summary: doc.abstract || `Federal Register document from ${doc.agencies?.[0]?.name || "Unknown Agency"}`,
        content: "",
        url: doc.html_url,
        source: "federal_register",
        sourceName: "Federal Register",
        author: doc.agencies?.[0]?.name,
        publishedAt: new Date(doc.publication_date),
        category: "executive",
      });
    }
    
    console.log(`  ✓ Federal Register: ${articles.length} documents`);
  } catch (error: any) {
    console.error("Error fetching Federal Register:", error.message);
  }
  
  return articles;
}

// Deduplicate articles based on title similarity
function deduplicateArticles(articles: AggregatedArticle[]): AggregatedArticle[] {
  const seen = new Map<string, boolean>();
  const seenUrls = new Set<string>();
  const unique: AggregatedArticle[] = [];
  
  for (const article of articles) {
    // Skip if we've seen this URL
    if (seenUrls.has(article.url)) continue;
    seenUrls.add(article.url);
    
    // Create fingerprint from title
    const fingerprint = article.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .sort()
      .join(" ");
    
    if (!seen.has(fingerprint) && fingerprint.length > 10) {
      seen.set(fingerprint, true);
      unique.push(article);
    }
  }
  
  return unique;
}

// Main aggregation function - fetches from all sources
export async function aggregateAllNews(hoursBack: number = 168): Promise<AggregatedArticle[]> {
  console.log(`\n========== Aggregating News ==========`);
  console.log(`Time range: Last ${hoursBack} hours (${(hoursBack / 24).toFixed(1)} days)`);
  console.log(`Started: ${new Date().toISOString()}\n`);
  
  const [rssArticles, congressArticles, federalRegisterArticles] = await Promise.all([
    fetchAllRssFeeds(hoursBack),
    fetchCongressGov(hoursBack),
    fetchFederalRegister(hoursBack),
  ]);
  
  let allArticles = [...rssArticles, ...congressArticles, ...federalRegisterArticles];
  console.log(`\nTotal before deduplication: ${allArticles.length}`);
  
  allArticles = deduplicateArticles(allArticles);
  console.log(`Total after deduplication: ${allArticles.length}`);
  
  console.log(`\n========== Aggregation Complete ==========\n`);
  
  return allArticles;
}

// Score article relevance based on research context
export function scoreArticleRelevance(
  article: AggregatedArticle,
  context: {
    trackedTopics?: string[];
    trackedBillNumbers?: string[];
    trackedStaffers?: string[];
    trackedOrganizations?: string[];
    matterKeywords?: string[];
    profile?: FirmProfileTerms;
  } = {}
): { score: number; matchedTopics: string[] } {
  const searchText = `${article.title} ${article.summary} ${article.content || ""}`.toLowerCase();
  let score = 0;
  const matchedTopics: string[] = [];
  
  // Match tracked topics (20 points each)
  for (const topic of context.trackedTopics || []) {
    if (searchText.includes(topic.toLowerCase())) {
      score += 20;
      matchedTopics.push(topic);
    }
  }
  
  // Match bill numbers (30 points each - high priority)
  for (const billNum of context.trackedBillNumbers || []) {
    const normalizedBill = billNum.toLowerCase().replace(/\s+/g, "");
    if (searchText.includes(normalizedBill) || searchText.includes(billNum.toLowerCase())) {
      score += 30;
      matchedTopics.push(`Bill: ${billNum}`);
    }
  }
  
  // Match tracked staffers (25 points each)
  for (const staffer of context.trackedStaffers || []) {
    if (searchText.includes(staffer.toLowerCase())) {
      score += 25;
      matchedTopics.push(`Staffer: ${staffer}`);
    }
  }
  
  // Match organizations (15 points each)
  for (const org of context.trackedOrganizations || []) {
    if (searchText.includes(org.toLowerCase())) {
      score += 15;
      matchedTopics.push(`Org: ${org}`);
    }
  }
  
  // Match matter keywords (10 points each)
  for (const keyword of context.matterKeywords || []) {
    if (searchText.includes(keyword.toLowerCase())) {
      score += 10;
      matchedTopics.push(keyword);
    }
  }
  
  // Firm profile (client_profiles): watchlist topics, agencies, committees,
  // industries. This is what makes "High relevance" mean something for a
  // firm before it has projects, contacts or tracked bills of its own.
  if (context.profile) {
    const profileText = `${article.title} ${article.summary} ${(article.content || "").slice(0, 3000)}`;
    const p = scoreProfileMatch(article.title, profileText, context.profile, article.url);
    score += p.score;
    matchedTopics.push(...p.matched);
  }

  // Source and recency bonuses only lift stories that already matched
  // something — an unrelated story stays at 0 instead of showing "10%".
  if (score === 0) return { score: 0, matchedTopics };

  // Bonus for credible sources
  const highCredibilitySources = ["congress_gov", "federal_register", "department_of_defense", "white_house"];
  if (highCredibilitySources.includes(article.source)) {
    score += 10;
  }
  
  // Bonus for recency
  const hoursOld = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60);
  if (hoursOld < 6) score += 10;
  else if (hoursOld < 24) score += 7;
  else if (hoursOld < 48) score += 5;
  else if (hoursOld < 72) score += 3;
  
  return { score: Math.min(score, 100), matchedTopics };
}

// ─── Firm-profile relevance ───────────────────────────────────────────────────

export interface FirmProfileTerms {
  watchlistTopics: string[];
  industries: string[];
  agencies: string[];
  committees: string[];
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "into", "over", "under", "about", "of", "to", "in", "on", "a", "an",
  "policy", "policies", "issues", "services", "service", "program", "programs", "expansion", "funding",
  "senate", "house", "committee", "department", "affairs",
]);

// Common names for agency acronyms in client profiles. Acronyms are matched
// case-sensitively as whole words ("VA", not "va" inside "Nevada").
const AGENCY_ALIASES: Record<string, string[]> = {
  va: ["VA", "veterans affairs"],
  dod: ["DoD", "DOD", "Pentagon", "Defense Department", "Department of Defense", "Hegseth", "Department of War"],
  hhs: ["HHS", "Health and Human Services"],
  cms: ["CMS", "Medicare", "Medicaid", "Centers for Medicare"],
  fda: ["FDA", "Food and Drug Administration"],
  dot: ["DOT", "Transportation Department", "Department of Transportation", "FAA", "Federal Highway"],
  doe: ["DOE", "Energy Department", "Department of Energy"],
  commerce: ["Commerce Department", "Department of Commerce", "Lutnick"],
  ntia: ["NTIA", "broadband"],
  treasury: ["Treasury", "IRS"],
  "white house": ["White House"],
  dol: ["Labor Department", "Department of Labor", "DOL"],
  dhs: ["DHS", "Homeland Security", "ICE", "FEMA"],
  epa: ["EPA", "Environmental Protection Agency"],
};

function stemOf(word: string): string {
  return word.length > 5 ? word.slice(0, Math.max(5, word.length - 3)) : word;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function significantTerms(phrase: string): string[] {
  return tokenize(phrase).filter((t) => (t.length >= 3 || /^[a-z]{2}$/.test(t)) && !STOPWORDS.has(t));
}

function hasTerm(tokens: string[], term: string): boolean {
  if (term.length <= 3) return tokens.includes(term); // short words/acronyms: exact
  const stem = stemOf(term);
  return tokens.some((t) => t.startsWith(stem));
}

function hasPhrase(text: string, alias: string): boolean {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // All-caps aliases (acronyms) must match case-sensitively as whole words.
  const flags = alias === alias.toUpperCase() && alias.length <= 5 ? "" : "i";
  return new RegExp(`\\b${escaped}\\b`, flags).test(text);
}

function agencyAliases(label: string): string[] {
  const key = label.toLowerCase().replace(/^(u\.?s\.?\s+)?(department|dept\.?)\s+of\s+(the\s+)?/, "").trim();
  return AGENCY_ALIASES[key] ?? [label];
}

// Words that appear in almost every story for a veterans/health firm. On
// their own they can't make a watchlist topic match — a topic needs at least
// one of its distinctive words ("mental", "claims", "workforce"…).
const GENERIC_TERMS = new Set([
  "veteran", "veterans", "va", "military", "service", "services", "health", "healthcare", "care",
  "benefit", "benefits", "federal", "program", "programs", "bill", "people", "support",
]);

// Headlines about decisions, money or oversight — what a lobbyist acts on —
// as opposed to features, events and how-to posts.
const POLICY_ACTION =
  /\b(bill|bills|act|legislation|law|rule|rules|regulation|funding|budget|appropriations?|cuts?|contracts?|terminated|cancel(?:ed|s)?|lawsuit|sues?|court|ruling|hearing|markup|vote[sd]?|nominee|nomination|confirm(?:ed|ation)?|watchdog|audit|inspector general|gao|investigation|probe|report finds|executive order|policy|reform|layoffs?|backlog|shortage)\b/i;

// Agencies' own newsrooms/blogs mention the agency in every post, so they get
// no agency points (their posts still score on topics and policy words).
const AGENCY_DOMAINS: Record<string, string[]> = {
  va: ["va.gov"],
  dod: ["defense.gov", "mil"],
  hhs: ["hhs.gov"],
  cms: ["cms.gov", "medicare.gov", "medicaid.gov"],
  fda: ["fda.gov"],
  dot: ["transportation.gov", "dot.gov"],
  doe: ["energy.gov"],
  commerce: ["commerce.gov"],
  treasury: ["treasury.gov"],
  "white house": ["whitehouse.gov"],
  dol: ["dol.gov"],
  dhs: ["dhs.gov"],
  epa: ["epa.gov"],
};

function hostOf(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname.toLowerCase() : "";
  } catch {
    return "";
  }
}

function isAgencyOwnSite(agency: string, host: string): boolean {
  if (!host) return false;
  const key = agency.toLowerCase().replace(/^(u\.?s\.?\s+)?(department|dept\.?)\s+of\s+(the\s+)?/, "").trim();
  return (AGENCY_DOMAINS[key] ?? []).some((d) => host === d || host.endsWith(`.${d}`));
}

// Scoring (calibrated so "High relevance" ≥ 50 means a lobbyist should read it):
// - watchlist topics: best match 25 (all key words) / 15 (most), +5 if in the
//   headline, +5 per extra topic (max +10) — no stacking six partial hits
// - agencies: 25 when named in the headline, 12 in the body (max 30); none
//   for the agency's own site
// - committees: 12 each (max 24), only when the story is about that panel
// - industries: 10 once
// - +10 when a matched story's headline describes policy action
export function scoreProfileMatch(
  title: string,
  text: string,
  profile: FirmProfileTerms,
  url?: string,
): { score: number; matched: string[] } {
  const tokens = tokenize(text);
  const titleTokens = tokenize(title);
  const host = hostOf(url);
  const matched: string[] = [];

  // Topics
  const topicScores: number[] = [];
  for (const topic of profile.watchlistTopics) {
    const terms = significantTerms(topic);
    if (terms.length === 0) continue;
    const distinctive = terms.filter((t) => !GENERIC_TERMS.has(t));
    let pts = 0;
    if (distinctive.length === 0) {
      // Only generic words ("veterans benefits expansion"): all must be in the headline.
      if (terms.every((t) => hasTerm(titleTokens, t))) pts = 20;
    } else {
      const distinctHits = distinctive.filter((t) => hasTerm(tokens, t)).length;
      const hits = terms.filter((t) => hasTerm(tokens, t)).length;
      const needed = terms.length <= 2 ? terms.length : terms.length - 1;
      if (distinctHits === 0) pts = 0;
      else if (hits === terms.length) pts = 25;
      else if (hits >= needed && hits >= 2) pts = 15;
      if (pts > 0 && distinctive.some((t) => hasTerm(titleTokens, t))) pts += 5;
    }
    if (pts > 0) {
      topicScores.push(pts);
      matched.push(topic);
    }
  }
  topicScores.sort((a, b) => b - a);
  const topicPoints = topicScores.length
    ? topicScores[0] + Math.min(10, 5 * (topicScores.length - 1))
    : 0;

  // Agencies
  let agencyPoints = 0;
  for (const agency of profile.agencies) {
    if (isAgencyOwnSite(agency, host)) continue;
    const aliases = agencyAliases(agency);
    if (aliases.some((a) => hasPhrase(title, a))) {
      agencyPoints += 25;
      matched.push(agency);
    } else if (aliases.some((a) => hasPhrase(text, a))) {
      agencyPoints += 12;
      matched.push(agency);
    }
  }
  agencyPoints = Math.min(agencyPoints, 30);

  // A committee counts only when the story is about the committee itself
  // ("House Veterans Affairs", "Armed Services Committee"), not merely the
  // department that shares its name. Apostrophes are dropped ("Veterans'").
  const plain = text.replace(/['\u2019]/g, "");
  let committeePoints = 0;
  for (const committee of profile.committees) {
    const chamber = committee.match(/^(senate|house)\s+/i)?.[1];
    const core = committee.replace(/^(senate|house)\s+/i, "").replace(/\s+committee$/i, "");
    // With a chamber ("Senate Armed Services") it must be that chamber's panel.
    const aboutCommittee = chamber
      ? hasPhrase(plain, `${chamber} ${core}`)
      : hasPhrase(plain, `${core} Committee`) || hasPhrase(plain, `${core} panel`);
    if (aboutCommittee) {
      committeePoints += 12;
      matched.push(committee);
    }
  }
  committeePoints = Math.min(committeePoints, 24);

  // Industries — once, not per industry
  let industryPoints = 0;
  for (const industry of profile.industries) {
    const terms = significantTerms(industry);
    const industryTerms = terms.length > 0 ? terms : tokenize(industry);
    if (industryTerms.length > 0 && industryTerms.every((t) => hasTerm(tokens, t))) {
      industryPoints = 10;
      matched.push(industry);
    }
  }

  let score = topicPoints + agencyPoints + committeePoints + industryPoints;
  // Industry words alone ("veterans", "healthcare") aren't a match.
  if (topicPoints + agencyPoints + committeePoints === 0) {
    return { score: 0, matched: [] };
  }
  if (POLICY_ACTION.test(title)) score += 10;

  return { score, matched: Array.from(new Set(matched)) };
}

// Re-score a firm's recent articles (e.g. after its profile or the scoring
// changes). Only rows whose score or matches changed are written.
export async function rescoreRecentArticles(
  clientId: string,
  context: Parameters<typeof scoreArticleRelevance>[1],
  days = 14,
): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      summary: newsArticles.summary,
      content: newsArticles.content,
      source: newsArticles.source,
      publishedAt: newsArticles.publishedAt,
      relevanceScore: newsArticles.relevanceScore,
      url: newsArticles.url,
    })
    .from(newsArticles)
    .where(and(eq(newsArticles.clientId, clientId), gte(newsArticles.publishedAt, since)));

  let updated = 0;
  for (const r of rows) {
    const { score, matchedTopics } = scoreArticleRelevance(
      {
        title: r.title,
        summary: r.summary ?? "",
        content: r.content ?? "",
        source: r.source ?? "",
        url: r.url ?? "",
        publishedAt: r.publishedAt ?? new Date(0),
      } as AggregatedArticle,
      context,
    );
    if (score !== r.relevanceScore) {
      await db
        .update(newsArticles)
        .set({ relevanceScore: score, matchedTopics: matchedTopics.length > 0 ? matchedTopics : null })
        .where(eq(newsArticles.id, r.id));
      updated++;
    }
  }
  return updated;
}

// Save aggregated articles to database for a specific client
export async function saveArticlesToDatabase(
  clientId: string,
  articles: AggregatedArticle[],
  relevanceContext?: Parameters<typeof scoreArticleRelevance>[1]
): Promise<number> {
  let savedCount = 0;

  // Dedupe per firm: every firm keeps its own copy (read/flag/bookmark state
  // is per firm). One lookup per batch instead of one table scan per article.
  const known = new Set<string>();
  const ids = Array.from(new Set(articles.map((a) => a.externalId).filter(Boolean)));
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await db
      .select({ externalId: newsArticles.externalId })
      .from(newsArticles)
      .where(and(eq(newsArticles.clientId, clientId), inArray(newsArticles.externalId, ids.slice(i, i + 500))));
    for (const r of rows) if (r.externalId) known.add(r.externalId);
  }

  for (const article of articles) {
    try {
      if (article.externalId) {
        if (known.has(article.externalId)) continue;
        known.add(article.externalId); // also skips repeats within this batch
      }

      // Calculate relevance score
      const { score, matchedTopics } = scoreArticleRelevance(article, relevanceContext);
      
      await db.insert(newsArticles).values({
        clientId,
        externalId: article.externalId,
        title: article.title,
        summary: article.summary,
        content: article.content,
        source: article.sourceName || article.source,
        author: article.author,
        url: article.url,
        category: article.category,
        imageUrl: article.imageUrl,
        relevanceScore: score,
        matchedTopics: matchedTopics.length > 0 ? matchedTopics : null,
        publishedAt: article.publishedAt,
        isRead: false,
        isFlagged: false,
        isBookmarked: false,
      });
      
      savedCount++;
    } catch (error: any) {
      // Likely a duplicate, skip
      if (!error.message?.includes("duplicate")) {
        console.error(`Error saving article "${article.title}":`, error.message);
      }
    }
  }
  
  return savedCount;
}

// Get relevance context from client's research data
export async function getClientRelevanceContext(clientId: string): Promise<{
  trackedTopics: string[];
  trackedBillNumbers: string[];
  trackedStaffers: string[];
  profile?: FirmProfileTerms;
}> {
  const context: {
    trackedTopics: string[];
    trackedBillNumbers: string[];
    trackedStaffers: string[];
    profile?: FirmProfileTerms;
  } = {
    trackedTopics: [],
    trackedBillNumbers: [],
    trackedStaffers: [],
  };
  
  try {
    const [profile] = await db
      .select()
      .from(clientProfiles)
      .where(eq(clientProfiles.clientId, clientId))
      .limit(1);
    if (profile) {
      context.profile = {
        watchlistTopics: profile.watchlistTopics ?? [],
        industries: profile.industries ?? [],
        agencies: profile.relevantAgencies ?? [],
        committees: profile.relevantCommittees ?? [],
      };
    }

    // Get matter keywords for topics
    const matters = await db.execute(
      sql`SELECT name, description FROM matters WHERE client_id = ${clientId} AND status = 'active'`
    );
    
    for (const matter of matters.rows as any[]) {
      if (matter.name) context.trackedTopics.push(matter.name);
      // Extract keywords from description
      if (matter.description) {
        const words = matter.description.split(/\s+/).filter((w: string) => w.length > 5);
        context.trackedTopics.push(...words.slice(0, 5));
      }
    }
    
    // Get tracked contacts (staffers)
    const contacts = await db.execute(
      sql`SELECT first_name, last_name FROM contacts WHERE client_id = ${clientId} LIMIT 50`
    );
    
    for (const contact of contacts.rows as any[]) {
      const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
      if (fullName) context.trackedStaffers.push(fullName);
    }
    
    // Get favorited Congress members
    const favorites = await db.execute(
      sql`SELECT name FROM favorite_congress_members WHERE client_id = ${clientId}`
    );
    
    for (const fav of favorites.rows as any[]) {
      if (fav.name) context.trackedStaffers.push(fav.name);
    }
    
    // Get tracked bills
    const bills = await db.execute(
      sql`SELECT bill_type, bill_number FROM tracked_bills WHERE client_id = ${clientId}`
    );
    
    for (const bill of bills.rows as any[]) {
      if (bill.bill_type && bill.bill_number) {
        context.trackedBillNumbers.push(`${bill.bill_type}${bill.bill_number}`);
      }
    }
    
  } catch (error: any) {
    console.error("Error getting relevance context:", error.message);
  }
  
  return context;
}

// Test a single RSS feed URL
export async function testRssFeed(feedUrl: string): Promise<{
  success: boolean;
  title?: string;
  description?: string;
  itemCount?: number;
  sampleItems?: { title: string; pubDate: string }[];
  error?: string;
}> {
  try {
    const feed = await parser.parseURL(feedUrl);
    
    return {
      success: true,
      title: feed.title,
      description: feed.description,
      itemCount: feed.items?.length || 0,
      sampleItems: feed.items?.slice(0, 3).map((item) => ({
        title: item.title || "Untitled",
        pubDate: item.pubDate || item.isoDate || "Unknown",
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

import Parser from "rss-parser";
import axios from "axios";
import { db } from "../db";
import { rssFeeds, newsArticles } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

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
  { name: "Politico", feedUrl: "https://www.politico.com/rss/politics08.xml", category: "politics", tier: 1 },
  { name: "The Hill", feedUrl: "https://thehill.com/feed/", category: "politics", tier: 1 },
  { name: "Roll Call", feedUrl: "https://www.rollcall.com/feed/", category: "legislative", tier: 1 },
  
  // TIER 2: Defense & Military
  { name: "Department of Defense", feedUrl: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945", category: "defense", tier: 2 },
  { name: "Military Times", feedUrl: "https://www.militarytimes.com/arc/outboundfeeds/rss/", category: "defense", tier: 2 },
  { name: "Defense News", feedUrl: "https://www.defensenews.com/arc/outboundfeeds/rss/", category: "defense", tier: 2 },
  
  // TIER 3: Think Tanks & Policy
  { name: "Brookings Institution", feedUrl: "https://www.brookings.edu/feed/", category: "policy", tier: 3 },
  { name: "CSIS", feedUrl: "https://www.csis.org/rss", category: "policy", tier: 3 },
  { name: "Heritage Foundation", feedUrl: "https://www.heritage.org/rss.xml", category: "policy", tier: 3 },
  { name: "Center for American Progress", feedUrl: "https://www.americanprogress.org/feed/", category: "policy", tier: 3 },
  
  // TIER 4: Federal Agencies
  { name: "White House", feedUrl: "https://www.whitehouse.gov/feed/", category: "politics", tier: 4 },
  { name: "Federal News Network", feedUrl: "https://federalnewsnetwork.com/feed/", category: "politics", tier: 4 },
  { name: "VA News", feedUrl: "https://www.va.gov/rss/rss.xml", category: "defense", tier: 4 },
  
  // TIER 5: Specialized
  { name: "Task & Purpose", feedUrl: "https://taskandpurpose.com/feed/", category: "defense", tier: 5 },
  { name: "Congressional Research Service", feedUrl: "https://crsreports.congress.gov/RSS/LatestReports.xml", category: "legislative", tier: 5 },
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

// Save aggregated articles to database for a specific client
export async function saveArticlesToDatabase(
  clientId: string,
  articles: AggregatedArticle[],
  relevanceContext?: {
    trackedTopics?: string[];
    trackedBillNumbers?: string[];
    trackedStaffers?: string[];
  }
): Promise<number> {
  let savedCount = 0;
  
  for (const article of articles) {
    try {
      // Check if article already exists
      const existing = await db
        .select({ id: newsArticles.id })
        .from(newsArticles)
        .where(eq(newsArticles.externalId, article.externalId))
        .limit(1);
      
      if (existing.length > 0) continue;
      
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
}> {
  const context = {
    trackedTopics: [] as string[],
    trackedBillNumbers: [] as string[],
    trackedStaffers: [] as string[],
  };
  
  try {
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
      sql`SELECT name FROM contacts WHERE client_id = ${clientId} LIMIT 50`
    );
    
    for (const contact of contacts.rows as any[]) {
      if (contact.name) context.trackedStaffers.push(contact.name);
    }
    
    // Get favorited Congress members
    const favorites = await db.execute(
      sql`SELECT member_name FROM favorites WHERE client_id = ${clientId}`
    );
    
    for (const fav of favorites.rows as any[]) {
      if (fav.member_name) context.trackedStaffers.push(fav.member_name);
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

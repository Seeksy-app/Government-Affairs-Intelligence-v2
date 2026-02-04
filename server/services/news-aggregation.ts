import Parser from "rss-parser";
import axios from "axios";

interface AggregatedArticle {
  externalId: string;
  title: string;
  summary: string;
  content?: string;
  url: string;
  source: string;
  author?: string;
  publishedAt: Date;
  category: string;
  imageUrl?: string;
}

const rssSources = {
  politico: "https://www.politico.com/rss/politics08.xml",
  theHill: "https://thehill.com/feed/",
  rollCall: "https://www.rollcall.com/feed/",
  defenseDept: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945",
  brookings: "https://www.brookings.edu/feed/",
};

const parser = new Parser({
  customFields: {
    item: [["media:content", "media"], ["media:thumbnail", "thumbnail"]],
  },
});

function categorizeArticle(title: string, description?: string): string {
  const text = `${title} ${description || ""}`.toLowerCase();
  
  if (text.match(/white house|president|executive order|administration/)) {
    return "executive";
  }
  if (text.match(/bill|legislation|congress|senate|house|vote|amendment/)) {
    return "legislation";
  }
  if (text.match(/campaign|election|candidate|poll|primary/)) {
    return "campaign";
  }
  return "policy";
}

function normalizeSource(sourceName: string): string {
  const sourceMap: Record<string, string> = {
    Politico: "politico",
    "The Hill": "the_hill",
    "Roll Call": "roll_call",
    Reuters: "reuters",
    "Associated Press": "ap",
    CNN: "cnn",
    "Fox News": "fox_news",
  };
  
  return sourceMap[sourceName] || sourceName.toLowerCase().replace(/\s+/g, "_");
}

export async function fetchRSSFeeds(hoursBack: number = 24): Promise<AggregatedArticle[]> {
  const articles: AggregatedArticle[] = [];
  const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  
  for (const [sourceName, feedUrl] of Object.entries(rssSources)) {
    try {
      console.log(`Fetching RSS: ${sourceName}...`);
      const feed = await parser.parseURL(feedUrl);
      
      for (const item of feed.items) {
        const pubDate = new Date(item.pubDate || item.isoDate || new Date());
        
        if (pubDate >= cutoffDate) {
          const itemAny = item as any;
          articles.push({
            externalId: `rss_${sourceName}_${item.guid || item.link}`,
            title: item.title || "Untitled",
            summary: item.contentSnippet || item.content?.substring(0, 500) || "",
            content: item.content || itemAny["content:encoded"] || "",
            url: item.link || "",
            source: sourceName,
            author: item.creator || itemAny.author,
            publishedAt: pubDate,
            category: categorizeArticle(item.title || "", item.contentSnippet),
            imageUrl: itemAny.media?.["$"]?.url || itemAny.thumbnail?.["$"]?.url,
          });
        }
      }
    } catch (error: any) {
      console.error(`Error fetching RSS ${sourceName}:`, error.message);
    }
  }
  
  return articles;
}

export async function fetchCongressGov(hoursBack: number = 24): Promise<AggregatedArticle[]> {
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
      `https://api.congress.gov/v3/bill?format=json&limit=50&api_key=${apiKey}`
    );
    
    for (const bill of response.data.bills || []) {
      const updateDate = new Date(bill.updateDate);
      
      if (updateDate >= cutoffDate) {
        articles.push({
          externalId: `congress_bill_${bill.congress}_${bill.type}_${bill.number}`,
          title: `${bill.type}${bill.number}: ${bill.title}`,
          summary: bill.latestAction?.text || "No description available",
          content: "",
          url: bill.url || `https://www.congress.gov/bill/${bill.congress}th-congress/${bill.type.toLowerCase()}-bill/${bill.number}`,
          source: "congress_gov",
          author: bill.sponsors?.[0]?.fullName,
          publishedAt: updateDate,
          category: "legislation",
        });
      }
    }
  } catch (error: any) {
    console.error("Error fetching Congress.gov:", error.message);
  }
  
  return articles;
}

export async function fetchFederalRegister(hoursBack: number = 24): Promise<AggregatedArticle[]> {
  const articles: AggregatedArticle[] = [];
  const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  
  try {
    console.log("Fetching Federal Register...");
    const dateStr = cutoffDate.toISOString().split("T")[0];
    
    const response = await axios.get(
      `https://www.federalregister.gov/api/v1/documents.json`,
      {
        params: {
          per_page: 50,
          order: "newest",
          "conditions[publication_date][gte]": dateStr,
        },
      }
    );
    
    for (const doc of response.data.results || []) {
      articles.push({
        externalId: `fedreg_${doc.document_number}`,
        title: doc.title,
        summary: doc.abstract || "",
        content: "",
        url: doc.html_url,
        source: "federal_register",
        author: doc.agencies?.[0]?.name,
        publishedAt: new Date(doc.publication_date),
        category: "executive",
      });
    }
  } catch (error: any) {
    console.error("Error fetching Federal Register:", error.message);
  }
  
  return articles;
}

function deduplicateArticles(articles: AggregatedArticle[]): AggregatedArticle[] {
  const seen = new Map<string, boolean>();
  const unique: AggregatedArticle[] = [];
  
  for (const article of articles) {
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

export async function aggregateAllNews(hoursBack: number = 24): Promise<AggregatedArticle[]> {
  console.log(`Aggregating news from last ${hoursBack} hours...`);
  
  const [rssArticles, congressArticles, federalRegisterArticles] = await Promise.all([
    fetchRSSFeeds(hoursBack),
    fetchCongressGov(hoursBack),
    fetchFederalRegister(hoursBack),
  ]);
  
  let allArticles = [...rssArticles, ...congressArticles, ...federalRegisterArticles];
  allArticles = deduplicateArticles(allArticles);
  
  console.log(`Aggregated ${allArticles.length} unique articles`);
  
  return allArticles;
}

export function scoreArticleRelevance(
  article: AggregatedArticle,
  trackedTopics: string[] = [],
  trackedBillNumbers: string[] = []
): { score: number; matchedTopics: string[] } {
  const searchText = `${article.title} ${article.summary} ${article.content || ""}`.toLowerCase();
  let score = 0;
  const matchedTopics: string[] = [];
  
  for (const topic of trackedTopics) {
    if (searchText.includes(topic.toLowerCase())) {
      score += 20;
      matchedTopics.push(topic);
    }
  }
  
  for (const billNum of trackedBillNumbers) {
    if (searchText.includes(billNum.toLowerCase())) {
      score += 30;
      matchedTopics.push(`Bill: ${billNum}`);
    }
  }
  
  const credibleSources = ["congress_gov", "federal_register", "reuters", "ap", "defense_dept"];
  if (credibleSources.includes(article.source)) {
    score += 5;
  }
  
  const hoursOld = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60);
  if (hoursOld < 24) score += 5;
  else if (hoursOld < 48) score += 3;
  else if (hoursOld < 72) score += 1;
  
  return { score: Math.min(score, 100), matchedTopics };
}

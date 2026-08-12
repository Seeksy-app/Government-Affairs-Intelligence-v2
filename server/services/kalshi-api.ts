import crypto from "crypto";

const KALSHI_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";

// Module-level cache of ALL open markets (with event categories), shared
// across requests and API instances — one crawl serves the dashboard and
// every predictions-page category tab.
const MARKETS_CACHE_TTL_MS = 5 * 60 * 1000;
let allMarketsCache: { markets: KalshiMarket[]; fetchedAt: number } | null = null;

// UI category names → Kalshi's actual event categories. The old code exact-
// matched UI strings ("Tech", "Culture") against Kalshi's names ("Science and
// Technology", "Entertainment"), so those tabs always showed zero markets.
const CATEGORY_ALIASES: Record<string, string[]> = {
  Politics: ["Politics", "Elections"],
  Elections: ["Politics", "Elections"],
  Tech: ["Science and Technology"],
  "Tech & Science": ["Science and Technology"],
  Culture: ["Entertainment", "Social"],
  Financials: ["Financials", "Companies"],
  "Climate and Weather": ["Climate and Weather"],
};

// Raw API response format.
// Kalshi migrated its market fields: numeric cents fields (last_price,
// yes_bid, volume, open_interest) were replaced by string decimal fields
// (last_price_dollars, yes_bid_dollars, volume_fp, open_interest_fp).
// We read the new names first and keep the legacy ones as fallback.
interface KalshiMarketRaw {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle?: string;
  yes_sub_title?: string;
  // Legacy numeric fields (cents / counts)
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume?: number;
  volume_24h?: number;
  open_interest?: number;
  // Current string fields
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  last_price_dollars?: string;
  volume_fp?: string;
  volume_24h_fp?: string;
  open_interest_fp?: string;
  status: string;
  close_time: string;
  result?: string;
  category?: string;
}

// "0.1000" dollars → 10 (cents, i.e. percent); returns 0 when absent/invalid.
function dollarsToCents(s: string | undefined): number {
  const n = s ? Math.round(parseFloat(s) * 100) : NaN;
  return Number.isFinite(n) ? n : 0;
}

// "528.84" fixed-point count → 529; returns 0 when absent/invalid.
function fpToInt(s: string | undefined): number {
  const n = s ? Math.round(parseFloat(s)) : NaN;
  return Number.isFinite(n) ? n : 0;
}

// Transformed format for frontend
export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle?: string;
  yes_price: number;
  no_price: number;
  volume: number;
  volume_24h: number;
  open_interest: number;
  status: string;
  close_time: string;
  result?: string;
  category?: string;
}

// Transform raw API response to our format
function transformMarket(raw: KalshiMarketRaw): KalshiMarket {
  // Resolve fields across both API generations (string *_dollars/*_fp first,
  // legacy numeric second). The old code read only the legacy names, which
  // Kalshi no longer sends — so every market rendered as a fake "50% / Vol 0".
  const lastPrice = dollarsToCents(raw.last_price_dollars) || raw.last_price || 0;
  const yesBid = dollarsToCents(raw.yes_bid_dollars) || raw.yes_bid || 0;
  const yesAsk = dollarsToCents(raw.yes_ask_dollars) || raw.yes_ask || 0;
  const noBid = dollarsToCents(raw.no_bid_dollars) || raw.no_bid || 0;
  const volume = fpToInt(raw.volume_fp) || raw.volume || 0;
  const volume24h = fpToInt(raw.volume_24h_fp) || raw.volume_24h || 0;
  const openInterest = fpToInt(raw.open_interest_fp) || raw.open_interest || 0;

  // Price preference: last traded price, else bid/ask midpoint, else bid, else 50.
  let yesPrice: number;
  if (lastPrice > 0) {
    yesPrice = lastPrice;
  } else if (yesBid > 0 && yesAsk > 0 && yesAsk <= 100) {
    yesPrice = Math.round((yesBid + yesAsk) / 2);
  } else if (yesBid > 0) {
    yesPrice = yesBid;
  } else {
    yesPrice = 50;
  }
  const noPrice = noBid > 0 ? noBid : 100 - yesPrice;
  
  return {
    ticker: raw.ticker,
    event_ticker: raw.event_ticker,
    title: raw.title,
    subtitle: raw.subtitle,
    yes_price: yesPrice,
    no_price: noPrice,
    volume,
    volume_24h: volume24h,
    open_interest: openInterest,
    status: raw.status,
    close_time: raw.close_time,
    result: raw.result,
    category: raw.category,
  };
}

export interface KalshiEventMetadata {
  image_url?: string;
  featured_image_url?: string;
  market_details?: Array<{
    market_ticker: string;
    image_url?: string;
    color_code?: string;
  }>;
}

export interface KalshiEvent {
  event_ticker: string;
  title: string;
  subtitle?: string;
  category: string;
  mutually_exclusive: boolean;
  markets: KalshiMarket[];
}

export interface KalshiSeries {
  ticker: string;
  title: string;
  category: string;
  frequency: string;
}

class KalshiAPI {
  private baseUrl: string;
  private apiKeyId?: string;
  private privateKey?: string;

  constructor() {
    this.baseUrl = KALSHI_BASE_URL;
    const apiKey = process.env.KALSHI_API_KEY;
    if (apiKey) {
      const parts = apiKey.split("::");
      if (parts.length === 2) {
        this.apiKeyId = parts[0];
        this.privateKey = parts[1].replace(/\\n/g, "\n");
      }
    }
  }

  private signRequest(method: string, path: string): Record<string, string> {
    if (!this.apiKeyId || !this.privateKey) {
      return {};
    }

    const timestamp = Date.now().toString();
    const pathWithoutQuery = path.split("?")[0];
    const message = timestamp + method.toUpperCase() + pathWithoutQuery;

    try {
      const sign = crypto.createSign("RSA-SHA256");
      sign.update(message);
      sign.end();

      const signature = sign.sign(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
          saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
        },
        "base64"
      );

      return {
        "KALSHI-ACCESS-KEY": this.apiKeyId,
        "KALSHI-ACCESS-SIGNATURE": signature,
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
      };
    } catch (error) {
      console.error("Failed to sign Kalshi request:", error);
      return {};
    }
  }

  private async request<T>(
    path: string,
    method: string = "GET",
    requiresAuth: boolean = false
  ): Promise<T | null> {
    // Kalshi docs: apply exponential backoff on 429 (basic tier ≈ 20 reads/s).
    const RETRY_DELAYS_MS = [600, 1500];
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Accept": "application/json",
        };

        if (requiresAuth) {
          Object.assign(headers, this.signRequest(method, path));
        }

        const response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
        });

        if (response.status === 429 && attempt < RETRY_DELAYS_MS.length) {
          console.warn(`[Kalshi] 429 on ${path} — backing off ${RETRY_DELAYS_MS[attempt]}ms`);
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`[Kalshi] API error: ${response.status} ${response.statusText}`);
          console.error(`[Kalshi] Error body: ${errorBody}`);
          console.error(`[Kalshi] Request path: ${path}`);
          return null;
        }

        const data = await response.json();
        console.log(`[Kalshi] Fetched ${path}, got ${(data as any)?.markets?.length || 0} markets`);
        return data;
      } catch (error) {
        console.error("[Kalshi] API request failed:", error);
        return null;
      }
    }
    return null;
  }

  async getMarkets(options: {
    seriesTicker?: string;
    eventTicker?: string;
    status?: "open" | "closed" | "settled" | "all";
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ markets: KalshiMarket[]; cursor?: string } | null> {
    const params = new URLSearchParams();
    if (options.seriesTicker) params.append("series_ticker", options.seriesTicker);
    if (options.eventTicker) params.append("event_ticker", options.eventTicker);
    if (options.status && options.status !== "all") params.append("status", options.status);
    if (options.limit) params.append("limit", options.limit.toString());
    if (options.cursor) params.append("cursor", options.cursor);

    const queryString = params.toString();
    const path = `/markets${queryString ? `?${queryString}` : ""}`;
    // Markets endpoint is public - no auth required
    const result = await this.request<{ markets: KalshiMarketRaw[]; cursor?: string }>(path, "GET", false);
    
    if (!result) return null;
    
    // Transform raw markets to our format
    return {
      markets: result.markets.map(transformMarket),
      cursor: result.cursor,
    };
  }

  async getMarket(ticker: string): Promise<{ market: KalshiMarket } | null> {
    // Single market endpoint is public - no auth required
    const result = await this.request<{ market: KalshiMarketRaw }>(`/markets/${ticker}`, "GET", false);
    if (!result) return null;
    return { market: transformMarket(result.market) };
  }

  async getEvent(eventTicker: string): Promise<{ event: KalshiEvent } | null> {
    // Events endpoint is public - no auth required
    return this.request<{ event: KalshiEvent }>(`/events/${eventTicker}`, "GET", false);
  }

  async getEvents(options: {
    seriesTicker?: string;
    status?: "open" | "closed" | "settled";
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ events: KalshiEvent[]; cursor?: string } | null> {
    const params = new URLSearchParams();
    if (options.seriesTicker) params.append("series_ticker", options.seriesTicker);
    if (options.status) params.append("status", options.status);
    if (options.limit) params.append("limit", options.limit.toString());
    if (options.cursor) params.append("cursor", options.cursor);

    const queryString = params.toString();
    const path = `/events${queryString ? `?${queryString}` : ""}`;
    // Events endpoint is public - no auth required
    return this.request<{ events: KalshiEvent[]; cursor?: string }>(path, "GET", false);
  }

  async getSeries(ticker: string): Promise<{ series: KalshiSeries } | null> {
    // Series endpoint is public - no auth required
    return this.request<{ series: KalshiSeries }>(`/series/${ticker}`, "GET", false);
  }

  private isPoliticalMarket(title: string, ticker: string): boolean {
    const lowerTitle = title.toLowerCase();
    const lowerTicker = ticker.toLowerCase();
    
    // Exclude sports markets
    if (lowerTicker.includes("nba") || lowerTicker.includes("nfl") || 
        lowerTicker.includes("mlb") || lowerTicker.includes("nhl") ||
        lowerTicker.includes("sports") || lowerTicker.includes("esports") ||
        lowerTicker.includes("soccer") || lowerTicker.includes("golf")) {
      return false;
    }
    
    // Include political keywords
    const politicalKeywords = [
      "president", "trump", "biden", "vance", "newsom", "harris",
      "democrat", "republican", "congress", "senate", "house",
      "election", "vote", "nominee", "cabinet", "secretary",
      "fed chair", "federal reserve", "supreme court", "scotus",
      "shutdown", "government", "tariff", "stimulus", "impeach",
      "legislation", "bill", "veto", "poll", "party", "governor",
      "mayor", "attorney general", "khamenei", "leader", "costa rica",
      "world leader", "prime minister", "chancellor"
    ];
    
    return politicalKeywords.some(keyword => lowerTitle.includes(keyword));
  }

  // One crawl of /events with with_nested_markets=true returns every open
  // event WITH its full market objects (prices + volume included) — ~8
  // requests every 5 minutes, replacing the old one-request-per-event crawls
  // (250+ calls) that tripped Kalshi's rate limit on every page load.
  private async ensureMarketsCache(): Promise<KalshiMarket[]> {
    const now = Date.now();
    if (allMarketsCache && now - allMarketsCache.fetchedAt < MARKETS_CACHE_TTL_MS) {
      return allMarketsCache.markets;
    }

    console.log(`[Kalshi] Refreshing full markets cache...`);
    const allMarkets: KalshiMarket[] = [];
    const seenTickers = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 8; page++) {
      const path = `/events?status=open&limit=200&with_nested_markets=true${cursor ? `&cursor=${cursor}` : ""}`;
      const result = await this.request<{ events: Array<KalshiEvent & { markets?: KalshiMarketRaw[] }>; cursor?: string }>(
        path,
        "GET",
        false,
      );
      if (!result?.events?.length) break;
      for (const event of result.events) {
        for (const rawMarket of event.markets ?? []) {
          if (seenTickers.has(rawMarket.ticker)) continue;
          seenTickers.add(rawMarket.ticker);
          const market = transformMarket(rawMarket);
          market.category = event.category ?? market.category;
          allMarkets.push(market);
        }
      }
      cursor = result.cursor;
      if (!cursor) break;
    }

    // Rank by real trading activity so live markets lead and dead placeholder
    // markets (50% / Vol 0, closing in 2099) sink to the bottom.
    const activity = (m: KalshiMarket) => m.volume_24h * 3 + m.volume + m.open_interest;
    allMarkets.sort((a, b) => activity(b) - activity(a));

    const liveCount = allMarkets.filter((m) => activity(m) > 0).length;
    console.log(`[Kalshi] Markets cache: ${allMarkets.length} total, ${liveCount} with trading activity`);

    allMarketsCache = { markets: allMarkets, fetchedAt: now };
    return allMarkets;
  }

  async searchPoliticalMarkets(limit: number = 200): Promise<KalshiMarket[]> {
    const markets = await this.ensureMarketsCache();
    return markets
      .filter((m) => m.category === "Politics" || m.category === "Elections")
      .slice(0, limit);
  }

  async getEventMetadata(eventTicker: string): Promise<KalshiEventMetadata | null> {
    return this.request<KalshiEventMetadata>(`/events/${eventTicker}/metadata`, "GET", false);
  }

  async getEventImages(eventTickers: string[]): Promise<Map<string, string>> {
    const imageMap = new Map<string, string>();
    const batchSize = 5;
    
    for (let i = 0; i < eventTickers.length; i += batchSize) {
      const batch = eventTickers.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (ticker) => {
          const metadata = await this.getEventMetadata(ticker);
          if (metadata?.image_url) {
            imageMap.set(ticker, metadata.image_url);
          }
          if (metadata?.market_details) {
            for (const detail of metadata.market_details) {
              if (detail.image_url) {
                imageMap.set(detail.market_ticker, detail.image_url);
              }
            }
          }
        })
      );
    }
    
    return imageMap;
  }

  async searchMarketsByCategory(category: string, limit: number = 200): Promise<KalshiMarket[]> {
    const kalshiCategories = new Set(CATEGORY_ALIASES[category] ?? [category]);
    const markets = await this.ensureMarketsCache();
    const matched = markets.filter((m) => m.category && kalshiCategories.has(m.category));
    console.log(`[Kalshi] Category "${category}" → [${Array.from(kalshiCategories).join(", ")}]: ${matched.length} markets`);
    return matched.slice(0, limit);
  }

  async getAvailableCategories(): Promise<string[]> {
    const categories = new Set<string>();
    let eventCursor: string | undefined;

    for (let page = 0; page < 5; page++) {
      const eventsResult = await this.getEvents({ status: "open", limit: 100, cursor: eventCursor });
      if (!eventsResult?.events?.length) break;

      for (const event of eventsResult.events) {
        if (event.category) {
          categories.add(event.category);
        }
      }

      eventCursor = eventsResult.cursor;
      if (!eventCursor) break;
    }

    return Array.from(categories).sort();
  }

  async searchBillMarkets(billNumber: string): Promise<KalshiMarket[]> {
    const result = await this.getMarkets({ status: "open", limit: 100 });
    if (!result?.markets) return [];

    const normalizedBill = billNumber.replace(/\s+/g, "").toUpperCase();
    return result.markets.filter((m) => {
      const normalizedTitle = m.title.replace(/\s+/g, "").toUpperCase();
      return (
        normalizedTitle.includes(normalizedBill) ||
        normalizedTitle.includes("BILL") ||
        normalizedTitle.includes("LEGISLATION")
      );
    });
  }

  async getTopPoliticalEvents(limit: number = 10): Promise<KalshiMarket[]> {
    const markets = await this.searchPoliticalMarkets(50);
    return markets
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit);
  }
}

export const kalshiApi = new KalshiAPI();

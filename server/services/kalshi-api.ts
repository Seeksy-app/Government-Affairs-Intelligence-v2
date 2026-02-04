import crypto from "crypto";

const KALSHI_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";

// Raw API response format
interface KalshiMarketRaw {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle?: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume: number;
  open_interest: number;
  status: string;
  close_time: string;
  result?: string;
  category?: string;
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
  open_interest: number;
  status: string;
  close_time: string;
  result?: string;
  category?: string;
}

// Transform raw API response to our format
function transformMarket(raw: KalshiMarketRaw): KalshiMarket {
  // Use yes_bid if available, otherwise last_price, otherwise 50 as default
  const yesPrice = raw.yes_bid ?? raw.last_price ?? 50;
  const noPrice = raw.no_bid ?? (100 - yesPrice);
  
  return {
    ticker: raw.ticker,
    event_ticker: raw.event_ticker,
    title: raw.title,
    subtitle: raw.subtitle,
    yes_price: yesPrice,
    no_price: noPrice,
    volume: raw.volume || 0,
    open_interest: raw.open_interest || 0,
    status: raw.status,
    close_time: raw.close_time,
    result: raw.result,
    category: raw.category,
  };
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
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json",
      };

      if (requiresAuth) {
        Object.assign(headers, this.signRequest(method, path));
      }

      console.log(`[Kalshi] Making request to: ${this.baseUrl}${path}`);
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Kalshi] API error: ${response.status} ${response.statusText}`);
        console.error(`[Kalshi] Error body: ${errorBody}`);
        console.error(`[Kalshi] Request path: ${path}`);
        return null;
      }

      const data = await response.json();
      console.log(`[Kalshi] Successfully fetched ${path}, got ${(data as any)?.markets?.length || 0} markets`);
      return data;
    } catch (error) {
      console.error("[Kalshi] API request failed:", error);
      return null;
    }
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

  async searchPoliticalMarkets(limit: number = 200): Promise<KalshiMarket[]> {
    const allMarkets: KalshiMarket[] = [];
    const seenTickers = new Set<string>();
    const politicalEventTickers: string[] = [];
    
    console.log(`[Kalshi] Starting search for political markets (limit: ${limit})`);
    
    // Step 1: Get political events by fetching events and filtering by category
    let eventCursor: string | undefined;
    for (let page = 0; page < 5; page++) {
      const eventsResult = await this.getEvents({ status: "open", limit: 100, cursor: eventCursor });
      
      if (!eventsResult?.events?.length) break;
      
      for (const event of eventsResult.events) {
        // Filter for Politics and Elections categories
        if (event.category === "Politics" || event.category === "Elections") {
          politicalEventTickers.push(event.event_ticker);
        }
      }
      
      eventCursor = eventsResult.cursor;
      if (!eventCursor) break;
    }
    
    console.log(`[Kalshi] Found ${politicalEventTickers.length} political event tickers`);
    
    // Step 2: Fetch markets for each political event
    for (const eventTicker of politicalEventTickers) {
      if (allMarkets.length >= limit) break;
      
      const marketsResult = await this.getMarkets({ 
        eventTicker, 
        status: "open", 
        limit: 50 
      });
      
      if (marketsResult?.markets) {
        for (const market of marketsResult.markets) {
          if (!seenTickers.has(market.ticker)) {
            seenTickers.add(market.ticker);
            allMarkets.push(market);
          }
        }
      }
    }
    
    console.log(`[Kalshi] Found ${allMarkets.length} markets from political events`);
    
    // Step 3: If we need more, supplement with keyword-based search
    if (allMarkets.length < limit) {
      let cursor: string | undefined;
      
      for (let page = 0; page < 10 && allMarkets.length < limit; page++) {
        const result = await this.getMarkets({ status: "open", limit: 200, cursor });
        
        if (!result?.markets?.length) break;
        
        for (const market of result.markets) {
          if (!seenTickers.has(market.ticker) && this.isPoliticalMarket(market.title, market.ticker)) {
            seenTickers.add(market.ticker);
            allMarkets.push(market);
          }
        }
        
        cursor = result.cursor;
        if (!cursor) break;
      }
    }
    
    console.log(`[Kalshi] Total political markets found: ${allMarkets.length}`);
    return allMarkets.slice(0, limit);
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

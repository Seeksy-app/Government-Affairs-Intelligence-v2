import crypto from "crypto";

const KALSHI_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";

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
      };

      if (requiresAuth) {
        Object.assign(headers, this.signRequest(method, path));
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Kalshi API error: ${response.status} ${response.statusText}`);
        console.error(`Kalshi API error body: ${errorBody}`);
        console.error(`Kalshi request path: ${path}`);
        console.error(`Kalshi auth enabled: ${requiresAuth}, has key: ${!!this.apiKeyId}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Kalshi API request failed:", error);
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
    return this.request<{ markets: KalshiMarket[]; cursor?: string }>(path, "GET", false);
  }

  async getMarket(ticker: string): Promise<{ market: KalshiMarket } | null> {
    // Single market endpoint is public - no auth required
    return this.request<{ market: KalshiMarket }>(`/markets/${ticker}`, "GET", false);
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

  async searchPoliticalMarkets(limit: number = 20): Promise<KalshiMarket[]> {
    const politicalCategories = ["Politics", "Elections", "Congress", "Government"];
    const allMarkets: KalshiMarket[] = [];

    const result = await this.getMarkets({ status: "open", limit: 100 });
    if (result?.markets) {
      const politicalMarkets = result.markets.filter(
        (m) =>
          politicalCategories.some((cat) =>
            m.category?.toLowerCase().includes(cat.toLowerCase())
          ) ||
          m.title.toLowerCase().includes("president") ||
          m.title.toLowerCase().includes("congress") ||
          m.title.toLowerCase().includes("senate") ||
          m.title.toLowerCase().includes("election") ||
          m.title.toLowerCase().includes("bill") ||
          m.title.toLowerCase().includes("trump") ||
          m.title.toLowerCase().includes("biden") ||
          m.title.toLowerCase().includes("democrat") ||
          m.title.toLowerCase().includes("republican") ||
          m.title.toLowerCase().includes("legislation") ||
          m.title.toLowerCase().includes("veto") ||
          m.title.toLowerCase().includes("impeach")
      );
      allMarkets.push(...politicalMarkets);
    }

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

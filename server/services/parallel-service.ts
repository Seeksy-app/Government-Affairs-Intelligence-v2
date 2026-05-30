const SEARCH_URL = "https://api.parallel.ai/v1beta/search";
const EXTRACT_URL = "https://api.parallel.ai/v1beta/extract";

function getApiKey(): string {
  const key = process.env.PARALLEL_API_KEY;
  if (!key) throw new Error("PARALLEL_API_KEY not configured");
  return key;
}

async function parallelPost(url: string, body: Record<string, unknown>): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-KEY": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Parallel.ai API error ${response.status}: ${text}`);
  }

  return response.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractResult {
  url: string;
  title: string | null;
  publishDate: string | null;   // YYYY-MM-DD or null
  markdown: string;             // full clean content
}

export interface SearchResult {
  url: string;
  title: string;
  excerpts: string[];
  domain: string;
}

// ─── Extract API ──────────────────────────────────────────────────────────────

export async function extractUrls(urls: string[]): Promise<ExtractResult[]> {
  const data = await parallelPost(EXTRACT_URL, {
    urls,
    advanced_settings: { full_content: true },
  });

  // Build lookup maps from the batch response
  const successByUrl = new Map<string, { title: string | null; publishDate: string | null; markdown: string }>();
  for (const r of (data.results ?? []) as any[]) {
    successByUrl.set(r.url, {
      title: r.title ?? null,
      publishDate: r.publish_date ?? null,
      // full_content is the complete markdown; fall back to joined excerpts
      markdown: r.full_content ?? (Array.isArray(r.excerpts) ? r.excerpts.join("\n\n") : ""),
    });
  }

  for (const e of (data.errors ?? []) as any[]) {
    console.error(`parallel-service: extract failed for ${e.url}: ${e.error_type} (HTTP ${e.http_status_code ?? "?"})`);
  }

  // Return results in input URL order; missing = failed
  return urls.map((url) => {
    const hit = successByUrl.get(url);
    if (hit) return { url, ...hit };
    return { url, title: null, publishDate: null, markdown: "" };
  });
}

// ─── Search API ───────────────────────────────────────────────────────────────

export async function searchTopic(
  objective: string,
  opts: { numResults?: number; domains?: string[] } = {},
): Promise<SearchResult[]> {
  if (!objective || !objective.trim()) {
    throw new Error("searchTopic: objective must be a non-empty string");
  }

  const body: Record<string, unknown> = {
    objective,
    num_results: opts.numResults ?? 5,
  };

  if (opts.domains && opts.domains.length > 0) {
    body.domains = opts.domains;
  }

  const data = await parallelPost(SEARCH_URL, body);

  const raw: any[] = data.results ?? data.items ?? [];

  return raw.map((r) => ({
    url: r.url ?? "",
    title: r.title ?? "",
    excerpts: Array.isArray(r.excerpts) ? r.excerpts : [],
    domain: r.domain ?? extractDomain(r.url ?? ""),
  }));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const TIER_1_DOMAINS = new Set([
  "reuters.com",
  "apnews.com",
  "wsj.com",
  "nytimes.com",
  "bloomberg.com",
]);

const TIER_2_DOMAINS = new Set([
  "politico.com",
  "thehill.com",
  "defensenews.com",
  "rollcall.com",
  "axios.com",
]);

export function domainTier(url: string): 1 | 2 | 3 {
  const domain = extractDomain(url);
  if (!domain) return 3;
  if (domain.endsWith(".gov")) return 1;
  if (TIER_1_DOMAINS.has(domain)) return 1;
  if (TIER_2_DOMAINS.has(domain)) return 2;
  return 3;
}

interface SearchApiOrganic {
  position: number;
  title: string;
  link: string;
  domain: string;
  displayed_link?: string;
  snippet: string;
}

interface SearchApiResponse {
  search_metadata: {
    status: string;
  };
  organic_results?: SearchApiOrganic[];
  error?: string;
}

export interface RankCheckResult {
  position: number;
  title: string;
  link: string;
  domain: string;
  snippet: string;
}

export async function checkRankings(
  query: string,
  options: {
    device?: string;
    location?: string;
    num?: number;
  } = {}
): Promise<RankCheckResult[]> {
  const apiKey = process.env.SEARCHAPI_API_KEY;
  if (!apiKey) {
    throw new Error("SEARCHAPI_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    engine: "google_rank_tracking",
    q: query,
    api_key: apiKey,
    num: String(options.num || 100),
  });

  if (options.device) params.set("device", options.device);
  if (options.location) params.set("location", options.location);

  const response = await fetch(`https://www.searchapi.io/api/v1/search?${params.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SearchAPI error (${response.status}): ${text}`);
  }

  const data: SearchApiResponse = await response.json();

  if (data.error) {
    throw new Error(`SearchAPI error: ${data.error}`);
  }

  if (!data.organic_results || data.organic_results.length === 0) {
    return [];
  }

  return data.organic_results.map((r) => ({
    position: r.position,
    title: r.title,
    link: r.link,
    domain: r.domain,
    snippet: r.snippet || "",
  }));
}

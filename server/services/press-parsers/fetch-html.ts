// Shared HTML fetcher for .gov press release pages.
// Uses Sec-Fetch-Mode: navigate so Drupal/Akamai serves the fully server-rendered
// HTML (same as curl), not the partial page returned to undici's default cors mode.
const USER_AGENT =
  process.env.GOV_PRESS_USER_AGENT ??
  "NewsBlur Feed Fetcher - 1 subscriber (http://www.newsblur.com/)";

export async function fetchHtml(url: string, timeoutMs = 15_000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Site": "none",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  return res.text();
}

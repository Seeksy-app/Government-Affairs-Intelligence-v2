// Polymarket odds from its free, public Gamma API (no key). Markets are
// returned in the same shape as Kalshi's so the Markets page can switch
// sources without changing its filters, sorting or cards.

const GAMMA = "https://gamma-api.polymarket.com";
const CACHE_MS = 5 * 60 * 1000;

// Markets page category (Kalshi naming) → Polymarket tag slugs.
const CATEGORY_TAGS: Record<string, string[]> = {
  Politics: ["politics"],
  Sports: ["sports"],
  Economics: ["economy", "fed"],
  Financials: ["finance"],
  "Climate and Weather": ["climate", "weather"],
  Tech: ["tech", "ai", "science"],
  Culture: ["pop-culture"],
  Health: ["health"],
  World: ["geopolitics", "world"],
};

export interface NormalizedMarket {
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
  category?: string;
  image_url?: string | null;
  source: "polymarket";
  url: string;
}

interface GammaMarket {
  id: string;
  slug?: string;
  question: string;
  groupItemTitle?: string;
  outcomes?: string;
  outcomePrices?: string;
  volume?: string | number;
  volume24hr?: string | number;
  liquidity?: string | number;
  endDate?: string;
  image?: string;
  active?: boolean;
  closed?: boolean;
}
interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  endDate?: string;
  image?: string;
  volume24hr?: string | number;
  markets?: GammaMarket[];
}

const cache = new Map<string, { at: number; events: GammaEvent[] }>();

// Up to 300 of a tag's most-traded open events (3 pages of 100).
async function eventsForTag(tag: string): Promise<GammaEvent[]> {
  const hit = cache.get(tag);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.events;
  try {
    const events: GammaEvent[] = [];
    for (let offset = 0; offset < 300; offset += 100) {
      const url = `${GAMMA}/events?active=true&closed=false&limit=100&offset=${offset}&order=volume24hr&ascending=false&tag_slug=${encodeURIComponent(tag)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`Polymarket ${res.status}`);
      const page = (await res.json()) as GammaEvent[];
      events.push(...page);
      if (page.length < 100) break;
    }
    cache.set(tag, { at: Date.now(), events });
    return events;
  } catch (err) {
    console.warn(`[polymarket] ${tag} failed:`, (err as Error).message);
    return hit?.events ?? []; // last good copy beats nothing
  }
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const parseList = (s?: string): string[] => {
  try {
    const v = JSON.parse(s ?? "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

// "Ceasefire continues through...?" + "September 30" → "Ceasefire continues
// through September 30?"; otherwise "Fed decision in October? — No change".
function groupedTitle(eventTitle: string, item: string): string {
  if (/\.{3}|…/.test(eventTitle)) return eventTitle.replace(/\s*(\.{3}|…)\s*/, ` ${item}`).replace(/\s+\?/, "?");
  return `${eventTitle} — ${item}`;
}

// Yes/No markets only; a multi-outcome event keeps its 6 likeliest outcomes
// so "2028 nominee" doesn't bury everything else under 128 names.
function normalize(event: GammaEvent, category: string): NormalizedMarket[] {
  const open = (event.markets ?? []).filter((m) => m.active !== false && !m.closed);
  const rows: NormalizedMarket[] = [];
  for (const m of open) {
    const outcomes = parseList(m.outcomes);
    const prices = parseList(m.outcomePrices).map(num);
    if (outcomes[0]?.toLowerCase() !== "yes" || prices.length < 2) continue;
    const yes = Math.round(prices[0] * 100);
    const no = Math.round(prices[1] * 100); // quoted separately; not always 100 − yes
    if (yes <= 0 || yes >= 100) continue; // settled in all but name
    const grouped = open.length > 1 && m.groupItemTitle;
    rows.push({
      ticker: `pm-${m.id}`,
      event_ticker: event.slug,
      title: grouped ? groupedTitle(event.title, m.groupItemTitle!) : m.question,
      subtitle: grouped ? m.groupItemTitle : undefined,
      yes_price: yes,
      no_price: no,
      volume: Math.round(num(m.volume)),
      open_interest: Math.round(num(m.liquidity)),
      status: "open",
      close_time: m.endDate ?? event.endDate ?? "",
      category,
      image_url: m.image || event.image || null,
      source: "polymarket",
      url: `https://polymarket.com/event/${event.slug}`,
    });
  }
  // Only multi-outcome events (candidates, dates) are trimmed to the likeliest six.
  const multiOutcome = open.length > 1 && open.every((m) => !!m.groupItemTitle);
  return multiOutcome ? rows.sort((a, b) => b.yes_price - a.yes_price).slice(0, 6) : rows;
}

export async function polymarketMarkets(category: string, limit = 200): Promise<NormalizedMarket[]> {
  const tags = CATEGORY_TAGS[category] ?? CATEGORY_TAGS.Politics;
  const lists = await Promise.all(tags.map(eventsForTag));
  const seen = new Set<string>();
  const events = lists
    .flat()
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => num(b.volume24hr) - num(a.volume24hr));
  return events.flatMap((e) => normalize(e, category)).slice(0, limit);
}

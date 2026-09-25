// Weather watch — severe weather and disasters that move the political
// calendar: storms that cancel votes and fly-ins, hurricanes and floods that
// lead to FEMA declarations and supplemental funding fights.
//
// Free, official sources (no key needed):
//   - National Weather Service alerts  https://api.weather.gov/alerts/active
//   - National Hurricane Center storms https://www.nhc.noaa.gov/CurrentStorms.json
//   - OpenFEMA disaster declarations   https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries
// Impact lines are fixed, factual rules — no model call, nothing invented.

import { db } from "../db";
import { contacts, trackedBills } from "@shared/schema";
import { eq } from "drizzle-orm";
import { US_STATES } from "@shared/bill-label";

const USER_AGENT = "GovernmentAffairs.io weather-watch (support@governmentaffairs.io)";
const CACHE_MS = 20 * 60 * 1000;
const FEMA_LOOKBACK_DAYS = 14;

const TERRITORIES: Record<string, string> = { PR: "Puerto Rico", GU: "Guam", VI: "U.S. Virgin Islands", AS: "American Samoa", MP: "Northern Mariana Islands" };
const PLACES: Record<string, string> = { ...US_STATES, ...TERRITORIES };

export type WeatherKind = "capitol" | "tropical" | "disaster" | "severe";

export interface WeatherItem {
  id: string;
  kind: WeatherKind;
  title: string;
  detail: string;
  impact: string;
  states: string[];
  yourStates: string[];
  url: string;
  source: "National Weather Service" | "National Hurricane Center" | "FEMA";
  when: string | null;
}

export interface WeatherWatch {
  updatedAt: string;
  items: WeatherItem[];
  tracking: Array<{ name: string; classification: string; basin: string; windMph: number; url: string }>;
  yourStates: string[];
  sourcesOk: { nws: boolean; nhc: boolean; fema: boolean };
}

// ─── Raw fetch (shared across firms, cached) ─────────────────────────────────

interface RawData {
  alerts: any[];
  storms: any[];
  declarations: any[];
  ok: { nws: boolean; nhc: boolean; fema: boolean };
  fetchedAt: number;
}

let cache: RawData | null = null;

async function getJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json, application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRaw(): Promise<RawData> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache;

  const since = new Date(Date.now() - FEMA_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const femaUrl =
    "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries" +
    `?$filter=${encodeURIComponent(`declarationDate ge '${since}'`)}` +
    "&$orderby=declarationDate%20desc&$top=200" +
    "&$select=femaDeclarationString,disasterNumber,state,declarationType,incidentType,declarationTitle,declarationDate,designatedArea";

  const [nws, nhc, fema] = await Promise.allSettled([
    getJson("https://api.weather.gov/alerts/active?status=actual&message_type=alert,update&severity=Extreme,Severe"),
    getJson("https://www.nhc.noaa.gov/CurrentStorms.json"),
    getJson(femaUrl),
  ]);

  for (const [name, r] of [["NWS", nws], ["NHC", nhc], ["FEMA", fema]] as const) {
    if (r.status === "rejected") console.warn(`[weather-watch] ${name} fetch failed:`, (r.reason as Error)?.message);
  }

  const next: RawData = {
    alerts: nws.status === "fulfilled" ? nws.value.features ?? [] : cache?.alerts ?? [],
    storms: nhc.status === "fulfilled" ? nhc.value.activeStorms ?? [] : cache?.storms ?? [],
    declarations: fema.status === "fulfilled" ? fema.value.DisasterDeclarationsSummaries ?? [] : cache?.declarations ?? [],
    ok: { nws: nws.status === "fulfilled", nhc: nhc.status === "fulfilled", fema: fema.status === "fulfilled" },
    fetchedAt: Date.now(),
  };
  cache = next;
  return next;
}

// ─── Pure transform (unit-tested) ─────────────────────────────────────────────

const TROPICAL_EVENTS = /hurricane|tropical storm|storm surge|typhoon/i;
// Land-affecting events that plausibly move the political calendar. Routine
// river and coastal flood warnings (several states on any given day) are left
// out as noise; flash floods are kept.
const SEVERE_EVENTS =
  /flash flood emergency|flash flood warning|blizzard|winter storm warning|ice storm|extreme heat|excessive heat|extreme wind|high wind warning|tornado warning|tornado emergency|fire warning|extreme cold/i;

// UGC codes look like "FLZ052" (zone) or "NMC005" (county); marine zones use
// non-state prefixes (ANZ, PHZ, PKZ…), which we ignore.
function statesOf(alert: any): string[] {
  const ugc: string[] = alert?.properties?.geocode?.UGC ?? [];
  const out = new Set<string>();
  for (const code of ugc) {
    const st = code.slice(0, 2);
    if (PLACES[st] && /^[A-Z]{2}[CZ]\d{3}$/.test(code)) out.add(st);
  }
  return Array.from(out);
}

function placeList(states: string[], max = 4): string {
  const names = states.map((s) => (s === "DC" ? "Washington, D.C." : PLACES[s] ?? s));
  return names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} +${names.length - max} more`;
}

function basinOf(bin: string): string {
  if (bin?.startsWith("AT")) return "Atlantic";
  if (bin?.startsWith("EP")) return "Eastern Pacific";
  if (bin?.startsWith("CP")) return "Central Pacific";
  return "Tropics";
}

const CLASSIFICATION: Record<string, string> = {
  HU: "Hurricane", TS: "Tropical Storm", TD: "Tropical Depression", STS: "Subtropical Storm",
  STD: "Subtropical Depression", PTC: "Potential Tropical Cyclone", PC: "Post-tropical Cyclone",
};

const DECLARATION_TYPE: Record<string, { label: string; impact: string }> = {
  DR: {
    label: "Major disaster declared",
    impact:
      "Federal recovery aid flows through FEMA's Disaster Relief Fund; large or repeated disasters drive supplemental funding requests.",
  },
  EM: {
    label: "Emergency declared",
    impact: "Federal support for the response is authorized; emergency declarations often precede a major-disaster request.",
  },
  FM: {
    label: "Fire management assistance",
    impact: "FEMA covers part of the cost of fighting the fire; watch for a follow-on major-disaster request if damage spreads.",
  },
};

export function buildWeatherWatch(raw: RawData, yourStates: string[]): WeatherWatch {
  const mine = new Set(yourStates);
  const items: WeatherItem[] = [];

  const landAlerts = raw.alerts
    .map((a) => ({ a, states: statesOf(a), event: String(a?.properties?.event ?? "") }))
    .filter((x) => x.states.length > 0);

  // 1) Washington, D.C. — anything severe there can cancel votes and fly-ins.
  const dc = landAlerts.filter(
    (x) => x.states.includes("DC") && (SEVERE_EVENTS.test(x.event) || TROPICAL_EVENTS.test(x.event)),
  );
  if (dc.length > 0) {
    const events = Array.from(new Set(dc.map((x) => x.event)));
    const first = dc[0].a.properties;
    items.push({
      id: "capitol",
      kind: "capitol",
      title: `${events.join(" · ")} in Washington`,
      detail: first.headline ?? "",
      impact: "Severe weather in D.C. can cancel votes, postpone hearings and scramble fly-in meetings.",
      states: ["DC"],
      yourStates: [],
      url: "https://www.weather.gov/lwx/",
      source: "National Weather Service",
      when: first.onset ?? first.effective ?? null,
    });
  }

  // 2) Tropical warnings on U.S. land, grouped into one item.
  const tropical = landAlerts.filter((x) => TROPICAL_EVENTS.test(x.event));
  if (tropical.length > 0) {
    const states = Array.from(new Set(tropical.flatMap((x) => x.states))).filter((s) => s !== "DC");
    const events = Array.from(new Set(tropical.map((x) => x.event)));
    const hasWarning = events.some((e) => /warning/i.test(e));
    if (states.length > 0) {
      items.push({
        id: "tropical",
        kind: "tropical",
        title: `${hasWarning ? "Tropical warnings" : "Tropical watches"}: ${placeList(states)}`,
        detail: events.join(" · "),
        impact: `Expect FEMA emergency declarations if it hits; members from ${placeList(states, 3)} may miss votes while at home for the storm.`,
        states,
        yourStates: states.filter((s) => mine.has(s)),
        url: "https://www.nhc.noaa.gov/",
        source: "National Hurricane Center",
        when: tropical[0].a.properties.onset ?? null,
      });
    }
  }

  // 3) FEMA declarations in the last two weeks, one item per declaration.
  const byDecl = new Map<string, any[]>();
  for (const d of raw.declarations) {
    const key = d.femaDeclarationString ?? `${d.state}-${d.disasterNumber}`;
    if (!byDecl.has(key)) byDecl.set(key, []);
    byDecl.get(key)!.push(d);
  }
  const decls = Array.from(byDecl.entries())
    .map(([key, rows]) => ({ key, first: rows[0], areas: rows.length }))
    .sort((a, b) => {
      // Major disasters, then emergencies, then fire grants.
      const rank = (t: string) => (t === "DR" ? 0 : t === "EM" ? 1 : 2);
      return rank(a.first.declarationType) - rank(b.first.declarationType) ||
        String(b.first.declarationDate).localeCompare(String(a.first.declarationDate));
    });
  for (const { key, first, areas } of decls.slice(0, 4)) {
    const t = DECLARATION_TYPE[first.declarationType] ?? { label: "Declaration", impact: "" };
    const title = String(first.declarationTitle ?? first.incidentType ?? "").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
    items.push({
      id: `fema-${key}`,
      kind: "disaster",
      title: `${t.label}: ${title} (${PLACES[first.state] ?? first.state})`,
      detail: `${first.incidentType} · ${areas} ${areas === 1 ? "area" : "areas"} · declared ${String(first.declarationDate).slice(0, 10)}`,
      impact: t.impact,
      states: [first.state],
      yourStates: mine.has(first.state) ? [first.state] : [],
      url: `https://www.fema.gov/disaster/${first.disasterNumber}`,
      source: "FEMA",
      when: first.declarationDate ?? null,
    });
  }

  // 4) Other severe land alerts, grouped by event.
  const byEvent = new Map<string, Set<string>>();
  for (const x of landAlerts) {
    if (TROPICAL_EVENTS.test(x.event) || !SEVERE_EVENTS.test(x.event)) continue;
    if (!byEvent.has(x.event)) byEvent.set(x.event, new Set());
    for (const s of x.states) if (s !== "DC") byEvent.get(x.event)!.add(s);
  }
  for (const [event, set] of Array.from(byEvent.entries())) {
    const states = Array.from(set);
    if (states.length === 0) continue;
    items.push({
      id: `severe-${event}`,
      kind: "severe",
      title: `${event}: ${placeList(states)}`,
      detail: "",
      impact: "If damage is serious, governors request federal disaster declarations and delegations press for aid.",
      states,
      yourStates: states.filter((s) => mine.has(s)),
      url: "https://www.weather.gov/",
      source: "National Weather Service",
      when: null,
    });
  }

  // Order: D.C., then anything touching the firm's states, then the rest.
  const order: Record<WeatherKind, number> = { capitol: 0, tropical: 1, disaster: 2, severe: 3 };
  items.sort((a, b) => {
    if (a.kind === "capitol" || b.kind === "capitol") return order[a.kind] - order[b.kind];
    return (b.yourStates.length > 0 ? 1 : 0) - (a.yourStates.length > 0 ? 1 : 0) || order[a.kind] - order[b.kind];
  });

  const tracking = raw.storms
    .filter((s) => /^(AT|CP)/.test(s.binNumber ?? "")) // basins that reach U.S. states
    .map((s) => ({
      name: s.name,
      classification: CLASSIFICATION[s.classification] ?? s.classification,
      basin: basinOf(s.binNumber),
      windMph: Math.round(Number(s.intensity ?? 0) * 1.15078),
      url: s.publicAdvisory?.url ?? "https://www.nhc.noaa.gov/",
    }));

  return {
    updatedAt: new Date(raw.fetchedAt).toISOString(),
    items: items.slice(0, 6),
    tracking,
    yourStates,
    sourcesOk: raw.ok,
  };
}

// ─── Firm context ─────────────────────────────────────────────────────────────

// "Your states": states of tracked state bills plus contacts' states.
async function firmStates(clientId: string): Promise<string[]> {
  const [bills, people] = await Promise.all([
    db.select({ j: trackedBills.jurisdiction }).from(trackedBills).where(eq(trackedBills.clientId, clientId)),
    db.select({ s: contacts.state }).from(contacts).where(eq(contacts.clientId, clientId)),
  ]);
  const out = new Set<string>();
  for (const b of bills) if (b.j && b.j !== "US" && PLACES[b.j]) out.add(b.j);
  for (const p of people) {
    const s = (p.s ?? "").trim().toUpperCase();
    if (PLACES[s]) out.add(s);
  }
  return Array.from(out).sort();
}

export async function getWeatherWatch(clientId: string | null): Promise<WeatherWatch> {
  const [raw, states] = await Promise.all([fetchRaw(), clientId ? firmStates(clientId) : Promise.resolve([])]);
  return buildWeatherWatch(raw, states);
}

// LegiScan Public API client for state bill tracking.
//
// Ground rules (see the LegiScan API Crash Course and our API usage survey):
// - One key only, from LEGISCAN_API_KEY. Calls come from the Render backend.
// - Every call spends a query. Usage is counted per month in legiscan_usage
//   and calls are refused once LEGISCAN_MONTHLY_BUDGET (default 9,000 of the
//   10,000 free-tier limit) is reached.
// - Use change_hash: getMasterListRaw tells us which bills changed, and only
//   those get a getBill call. Search results are cached in memory.
// - Data is CC BY 4.0: anywhere it is shown, show LEGISCAN_ATTRIBUTION.
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { legiscanUsage } from "@shared/schema";
import { formatStateBillLabel } from "@shared/bill-label";

const BASE_URL = "https://api.legiscan.com/";
const SEARCH_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

// LegiScan bill status codes.
const STATUS_LABELS: Record<number, string> = {
  1: "Introduced",
  2: "Engrossed",
  3: "Enrolled",
  4: "Passed",
  5: "Vetoed",
  6: "Failed",
};

export class LegiScanError extends Error {
  constructor(message: string, public readonly userFacing = false) {
    super(message);
  }
}

export function isLegiScanConfigured(): boolean {
  return !!process.env.LEGISCAN_API_KEY;
}

function monthlyBudget(): number {
  const n = Number(process.env.LEGISCAN_MONTHLY_BUDGET);
  return Number.isFinite(n) && n > 0 ? n : 9000;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function getLegiScanUsage(): Promise<{ month: string; queries: number; budget: number }> {
  const month = currentMonth();
  const [row] = await db.select().from(legiscanUsage).where(eq(legiscanUsage.month, month));
  return { month, queries: row?.queryCount ?? 0, budget: monthlyBudget() };
}

async function recordQuery(op: string): Promise<void> {
  const month = currentMonth();
  await db
    .insert(legiscanUsage)
    .values({ month, queryCount: 1 })
    .onConflictDoUpdate({
      target: legiscanUsage.month,
      set: { queryCount: sql`${legiscanUsage.queryCount} + 1`, updatedAt: new Date() },
    });
  console.log(`[legiscan] ${op} (query counted for ${month})`);
}

async function call(op: string, params: Record<string, string | number>): Promise<any> {
  const key = process.env.LEGISCAN_API_KEY;
  if (!key) {
    throw new LegiScanError("State bill tracking isn't set up yet (LEGISCAN_API_KEY is missing).", true);
  }

  const { queries, budget } = await getLegiScanUsage();
  if (queries >= budget) {
    console.warn(`[legiscan] monthly budget reached (${queries}/${budget}); refusing ${op}`);
    throw new LegiScanError("The monthly LegiScan query budget is used up. State bill data will refresh next month.", true);
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("key", key);
  url.searchParams.set("op", op);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  // Count before awaiting the response: a failed or timed-out request may
  // still have been charged.
  await recordQuery(op);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new LegiScanError(`LegiScan ${op} failed: HTTP ${res.status}`);

  const data = await res.json();
  if (data?.status !== "OK") {
    const message = data?.alert?.message || data?.status || "unknown error";
    throw new LegiScanError(`LegiScan ${op} error: ${message}`);
  }
  return data;
}

// LegiScan returns lists as objects with numeric keys ("0", "1", …) alongside
// metadata keys like "summary" or "session".
function numericEntries<T>(obj: Record<string, any> | undefined): T[] {
  if (!obj) return [];
  return Object.keys(obj)
    .filter((k) => /^\d+$/.test(k))
    .map((k) => obj[k] as T);
}

export interface StateBillSearchResult {
  legiscanBillId: number;
  state: string;
  billNumber: string;
  billLabel: string;
  title: string;
  lastAction: string | null;
  lastActionDate: string | null;
  url: string | null;
  changeHash: string | null;
}

const searchCache = new Map<string, { results: StateBillSearchResult[]; fetchedAt: number }>();

export async function searchStateBills(state: string, query: string): Promise<StateBillSearchResult[]> {
  const cacheKey = `${state}|${query.trim().toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SEARCH_CACHE_TTL_MS) return cached.results;

  // year=2: current session.
  const data = await call("getSearch", { state, query: query.trim(), year: 2 });
  const results = parseSearchResults(data);
  searchCache.set(cacheKey, { results, fetchedAt: Date.now() });
  return results;
}

export function parseSearchResults(data: any): StateBillSearchResult[] {
  return numericEntries<any>(data?.searchresult).map((r) => ({
    legiscanBillId: Number(r.bill_id),
    state: r.state,
    billNumber: r.bill_number,
    billLabel: formatStateBillLabel(r.state, r.bill_number),
    title: r.title,
    lastAction: r.last_action || null,
    lastActionDate: r.last_action_date || null,
    url: r.url || null,
    changeHash: r.change_hash || null,
  }));
}

export interface StateBillDetail {
  legiscanBillId: number;
  legiscanSessionId: number | null;
  state: string;
  billNumber: string;
  billLabel: string;
  title: string;
  status: string | null;
  introducedDate: string | null;
  lastAction: string | null;
  lastActionDate: string | null;
  sponsor: string | null;
  sponsorParty: string | null;
  subject: string | null;
  sourceUrl: string | null;
  stateUrl: string | null;
  changeHash: string | null;
}

export async function getStateBill(legiscanBillId: number): Promise<StateBillDetail> {
  const data = await call("getBill", { id: legiscanBillId });
  return parseStateBill(data.bill);
}

export function parseStateBill(b: any): StateBillDetail {
  const history: Array<{ date: string; action: string }> = Array.isArray(b.history) ? b.history : [];
  const last = history.length > 0 ? history[history.length - 1] : null;
  const sponsors: any[] = Array.isArray(b.sponsors) ? b.sponsors : [];
  // sponsor_type_id 1 = primary sponsor.
  const primary = sponsors.find((s) => s.sponsor_type_id === 1) || sponsors[0];
  const subjects: any[] = Array.isArray(b.subjects) ? b.subjects : [];

  return {
    legiscanBillId: Number(b.bill_id),
    legiscanSessionId: b.session_id ?? b.session?.session_id ?? null,
    state: b.state,
    billNumber: b.bill_number,
    billLabel: formatStateBillLabel(b.state, b.bill_number),
    title: b.title || b.description || b.bill_number,
    status: STATUS_LABELS[Number(b.status)] ?? null,
    introducedDate: history[0]?.date ?? null,
    lastAction: last?.action ?? null,
    lastActionDate: last?.date ?? null,
    sponsor: primary?.name ?? null,
    sponsorParty: primary?.party ?? null,
    subject: subjects[0]?.subject_name ?? null,
    sourceUrl: b.url ?? null,
    stateUrl: b.state_link ?? null,
    changeHash: b.change_hash ?? null,
  };
}

// bill_id → change_hash for every bill in one session. One query per session.
export async function getSessionChangeHashes(legiscanSessionId: number): Promise<Map<number, string>> {
  const data = await call("getMasterListRaw", { id: legiscanSessionId });
  return parseMasterList(data);
}

export function parseMasterList(data: any): Map<number, string> {
  const map = new Map<number, string>();
  for (const entry of numericEntries<any>(data?.masterlist)) {
    map.set(Number(entry.bill_id), entry.change_hash);
  }
  return map;
}

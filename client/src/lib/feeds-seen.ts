import { useEffect, useState } from "react";
import { queryClient } from "@/lib/queryClient";

// Top-bar badges count what arrived today since you last opened that page.
// "Last opened" is per browser (a convenience, not a record), so storage
// failures just mean the badge counts all of today.
export type FeedKey = "news" | "press" | "questions";

const STORAGE_KEY = "ga.feeds.seen";
const EVENT = "ga:feeds-seen";

function readAll(): Partial<Record<FeedKey, string>> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function lastSeen(key: FeedKey): Date | null {
  const v = readAll()[key];
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

function markSeen(key: FeedKey) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [key]: new Date().toISOString() }));
  } catch {
    /* private window etc. */
  }
  window.dispatchEvent(new Event(EVENT));
}

// Midnight in Washington today, as an instant (the badges' "today").
export function easternMidnight(now = new Date()): Date {
  const wall = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const offset = now.getTime() - wall.getTime();
  wall.setHours(0, 0, 0, 0);
  return new Date(wall.getTime() + offset);
}

// The badge query string; re-renders whenever a page is marked seen.
export function useSeenParams(): string {
  const build = () => {
    const all = readAll();
    return (["news", "press", "questions"] as FeedKey[])
      .filter((k) => all[k])
      .map((k) => `${k}=${encodeURIComponent(all[k]!)}`)
      .join("&");
  };
  const [params, setParams] = useState(build);
  useEffect(() => {
    const update = () => setParams(build());
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return params;
}

// Call on a feed page: returns the cutoff for "new" (the previous visit, or
// midnight if that was earlier) and marks the feed seen, clearing its badge.
export function useNewSince(key: FeedKey): Date {
  const [cutoff] = useState(() => {
    const prev = lastSeen(key);
    const midnight = easternMidnight();
    return prev && prev > midnight ? prev : midnight;
  });
  useEffect(() => {
    markSeen(key);
    queryClient.invalidateQueries({ queryKey: ["/api/top-bar-counts"], exact: false });
  }, [key]);
  return cutoff;
}

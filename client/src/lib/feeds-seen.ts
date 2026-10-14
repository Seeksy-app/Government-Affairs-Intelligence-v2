import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

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

export interface NewFeedItem {
  id: string;
  title: string;
  url: string | null;
  meta: string | null;
  at: string | null;
}

// Call on a feed page: marks the feed seen (clearing its badge) and returns
// what the badge was counting — fetched with the previous visit time, so the
// server's one definition of "new today" decides both the number and the list.
export function useNewItems(feed: "news" | "press"): { items: NewFeedItem[]; isNew: (id: string) => boolean } {
  const [since] = useState(() => lastSeen(feed)?.toISOString() ?? "");
  useEffect(() => {
    markSeen(feed);
  }, [feed]);
  const { data } = useQuery<{ items: NewFeedItem[] }>({
    queryKey: ["/api/feeds/new", feed, since],
    queryFn: async () => {
      const res = await fetch(`/api/feeds/new?feed=${feed}${since ? `&since=${encodeURIComponent(since)}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    // Re-ask now and then so a page left open past midnight drops yesterday's items.
    refetchInterval: 5 * 60 * 1000,
  });
  const items = data?.items ?? [];
  const ids = new Set(items.map((i) => i.id));
  return { items, isNew: (id) => ids.has(id) };
}

// For pages without a "new" list (Should I be worried?): opening clears the badge.
export function useMarkSeen(feed: FeedKey) {
  useEffect(() => {
    markSeen(feed);
  }, [feed]);
}

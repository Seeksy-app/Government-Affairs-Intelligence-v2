import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { BarChart3, Briefcase, ChevronRight, FileText, ScrollText, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { resolveAccentColor, formatVolume } from "@/lib/kalshi-visuals";
import type { Brief, ConcernLevel } from "@shared/schema";

// Right-hand column of the Today page: quick counts, recent answers, and a
// compact view of the prediction markets.

function RailLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

export function AtAGlance() {
  const { user } = useAuth();
  const { data: trackedBills } = useQuery<unknown[]>({ queryKey: ["/api/tracked-bills"], enabled: !!user });
  const { data: unreadChanges } = useQuery<unknown[]>({ queryKey: ["/api/tracked-bills/changes/unread"], enabled: !!user });
  const { data: briefs } = useQuery<Brief[]>({ queryKey: ["/api/briefs"], enabled: !!user });
  const { data: contacts } = useQuery<unknown[]>({ queryKey: ["/api/contacts"], enabled: !!user });
  const { data: staffStatus } = useQuery<{ currentStaffers: number }>({
    queryKey: ["/api/legistorm/status"],
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const rows = [
    {
      label: "Tracked bills",
      value: Array.isArray(trackedBills) ? trackedBills.length : null,
      note:
        Array.isArray(unreadChanges) && unreadChanges.length > 0
          ? `${unreadChanges.length} new update${unreadChanges.length === 1 ? "" : "s"}`
          : null,
      href: "/bills",
      icon: ScrollText,
    },
    { label: "Decision briefs", value: Array.isArray(briefs) ? briefs.length : null, note: null, href: "/briefs", icon: FileText },
    { label: "Contacts", value: Array.isArray(contacts) ? contacts.length : null, note: null, href: "/contacts", icon: Users },
    { label: "Congressional staff", value: staffStatus?.currentStaffers ?? null, note: null, href: "/staffers", icon: Briefcase },
  ];

  return (
    <Card>
      <CardContent className="p-0">
        <RailLabel>At a glance</RailLabel>
        <div className="divide-y">
          {rows.map((r) => (
            <Link
              key={r.label}
              href={r.href}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              data-testid={`link-quick-${r.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <r.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{r.label}</p>
                {r.note && <p className="text-xs font-semibold text-primary">{r.note}</p>}
              </div>
              <div className="text-lg font-bold tabular-nums tracking-tight">
                {r.value === null ? <Skeleton className="h-5 w-8" /> : r.value.toLocaleString()}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const CONCERN_DOT: Record<ConcernLevel, { dot: string; label: string }> = {
  low: { dot: "bg-emerald-500", label: "Low concern" },
  watch: { dot: "bg-amber-500", label: "Worth watching" },
  act: { dot: "bg-[#A53B39]", label: "Act now" },
};

export function RecentBriefs() {
  const { user } = useAuth();
  const { data: briefs } = useQuery<Brief[]>({ queryKey: ["/api/briefs"], enabled: !!user });
  const recent = (briefs ?? []).slice(0, 4);

  return (
    <Card>
      <CardContent className="p-0">
        <RailLabel action={<Link href="/briefs" className="text-xs font-semibold text-primary hover:underline">See all</Link>}>
          Recent questions
        </RailLabel>
        {recent.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            Questions you ask appear here with their answers, ready to share with clients.
          </p>
        ) : (
          <div className="divide-y">
            {recent.map((b) => {
              const level = b.content?.bottomLine?.level;
              const meta = level ? CONCERN_DOT[level] : null;
              return (
                <Link
                  key={b.id}
                  href={`/briefs/${b.id}`}
                  className="block px-4 py-3 transition-colors hover:bg-muted/50"
                  data-testid={`link-recent-brief-${b.id}`}
                >
                  <p className="text-sm font-semibold leading-snug line-clamp-2">{b.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {b.status === "generating" ? (
                      <>
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                        Writing…
                      </>
                    ) : meta ? (
                      <>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </>
                    ) : null}
                    {b.updatedAt && (
                      <span>
                        {(meta || b.status === "generating") && "· "}
                        {formatDistanceToNow(new Date(b.updatedAt), { addSuffix: true })}
                      </span>
                    )}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface KalshiMarket {
  ticker: string;
  title: string;
  yes_price: number;
  volume: number;
  color_code?: string | null;
}

const MARKET_CATEGORIES = [
  { id: "politics", label: "Politics", apiCategory: "Politics" },
  { id: "economics", label: "Economics", apiCategory: "Economics" },
  { id: "climate", label: "Climate", apiCategory: "Climate and Weather" },
  { id: "health", label: "Health", apiCategory: "Health" },
];

export function MarketsPanel() {
  const [category, setCategory] = useState(MARKET_CATEGORIES[0]);
  const { data: markets, isLoading } = useQuery<KalshiMarket[]>({
    queryKey: ["/api/kalshi/markets", category.id, "rail"],
    queryFn: async () => {
      const res = await fetch(`/api/kalshi/markets?category=${encodeURIComponent(category.apiCategory)}&limit=5`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch markets");
      const data = await res.json();
      return data.markets || data || [];
    },
    refetchInterval: 60_000,
  });

  return (
    <Card data-testid="section-predictions">
      <CardContent className="p-0">
        <RailLabel
          action={
            <Link href="/predictions" className="text-xs font-semibold text-primary hover:underline" data-testid="link-view-all-predictions">
              View all
            </Link>
          }
        >
          Prediction markets
        </RailLabel>
        <div className="flex gap-1 overflow-x-auto px-4 pb-2" role="tablist" aria-label="Market category">
          {MARKET_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category.id === c.id}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                category.id === c.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`btn-category-${c.id}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="space-y-3 px-4 pb-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : !markets || markets.length === 0 ? (
          <div className="flex items-center gap-2 px-4 pb-4 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4" /> No open markets in this category.
          </div>
        ) : (
          <div className="divide-y">
            {markets.slice(0, 5).map((m) => {
              const accent = resolveAccentColor(m.yes_price, m.color_code);
              return (
                <Link
                  key={m.ticker}
                  href="/predictions"
                  className="block px-4 py-2.5 transition-colors hover:bg-muted/50"
                  data-testid={`market-card-${m.ticker}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-snug line-clamp-2" data-testid={`market-title-${m.ticker}`}>
                      {m.title}
                    </p>
                    <span className="shrink-0 text-base font-bold tabular-nums" data-testid={`market-price-${m.ticker}`}>
                      {m.yes_price}%
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${m.yes_price}%`, backgroundColor: accent }} />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{formatVolume(m.volume)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

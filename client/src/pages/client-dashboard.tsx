import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Briefcase,
  ChevronRight,
  FileText,
  Landmark,
  ScrollText,
  Share2,
  Sunrise,
  Users,
} from "lucide-react";
import { getCategoryIcon, resolveAccentColor, formatCloseLabel, formatVolume } from "@/lib/kalshi-visuals";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/score-badge";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { Brief, ConcernLevel } from "@shared/schema";

const PREDICTION_CATEGORIES = [
  { id: "politics", label: "Politics", apiCategory: "Politics" },
  { id: "economics", label: "Economics", apiCategory: "Economics" },
  { id: "financials", label: "Financials", apiCategory: "Financials" },
  { id: "climate", label: "Climate", apiCategory: "Climate and Weather" },
  { id: "tech", label: "Tech", apiCategory: "Tech" },
  { id: "health", label: "Health", apiCategory: "Health" },
  { id: "world", label: "World", apiCategory: "World" },
  { id: "culture", label: "Culture", apiCategory: "Culture" },
  { id: "sports", label: "Sports", apiCategory: "Sports" },
];

// The brief follows the time of day.
function getBriefLabel() {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning Brief";
  if (hour < 17) return "Afternoon Brief";
  return "Evening Brief";
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getTodayLine() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

interface RankedItem {
  id: string;
  title: string;
  source: string;
  score: number;
  whyItMatters: string;
}

interface BriefResult {
  highRelevance: RankedItem[];
}

interface UserRole {
  isSuperAdmin: boolean;
  clientId?: string;
  clientName?: string;
  impersonatingClientId?: string;
  impersonatingClientName?: string;
}

interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle?: string | null;
  yes_price: number;
  volume: number;
  status: string;
  category?: string | null;
  close_time?: string | null;
  image_url?: string | null;
  color_code?: string | null;
}

// Relevance is information, not alarm: high scores get the brand blue.
function scoreColor(score: number) {
  if (score >= 70) return "bg-primary/10 text-primary border-primary/20";
  if (score >= 40) return "bg-muted text-foreground border-border";
  return "bg-muted text-muted-foreground border-border";
}

const CONCERN_DOT: Record<ConcernLevel, { dot: string; label: string }> = {
  low: { dot: "bg-emerald-500", label: "Low concern" },
  watch: { dot: "bg-amber-500", label: "Worth watching" },
  act: { dot: "bg-[#A53B39]", label: "Act now" },
};

function SectionHeading({
  title,
  href,
  linkLabel,
  testId,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  testId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
      {href && (
        <Button variant="ghost" size="sm" asChild className="shrink-0 text-muted-foreground hover:text-foreground">
          <Link href={href} data-testid={testId}>
            {linkLabel ?? "View all"} <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

export default function ClientDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [marketCategory, setMarketCategory] = useState("politics");

  const selectedCategory = PREDICTION_CATEGORIES.find(c => c.id === marketCategory) || PREDICTION_CATEGORIES[0];

  const { data: userRole } = useQuery<UserRole>({
    queryKey: ["/api/user/role"],
    enabled: !!user,
  });

  const effectiveClientId =
    userRole?.isSuperAdmin && userRole?.impersonatingClientId
      ? userRole.impersonatingClientId
      : userRole?.clientId;
  const firmName = userRole?.impersonatingClientName || userRole?.clientName;

  const {
    data: morningBrief,
    isLoading: morningBriefLoading,
    error: morningBriefError,
  } = useQuery<BriefResult>({
    queryKey: ["/api/morning-brief", effectiveClientId],
    queryFn: async () => {
      const res = await fetch(`/api/morning-brief/${effectiveClientId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `${res.status}`);
      }
      return res.json();
    },
    enabled: !!effectiveClientId,
    staleTime: 10 * 60 * 1000,
    retry: 1, // fail fast — surface the error instead of minutes of skeleton
  });

  const { data: predictionMarkets, isLoading: marketsLoading } = useQuery<KalshiMarket[]>({
    queryKey: ["/api/kalshi/markets", marketCategory],
    queryFn: async () => {
      const res = await fetch(`/api/kalshi/markets?category=${encodeURIComponent(selectedCategory.apiCategory)}&limit=8`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch markets");
      const data = await res.json();
      return data.markets || data || [];
    },
    refetchInterval: 60000,
  });

  // "At a glance" counts — each is an existing list endpoint the app already uses.
  const { data: trackedBills } = useQuery<unknown[]>({ queryKey: ["/api/tracked-bills"], enabled: !!user });
  const { data: unreadChanges } = useQuery<unknown[]>({ queryKey: ["/api/tracked-bills/changes/unread"], enabled: !!user });
  const { data: briefs } = useQuery<Brief[]>({ queryKey: ["/api/briefs"], enabled: !!user });
  const { data: contacts } = useQuery<unknown[]>({ queryKey: ["/api/contacts"], enabled: !!user });
  const { data: staffStatus } = useQuery<{ currentStaffers: number }>({
    queryKey: ["/api/legistorm/status"],
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const recentBriefs = (briefs ?? []).slice(0, 4);
  const firstName = user?.firstName;

  const glance = [
    {
      label: "Tracked bills",
      value: Array.isArray(trackedBills) ? trackedBills.length : null,
      note: Array.isArray(unreadChanges) && unreadChanges.length > 0 ? `${unreadChanges.length} new update${unreadChanges.length === 1 ? "" : "s"}` : null,
      href: "/bills",
      icon: ScrollText,
    },
    {
      label: "Decision briefs",
      value: Array.isArray(briefs) ? briefs.length : null,
      note: null,
      href: "/briefs",
      icon: FileText,
    },
    {
      label: "Contacts",
      value: Array.isArray(contacts) ? contacts.length : null,
      note: null,
      href: "/contacts",
      icon: Users,
    },
    {
      label: "Congressional staff",
      value: staffStatus?.currentStaffers ?? null,
      note: null,
      href: "/staffers",
      icon: Briefcase,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1760px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* Greeting */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary" data-testid="text-brief-date">
            {getTodayLine()}
          </p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight" data-testid="text-dashboard-title">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {firmName ? <>Here's what moved for <span className="font-semibold text-foreground">{firmName}</span>.</> : "Here's what moved today."}
          </p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-10">

            {/* Today's brief */}
            <section data-testid="section-morning-brief">
              <SectionHeading title={getBriefLabel()} href="/morning-brief" linkLabel="Open brief" testId="link-morning-brief-see-all">
                {!morningBriefLoading && morningBrief && (
                  <p className="text-sm text-muted-foreground">
                    Top priorities ranked for your firm · {morningBrief.highRelevance.length} item{morningBrief.highRelevance.length === 1 ? "" : "s"}
                  </p>
                )}
              </SectionHeading>

              {morningBriefLoading && (
                <Card>
                  <CardContent className="divide-y p-0">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-2 p-4">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {!morningBriefLoading && morningBriefError && (
                <Card>
                  <CardContent className="p-4">
                    <Link
                      href="/morning-brief"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      data-testid="link-morning-brief-error"
                    >
                      Couldn't load the brief. Open it to retry →
                    </Link>
                  </CardContent>
                </Card>
              )}

              {!morningBriefLoading && !morningBriefError && morningBrief && morningBrief.highRelevance.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center p-8 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Sunrise className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold">Nothing urgent right now</p>
                    <p className="mt-1 text-sm text-muted-foreground">Items worth watching are in the full brief.</p>
                  </CardContent>
                </Card>
              )}

              {!morningBriefLoading && !morningBriefError && morningBrief && morningBrief.highRelevance.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="divide-y">
                    {morningBrief.highRelevance.slice(0, 4).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(`/morning-brief?openItem=${item.id}`)}
                        className="group flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-muted/50"
                        data-testid={`morning-brief-card-${item.id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {item.source}
                          </p>
                          <p className="font-semibold leading-snug transition-colors group-hover:text-primary line-clamp-2">
                            {item.title}
                          </p>
                          {item.whyItMatters && (
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                              {item.whyItMatters}
                            </p>
                          )}
                        </div>
                        <ScoreBadge
                          score={item.score}
                          className={`mt-0.5 shrink-0 px-2 py-0.5 text-xs font-semibold ${scoreColor(item.score)}`}
                        />
                      </button>
                    ))}
                  </div>
                </Card>
              )}
            </section>

            {/* Prediction Markets */}
            <section data-testid="section-predictions">
              <SectionHeading title="Prediction markets" href="/predictions" testId="link-view-all-predictions">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live odds from Kalshi, refreshed every minute
                </p>
              </SectionHeading>

              <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Market category">
                {PREDICTION_CATEGORIES.map((cat) => {
                  const active = marketCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setMarketCategory(cat.id)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`btn-category-${cat.id}`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {marketsLoading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i}><CardContent className="p-4"><Skeleton className="mb-3 h-4 w-full" /><Skeleton className="mb-2 h-8 w-24" /><Skeleton className="h-1.5 w-full" /></CardContent></Card>
                  ))}
                </div>
              ) : predictionMarkets && predictionMarkets.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {predictionMarkets.slice(0, 4).map((market) => {
                    const accent = resolveAccentColor(market.yes_price, market.color_code);
                    const CategoryIcon = getCategoryIcon(market.category ?? selectedCategory.apiCategory);
                    const closeLabel = formatCloseLabel(market.close_time);
                    return (
                      <Card
                        key={market.ticker}
                        className="group cursor-pointer transition-colors hover:border-primary/30"
                        onClick={() => navigate("/predictions")}
                        data-testid={`market-card-${market.ticker}`}
                      >
                        <CardContent className="flex h-full flex-col p-4">
                          <div className="mb-3 flex items-start gap-2.5">
                            {market.image_url ? (
                              <img
                                src={market.image_url}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded-md bg-muted object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                                <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <p className="text-sm font-semibold leading-snug line-clamp-2" data-testid={`market-title-${market.ticker}`}>
                              {market.title}
                            </p>
                          </div>

                          <div className="mt-auto">
                            <div className="mb-1.5 flex items-baseline gap-1.5">
                              <span className="text-2xl font-bold tabular-nums tracking-tight" data-testid={`market-price-${market.ticker}`}>
                                {market.yes_price}%
                              </span>
                              <span className="text-xs text-muted-foreground">chance</span>
                            </div>
                            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full" style={{ width: `${market.yes_price}%`, backgroundColor: accent }} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatVolume(market.volume)} traded{closeLabel ? ` · ${closeLabel}` : ""}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center py-10 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold">No open markets in this category</p>
                    <p className="mt-1 text-sm text-muted-foreground">Try Politics or Economics.</p>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>

          {/* Right rail */}
          <aside className="space-y-6">
            <Card>
              <CardContent className="p-0">
                <p className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  At a glance
                </p>
                <div className="divide-y">
                  {glance.map((g) => (
                    <Link
                      key={g.label}
                      href={g.href}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      data-testid={`link-quick-${g.label.toLowerCase().replace(/\s/g, "-")}`}
                    >
                      <g.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{g.label}</p>
                        {g.note && <p className="text-xs font-semibold text-primary">{g.note}</p>}
                      </div>
                      <div className="text-lg font-bold tabular-nums tracking-tight">
                        {g.value === null ? <Skeleton className="h-5 w-8" /> : g.value.toLocaleString()}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 pb-2 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Recent briefs</p>
                  <Link href="/briefs" className="text-xs font-semibold text-primary hover:underline">All briefs</Link>
                </div>
                {recentBriefs.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">
                    Answers you ask for appear here, ready to share with clients.
                  </p>
                ) : (
                  <div className="divide-y">
                    {recentBriefs.map((b) => {
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

            <Card>
              <CardContent className="p-0">
                <p className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Build the path
                </p>
                <div className="divide-y">
                  {[
                    { label: "Staff directory", desc: "Find who covers an issue", href: "/staffers", icon: Briefcase },
                    { label: "Members of Congress", desc: "Offices, committees, contacts", href: "/network", icon: Landmark },
                    { label: "Client portals", desc: "Share briefs and bills with clients", href: "/portals", icon: Share2 },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

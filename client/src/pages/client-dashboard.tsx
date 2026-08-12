import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, BarChart3, FileText, TrendingUp, ArrowUpRight, ArrowDownRight, Minus, Landmark, Trophy, DollarSign, Beaker, Film, Heart, Globe, ChevronRight, Users, Sunrise, Cloud } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

const PREDICTION_CATEGORIES = [
  { id: "politics", label: "Politics", icon: Landmark, apiCategory: "Politics" },
  { id: "sports", label: "Sports", icon: Trophy, apiCategory: "Sports" },
  { id: "economics", label: "Economics", icon: DollarSign, apiCategory: "Economics" },
  { id: "financials", label: "Financials", icon: TrendingUp, apiCategory: "Financials" },
  { id: "climate", label: "Climate", icon: Cloud, apiCategory: "Climate and Weather" },
  { id: "tech", label: "Tech", icon: Beaker, apiCategory: "Tech" },
  { id: "culture", label: "Culture", icon: Film, apiCategory: "Culture" },
  { id: "health", label: "Health", icon: Heart, apiCategory: "Health" },
  { id: "world", label: "World", icon: Globe, apiCategory: "World" },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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
  impersonatingClientId?: string;
}

interface KalshiMarket {
  ticker: string;
  title: string;
  yes_price: number;
  volume: number;
  status: string;
}

function scoreColor(score: number) {
  if (score >= 70) return "bg-red-100 text-red-800 border-red-200";
  if (score >= 40) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function getPriceColor(price: number) {
  if (price >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (price >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function getPriceBarColor(price: number) {
  if (price >= 70) return "bg-emerald-500";
  if (price >= 40) return "bg-amber-500";
  return "bg-rose-500";
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
      const res = await fetch(`/api/kalshi/markets?category=${encodeURIComponent(selectedCategory.apiCategory)}&limit=4`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch markets");
      const data = await res.json();
      return data.markets || data || [];
    },
    refetchInterval: 60000,
  });

  const displayName = user?.firstName || user?.email?.split("@")[0] || "there";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Greeting */}
        <div className="text-center space-y-3" data-testid="card-welcome">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">
            {getGreeting()}, {displayName}
          </h1>
          <p className="text-muted-foreground" data-testid="text-dashboard-subtitle">
            Here's what's happening across your political intelligence
          </p>
        </div>

        {/* Morning Brief Hero */}
        <div data-testid="section-morning-brief">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sunrise className="h-5 w-5 text-amber-500" />
                Morning Brief
              </h2>
              {!morningBriefLoading && morningBrief && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {morningBrief.highRelevance.length} items waiting
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/morning-brief" data-testid="link-morning-brief-see-all">
                See all →
              </Link>
            </Button>
          </div>

          {morningBriefLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border p-4 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          )}

          {!morningBriefLoading && morningBriefError && (
            <Card>
              <CardContent className="p-4">
                <Link
                  href="/morning-brief"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  data-testid="link-morning-brief-error"
                >
                  Couldn't load Morning Brief — click to retry
                </Link>
              </CardContent>
            </Card>
          )}

          {!morningBriefLoading && !morningBriefError && morningBrief && morningBrief.highRelevance.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Sunrise className="h-8 w-8 text-amber-500 mx-auto mb-3" />
                <p className="font-medium text-sm mb-1">No urgent items today</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Check Worth Watching for items to monitor
                </p>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/morning-brief">See all →</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {!morningBriefLoading && !morningBriefError && morningBrief && morningBrief.highRelevance.length > 0 && (
            <div className="space-y-2">
              {morningBrief.highRelevance.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/morning-brief?openItem=${item.id}`)}
                  className="w-full text-left rounded-lg border p-4 hover:bg-accent/50 transition-colors group border-primary/30 bg-primary/5"
                  data-testid={`morning-brief-card-${item.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-muted-foreground block mb-1.5">
                        {item.source}
                      </span>
                      <p className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
                        {item.title}
                      </p>
                      {item.whyItMatters && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                          {item.whyItMatters}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs ${scoreColor(item.score)}`}
                    >
                      {item.score}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Prediction Markets */}
        <div data-testid="section-predictions">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              Prediction Markets
              <Badge variant="outline" className="text-xs ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                Live
              </Badge>
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/predictions" data-testid="link-view-all-predictions">
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>

          <div className="flex gap-1.5 mb-4 flex-wrap">
            {PREDICTION_CATEGORIES.map((cat) => {
              const CatIcon = cat.icon;
              return (
                <Button
                  key={cat.id}
                  variant={marketCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMarketCategory(cat.id)}
                  data-testid={`btn-category-${cat.id}`}
                >
                  <CatIcon className="h-3.5 w-3.5 mr-1.5" />
                  {cat.label}
                </Button>
              );
            })}
          </div>

          {marketsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}><CardContent className="p-5"><Skeleton className="h-4 w-full mb-3" /><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-2 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : predictionMarkets && predictionMarkets.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {predictionMarkets.slice(0, 4).map((market) => (
                <Card
                  key={market.ticker}
                  className="cursor-pointer hover-elevate overflow-visible"
                  onClick={() => navigate("/predictions")}
                  data-testid={`market-card-${market.ticker}`}
                >
                  <CardContent className="p-5">
                    <p className="text-sm font-medium line-clamp-2 mb-4 min-h-[2.5rem]" data-testid={`market-title-${market.ticker}`}>
                      {market.title}
                    </p>
                    <div className="flex items-end justify-between gap-2 mb-3">
                      <span className={`text-2xl font-bold ${getPriceColor(market.yes_price)}`} data-testid={`market-price-${market.ticker}`}>
                        {market.yes_price}%
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {market.yes_price >= 60 ? (
                          <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                        ) : market.yes_price <= 40 ? (
                          <ArrowDownRight className="h-3 w-3 text-rose-500" />
                        ) : (
                          <Minus className="h-3 w-3 text-amber-500" />
                        )}
                        <span>Vol: {market.volume >= 1000 ? `${(market.volume / 1000).toFixed(1)}k` : market.volume.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getPriceBarColor(market.yes_price)}`}
                        style={{ width: `${market.yes_price}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">Yes</span>
                      <span className="text-[10px] text-muted-foreground">No</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-10 text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No prediction markets available for this category</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Access */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Quick Access</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Contacts", desc: "Manage your political network", href: "/contacts", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
              { label: "News Feed", desc: "Latest political developments", href: "/news", icon: Newspaper, color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { label: "Legislation", desc: "Track bills and votes", href: "/bills", icon: FileText, color: "text-violet-500", bg: "bg-violet-500/10" },
              { label: "Predictions", desc: "Political prediction markets", href: "/predictions", icon: BarChart3, color: "text-indigo-500", bg: "bg-indigo-500/10" },
              { label: "Congressional", desc: "Members and schedules", href: "/congressional", icon: Landmark, color: "text-amber-500", bg: "bg-amber-500/10" },
              { label: "Network Map", desc: "Visualize relationships", href: "/network", icon: TrendingUp, color: "text-rose-500", bg: "bg-rose-500/10" },
            ].map((item) => (
              <Card key={item.href} className="cursor-pointer hover-elevate overflow-visible" onClick={() => navigate(item.href)} data-testid={`link-quick-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

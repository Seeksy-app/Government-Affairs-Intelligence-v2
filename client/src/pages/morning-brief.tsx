import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/score-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sun,
  Sunrise,
  Sunset,
  ExternalLink,
  FileText,
  Users,
  AlertCircle,
  Clock,
  Info,
  RefreshCw,
  ChevronRight,
  Loader2,
  ShieldQuestion,
} from "lucide-react";
import { useAskBrief } from "@/components/briefs/ask-box";
import { PageHeader } from "@/components/page-header";
import { AtAGlance, MarketsPanel } from "@/components/today/today-rail";
import { RecentQuestions } from "@/components/today/recent-questions";
import { BannerWeather } from "@/components/today/banner-weather";
import { WeatherWatchCard } from "@/components/today/weather-watch";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FocusPerson {
  name: string;
  title: string;
  office: string;
}

interface RankedItem {
  id: string;
  type: "press_release" | "news";
  title: string;
  summary: string | null;
  source: string;
  url: string;
  publishedAt: string | null;
  score: number;
  whyItMatters: string;
  whoToFocusOn: FocusPerson[];
}

interface BriefResult {
  clientId: string;
  clientName: string;
  industries: string[];
  watchlistTopics: string[];
  highRelevance: RankedItem[];
  worthWatching: RankedItem[];
  generatedAt: string;
  scoringMetadata: {
    totalItemsConsidered: number;
    highRelevanceCount: number;
    worthWatchingCount: number;
    ignoredCount: number;
    claudeCallsMadeThisRender: number;
    windowUsedHours: number;
  };
}

interface UserRole {
  isSuperAdmin: boolean;
  clientId?: string;
  impersonatingClientId?: string;
  impersonatingClientName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function scoreColor(score: number) {
  // Relevance is information, not alarm: high scores get the brand blue.
  if (score >= 70) return "bg-primary/10 text-primary border-primary/20";
  if (score >= 40) return "bg-muted text-foreground border-border";
  return "bg-muted text-muted-foreground border-border";
}

// Left accent bar per relevance tier — the card's at-a-glance signal.
function accentClass(score: number) {
  if (score >= 70) return "border-l-primary";
  if (score >= 40) return "border-l-primary/35";
  return "border-l-border";
}

// The brief's identity follows the clock (matches the dashboard header).
function getBriefIdentity() {
  const hour = new Date().getHours();
  if (hour < 12) return { label: "Morning Brief", Icon: Sunrise };
  if (hour < 17) return { label: "Afternoon Brief", Icon: Sun };
  return { label: "Evening Brief", Icon: Sunset };
}

function getTodayLine() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ─── Side Panel ───────────────────────────────────────────────────────────────

function ItemPanel({
  item,
  open,
  onClose,
  onCreateBrief,
  onAsk,
  isAsking,
}: {
  item: RankedItem | null;
  open: boolean;
  onClose: () => void;
  onCreateBrief: (item: RankedItem) => void;
  onAsk: (item: RankedItem) => void;
  isAsking: boolean;
}) {
  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pr-8">
          <div className="flex items-center gap-2 mb-2">
            <ScoreBadge
              score={item.score}
              label="Score"
              className={`px-2.5 py-0.5 text-xs font-semibold ${scoreColor(item.score)}`}
            />
            <Badge variant="outline" className="text-xs">
              {item.type === "press_release" ? "Press Release" : "News"}
            </Badge>
          </div>
          <SheetTitle className="text-base font-semibold leading-snug text-left">
            {item.title}
          </SheetTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className="font-medium">{item.source}</span>
            {item.publishedAt && (
              <>
                <span>·</span>
                <Clock className="h-3 w-3" />
                <span>{formatDate(item.publishedAt)}</span>
              </>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Why it matters */}
          {item.whyItMatters && (
            <div className="rounded-lg bg-primary/5 border border-primary/15 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                Why It Matters
              </p>
              <p className="text-sm leading-relaxed">{item.whyItMatters}</p>
            </div>
          )}

          {/* Summary */}
          {item.summary && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Summary
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.summary}
              </p>
            </div>
          )}

          {/* Suggested contacts */}
          {item.whoToFocusOn.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Suggested Contacts
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center">
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 px-1.5 ml-1 cursor-default"
                        >
                          beta
                        </Badge>
                        <Info className="h-3 w-3 text-muted-foreground ml-1" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      These matches are keyword-based and may not reflect precise
                      jurisdiction. Manual verification recommended.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="space-y-2">
                {item.whoToFocusOn.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.title}
                      {p.office && ` · ${p.office}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2 border-t">
            {item.url && (
              <Button variant="outline" size="sm" asChild>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Read original
                </a>
              </Button>
            )}
            <Button size="sm" onClick={() => onAsk(item)} disabled={isAsking}>
              {isAsking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldQuestion className="h-4 w-4 mr-2" />
              )}
              Should I be worried?
            </Button>
            {item.url && (
              <Button variant="ghost" size="sm" onClick={() => onCreateBrief(item)}>
                <FileText className="h-4 w-4 mr-2" />
                Brief from this article only
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  highlight,
  onClick,
}: {
  item: RankedItem;
  highlight: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border border-l-[3px] bg-card shadow-sm transition-colors group hover:border-primary/30 ${accentClass(
        item.score,
      )} ${highlight ? "p-5" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {item.source}
            </span>
            {item.publishedAt && (
              <>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(item.publishedAt)}
                </span>
              </>
            )}
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
              {item.type === "press_release" ? "Press Release" : "News"}
            </Badge>
          </div>
          <p
            className={`font-semibold leading-snug group-hover:text-primary transition-colors ${
              highlight ? "text-base line-clamp-3" : "text-sm line-clamp-2"
            }`}
          >
            {item.title}
          </p>
          {item.whyItMatters && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed border-l-2 border-primary/20 pl-2.5">
              {item.whyItMatters}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <ScoreBadge
            score={item.score}
            className={`min-w-[2.25rem] px-1.5 py-0.5 text-sm font-bold ${scoreColor(
              item.score,
            )}`}
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-colors" />
        </div>
      </div>
    </button>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function BriefSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border p-4 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MorningBriefPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedItem, setSelectedItem] = useState<RankedItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: userRole } = useQuery<UserRole>({
    queryKey: ["/api/user/role"],
    enabled: !!user,
  });

  const effectiveClientId =
    userRole?.isSuperAdmin && userRole?.impersonatingClientId
      ? userRole.impersonatingClientId
      : userRole?.clientId;

  const {
    data: brief,
    isLoading,
    error,
    refetch,
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
    staleTime: 10 * 60 * 1000, // match server-side cache TTL
    retry: 1, // fail fast — surface the error instead of minutes of skeleton
  });

  function openItem(item: RankedItem) {
    setSelectedItem(item);
    setPanelOpen(true);
  }

  // Auto-open item from ?openItem= query param (deep-link from dashboard)
  useEffect(() => {
    if (!brief) return;
    const params = new URLSearchParams(window.location.search);
    const openItemId = params.get("openItem");
    if (!openItemId) return;

    const allItems = [...brief.highRelevance, ...brief.worthWatching];
    const item = allItems.find((i) => i.id === openItemId);
    if (item) {
      setSelectedItem(item);
      setPanelOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [brief]);

  function contextFor(item: RankedItem): string | null {
    if (!brief) return null;
    const lines: string[] = [];
    lines.push(`Client: ${brief.clientName}`);
    if (brief.industries?.length) lines.push(`Industries: ${brief.industries.join(", ")}`);
    if (brief.watchlistTopics?.length) lines.push(`Watchlist topics: ${brief.watchlistTopics.join(", ")}`);
    if (item.whyItMatters) lines.push(`\nWhy this item matters: ${item.whyItMatters}`);
    return lines.join("\n").slice(0, 2000);
  }

  function handleCreateBrief(item: RankedItem) {
    const params = new URLSearchParams();
    if (item.url) params.set("url0", item.url);
    params.set("title", item.title.slice(0, 120));
    const context = contextFor(item);
    if (context) params.set("clientContext", context);
    navigate(`/briefs/new?${params.toString()}`);
  }

  // The headline (plus its link) goes through automatic source discovery.
  const ask = useAskBrief();
  function handleAsk(item: RankedItem) {
    const question = [item.title, item.url].filter(Boolean).join("\n").slice(0, 1000);
    ask.mutate({ question, clientContext: contextFor(item) });
  }

  const generatedAt = brief?.generatedAt
    ? new Date(brief.generatedAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const { label: briefLabel } = getBriefIdentity();
  const greeting = briefLabel.startsWith("Morning") ? "Good morning" : briefLabel.startsWith("Afternoon") ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8 xl:px-14 2xl:px-20">
        {/* Today: the Morning Brief is the page; the rail keeps the at-a-glance pieces.
            The greeting sits on a Capitol Navy banner — the page's one splash of color. */}
        <div className="relative mb-8 overflow-hidden rounded-xl bg-[#14253D] px-6 py-6 text-white shadow-md sm:px-8 dark:bg-[#0F1D31] dark:ring-1 dark:ring-white/10">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#078ACB]/25 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6CC3EE]">{getTodayLine()}</p>
              <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-white" data-testid="text-dashboard-title">
                {greeting}
                {user?.firstName ? `, ${user.firstName}` : ""}
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-white/75">
                <span data-testid="text-brief-title">Your {briefLabel.toLowerCase()}</span> for{" "}
                <span className="font-semibold text-white">{brief?.clientName ?? "your firm"}</span>, ranked from the last{" "}
                {brief?.scoringMetadata.windowUsedHours ?? 48} hours of news and agency press releases
                {generatedAt && <> · updated {generatedAt}</>}
              </p>
              {brief && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#078ACB] px-2.5 py-1 text-xs font-semibold text-white">
                    {brief.highRelevance.length} top priorit{brief.highRelevance.length === 1 ? "y" : "ies"}
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/85">
                    {brief.worthWatching.length} worth watching
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/85">
                    {brief.scoringMetadata.totalItemsConsidered} items reviewed
                  </span>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    data-testid="button-refresh-brief"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </button>
                </div>
              )}
            </div>
            <BannerWeather />
          </div>
        </div>

        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <RecentQuestions />
          <div className="min-w-0" data-testid="section-morning-brief">
            {/* Loading */}
            {isLoading && (
              <div>
                <Skeleton className="h-4 w-32 mb-3" />
                <BriefSkeleton />
              </div>
            )}

            {/* No client context */}
            {!isLoading && !effectiveClientId && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">No client context</p>
                <p className="text-xs text-muted-foreground">
                  Impersonate a client from the Admin panel to view their morning brief.
                </p>
              </div>
            )}

            {/* Error */}
            {!isLoading && error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Couldn't load the brief</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{(error as Error).message}</p>
                </div>
              </div>
            )}

            {/* Content */}
            {!isLoading && brief && (
              <div className="space-y-6">
                {/* Priorities first, full width; the watch list below in two
                    columns so neither side leaves a dead zone. */}
                <div className="space-y-8">
                  <section className="min-w-0">
                    <h2 className="mb-3 text-lg font-semibold tracking-tight">Top priorities</h2>
                    {brief.highRelevance.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nothing urgent in this window — a quiet day for {brief.clientName}.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {brief.highRelevance.map((item) => (
                          <ItemCard key={item.id} item={item} highlight onClick={() => openItem(item)} />
                        ))}
                      </div>
                    )}
                  </section>

                  {brief.worthWatching.length > 0 && (
                    <section className="min-w-0">
                      <h2 className="mb-3 text-lg font-semibold tracking-tight">Worth watching</h2>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {brief.worthWatching.map((item) => (
                          <ItemCard key={item.id} item={item} highlight={false} onClick={() => openItem(item)} />
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                <p className="text-xs text-muted-foreground text-center pb-4">
                  {brief.scoringMetadata.ignoredCount} lower-relevance items not shown
                </p>
              </div>
            )}
          </div>

          </div>

          <aside className="space-y-6">
            <WeatherWatchCard />
            <AtAGlance />
            <MarketsPanel />
          </aside>
        </div>
      </div>

      {/* Side Panel */}
      <ItemPanel
        item={selectedItem}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onCreateBrief={handleCreateBrief}
        onAsk={handleAsk}
        isAsking={ask.isPending}
      />
    </div>
  );
}

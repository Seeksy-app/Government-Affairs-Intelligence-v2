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
} from "lucide-react";

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
  if (score >= 70) return "bg-red-100 text-red-800 border-red-200";
  if (score >= 40) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

// Left accent bar per relevance tier — the card's at-a-glance signal.
function accentClass(score: number) {
  if (score >= 70) return "border-l-red-400";
  if (score >= 40) return "border-l-amber-400";
  return "border-l-slate-300";
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
}: {
  item: RankedItem | null;
  open: boolean;
  onClose: () => void;
  onCreateBrief: (item: RankedItem) => void;
}) {
  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pr-8">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={scoreColor(item.score)}>
              Score {item.score}
            </Badge>
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
            {item.url && (
              <Button size="sm" onClick={() => onCreateBrief(item)}>
                <FileText className="h-4 w-4 mr-2" />
                Create Brief from This
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
      className={`w-full text-left rounded-xl border border-l-4 bg-card transition-all group hover:shadow-md hover:-translate-y-px ${accentClass(
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
          <span
            className={`inline-flex items-center justify-center min-w-[2.25rem] rounded-md border px-1.5 py-0.5 text-sm font-bold tabular-nums ${scoreColor(
              item.score,
            )}`}
          >
            {item.score}
          </span>
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
      window.history.replaceState(null, "", "/morning-brief");
    }
  }, [brief]);

  function handleCreateBrief(item: RankedItem) {
    const params = new URLSearchParams();
    if (item.url) params.set("url0", item.url);
    params.set("title", item.title.slice(0, 120));
    if (brief) {
      const lines: string[] = [];
      lines.push(`Client: ${brief.clientName}`);
      if (brief.industries?.length) lines.push(`Industries: ${brief.industries.join(", ")}`);
      if (brief.watchlistTopics?.length) lines.push(`Watchlist topics: ${brief.watchlistTopics.join(", ")}`);
      if (item.whyItMatters) lines.push(`\nWhy this item matters: ${item.whyItMatters}`);
      params.set("clientContext", lines.join("\n"));
    }
    navigate(`/briefs/new?${params.toString()}`);
  }

  const generatedAt = brief?.generatedAt
    ? new Date(brief.generatedAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const { label: briefLabel, Icon: BriefIcon } = getBriefIdentity();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        {/* Masthead */}
        <div className="border-b pb-6 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <BriefIcon className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight" data-testid="text-brief-title">
                  {briefLabel}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {getTodayLine()}
                  {brief?.clientName && <> · {brief.clientName}</>}
                  {generatedAt && <> · generated {generatedAt}</>}
                </p>
              </div>
            </div>
            {brief && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="shrink-0"
                data-testid="button-refresh-brief"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Refresh
              </Button>
            )}
          </div>
          {brief && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-xs font-medium rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                {brief.scoringMetadata.totalItemsConsidered} items scored
              </span>
              <span className="text-xs font-medium rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                last {brief.scoringMetadata.windowUsedHours}h
              </span>
              <span className="text-xs font-medium rounded-full bg-red-50 text-red-700 px-2.5 py-1 dark:bg-red-950/40 dark:text-red-300">
                {brief.highRelevance.length} high priority
              </span>
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-8">
            <div>
              <Skeleton className="h-4 w-32 mb-3" />
              <BriefSkeleton />
            </div>
          </div>
        )}

        {/* No client context */}
        {!isLoading && !effectiveClientId && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">No client context</p>
            <p className="text-xs text-muted-foreground">
              Impersonate a client from the Admin panel to view their morning
              brief.
            </p>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Failed to load brief</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(error as Error).message}
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        {!isLoading && brief && (
          <div className="space-y-8">
            {/* Top Priorities */}
            <section>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Top Priorities
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {brief.highRelevance.length}
                </Badge>
              </div>
              {brief.highRelevance.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing urgent in this window — a quiet day for {brief.clientName}.
                </p>
              ) : (
                <div className="space-y-3">
                  {brief.highRelevance.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      highlight
                      onClick={() => openItem(item)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Worth Watching */}
            {brief.worthWatching.length > 0 && (
              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Worth Watching
                  </h2>
                  <Badge variant="outline" className="text-xs">
                    {brief.worthWatching.length}
                  </Badge>
                </div>
                <div className="space-y-2.5">
                  {brief.worthWatching.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      highlight={false}
                      onClick={() => openItem(item)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Footer metadata */}
            <p className="text-xs text-muted-foreground text-center pb-4">
              {brief.scoringMetadata.ignoredCount} items scored below threshold ·{" "}
              {brief.scoringMetadata.claudeCallsMadeThisRender} Claude call
            </p>
          </div>
        )}
      </div>

      {/* Side Panel */}
      <ItemPanel
        item={selectedItem}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onCreateBrief={handleCreateBrief}
      />
    </div>
  );
}

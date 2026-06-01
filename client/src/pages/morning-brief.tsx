import { useState } from "react";
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
  ExternalLink,
  FileText,
  Users,
  AlertCircle,
  Clock,
  Info,
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
      className={`w-full text-left rounded-lg border p-4 hover:bg-accent/50 transition-colors group ${
        highlight ? "border-primary/30 bg-primary/5" : "bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">
              {item.source}
            </span>
            {item.publishedAt && (
              <>
                <span className="text-muted-foreground/50 text-xs">·</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(item.publishedAt)}
                </span>
              </>
            )}
          </div>
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
  });

  function openItem(item: RankedItem) {
    setSelectedItem(item);
    setPanelOpen(true);
  }

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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sun className="h-5 w-5 text-amber-500" />
              <h1 className="text-xl font-semibold">Morning Brief</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {brief?.clientName ?? "Loading..."}
              {generatedAt && (
                <span className="ml-2 text-xs">· Generated {generatedAt}</span>
              )}
            </p>
          </div>
          {brief && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="text-xs text-muted-foreground">
                {brief.scoringMetadata.totalItemsConsidered} items scored ·{" "}
                {brief.scoringMetadata.windowUsedHours}h window
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="shrink-0"
              >
                Refresh
              </Button>
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
            {/* High Relevance */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  High Relevance
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {brief.highRelevance.length}
                </Badge>
              </div>
              {brief.highRelevance.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No high-relevance items in this window.
                </p>
              ) : (
                <div className="space-y-2">
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
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Worth Watching
                  </h2>
                  <Badge variant="outline" className="text-xs">
                    {brief.worthWatching.length}
                  </Badge>
                </div>
                <div className="space-y-2">
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

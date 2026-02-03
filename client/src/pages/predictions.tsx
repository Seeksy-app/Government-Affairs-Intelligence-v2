import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, RefreshCw, Clock, Plus, Activity, Info } from "lucide-react";

interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle?: string;
  yes_price: number;
  no_price: number;
  volume: number;
  open_interest: number;
  status: string;
  close_time: string;
  result?: string;
  category?: string;
}

type FilterCategory = "all" | "us-elections" | "primaries" | "trump" | "foreign" | "international" | "congress" | "scotus" | "local";

const CATEGORY_TABS: { value: FilterCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "us-elections", label: "US Elections" },
  { value: "primaries", label: "Primaries" },
  { value: "trump", label: "Trump" },
  { value: "foreign", label: "Foreign Elections" },
  { value: "international", label: "International" },
  { value: "congress", label: "Congress" },
  { value: "scotus", label: "SCOTUS & courts" },
  { value: "local", label: "Local" },
];

const REFRESH_INTERVAL = 20 * 60 * 1000;
const INITIAL_DISPLAY_COUNT = 20;

export default function PredictionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>("all");
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  const [selectedMarket, setSelectedMarket] = useState<KalshiMarket | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [timeUntilRefresh, setTimeUntilRefresh] = useState<string>("20m");

  const { data: marketsData, isLoading, refetch, isFetching } = useQuery<{ markets: KalshiMarket[]; cursor?: string }>({
    queryKey: ["/api/kalshi/markets"],
    queryFn: async () => {
      const res = await fetch("/api/kalshi/markets?status=open&limit=200", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch markets: ${res.status}`);
      }
      return res.json();
    },
    refetchInterval: REFRESH_INTERVAL,
    staleTime: REFRESH_INTERVAL - 60000,
  });

  useEffect(() => {
    if (marketsData) {
      setLastRefresh(new Date());
    }
  }, [marketsData]);

  const updateCountdown = useCallback(() => {
    const now = new Date();
    const nextRefresh = new Date(lastRefresh.getTime() + REFRESH_INTERVAL);
    const diff = nextRefresh.getTime() - now.getTime();
    if (diff <= 0) {
      setTimeUntilRefresh("...");
    } else {
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      if (minutes > 0) {
        setTimeUntilRefresh(`${minutes}m ${seconds}s`);
      } else {
        setTimeUntilRefresh(`${seconds}s`);
      }
    }
  }, [lastRefresh]);

  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateCountdown]);

  const markets = marketsData?.markets || [];

  const getCategoryKeywords = (category: FilterCategory): string[] => {
    switch (category) {
      case "us-elections":
        return ["president", "presidential", "election", "2024", "2028", "nominee", "democratic", "republican", "vote"];
      case "primaries":
        return ["primary", "primaries", "nomination", "caucus"];
      case "trump":
        return ["trump", "maga", "donald"];
      case "foreign":
        return ["foreign", "uk", "france", "germany", "brazil", "mexico", "canada", "australia", "japan", "india", "china", "russia", "starmer", "macron", "trudeau"];
      case "international":
        return ["international", "world", "global", "khamenei", "iran", "israel", "ukraine", "war", "nato", "un", "leader"];
      case "congress":
        return ["congress", "senate", "house", "bill", "legislation", "speaker", "representative", "senator"];
      case "scotus":
        return ["supreme", "court", "scotus", "judge", "justice", "ruling", "decision"];
      case "local":
        return ["governor", "mayor", "state", "local", "city"];
      default:
        return [];
    }
  };

  const filteredMarkets = markets
    .filter((market) => {
      const matchesSearch = searchQuery === "" || 
        market.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        market.ticker.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (categoryFilter === "all") return matchesSearch;
      
      const title = market.title.toLowerCase();
      const keywords = getCategoryKeywords(categoryFilter);
      const matchesCategory = keywords.some(keyword => title.includes(keyword));
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => b.volume - a.volume);

  const visibleMarkets = filteredMarkets.slice(0, displayCount);
  const hasMore = filteredMarkets.length > displayCount;

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${Math.round(vol / 1000)}K`;
    return `$${vol}`;
  };

  const formatVolumeCompact = (vol: number) => {
    if (vol >= 1000000000) return `$${(vol / 1000000000).toFixed(2)}B`;
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(0)}M`;
    if (vol >= 1000) return `$${Math.round(vol / 1000)}K`;
    return `$${vol}`;
  };

  const handleShowMore = () => {
    setDisplayCount(prev => prev + 20);
  };

  const handleMarketClick = (market: KalshiMarket) => {
    setSelectedMarket(market);
  };

  const MarketCard = ({ market }: { market: KalshiMarket }) => {
    return (
      <Card 
        className="hover-elevate cursor-pointer"
        onClick={() => handleMarketClick(market)}
        data-testid={`card-market-${market.ticker}`}
      >
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              <span className="text-xl font-semibold text-muted-foreground" aria-hidden="true">
                {market.title.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm leading-tight line-clamp-2 mb-3">
                {market.title}
              </h3>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-sm truncate flex-1">
                    {market.yes_price >= 50 ? "Yes" : "No"} likely
                  </span>
                  <span className="font-semibold text-sm">
                    {Math.max(market.yes_price, market.no_price)}%
                  </span>
                  <div className="flex gap-1">
                    <Badge 
                      variant="outline"
                      className="cursor-pointer bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Yes
                    </Badge>
                    <Badge 
                      variant="outline"
                      className="cursor-pointer bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400"
                      onClick={(e) => e.stopPropagation()}
                    >
                      No
                    </Badge>
                  </div>
                </div>
                
                {market.subtitle && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-sm truncate flex-1">
                      {market.subtitle.slice(0, 30)}
                    </span>
                    <span className="font-semibold text-sm">
                      {Math.min(market.yes_price, market.no_price)}%
                    </span>
                    <div className="flex gap-1">
                      <Badge 
                        variant="outline"
                        className="cursor-pointer bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Yes
                      </Badge>
                      <Badge 
                        variant="outline"
                        className="cursor-pointer bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        No
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <span className="text-muted-foreground text-sm">
              {formatVolumeCompact(market.volume)}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleMarketClick(market);
              }}
              aria-label={`View details for ${market.title}`}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-markets"
            aria-label="Search prediction markets"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-4 h-4" aria-hidden="true" />
            <span>Next refresh: {timeUntilRefresh}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-markets"
            aria-label="Refresh markets"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div 
        className="flex gap-2 overflow-x-auto pb-2" 
        role="tablist" 
        aria-label="Market categories"
      >
        {CATEGORY_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={categoryFilter === tab.value ? "default" : "secondary"}
            size="sm"
            onClick={() => {
              setCategoryFilter(tab.value);
              setDisplayCount(INITIAL_DISPLAY_COUNT);
            }}
            role="tab"
            aria-selected={categoryFilter === tab.value}
            data-testid={`tab-${tab.value}`}
            className="whitespace-nowrap"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <h2 className="text-2xl font-bold">Politics</h2>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : visibleMarkets.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleMarkets.map((market) => (
              <MarketCard key={market.ticker} market={market} />
            ))}
          </div>
          
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleShowMore}
                data-testid="button-show-more"
              >
                Load More ({filteredMarkets.length - displayCount} remaining)
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <Activity className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <h3 className="font-medium mb-2">No Markets Found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery || categoryFilter !== "all" 
                ? "Try adjusting your filters or search query."
                : "No prediction markets are currently available."}
            </p>
            {(searchQuery || categoryFilter !== "all") && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedMarket} onOpenChange={(open) => !open && setSelectedMarket(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-3">
              <div className="flex-1">
                <Badge variant="outline" className="mb-2">{selectedMarket?.ticker}</Badge>
                <h2 className="text-xl font-bold">{selectedMarket?.title}</h2>
                {selectedMarket?.subtitle && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedMarket.subtitle}</p>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedMarket && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Yes</p>
                    <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                      {selectedMarket.yes_price}%
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">No</p>
                    <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">
                      {selectedMarket.no_price}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-teal-600 dark:text-teal-400">Yes: {selectedMarket.yes_price}%</span>
                  <span className="text-rose-600 dark:text-rose-400">No: {selectedMarket.no_price}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-teal-500 transition-all"
                    style={{ width: `${selectedMarket.yes_price}%` }}
                  />
                  <div 
                    className="h-full bg-rose-500 transition-all"
                    style={{ width: `${selectedMarket.no_price}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Volume</p>
                  <p className="font-bold">{formatVolume(selectedMarket.volume)}</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Open Interest</p>
                  <p className="font-bold">{formatVolume(selectedMarket.open_interest)}</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <p className="font-bold capitalize">{selectedMarket.status}</p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg border">
                <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  This is a prediction market showing crowd-sourced probability estimates. 
                  Odds update in real-time based on market activity.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

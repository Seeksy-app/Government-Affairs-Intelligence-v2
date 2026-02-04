import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, RefreshCw, Clock, Plus, Activity, SlidersHorizontal, ArrowUpDown, TrendingUp, Landmark, DollarSign, Globe, User, Vote, Scale, MapPin, BarChart3 } from "lucide-react";

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

type PoliticsSubFilter = "all" | "us-elections" | "primaries" | "trump" | "foreign" | "international" | "house" | "congress" | "scotus" | "local" | "recurring";

type SortOption = "volume" | "newest" | "closing-soon" | "probability";

const POLITICS_SUB_FILTERS: { value: PoliticsSubFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "us-elections", label: "US Elections" },
  { value: "primaries", label: "Primaries" },
  { value: "trump", label: "Trump" },
  { value: "foreign", label: "Foreign Elections" },
  { value: "international", label: "International" },
  { value: "house", label: "House" },
  { value: "congress", label: "Congress" },
  { value: "scotus", label: "SCOTUS & courts" },
  { value: "local", label: "Local" },
  { value: "recurring", label: "Recurring" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "volume", label: "Volume (High to Low)" },
  { value: "newest", label: "Newest First" },
  { value: "closing-soon", label: "Closing Soon" },
  { value: "probability", label: "Highest Probability" },
];

const REFRESH_INTERVAL = 20 * 60 * 1000;
const INITIAL_DISPLAY_COUNT = 20;

export default function PredictionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [politicsSubFilter, setPoliticsSubFilter] = useState<PoliticsSubFilter>("congress");
  const [sortOption, setSortOption] = useState<SortOption>("volume");
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

  const getPoliticsSubFilterKeywords = (subFilter: PoliticsSubFilter): string[] => {
    switch (subFilter) {
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
      case "house":
        return ["house", "representative", "speaker", "mccarthy", "jeffries"];
      case "congress":
        return ["congress", "senate", "house", "bill", "legislation", "speaker", "representative", "senator", "shutdown", "funding", "government", "dhs", "fed", "cabinet", "nomination", "confirmation"];
      case "scotus":
        return ["supreme", "court", "scotus", "judge", "justice", "ruling", "decision"];
      case "local":
        return ["governor", "mayor", "state", "local", "city", "florida", "texas", "california"];
      case "recurring":
        return ["weekly", "monthly", "daily", "recurring", "regular", "annually"];
      default:
        return [];
    }
  };

  const sortMarkets = (marketsToSort: KalshiMarket[]): KalshiMarket[] => {
    switch (sortOption) {
      case "volume":
        return [...marketsToSort].sort((a, b) => b.volume - a.volume);
      case "newest":
        return [...marketsToSort].sort((a, b) => new Date(b.close_time).getTime() - new Date(a.close_time).getTime());
      case "closing-soon":
        return [...marketsToSort].sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime());
      case "probability":
        return [...marketsToSort].sort((a, b) => Math.max(b.yes_price, b.no_price) - Math.max(a.yes_price, a.no_price));
      default:
        return marketsToSort;
    }
  };

  const filteredMarkets = sortMarkets(markets
    .filter((market) => {
      const matchesSearch = searchQuery === "" || 
        market.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        market.ticker.toLowerCase().includes(searchQuery.toLowerCase());
      
      const title = market.title.toLowerCase();
      
      // Base political keywords to ensure we're showing political markets
      const politicalKeywords = ["president", "election", "congress", "senate", "house", "vote", "trump", "biden", "democrat", "republican", "governor", "mayor", "supreme", "court", "shutdown", "government", "funding", "cabinet", "fed", "nominee", "leader", "khamenei", "aliens"];
      const isPolitical = politicalKeywords.some(keyword => title.includes(keyword));
      
      if (!isPolitical && politicsSubFilter !== "all") {
        return false;
      }
      
      if (politicsSubFilter !== "all") {
        const subKeywords = getPoliticsSubFilterKeywords(politicsSubFilter);
        const matchesSubFilter = subKeywords.some(keyword => title.includes(keyword));
        return matchesSearch && matchesSubFilter;
      }
      
      return matchesSearch && isPolitical;
    }));

  const visibleMarkets = filteredMarkets.slice(0, displayCount);
  const hasMore = filteredMarkets.length > displayCount;

  const formatVolumeCompact = (vol: number) => {
    if (vol >= 1000000000) return `$${(vol / 1000000000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    if (vol >= 1000) return `$${Math.round(vol).toLocaleString()}`;
    return `$${vol.toLocaleString()}`;
  };

  const handleShowMore = () => {
    setDisplayCount(prev => prev + 20);
  };

  const handleMarketClick = (market: KalshiMarket) => {
    setSelectedMarket(market);
  };

  // Get an icon component based on market title
  const getMarketIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("shutdown") || t.includes("government") || t.includes("funding") || t.includes("senate") || t.includes("congress")) {
      return <Landmark className="w-5 h-5 text-muted-foreground" />;
    }
    if (t.includes("fed") || t.includes("chair") || t.includes("treasury")) {
      return <DollarSign className="w-5 h-5 text-muted-foreground" />;
    }
    if (t.includes("president") || t.includes("trump") || t.includes("cabinet") || t.includes("nominee")) {
      return <User className="w-5 h-5 text-muted-foreground" />;
    }
    if (t.includes("democratic") || t.includes("democrat") || t.includes("republican") || t.includes("election")) {
      return <Vote className="w-5 h-5 text-muted-foreground" />;
    }
    if (t.includes("khamenei") || t.includes("iran") || t.includes("leader") || t.includes("world") || t.includes("international")) {
      return <Globe className="w-5 h-5 text-muted-foreground" />;
    }
    if (t.includes("governor") || t.includes("florida") || t.includes("texas") || t.includes("local")) {
      return <MapPin className="w-5 h-5 text-muted-foreground" />;
    }
    if (t.includes("court") || t.includes("scotus") || t.includes("justice")) {
      return <Scale className="w-5 h-5 text-muted-foreground" />;
    }
    return <BarChart3 className="w-5 h-5 text-muted-foreground" />;
  };

  const MarketCard = ({ market }: { market: KalshiMarket }) => {
    return (
      <Card 
        className="bg-card border-border hover-elevate cursor-pointer h-full flex flex-col"
        onClick={() => handleMarketClick(market)}
        data-testid={`card-market-${market.ticker}`}
      >
        <CardContent className="p-4 flex-1 flex flex-col">
          {/* Header with icon and title */}
          <div className="flex gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
              {getMarketIcon(market.title)}
            </div>
            <h3 className="font-medium text-sm leading-tight line-clamp-2 flex-1">
              {market.title}
            </h3>
          </div>
          
          {/* Primary option row */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-sm truncate flex-1">
                {market.subtitle?.split(" ").slice(0, 3).join(" ") || (market.yes_price >= 50 ? "Yes" : "No")}
              </span>
              <span className="font-bold text-sm min-w-[40px] text-right">
                {market.yes_price}%
              </span>
              <div className="flex gap-1">
                <Badge 
                  variant="outline"
                  className="cursor-pointer bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`badge-yes-${market.ticker}`}
                >
                  Yes
                </Badge>
                <Badge 
                  variant="outline"
                  className="cursor-pointer bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`badge-no-${market.ticker}`}
                >
                  No
                </Badge>
              </div>
            </div>
            
            {/* Secondary option if subtitle exists */}
            {market.subtitle && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-sm truncate flex-1">
                  {market.subtitle.split(" ").slice(3, 6).join(" ") || "Other"}
                </span>
                <span className="font-bold text-sm min-w-[40px] text-right">
                  {market.no_price}%
                </span>
                <div className="flex gap-1">
                  <Badge 
                    variant="outline"
                    className="cursor-pointer bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`badge-yes-alt-${market.ticker}`}
                  >
                    Yes
                  </Badge>
                  <Badge 
                    variant="outline"
                    className="cursor-pointer bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`badge-no-alt-${market.ticker}`}
                  >
                    No
                  </Badge>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer with volume and expand */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
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
              data-testid={`button-expand-${market.ticker}`}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Top filter tabs row */}
      <div 
        className="flex gap-2 overflow-x-auto pb-2 items-center flex-wrap" 
        role="tablist" 
        aria-label="Politics sub-filters"
      >
        {POLITICS_SUB_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            variant={politicsSubFilter === filter.value ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setPoliticsSubFilter(filter.value);
              setDisplayCount(INITIAL_DISPLAY_COUNT);
            }}
            role="tab"
            aria-selected={politicsSubFilter === filter.value}
            data-testid={`tab-${filter.value}`}
            className="rounded-full whitespace-nowrap"
          >
            {filter.label}
          </Button>
        ))}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost"
              size="sm"
              className="rounded-full gap-1"
              data-testid="button-sort-filter"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Sort / Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setSortOption(option.value)}
                className={sortOption === option.value ? "bg-muted" : ""}
                data-testid={`sort-option-${option.value}`}
              >
                {sortOption === option.value && <ArrowUpDown className="w-3 h-3 mr-2" />}
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Section header with search and refresh */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold capitalize">
          {politicsSubFilter === "all" ? "Politics" : POLITICS_SUB_FILTERS.find(f => f.value === politicsSubFilter)?.label}
        </h2>
        
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
              data-testid="input-search-markets"
              aria-label="Search prediction markets"
            />
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-4 h-4" aria-hidden="true" />
            <span>{timeUntilRefresh}</span>
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

      {/* Markets grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-3 mb-4">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
                <div className="flex justify-between mt-4 pt-3 border-t">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-5 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : visibleMarkets.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              {searchQuery || politicsSubFilter !== "all"
                ? "Try adjusting your filters or search query."
                : "No prediction markets are currently available."}
            </p>
            {(searchQuery || politicsSubFilter !== "all") && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery("");
                  setPoliticsSubFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Market detail dialog */}
      <Dialog open={!!selectedMarket} onOpenChange={(open) => !open && setSelectedMarket(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">
                {selectedMarket && getMarketIcon(selectedMarket.title)}
              </div>
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
                <Card className="bg-emerald-500/10 border-emerald-500/30">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Yes</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedMarket.yes_price}%
                    </p>
                    <Button 
                      className="mt-3 w-full bg-emerald-500 border-emerald-600 text-white"
                      data-testid="button-buy-yes"
                    >
                      Buy Yes
                    </Button>
                  </CardContent>
                </Card>
                <Card className="bg-red-500/10 border-red-500/30">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">No</p>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {selectedMarket.no_price}%
                    </p>
                    <Button 
                      className="mt-3 w-full bg-red-500 border-red-600 text-white"
                      data-testid="button-buy-no"
                    >
                      Buy No
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-500">Yes: {selectedMarket.yes_price}%</span>
                  <span className="text-red-500">No: {selectedMarket.no_price}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${selectedMarket.yes_price}%` }}
                  />
                  <div 
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${selectedMarket.no_price}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Volume</p>
                  <p className="font-semibold">{formatVolumeCompact(selectedMarket.volume)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Open Interest</p>
                  <p className="font-semibold">{selectedMarket.open_interest.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Closes</p>
                  <p className="font-semibold">
                    {new Date(selectedMarket.close_time).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <Button variant="outline" className="gap-2" asChild data-testid="button-view-kalshi">
                  <a 
                    href={`https://kalshi.com/markets/${selectedMarket.event_ticker}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <TrendingUp className="w-4 h-4" />
                    View on Kalshi
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

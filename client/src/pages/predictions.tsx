import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, RefreshCw, Clock, Plus, Activity, Info, SlidersHorizontal, ArrowUpDown } from "lucide-react";

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

type MainCategory = "trending" | "new" | "all" | "politics" | "sports" | "culture" | "crypto" | "climate" | "economics" | "mentions" | "companies" | "financials" | "tech-science";

type PoliticsSubFilter = "all" | "us-elections" | "primaries" | "trump" | "foreign" | "international" | "house" | "congress" | "scotus" | "local" | "recurring";

type SortOption = "volume" | "newest" | "closing-soon" | "probability";

const MAIN_CATEGORY_TABS: { value: MainCategory; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "new", label: "New" },
  { value: "all", label: "All" },
  { value: "politics", label: "Politics" },
  { value: "sports", label: "Sports" },
  { value: "culture", label: "Culture" },
  { value: "crypto", label: "Crypto" },
  { value: "climate", label: "Climate" },
  { value: "economics", label: "Economics" },
  { value: "mentions", label: "Mentions" },
  { value: "companies", label: "Companies" },
  { value: "financials", label: "Financials" },
  { value: "tech-science", label: "Tech & Science" },
];

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
  const [mainCategory, setMainCategory] = useState<MainCategory>("politics");
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

  const getMainCategoryKeywords = (category: MainCategory): string[] => {
    switch (category) {
      case "politics":
        return ["president", "election", "congress", "senate", "house", "vote", "trump", "biden", "democrat", "republican", "governor", "mayor", "supreme", "court"];
      case "sports":
        return ["nfl", "nba", "mlb", "nhl", "soccer", "football", "basketball", "baseball", "hockey", "championship", "playoff", "super bowl", "world series"];
      case "culture":
        return ["movie", "film", "music", "oscar", "grammy", "celebrity", "entertainment", "tv", "show", "award"];
      case "crypto":
        return ["bitcoin", "btc", "ethereum", "eth", "crypto", "blockchain", "defi", "nft", "token", "coin"];
      case "climate":
        return ["climate", "weather", "temperature", "hurricane", "storm", "environment", "carbon", "renewable", "energy"];
      case "economics":
        return ["gdp", "inflation", "fed", "interest rate", "unemployment", "recession", "economy", "growth"];
      case "companies":
        return ["apple", "google", "meta", "amazon", "microsoft", "tesla", "nvidia", "stock", "earnings", "ipo", "merger"];
      case "financials":
        return ["stock", "market", "s&p", "dow", "nasdaq", "bond", "yield", "treasury", "index"];
      case "tech-science":
        return ["ai", "artificial intelligence", "space", "nasa", "spacex", "tech", "science", "research", "fda", "drug"];
      default:
        return [];
    }
  };

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
        return ["congress", "senate", "house", "bill", "legislation", "speaker", "representative", "senator"];
      case "scotus":
        return ["supreme", "court", "scotus", "judge", "justice", "ruling", "decision"];
      case "local":
        return ["governor", "mayor", "state", "local", "city"];
      case "recurring":
        return ["weekly", "monthly", "daily", "recurring", "regular"];
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
      
      if (mainCategory === "trending" || mainCategory === "new" || mainCategory === "all" || mainCategory === "mentions") {
        return matchesSearch;
      }
      
      const mainKeywords = getMainCategoryKeywords(mainCategory);
      const matchesMainCategory = mainKeywords.some(keyword => title.includes(keyword));
      
      if (mainCategory === "politics" && politicsSubFilter !== "all") {
        const subKeywords = getPoliticsSubFilterKeywords(politicsSubFilter);
        const matchesSubFilter = subKeywords.some(keyword => title.includes(keyword));
        return matchesSearch && matchesMainCategory && matchesSubFilter;
      }
      
      return matchesSearch && matchesMainCategory;
    }));

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
        className="flex gap-1 overflow-x-auto pb-2 border-b" 
        role="tablist" 
        aria-label="Main market categories"
      >
        {MAIN_CATEGORY_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setMainCategory(tab.value);
              setPoliticsSubFilter("all");
              setDisplayCount(INITIAL_DISPLAY_COUNT);
            }}
            role="tab"
            aria-selected={mainCategory === tab.value}
            data-testid={`main-tab-${tab.value}`}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              mainCategory === tab.value 
                ? "text-foreground border-b-2 border-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mainCategory === "politics" && (
        <div 
          className="flex gap-2 overflow-x-auto pb-2 flex-wrap" 
          role="tablist" 
          aria-label="Politics sub-filters"
        >
          {POLITICS_SUB_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={politicsSubFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setPoliticsSubFilter(filter.value);
                setDisplayCount(INITIAL_DISPLAY_COUNT);
              }}
              role="tab"
              aria-selected={politicsSubFilter === filter.value}
              data-testid={`sub-tab-${filter.value}`}
              className="whitespace-nowrap"
            >
              {filter.label}
            </Button>
          ))}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="whitespace-nowrap gap-1" data-testid="button-sort-filter">
                <SlidersHorizontal className="w-3 h-3" />
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
      )}

      <h2 className="text-2xl font-bold capitalize">
        {mainCategory === "tech-science" ? "Tech & Science" : mainCategory}
      </h2>

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
              {searchQuery || mainCategory !== "all" || politicsSubFilter !== "all"
                ? "Try adjusting your filters or search query."
                : "No prediction markets are currently available."}
            </p>
            {(searchQuery || mainCategory !== "all" || politicsSubFilter !== "all") && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery("");
                  setMainCategory("all");
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

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, Search, TrendingUp, TrendingDown, RefreshCw, Filter, Clock, ChevronDown, Activity, Info } from "lucide-react";

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

type FilterCategory = "all" | "politics" | "elections" | "congress";

const REFRESH_INTERVAL = 20 * 60 * 1000; // 20 minutes in milliseconds
const INITIAL_DISPLAY_COUNT = 20;

export default function PredictionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>("all");
  const [sortBy, setSortBy] = useState<"volume" | "price" | "name">("volume");
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  const [selectedMarket, setSelectedMarket] = useState<KalshiMarket | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [timeUntilRefresh, setTimeUntilRefresh] = useState<string>("20 min");

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
    staleTime: REFRESH_INTERVAL - 60000, // Consider stale 1 minute before next refresh
  });

  // Update last refresh time when data changes
  useEffect(() => {
    if (marketsData) {
      setLastRefresh(new Date());
    }
  }, [marketsData]);

  // Reactive countdown timer - updates every minute
  const updateCountdown = useCallback(() => {
    const now = new Date();
    const nextRefresh = new Date(lastRefresh.getTime() + REFRESH_INTERVAL);
    const diff = nextRefresh.getTime() - now.getTime();
    if (diff <= 0) {
      setTimeUntilRefresh("Refreshing...");
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

  // Politics keywords for filtering
  const politicsKeywords = [
    "president", "trump", "biden", "democrat", "republican", "government",
    "cabinet", "nominee", "fed chair", "supreme", "shutdown", "vance",
    "newsom", "costa rica", "party", "senate", "congress", "election",
    "vote", "primary", "tariff", "stimulus", "leader", "khamenei",
    "world leader", "rican", "presidential"
  ];

  const filteredMarkets = markets
    .filter((market) => {
      const matchesSearch = searchQuery === "" || 
        market.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        market.ticker.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (categoryFilter === "all") return matchesSearch;
      
      const title = market.title.toLowerCase();
      const category = market.category?.toLowerCase() || "";
      
      switch (categoryFilter) {
        case "politics":
          return matchesSearch && (
            category.includes("politic") ||
            politicsKeywords.some(keyword => title.includes(keyword))
          );
        case "elections":
          return matchesSearch && (
            category.includes("election") ||
            title.includes("election") ||
            title.includes("vote") ||
            title.includes("primary") ||
            title.includes("nominee")
          );
        case "congress":
          return matchesSearch && (
            title.includes("congress") ||
            title.includes("senate") ||
            title.includes("house") ||
            title.includes("bill") ||
            title.includes("legislation")
          );
        default:
          return matchesSearch;
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "volume":
          return b.volume - a.volume;
        case "price":
          return b.yes_price - a.yes_price;
        case "name":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

  const visibleMarkets = filteredMarkets.slice(0, displayCount);
  const hasMore = filteredMarkets.length > displayCount;

  const getPriceColor = (price: number) => {
    if (price >= 70) return "text-green-600 dark:text-green-400";
    if (price >= 50) return "text-yellow-600 dark:text-yellow-400";
    if (price >= 30) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
    return `$${vol}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const handleShowMore = () => {
    setDisplayCount(prev => prev + 20);
  };

  const handleMarketClick = (market: KalshiMarket) => {
    setSelectedMarket(market);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif flex items-center gap-2" data-testid="text-predictions-title">
            <BarChart3 className="h-8 w-8" />
            Prediction Markets
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time political odds powered by Kalshi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Next refresh: {timeUntilRefresh}</span>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-markets"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-markets"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={(v) => {
              setCategoryFilter(v as FilterCategory);
              setDisplayCount(INITIAL_DISPLAY_COUNT);
            }}>
              <SelectTrigger className="w-[180px]" data-testid="select-category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                <SelectItem value="politics">Politics</SelectItem>
                <SelectItem value="elections">Elections</SelectItem>
                <SelectItem value="congress">Congress</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as "volume" | "price" | "name")}>
              <SelectTrigger className="w-[180px]" data-testid="select-sort">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="volume">Highest Volume</SelectItem>
                <SelectItem value="price">Highest Odds</SelectItem>
                <SelectItem value="name">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : visibleMarkets.length > 0 ? (
        <>
          <div className="text-sm text-muted-foreground">
            Showing {visibleMarkets.length} of {filteredMarkets.length} {filteredMarkets.length === 1 ? 'market' : 'markets'}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleMarkets.map((market) => (
              <Card 
                key={market.ticker} 
                className="hover-elevate cursor-pointer flex flex-col" 
                onClick={() => handleMarketClick(market)}
                data-testid={`card-market-${market.ticker}`}
              >
                <CardHeader className="pb-3 flex-1">
                  <CardTitle className="text-sm font-medium leading-snug line-clamp-3">
                    {market.title}
                  </CardTitle>
                  {market.subtitle && (
                    <CardDescription className="text-xs line-clamp-1 mt-1">
                      {market.subtitle}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Yes odds</p>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-3xl font-bold ${getPriceColor(market.yes_price)}`}>
                          {market.yes_price}
                        </span>
                        <span className={`text-lg ${getPriceColor(market.yes_price)}`}>%</span>
                        {market.yes_price >= 50 ? (
                          <TrendingUp className="h-4 w-4 text-green-500 ml-1" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500 ml-1" />
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">No odds</p>
                      <span className="text-xl font-semibold text-muted-foreground">
                        {market.no_price}%
                      </span>
                    </div>
                  </div>

                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.max(market.yes_price, 2)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span className="font-medium">{formatVolume(market.volume)} traded</span>
                    <span className="flex items-center gap-1 text-primary">
                      <Activity className="w-3 h-3" />
                      Details
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleShowMore}
                className="w-full max-w-xs"
                data-testid="button-show-more"
              >
                <ChevronDown className="w-4 h-4 mr-2" />
                Show More ({filteredMarkets.length - displayCount} remaining)
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-2">No Markets Found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery || categoryFilter !== "all" 
                ? "Try adjusting your filters or search query."
                : "No prediction markets are currently available. Please check that the Kalshi API is configured correctly."}
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

      {/* Market Detail Dialog */}
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
              {/* Probability Chart Visualization */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Probability Indicator
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-32 relative bg-gradient-to-r from-red-100 via-yellow-100 to-green-100 dark:from-red-950/30 dark:via-yellow-950/30 dark:to-green-950/30">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {[0, 25, 50, 75, 100].map((val) => (
                        <div 
                          key={val} 
                          className="flex-1 border-r border-dashed border-muted-foreground/20 last:border-r-0 relative"
                        >
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
                            {val}%
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Probability indicator line */}
                    <div 
                      className="absolute top-0 bottom-0 w-1 bg-primary shadow-lg shadow-primary/50 transition-all duration-500"
                      style={{ left: `${selectedMarket.yes_price}%` }}
                    >
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background shadow-lg" />
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-bold whitespace-nowrap shadow-lg">
                        {selectedMarket.yes_price}% Yes
                      </div>
                    </div>
                    {/* Low/High labels */}
                    <div className="absolute top-2 left-2 text-xs font-medium text-red-600 dark:text-red-400">Unlikely</div>
                    <div className="absolute top-2 right-2 text-xs font-medium text-green-600 dark:text-green-400">Likely</div>
                  </div>
                </CardContent>
              </Card>

              {/* Probability Display */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Yes Probability</p>
                    <p className={`text-4xl font-bold ${getPriceColor(selectedMarket.yes_price)}`}>
                      {selectedMarket.yes_price}%
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">No Probability</p>
                    <p className="text-4xl font-bold text-muted-foreground">
                      {100 - selectedMarket.yes_price}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Probability Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 dark:text-green-400 font-medium">Yes: {selectedMarket.yes_price}%</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">No: {100 - selectedMarket.yes_price}%</span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${selectedMarket.yes_price}%` }}
                  />
                  <div 
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${100 - selectedMarket.yes_price}%` }}
                  />
                </div>
              </div>

              {/* Market Stats */}
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

              {/* Close Time */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Closes: {formatTime(selectedMarket.close_time)}</span>
              </div>

              {/* Info Note */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Info className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  This is a prediction market showing crowd-sourced probability estimates. 
                  Odds update in real-time based on market activity.
                </p>
              </div>

              {/* Category */}
              {selectedMarket.category && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Category:</span>
                  <Badge variant="secondary">{selectedMarket.category}</Badge>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

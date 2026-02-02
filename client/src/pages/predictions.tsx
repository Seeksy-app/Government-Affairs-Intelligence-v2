import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Search, TrendingUp, TrendingDown, ExternalLink, RefreshCw, Filter } from "lucide-react";

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

export default function PredictionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>("politics");
  const [sortBy, setSortBy] = useState<"volume" | "price" | "name">("volume");

  const { data: marketsData, isLoading, refetch, isFetching } = useQuery<{ markets: KalshiMarket[]; cursor?: string }>({
    queryKey: ["/api/kalshi/markets", { status: "open", limit: 100 }],
  });

  const markets = marketsData?.markets || [];

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
            title.includes("president") ||
            title.includes("trump") ||
            title.includes("biden") ||
            title.includes("democrat") ||
            title.includes("republican") ||
            title.includes("government") ||
            title.includes("cabinet") ||
            title.includes("nominee") ||
            title.includes("fed chair") ||
            title.includes("supreme") ||
            title.includes("shutdown") ||
            title.includes("vance") ||
            title.includes("newsom") ||
            title.includes("costa rica") ||
            title.includes("party")
          );
        case "elections":
          return matchesSearch && (
            category.includes("election") ||
            title.includes("election") ||
            title.includes("vote") ||
            title.includes("primary")
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

  const getPriceColor = (price: number) => {
    if (price >= 70) return "text-green-600 dark:text-green-400";
    if (price >= 50) return "text-yellow-600 dark:text-yellow-400";
    if (price >= 30) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toString();
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
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as FilterCategory)}>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
      ) : filteredMarkets.length > 0 ? (
        <>
          <div className="text-sm text-muted-foreground">
            Showing {filteredMarkets.length} {filteredMarkets.length === 1 ? 'market' : 'markets'}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMarkets.map((market) => (
              <Card key={market.ticker} className="hover-elevate" data-testid={`card-market-${market.ticker}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {market.ticker}
                    </Badge>
                    {market.category && (
                      <Badge variant="secondary" className="text-xs">
                        {market.category}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base line-clamp-2">{market.title}</CardTitle>
                  {market.subtitle && (
                    <CardDescription className="text-xs line-clamp-1">{market.subtitle}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Yes Probability</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${getPriceColor(market.yes_price)}`}>
                          {market.yes_price}%
                        </span>
                        {market.yes_price >= 50 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs text-muted-foreground">No Probability</p>
                      <span className="text-xl font-semibold text-muted-foreground">
                        {100 - market.yes_price}%
                      </span>
                    </div>
                  </div>

                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${market.yes_price}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Volume: {formatVolume(market.volume)}</span>
                    <span>Open Interest: {formatVolume(market.open_interest)}</span>
                  </div>

                  <div className="pt-2 border-t">
                    <a
                      href={`https://kalshi.com/markets/${market.ticker.toLowerCase()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline"
                    >
                      View on Kalshi <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
                : "No prediction markets are currently available."}
            </p>
            {(searchQuery || categoryFilter !== "all") && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("politics");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

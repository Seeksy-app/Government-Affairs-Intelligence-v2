import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, RefreshCw, Clock, Plus, Activity, SlidersHorizontal, ArrowUpDown,
  TrendingUp, Landmark, DollarSign, Globe, User, Vote, Scale, MapPin,
  BarChart3, Trophy, Zap, Cloud, Beaker, Film, Heart, Star, Settings2, Check
} from "lucide-react";
import { formatVolume } from "@/lib/kalshi-visuals";
import { PageHeader, PageShell } from "@/components/page-header";

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
  image_url?: string | null;
  /** Set on Polymarket markets (normalized to this shape by the server). */
  source?: "polymarket";
  url?: string;
}

type MarketSource = "kalshi" | "polymarket";
const SOURCES: { value: MarketSource; label: string }[] = [
  { value: "kalshi", label: "Kalshi" },
  { value: "polymarket", label: "Polymarket" },
];
const STORAGE_KEY_SOURCE = "predictions_source";

interface MarketCategory {
  id: string;
  label: string;
  icon: typeof Landmark;
  apiCategory: string;
}

const MARKET_CATEGORIES: MarketCategory[] = [
  { id: "politics", label: "Politics", icon: Landmark, apiCategory: "Politics" },
  { id: "sports", label: "Sports", icon: Trophy, apiCategory: "Sports" },
  { id: "economics", label: "Economics", icon: DollarSign, apiCategory: "Economics" },
  { id: "financials", label: "Financials", icon: TrendingUp, apiCategory: "Financials" },
  { id: "climate", label: "Climate & Weather", icon: Cloud, apiCategory: "Climate and Weather" },
  { id: "tech", label: "Tech & Science", icon: Beaker, apiCategory: "Tech" },
  { id: "culture", label: "Culture", icon: Film, apiCategory: "Culture" },
  { id: "health", label: "Health", icon: Heart, apiCategory: "Health" },
  { id: "world", label: "World", icon: Globe, apiCategory: "World" },
];

const STORAGE_KEY_DEFAULT_CATEGORY = "predictions_default_category";

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

function getSavedDefaultCategory(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_DEFAULT_CATEGORY) || "politics";
  } catch {
    return "politics";
  }
}

function saveDefaultCategory(categoryId: string) {
  try {
    localStorage.setItem(STORAGE_KEY_DEFAULT_CATEGORY, categoryId);
  } catch {}
}

export default function PredictionsPage() {
  const [activeCategory, setActiveCategory] = useState(getSavedDefaultCategory);
  const [source, setSource] = useState<MarketSource>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_SOURCE) === "polymarket" ? "polymarket" : "kalshi";
    } catch {
      return "kalshi";
    }
  });
  const pickSource = (s: MarketSource) => {
    setSource(s);
    setDisplayCount(INITIAL_DISPLAY_COUNT);
    try {
      localStorage.setItem(STORAGE_KEY_SOURCE, s);
    } catch {}
  };
  const [defaultCategory, setDefaultCategory] = useState(getSavedDefaultCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [politicsSubFilter, setPoliticsSubFilter] = useState<PoliticsSubFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("volume");
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  const [selectedMarket, setSelectedMarket] = useState<KalshiMarket | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [timeUntilRefresh, setTimeUntilRefresh] = useState<string>("20m");

  const currentCategoryObj = MARKET_CATEGORIES.find(c => c.id === activeCategory) || MARKET_CATEGORIES[0];

  const { data: marketsData, isLoading, refetch, isFetching } = useQuery<{ markets: KalshiMarket[]; cursor?: string }>({
    queryKey: [`/api/${source}/markets`, currentCategoryObj.apiCategory],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "open", limit: "200", category: currentCategoryObj.apiCategory });
      const res = await apiRequest("GET", `/api/${source}/markets?${params}`);
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

  const filteredMarkets = useMemo(() => {
    let result = markets;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.ticker.toLowerCase().includes(q)
      );
    }

    if (activeCategory === "politics" && politicsSubFilter !== "all") {
      const subKeywords = getPoliticsSubFilterKeywords(politicsSubFilter);
      result = result.filter(m => {
        const title = m.title.toLowerCase();
        return subKeywords.some(keyword => title.includes(keyword));
      });
    }

    return sortMarkets(result);
  }, [markets, searchQuery, activeCategory, politicsSubFilter, sortOption]);

  const visibleMarkets = filteredMarkets.slice(0, displayCount);
  const hasMore = filteredMarkets.length > displayCount;

  const formatVolumeCompact = (vol: number) => formatVolume(vol);

  const handleCategoryChange = (categoryId: string) => {
    setActiveCategory(categoryId);
    setDisplayCount(INITIAL_DISPLAY_COUNT);
    setSearchQuery("");
    setPoliticsSubFilter("all");
  };

  const handleSetDefault = (categoryId: string) => {
    setDefaultCategory(categoryId);
    saveDefaultCategory(categoryId);
  };

  const handleShowMore = () => {
    setDisplayCount(prev => prev + 20);
  };

  const handleMarketClick = (market: KalshiMarket) => {
    setSelectedMarket(market);
  };

  const getMarketImage = (title: string, imageUrl?: string | null) => {
    if (imageUrl) {
      return (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      );
    }
    const t = title.toLowerCase();
    if (activeCategory === "sports" || t.includes("nba") || t.includes("nfl") || t.includes("mlb") || t.includes("nhl") || t.includes("soccer") || t.includes("golf") || t.includes("tennis")) {
      return (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-muted-foreground" />
        </div>
      );
    }
    if (t.includes("shutdown") || t.includes("government") || t.includes("funding")) {
      return (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
          <Landmark className="w-5 h-5 text-muted-foreground" />
        </div>
      );
    }
    if (t.includes("house") || t.includes("senate") || t.includes("congress")) {
      return (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
          <Landmark className="w-5 h-5 text-muted-foreground" />
        </div>
      );
    }
    if (t.includes("fed") || t.includes("chair") || t.includes("treasury") || t.includes("interest rate") || t.includes("inflation") || t.includes("gdp") || t.includes("stock")) {
      return (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
          <DollarSign className="w-5 h-5 text-muted-foreground" />
        </div>
      );
    }
    if (t.includes("president") || t.includes("trump") || t.includes("cabinet") || t.includes("nominee")) {
      return (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-muted-foreground" />
        </div>
      );
    }
    if (t.includes("election") || t.includes("vote") || t.includes("democrat") || t.includes("republican")) {
      return (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
          <Vote className="w-5 h-5 text-muted-foreground" />
        </div>
      );
    }
    if (t.includes("weather") || t.includes("temperature") || t.includes("hurricane") || t.includes("climate")) {
      return (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
          <Cloud className="w-5 h-5 text-muted-foreground" />
        </div>
      );
    }
    if (t.includes("court") || t.includes("scotus") || t.includes("justice")) {
      return (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
          <Scale className="w-5 h-5 text-muted-foreground" />
        </div>
      );
    }
    if (t.includes("governor") || t.includes("mayor") || t.includes("local")) {
      return (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5 text-muted-foreground" />
        </div>
      );
    }
    const CategoryIcon = currentCategoryObj.icon;
    return (
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
        <CategoryIcon className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  };

  const MarketCard = ({ market }: { market: KalshiMarket }) => {
    return (
      <Card
        className="hover-elevate cursor-pointer h-full flex flex-col"
        onClick={() => handleMarketClick(market)}
        data-testid={`card-market-${market.ticker}`}
      >
        <CardContent className="p-4 flex-1 flex flex-col min-h-0">
          <div className="flex items-start gap-3 mb-3">
            {getMarketImage(market.title, market.image_url)}
            <h3 className="font-semibold text-sm leading-snug flex-1 min-w-0 pr-1 line-clamp-3" style={{ wordBreak: 'break-word' }} title={market.title}>
              {market.title}
            </h3>
          </div>

          {/* Plain odds: the chance of Yes and of No, with a bar. */}
          <div className="flex-1 space-y-2 min-h-0">
            {([
              ["Yes", market.yes_price, "bg-[#078ACB]"],
              ["No", market.no_price, "bg-muted-foreground/40"],
            ] as const).map(([label, pct, bar]) => (
              <div key={label} className="flex items-center gap-2" data-testid={`odds-${label.toLowerCase()}-${market.ticker}`}>
                <span className="w-7 shrink-0 text-sm text-muted-foreground">{label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{pct}%</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t">
            <span className="text-muted-foreground text-xs tabular-nums">
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
    <PageShell className="space-y-4">
      <PageHeader
        eyebrow="Monitor"
        title="Prediction Markets"
        description="Live odds on elections, Congress, the courts and the economy, from Kalshi and Polymarket."
        className="mb-2"
        actions={
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5" role="radiogroup" aria-label="Market source" data-testid="toggle-market-source">
            {SOURCES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={source === s.value}
                onClick={() => pickSource(s.value)}
                className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  source === s.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`source-${s.value}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Category tabs */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 items-center border-b" data-testid="category-tabs-container">
        {MARKET_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          const isDefault = defaultCategory === cat.id;
          return (
            <Tooltip key={cat.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`rounded-full whitespace-nowrap gap-1.5 shrink-0 ${isActive ? "" : "text-muted-foreground hover:text-foreground"}`}
                  data-testid={`button-category-${cat.id}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cat.label}
                  {isDefault && (
                    <Star className="h-3 w-3 fill-current opacity-60 ml-0.5" aria-label="Default category" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isDefault ? `${cat.label} (your default)` : cat.label}
              </TooltipContent>
            </Tooltip>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full shrink-0 text-muted-foreground"
              aria-label="Set default category"
              data-testid="button-category-settings"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Set Default Category</div>
            {MARKET_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <DropdownMenuItem
                  key={cat.id}
                  onClick={() => handleSetDefault(cat.id)}
                  data-testid={`menu-set-default-${cat.id}`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {cat.label}
                  {defaultCategory === cat.id && <Check className="h-4 w-4 ml-auto text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sub-filters for Politics */}
      {activeCategory === "politics" && (
        <div
          className="flex gap-1.5 items-center flex-wrap"
          role="tablist"
          aria-label="Politics sub-filters"
        >
          {POLITICS_SUB_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={politicsSubFilter === filter.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setPoliticsSubFilter(filter.value);
                setDisplayCount(INITIAL_DISPLAY_COUNT);
              }}
              role="tab"
              aria-selected={politicsSubFilter === filter.value}
              data-testid={`tab-${filter.value}`}
              className={`rounded-full whitespace-nowrap ${politicsSubFilter === filter.value ? "" : "text-muted-foreground hover:text-foreground"}`}
            >
              {filter.label}
            </Button>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full gap-1 text-muted-foreground hover:text-foreground"
                data-testid="button-sort-filter"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Sort
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

      {/* Sort controls for non-politics categories */}
      {activeCategory !== "politics" && (
        <div className="flex gap-2 items-center flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full gap-1 text-muted-foreground hover:text-foreground"
                data-testid="button-sort-filter-alt"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setSortOption(option.value)}
                  className={sortOption === option.value ? "bg-muted" : ""}
                  data-testid={`sort-option-alt-${option.value}`}
                >
                  {sortOption === option.value && <ArrowUpDown className="w-3 h-3 mr-2" />}
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Section header with search and refresh */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold" data-testid="text-category-title">
          {currentCategoryObj.label}
          {activeCategory === "politics" && politicsSubFilter !== "all" && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              / {POLITICS_SUB_FILTERS.find(f => f.value === politicsSubFilter)?.label}
            </span>
          )}
        </h2>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
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
          <div className="hidden sm:flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground" title="Next automatic refresh">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{timeUntilRefresh}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="shrink-0"
            data-testid="button-refresh-markets"
            aria-label="Refresh markets"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Results count */}
      {!isLoading && filteredMarkets.length > 0 && (
        <p className="text-sm text-muted-foreground" data-testid="text-results-count">
          {filteredMarkets.length} market{filteredMarkets.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Markets grid */}
      {isLoading ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Loading {currentCategoryObj.label.toLowerCase()} markets…</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <Card key={i} className="overflow-hidden">
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
                  <div className="flex justify-between gap-2 mt-4 pt-3 border-t">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : visibleMarkets.length > 0 ? (
        <>
          {isFetching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Updating markets…</span>
            </div>
          )}
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
                Load more ({filteredMarkets.length - displayCount} remaining)
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Activity className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold">No markets found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery || (activeCategory === "politics" && politicsSubFilter !== "all")
                ? "Try adjusting your filters or search query."
                : `No ${currentCategoryObj.label.toLowerCase()} prediction markets are currently available.`}
            </p>
            {(searchQuery || (activeCategory === "politics" && politicsSubFilter !== "all")) && (
              <Button
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setPoliticsSubFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear filters
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
              {selectedMarket && getMarketImage(selectedMarket.title, selectedMarket.image_url)}
              <div className="flex-1">
                <Badge variant="outline" className="mb-2 font-normal text-muted-foreground">{selectedMarket?.ticker}</Badge>
                <h2 className="text-lg font-semibold leading-snug">{selectedMarket?.title}</h2>
                {selectedMarket?.subtitle && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedMarket.subtitle}</p>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedMarket && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-primary/20 bg-primary/5 shadow-none">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Yes</p>
                    <p className="text-3xl font-semibold tabular-nums text-primary">
                      {selectedMarket.yes_price}%
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/40 shadow-none">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">No</p>
                    <p className="text-3xl font-semibold tabular-nums text-foreground">
                      {selectedMarket.no_price}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="font-medium text-primary tabular-nums">Yes: {selectedMarket.yes_price}%</span>
                  <span className="text-muted-foreground tabular-nums">No: {selectedMarket.no_price}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${selectedMarket.yes_price}%` }}
                  />
                  <div
                    className="h-full bg-muted-foreground/30 transition-all"
                    style={{ width: `${selectedMarket.no_price}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Volume</p>
                  <p className="font-semibold tabular-nums">{formatVolumeCompact(selectedMarket.volume)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Open Interest</p>
                  <p className="font-semibold tabular-nums">{selectedMarket.open_interest.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Closes</p>
                  <p className="font-semibold tabular-nums">
                    {new Date(selectedMarket.close_time).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <Button variant="outline" className="gap-2" asChild data-testid="button-view-kalshi">
                  <a
                    href={selectedMarket.url ?? `https://kalshi.com/markets/${selectedMarket.event_ticker}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <TrendingUp className="w-4 h-4" />
                    View on {selectedMarket.source === "polymarket" ? "Polymarket" : "Kalshi"}
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

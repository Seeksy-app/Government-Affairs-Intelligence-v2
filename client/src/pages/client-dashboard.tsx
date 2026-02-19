import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Users, Newspaper, BarChart3, FileText, Clock, TrendingUp, ArrowUpRight, ArrowDownRight, Minus, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog, MapPin, Landmark, Trophy, DollarSign, Beaker, Film, Heart, Globe, Star, ChevronRight, Sparkles, Send, Search, Scale, UserSearch } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { openAIChat } from "@/components/global-ai-chat";

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

function getWeatherIcon(code: number) {
  if (code === 0 || code === 1) return Sun;
  if (code === 2 || code === 3) return Cloud;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if (code >= 61 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 85 && code <= 86) return CloudSnow;
  if (code >= 95 && code <= 99) return CloudLightning;
  if (code === 45 || code === 48) return CloudFog;
  return Cloud;
}

function getWeatherLabel(code: number) {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 66 && code <= 67) return "Freezing rain";
  if (code >= 71 && code <= 75) return "Snow";
  if (code === 77) return "Snow grains";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Unknown";
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface WeatherData {
  temperature: number;
  weatherCode: number;
  city: string;
}

function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchWeatherForCoords(lat: number, lon: number, cityName?: string) {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`,
        { signal: controller.signal }
      );
      const weatherData = await weatherRes.json();

      let city = cityName || "Your area";
      if (!cityName) {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { signal: controller.signal, headers: { "User-Agent": "GovernmentAffairsPlatform/1.0" } }
          );
          const geoData = await geoRes.json();
          city = geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.address?.county || "Your area";
        } catch {}
      }

      return {
        temperature: Math.round(weatherData.current.temperature_2m),
        weatherCode: weatherData.current.weather_code,
        city,
      };
    }

    async function fetchWeather() {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        const result = await fetchWeatherForCoords(pos.coords.latitude, pos.coords.longitude);
        if (!cancelled) setWeather(result);
      } catch {
        try {
          const result = await fetchWeatherForCoords(38.9072, -77.0369, "Washington, D.C.");
          if (!cancelled) setWeather(result);
        } catch {
          if (!cancelled) setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWeather();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  return { weather, loading, failed };
}

function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

interface KalshiMarket {
  ticker: string;
  title: string;
  yes_price: number;
  volume: number;
  status: string;
}

interface ClientStats {
  totalContacts: number;
  highPriorityContacts: number;
  totalNews: number;
  unreadNews: number;
  trackedBillsCount: number;
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
  const { weather, loading: weatherLoading, failed: weatherFailed } = useWeather();
  const currentTime = useCurrentTime();
  const [marketCategory, setMarketCategory] = useState("politics");

  const selectedCategory = PREDICTION_CATEGORIES.find(c => c.id === marketCategory) || PREDICTION_CATEGORIES[0];

  const [aiPromptInput, setAiPromptInput] = useState("");

  const { data: stats, isLoading: statsLoading } = useQuery<ClientStats>({
    queryKey: ["/api/stats"],
    refetchInterval: 30000,
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
  const WeatherIcon = weather ? getWeatherIcon(weather.weatherCode) : Cloud;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Hero greeting */}
        <div className="text-center space-y-3" data-testid="card-welcome">
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground" data-testid="text-current-time">
            <Clock className="h-4 w-4" />
            <span>{currentTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</span>
            <span>{currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
            {!weatherLoading && weather && (
              <>
                <span className="text-border">|</span>
                <WeatherIcon className="h-4 w-4" />
                <span data-testid="text-weather-temp">{weather.temperature}&#176;F</span>
                <span data-testid="text-weather-condition">{getWeatherLabel(weather.weatherCode)}</span>
                <MapPin className="h-3 w-3" />
                <span data-testid="text-weather-location">{weather.city}</span>
              </>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">
            {getGreeting()}, {displayName}
          </h1>
          <p className="text-muted-foreground" data-testid="text-dashboard-subtitle">
            Here's what's happening across your political intelligence
          </p>
        </div>

        {/* AI Agent Prompt */}
        <div className="max-w-2xl mx-auto w-full" data-testid="section-ai-prompt">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              What can I help you with?
            </div>
          </div>
          <div className="relative">
            <Input
              value={aiPromptInput}
              onChange={(e) => setAiPromptInput(e.target.value)}
              placeholder="Ask about legislation, staffers, news, lobbying activity..."
              className="pr-12 h-12 text-base"
              data-testid="input-dashboard-ai-prompt"
              onKeyDown={(e) => {
                if (e.key === "Enter" && aiPromptInput.trim()) {
                  openAIChat(aiPromptInput.trim());
                  setAiPromptInput("");
                }
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              disabled={!aiPromptInput.trim()}
              onClick={() => {
                openAIChat(aiPromptInput.trim());
                setAiPromptInput("");
              }}
              data-testid="button-dashboard-ai-send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
            {[
              { label: "Research staffers", icon: UserSearch },
              { label: "Track legislation", icon: Scale },
              { label: "Find lobbyists", icon: Search },
              { label: "Analyze news", icon: Newspaper },
            ].map((chip) => (
              <Button
                key={chip.label}
                variant="outline"
                size="sm"
                onClick={() => openAIChat(chip.label)}
                data-testid={`chip-ai-${chip.label.toLowerCase().replace(/\s/g, '-')}`}
              >
                <chip.icon className="h-3.5 w-3.5 mr-1.5" />
                {chip.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Quick nav cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card
            className="cursor-pointer hover-elevate overflow-visible"
            onClick={() => navigate("/contacts")}
            data-testid="stat-card-total-contacts"
          >
            <CardContent className="p-5 text-center space-y-2">
              <div className="mx-auto w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              {statsLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (
                <p className="text-2xl font-bold">{stats?.totalContacts ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground">Contacts</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover-elevate overflow-visible"
            onClick={() => navigate("/contacts")}
            data-testid="stat-card-high-priority"
          >
            <CardContent className="p-5 text-center space-y-2">
              <div className="mx-auto w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-amber-500" />
              </div>
              {statsLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (
                <p className="text-2xl font-bold">{stats?.highPriorityContacts ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground">High Priority</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover-elevate overflow-visible"
            onClick={() => navigate("/news")}
            data-testid="stat-card-news-articles"
          >
            <CardContent className="p-5 text-center space-y-2">
              <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Newspaper className="h-5 w-5 text-emerald-500" />
              </div>
              {statsLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (
                <p className="text-2xl font-bold">{stats?.unreadNews ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground">Unread News</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover-elevate overflow-visible"
            onClick={() => navigate("/bills")}
            data-testid="stat-card-bills"
          >
            <CardContent className="p-5 text-center space-y-2">
              <div className="mx-auto w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-violet-500" />
              </div>
              {statsLoading ? <Skeleton className="h-8 w-12 mx-auto" /> : (
                <p className="text-2xl font-bold">{stats?.trackedBillsCount ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground">Tracked Bills</p>
            </CardContent>
          </Card>
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

        {/* Quick links */}
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

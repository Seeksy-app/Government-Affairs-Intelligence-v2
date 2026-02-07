import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Newspaper, Activity, Star, BarChart3, FileText, Sparkles, Clock, TrendingUp, AlertCircle, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog, MapPin } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import type { Contact, NewsArticle } from "@shared/schema";

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

export default function ClientDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { weather, loading: weatherLoading, failed: weatherFailed } = useWeather();
  const currentTime = useCurrentTime();

  const { data: stats, isLoading: statsLoading } = useQuery<ClientStats>({
    queryKey: ["/api/stats"],
  });

  const { data: recentContacts, isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts/recent"],
  });

  const { data: recentNews, isLoading: newsLoading } = useQuery<NewsArticle[]>({
    queryKey: ["/api/news/recent"],
  });

  const { data: predictionMarkets, isLoading: marketsLoading } = useQuery<KalshiMarket[]>({
    queryKey: ["/api/kalshi/political-markets"],
  });

  const displayName = user?.firstName || user?.email?.split("@")[0] || "there";
  const WeatherIcon = weather ? getWeatherIcon(weather.weatherCode) : Cloud;

  const StatCard = ({ title, value, icon: Icon, description, href }: { title: string; value: number | undefined; icon: any; description?: string; href?: string }) => (
    <Card
      className={href ? "cursor-pointer hover-elevate transition-colors" : ""}
      onClick={href ? () => navigate(href) : undefined}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {statsLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value ?? 0}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent" data-testid="card-welcome">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold font-serif" data-testid="text-dashboard-title">
                {getGreeting()}, {displayName}
              </h1>
              <p className="text-sm text-muted-foreground" data-testid="text-dashboard-subtitle">
                Your political intelligence at a glance
              </p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm" data-testid="text-current-time">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="font-medium">
                    {currentTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                  </span>
                  <span className="text-muted-foreground ml-1.5">
                    {currentTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
              <div className="w-px h-6 bg-border hidden sm:block" />
              {weatherLoading ? (
                <div className="flex items-center gap-2" data-testid="skeleton-weather">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ) : weather ? (
                <div className="flex items-center gap-2 text-sm" data-testid="text-weather">
                  <WeatherIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium" data-testid="text-weather-temp">{weather.temperature}&#176;F</span>
                  <span className="text-muted-foreground" data-testid="text-weather-condition">{getWeatherLabel(weather.weatherCode)}</span>
                  <div className="flex items-center gap-1 text-muted-foreground" data-testid="text-weather-location">
                    <MapPin className="h-3 w-3" />
                    <span className="text-xs">{weather.city}</span>
                  </div>
                </div>
              ) : weatherFailed ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-weather-unavailable">
                  <Cloud className="h-5 w-5" />
                  <span>Weather unavailable</span>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Daily Brief</CardTitle>
              <CardDescription>AI-curated summary of today's political developments</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            <TrendingUp className="h-3 w-3 mr-1" />
            Live Updates
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div
              className="p-3 rounded-lg bg-background/50 border cursor-pointer hover-elevate"
              onClick={() => navigate("/bills")}
              data-testid="brief-card-bills"
            >
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <FileText className="h-4 w-4 text-blue-500" />
                Bills to Watch
              </div>
              {statsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold">{stats?.trackedBillsCount ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground">Tracked bills</p>
            </div>
            <div
              className="p-3 rounded-lg bg-background/50 border cursor-pointer hover-elevate"
              onClick={() => navigate("/news")}
              data-testid="brief-card-news"
            >
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                Breaking News
              </div>
              {statsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold">{stats?.unreadNews ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground">Unread articles</p>
            </div>
            <div
              className="p-3 rounded-lg bg-background/50 border cursor-pointer hover-elevate"
              onClick={() => navigate("/predictions")}
              data-testid="brief-card-markets"
            >
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <BarChart3 className="h-4 w-4 text-green-500" />
                Market Moves
              </div>
              {marketsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold">{predictionMarkets?.length ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground">Active predictions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Contacts" 
          value={stats?.totalContacts} 
          icon={Users}
          description="In your network"
          href="/contacts"
        />
        <StatCard 
          title="High Priority" 
          value={stats?.highPriorityContacts} 
          icon={Star}
          description="Key contacts"
          href="/contacts"
        />
        <StatCard 
          title="News Articles" 
          value={stats?.totalNews} 
          icon={Newspaper}
          description="Aggregated today"
          href="/news"
        />
        <StatCard 
          title="Unread" 
          value={stats?.unreadNews} 
          icon={Activity}
          description="Pending review"
          href="/news"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recent Contacts
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/contacts">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {contactsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentContacts && recentContacts.length > 0 ? (
              <div className="space-y-3">
                {recentContacts.slice(0, 5).map((contact) => (
                  <Link
                    key={contact.id}
                    href="/contacts"
                    className="flex items-center gap-4 p-2 rounded-lg hover-elevate"
                    data-testid={`contact-item-${contact.id}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {contact.firstName[0]}{contact.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {contact.firstName} {contact.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {contact.title || contact.organization || "No title"}
                      </p>
                    </div>
                    {contact.priority && contact.priority >= 4 && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No contacts yet</p>
                <p className="text-sm">Add your first contact to get started</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Newspaper className="h-5 w-5" />
              Latest News
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/news">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {newsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : recentNews && recentNews.length > 0 ? (
              <div className="space-y-4">
                {recentNews.slice(0, 5).map((article) => (
                  <a
                    key={article.id}
                    href={article.url || "#"}
                    target={article.url ? "_blank" : undefined}
                    rel={article.url ? "noopener noreferrer" : undefined}
                    className="block p-3 rounded-lg hover-elevate space-y-1"
                    data-testid={`news-item-${article.id}`}
                    onClick={(e) => {
                      if (!article.url) {
                        e.preventDefault();
                        navigate("/news");
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm line-clamp-2">{article.title}</p>
                      {!article.isRead && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{article.source || "Unknown source"}</span>
                      {article.category && (
                        <>
                          <span>&#183;</span>
                          <span className="capitalize">{article.category}</span>
                        </>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No news articles yet</p>
                <p className="text-sm">News will appear here when aggregated</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Political Prediction Markets
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/predictions">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {marketsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-3 rounded-lg border">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : predictionMarkets && predictionMarkets.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {predictionMarkets.slice(0, 4).map((market) => (
                <div
                  key={market.ticker}
                  className="p-3 rounded-lg border hover-elevate cursor-pointer"
                  data-testid={`market-item-${market.ticker}`}
                  onClick={() => navigate("/predictions")}
                >
                  <p className="text-sm font-medium line-clamp-2 mb-2">
                    {market.title}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={market.yes_price >= 50 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {market.yes_price}% Yes
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Vol: {market.volume.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No prediction markets available</p>
              <p className="text-sm">Political markets will appear when active</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

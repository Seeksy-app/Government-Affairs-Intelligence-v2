import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Newspaper, Activity, Star, BarChart3, FileText, Sparkles, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Contact, NewsArticle } from "@shared/schema";

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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Your political intelligence at a glance
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
      </div>

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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-3 rounded-lg border">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : predictionMarkets && predictionMarkets.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {predictionMarkets.slice(0, 6).map((market) => (
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

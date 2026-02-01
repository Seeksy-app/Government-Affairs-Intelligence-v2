import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Network, Newspaper, TrendingUp, Activity, Star } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { Contact, NewsArticle } from "@shared/schema";

interface ClientStats {
  totalContacts: number;
  highPriorityContacts: number;
  totalNews: number;
  unreadNews: number;
}

export default function ClientDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<ClientStats>({
    queryKey: ["/api/stats"],
  });

  const { data: recentContacts, isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts/recent"],
  });

  const { data: recentNews, isLoading: newsLoading } = useQuery<NewsArticle[]>({
    queryKey: ["/api/news/recent"],
  });

  const StatCard = ({ title, value, icon: Icon, description }: { title: string; value: number | undefined; icon: any; description?: string }) => (
    <Card>
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
      <div>
        <h1 className="text-3xl font-bold font-serif" data-testid="text-dashboard-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Your political intelligence at a glance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Contacts" 
          value={stats?.totalContacts} 
          icon={Users}
          description="In your network"
        />
        <StatCard 
          title="High Priority" 
          value={stats?.highPriorityContacts} 
          icon={Star}
          description="Key contacts"
        />
        <StatCard 
          title="News Articles" 
          value={stats?.totalNews} 
          icon={Newspaper}
          description="Aggregated today"
        />
        <StatCard 
          title="Unread" 
          value={stats?.unreadNews} 
          icon={Activity}
          description="Pending review"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Contacts */}
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
                  <div
                    key={contact.id}
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
                  </div>
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

        {/* Recent News */}
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
                  <div
                    key={article.id}
                    className="p-3 rounded-lg hover-elevate space-y-1"
                    data-testid={`news-item-${article.id}`}
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
                          <span>•</span>
                          <span className="capitalize">{article.category}</span>
                        </>
                      )}
                    </div>
                  </div>
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
    </div>
  );
}

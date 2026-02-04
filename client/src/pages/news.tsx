import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Newspaper, Plus, Search, ExternalLink, Flag, Check, Clock, 
  RefreshCw, Bookmark, TrendingUp, Rss, Settings, Sparkles,
  AlertCircle, Filter, Star
} from "lucide-react";
import type { NewsArticle, InsertNewsArticle, RssFeed } from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";

export default function News() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterRead, setFilterRead] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRssDialogOpen, setIsRssDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [formData, setFormData] = useState<Partial<InsertNewsArticle>>({
    title: "",
    summary: "",
    source: "",
    url: "",
    category: "",
  });
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [newFeedName, setNewFeedName] = useState("");
  const [newFeedCategory, setNewFeedCategory] = useState("politics");

  const { data: articles, isLoading } = useQuery<NewsArticle[]>({
    queryKey: ["/api/news"],
  });

  const { data: rssFeeds } = useQuery<RssFeed[]>({
    queryKey: ["/api/rss-feeds"],
  });

  const fetchNewsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/news/fetch", { hoursBack: 168 });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({ 
        title: "News aggregation complete",
        description: `Fetched ${data.totalFetched} articles, ${data.newArticlesSaved} new`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error fetching news", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertNewsArticle) => {
      return apiRequest("POST", "/api/news", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Article added successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error adding article", description: error.message, variant: "destructive" });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      return apiRequest("PATCH", `/api/news/${id}`, { isRead });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  const toggleFlagMutation = useMutation({
    mutationFn: async ({ id, isFlagged }: { id: string; isFlagged: boolean }) => {
      return apiRequest("PATCH", `/api/news/${id}`, { isFlagged });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/news/${id}/bookmark`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({ title: "Bookmark updated" });
    },
  });

  const addRssFeedMutation = useMutation({
    mutationFn: async (data: { name: string; feedUrl: string; category: string }) => {
      return apiRequest("POST", "/api/rss-feeds", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rss-feeds"] });
      toast({ title: "RSS feed added successfully" });
      setNewFeedUrl("");
      setNewFeedName("");
      setIsRssDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error adding RSS feed", description: error.message, variant: "destructive" });
    },
  });

  const testFeedMutation = useMutation({
    mutationFn: async (feedUrl: string) => {
      return apiRequest("POST", "/api/rss-feeds/test", { feedUrl });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setNewFeedName(data.title || "");
        toast({ title: "Feed is valid", description: `Found ${data.itemCount} articles` });
      } else {
        toast({ title: "Invalid feed", description: data.error, variant: "destructive" });
      }
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      summary: "",
      source: "",
      url: "",
      category: "",
    });
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData as InsertNewsArticle);
  };

  const uniqueSources = [...new Set(articles?.map(a => a.source).filter(Boolean))].sort();

  const filteredArticles = articles?.filter((article) => {
    const matchesSearch = 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.source?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || article.category?.toLowerCase() === filterCategory.toLowerCase();
    const matchesSource = filterSource === "all" || article.source === filterSource;
    const matchesRead = 
      filterRead === "all" || 
      (filterRead === "unread" && !article.isRead) ||
      (filterRead === "read" && article.isRead) ||
      (filterRead === "flagged" && article.isFlagged) ||
      (filterRead === "bookmarked" && article.isBookmarked);
    
    const matchesTab = 
      activeTab === "all" ||
      (activeTab === "high-relevance" && (article.relevanceScore || 0) >= 50) ||
      (activeTab === "bookmarked" && article.isBookmarked) ||
      (activeTab === "flagged" && article.isFlagged);
    
    return matchesSearch && matchesCategory && matchesSource && matchesRead && matchesTab;
  })?.sort((a, b) => {
    if (activeTab === "high-relevance") {
      return (b.relevanceScore || 0) - (a.relevanceScore || 0);
    }
    return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
  });

  const categories = ["legislation", "executive", "policy", "campaign", "defense"];

  const getCategoryColor = (category: string | null) => {
    switch (category?.toLowerCase()) {
      case "legislation": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "executive": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "defense": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "policy": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "campaign": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 70) return "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400";
    if (score >= 40) return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400";
  };

  const highRelevanceCount = articles?.filter(a => (a.relevanceScore || 0) >= 50).length || 0;
  const bookmarkedCount = articles?.filter(a => a.isBookmarked).length || 0;
  const unreadCount = articles?.filter(a => !a.isRead).length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif flex items-center gap-2" data-testid="text-news-title">
            <Sparkles className="h-7 w-7 text-primary" />
            News Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered news aggregation from {rssFeeds?.filter(f => f.isActive).length || 0} sources
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => fetchNewsMutation.mutate()}
            disabled={fetchNewsMutation.isPending}
            data-testid="button-fetch-news"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${fetchNewsMutation.isPending ? "animate-spin" : ""}`} />
            {fetchNewsMutation.isPending ? "Fetching..." : "Refresh News"}
          </Button>
          
          <Dialog open={isRssDialogOpen} onOpenChange={setIsRssDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-manage-feeds">
                <Rss className="w-4 h-4 mr-2" />
                Manage Feeds
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Manage RSS Feeds</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium">Add New Feed</h4>
                  <div className="flex gap-2">
                    <Input
                      placeholder="RSS feed URL..."
                      value={newFeedUrl}
                      onChange={(e) => setNewFeedUrl(e.target.value)}
                      className="flex-1"
                      data-testid="input-feed-url"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => testFeedMutation.mutate(newFeedUrl)}
                      disabled={!newFeedUrl || testFeedMutation.isPending}
                    >
                      Test
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Feed name..."
                      value={newFeedName}
                      onChange={(e) => setNewFeedName(e.target.value)}
                      className="flex-1"
                      data-testid="input-feed-name"
                    />
                    <Select value={newFeedCategory} onValueChange={setNewFeedCategory}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="politics">Politics</SelectItem>
                        <SelectItem value="defense">Defense</SelectItem>
                        <SelectItem value="policy">Policy</SelectItem>
                        <SelectItem value="legislative">Legislative</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => addRssFeedMutation.mutate({ 
                        name: newFeedName, 
                        feedUrl: newFeedUrl, 
                        category: newFeedCategory 
                      })}
                      disabled={!newFeedUrl || !newFeedName || addRssFeedMutation.isPending}
                    >
                      Add Feed
                    </Button>
                  </div>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Active Feeds ({rssFeeds?.filter(f => f.isActive).length || 0})</h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {rssFeeds?.map((feed) => (
                      <div key={feed.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${feed.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                          <span className="font-medium text-sm">{feed.name}</span>
                          <Badge variant="outline" className="text-xs">{feed.category}</Badge>
                          {feed.lastFetchStatus === "error" && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {feed.lastFetchedAt && (
                            <span>Last: {formatDistanceToNow(new Date(feed.lastFetchedAt), { addSuffix: true })}</span>
                          )}
                          <span>{feed.articleCount || 0} articles</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()} data-testid="button-add-article">
                <Plus className="w-4 h-4 mr-2" />
                Add Article
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add News Article</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Article headline..."
                    required
                    data-testid="input-article-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="summary">Summary</Label>
                  <Textarea
                    id="summary"
                    value={formData.summary || ""}
                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                    placeholder="Brief summary of the article..."
                    rows={3}
                    data-testid="input-article-summary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Input
                      id="source"
                      value={formData.source || ""}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      placeholder="Politico, The Hill..."
                      data-testid="input-article-source"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category || ""}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger data-testid="select-article-category">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={formData.url || ""}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://..."
                    data-testid="input-article-url"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                    data-testid="button-submit-article"
                  >
                    {createMutation.isPending ? "Adding..." : "Add Article"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Articles</p>
                <p className="text-2xl font-bold">{articles?.length || 0}</p>
              </div>
              <Newspaper className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Relevance</p>
                <p className="text-2xl font-bold text-green-600">{highRelevanceCount}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unread</p>
                <p className="text-2xl font-bold text-blue-600">{unreadCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bookmarked</p>
                <p className="text-2xl font-bold text-yellow-600">{bookmarkedCount}</p>
              </div>
              <Bookmark className="h-8 w-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            All Articles
          </TabsTrigger>
          <TabsTrigger value="high-relevance" data-testid="tab-high-relevance">
            <TrendingUp className="h-4 w-4 mr-1" />
            High Relevance ({highRelevanceCount})
          </TabsTrigger>
          <TabsTrigger value="bookmarked" data-testid="tab-bookmarked">
            <Bookmark className="h-4 w-4 mr-1" />
            Bookmarked ({bookmarkedCount})
          </TabsTrigger>
          <TabsTrigger value="flagged" data-testid="tab-flagged">
            <Flag className="h-4 w-4 mr-1" />
            Flagged
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
                data-testid="input-search-news"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[140px]" data-testid="filter-category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-[150px]" data-testid="filter-source">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {uniqueSources.map((s) => (
                    <SelectItem key={s} value={s || "unknown"}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterRead} onValueChange={setFilterRead}>
                <SelectTrigger className="w-[120px]" data-testid="filter-read">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                  <SelectItem value="bookmarked">Bookmarked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <Skeleton className="h-16 w-16 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredArticles && filteredArticles.length > 0 ? (
            <div className="space-y-3">
              {filteredArticles.map((article) => (
                <Card 
                  key={article.id} 
                  className={`hover-elevate transition-colors ${!article.isRead ? "border-l-4 border-l-primary" : ""}`}
                  data-testid={`news-card-${article.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {(article.relevanceScore || 0) > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRelevanceColor(article.relevanceScore || 0)}`}>
                              <Star className="h-3 w-3 inline mr-1" />
                              {article.relevanceScore}%
                            </span>
                          )}
                          {article.isFlagged && (
                            <Flag className="h-4 w-4 text-orange-500 fill-orange-500" />
                          )}
                          {article.isBookmarked && (
                            <Bookmark className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <h3 className="font-medium line-clamp-2">{article.title}</h3>
                        {article.summary && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {article.summary}
                          </p>
                        )}
                        {article.matchedTopics && Array.isArray(article.matchedTopics) && article.matchedTopics.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Matches:</span>
                            {(article.matchedTopics as string[]).slice(0, 3).map((topic, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {topic}
                              </Badge>
                            ))}
                            {(article.matchedTopics as string[]).length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{(article.matchedTopics as string[]).length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                          {article.category && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(article.category)}`}>
                              {article.category}
                            </span>
                          )}
                          {article.source && (
                            <span className="text-xs text-muted-foreground">
                              {article.source}
                            </span>
                          )}
                          {article.publishedAt && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => bookmarkMutation.mutate(article.id)}
                          data-testid={`button-bookmark-${article.id}`}
                        >
                          <Bookmark className={`h-4 w-4 ${article.isBookmarked ? "text-yellow-500 fill-yellow-500" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleFlagMutation.mutate({ id: article.id, isFlagged: !article.isFlagged })}
                          data-testid={`button-flag-${article.id}`}
                        >
                          <Flag className={`h-4 w-4 ${article.isFlagged ? "text-orange-500 fill-orange-500" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markReadMutation.mutate({ id: article.id, isRead: !article.isRead })}
                          data-testid={`button-read-${article.id}`}
                        >
                          <Check className={`h-4 w-4 ${article.isRead ? "text-green-500" : ""}`} />
                        </Button>
                        {article.url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                          >
                            <a href={article.url} target="_blank" rel="noopener noreferrer" data-testid={`button-link-${article.id}`}>
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No articles found</p>
              <p className="text-sm mb-4">
                {searchQuery || filterCategory !== "all" || filterRead !== "all" 
                  ? "Try adjusting your filters" 
                  : "Click 'Refresh News' to fetch articles from all sources"}
              </p>
              {!searchQuery && filterCategory === "all" && filterRead === "all" && (
                <Button 
                  onClick={() => fetchNewsMutation.mutate()}
                  disabled={fetchNewsMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${fetchNewsMutation.isPending ? "animate-spin" : ""}`} />
                  Fetch News Now
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

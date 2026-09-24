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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Newspaper, Plus, Search, ExternalLink, Flag, Check, Clock, 
  RefreshCw, Bookmark, TrendingUp, Rss, Settings,
  AlertCircle, Filter, Star, Users, Trash2, Building2, X
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { NewsArticle, InsertNewsArticle, RssFeed, Client, RssFeedClientAssignment, HighIntentKeyword, ClientPortal, NewsArticlePortalAssignment } from "@shared/schema";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Mail, Share2, Target, Eye, EyeOff } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { PageHeader, PageShell } from "@/components/page-header";

interface AssignmentWithClient extends RssFeedClientAssignment {
  clientName: string;
}

export default function News() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterRead, setFilterRead] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRssDialogOpen, setIsRssDialogOpen] = useState(false);
  const [isFeedDetailsOpen, setIsFeedDetailsOpen] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<RssFeed | null>(null);
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

  // Check if user is super admin
  const { data: userRole } = useQuery<{ isSuperAdmin: boolean }>({
    queryKey: ["/api/user/role"],
  });

  const isSuperAdmin = userRole?.isSuperAdmin;

  // Get all clients for assignment (only for super admins)
  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/admin/clients"],
    enabled: isSuperAdmin,
  });

  // Get assignments for selected feed
  const { data: feedAssignments, refetch: refetchAssignments } = useQuery<AssignmentWithClient[]>({
    queryKey: ["/api/rss-feeds", selectedFeed?.id, "assignments"],
    queryFn: async () => {
      if (!selectedFeed) return [];
      const res = await fetch(`/api/rss-feeds/${selectedFeed.id}/assignments`);
      if (!res.ok) throw new Error("Failed to get assignments");
      return res.json();
    },
    enabled: !!selectedFeed,
  });

  const assignFeedMutation = useMutation({
    mutationFn: async ({ feedId, clientId }: { feedId: string; clientId: string }) => {
      return apiRequest("POST", `/api/rss-feeds/${feedId}/assignments`, { clientId });
    },
    onSuccess: () => {
      refetchAssignments();
      toast({ title: "Feed assigned to client" });
    },
    onError: (error: Error) => {
      toast({ title: "Error assigning feed", description: error.message, variant: "destructive" });
    },
  });

  const unassignFeedMutation = useMutation({
    mutationFn: async ({ feedId, clientId }: { feedId: string; clientId: string }) => {
      return apiRequest("DELETE", `/api/rss-feeds/${feedId}/assignments/${clientId}`);
    },
    onSuccess: () => {
      refetchAssignments();
      toast({ title: "Feed unassigned from client" });
    },
    onError: (error: Error) => {
      toast({ title: "Error unassigning feed", description: error.message, variant: "destructive" });
    },
  });

  const deleteFeedMutation = useMutation({
    mutationFn: async (feedId: string) => {
      return apiRequest("DELETE", `/api/rss-feeds/${feedId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rss-feeds"] });
      setIsFeedDetailsOpen(false);
      setSelectedFeed(null);
      toast({ title: "Feed deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting feed", description: error.message, variant: "destructive" });
    },
  });

  // High Intent Keywords
  const [newKeyword, setNewKeyword] = useState("");
  const [isKeywordsOpen, setIsKeywordsOpen] = useState(false);
  const [forwardEmail, setForwardEmail] = useState("");
  const [forwardMessage, setForwardMessage] = useState("");
  const [forwardArticleId, setForwardArticleId] = useState<string | null>(null);

  const { data: highIntentKeywords } = useQuery<HighIntentKeyword[]>({
    queryKey: ["/api/high-intent-keywords"],
  });

  const { data: portals } = useQuery<ClientPortal[]>({
    queryKey: ["/api/portals"],
  });

  const { data: articleAssignments } = useQuery<NewsArticlePortalAssignment[]>({
    queryKey: ["/api/news/assignments/all"],
  });

  const createKeywordMutation = useMutation({
    mutationFn: async (keyword: string) => {
      return apiRequest("POST", "/api/high-intent-keywords", { keyword });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/high-intent-keywords"] });
      setNewKeyword("");
      toast({ title: "Keyword added" });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding keyword", description: error.message, variant: "destructive" });
    },
  });

  const deleteKeywordMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/high-intent-keywords/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/high-intent-keywords"] });
      toast({ title: "Keyword removed" });
    },
  });

  const assignToPortalMutation = useMutation({
    mutationFn: async ({ articleId, portalId }: { articleId: string; portalId: string }) => {
      return apiRequest("POST", `/api/news/${articleId}/assign-portal`, { portalId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news/assignments/all"] });
      toast({ title: "Article assigned to portal" });
    },
    onError: (error: Error) => {
      toast({ title: "Error assigning article", description: error.message, variant: "destructive" });
    },
  });

  const forwardArticleMutation = useMutation({
    mutationFn: async ({ articleId, email, message }: { articleId: string; email: string; message: string }) => {
      return apiRequest("POST", `/api/news/${articleId}/forward`, { email, message });
    },
    onSuccess: () => {
      setForwardArticleId(null);
      setForwardEmail("");
      setForwardMessage("");
      toast({ title: "Article forwarded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error forwarding article", description: error.message, variant: "destructive" });
    },
  });

  // Check if article matches any high intent keywords
  const getMatchingKeywords = (article: NewsArticle): string[] => {
    if (!highIntentKeywords || highIntentKeywords.length === 0) return [];
    const text = `${article.title} ${article.summary || ""}`.toLowerCase();
    return highIntentKeywords
      .filter(k => text.includes(k.keyword.toLowerCase()))
      .map(k => k.keyword);
  };

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/news/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({ title: "Article deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting article", description: error.message, variant: "destructive" });
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

  const uniqueSources = Array.from(new Set(articles?.map(a => a.source).filter(Boolean) || [])).sort();

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
    
    const assignedArticleIds = new Set(articleAssignments?.map(a => a.articleId) || []);
    const isAssigned = assignedArticleIds.has(article.id);
    
    const matchesTab = 
      activeTab === "all" ||
      (activeTab === "high-relevance" && (article.relevanceScore || 0) >= 50) ||
      (activeTab === "bookmarked" && article.isBookmarked) ||
      (activeTab === "flagged" && article.isFlagged) ||
      (activeTab === "assigned" && isAssigned) ||
      (activeTab === "unread" && !article.isRead);
    
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
      // One neutral chip style for every category — color is reserved for state.
      case "legislation":
      case "executive":
      case "defense":
      case "policy":
      case "campaign":
      default: return "border bg-muted/50 text-muted-foreground capitalize";
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 70) return "text-primary bg-primary/10";
    if (score >= 40) return "text-foreground bg-muted";
    return "text-muted-foreground bg-muted/60";
  };

  const highRelevanceCount = articles?.filter(a => (a.relevanceScore || 0) >= 50).length || 0;
  const bookmarkedCount = articles?.filter(a => a.isBookmarked).length || 0;
  const unreadCount = articles?.filter(a => !a.isRead).length || 0;
  const assignedArticleIds = new Set(articleAssignments?.map(a => a.articleId) || []);
  const assignedCount = articles?.filter(a => assignedArticleIds.has(a.id)).length || 0;
  
  const getPortalNameForArticle = (articleId: string): string | null => {
    const assignment = articleAssignments?.find(a => a.articleId === articleId);
    if (!assignment) return null;
    const portal = portals?.find(p => p.id === assignment.portalId);
    return portal?.name || null;
  };

  return (
    <PageShell className="space-y-6">
      <PageHeader
        eyebrow="Monitor"
        title={<span data-testid="text-news-title">News</span>}
        description={`Monitor policy coverage from ${rssFeeds?.filter(f => f.isActive).length || 0} sources, scored for relevance to your clients.`}
        className="mb-0"
        actions={
        <>
          <Button 
            variant="outline"
            onClick={() => fetchNewsMutation.mutate()}
            disabled={fetchNewsMutation.isPending}
            data-testid="button-fetch-news"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${fetchNewsMutation.isPending ? "animate-spin" : ""}`} />
            {fetchNewsMutation.isPending ? "Fetching..." : "Refresh News"}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setIsKeywordsOpen(true)}
            data-testid="button-high-intent"
          >
            <Target className="w-4 h-4 mr-2" />
            High Intent
            {highIntentKeywords && highIntentKeywords.length > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 tabular-nums">{highIntentKeywords.length}</Badge>
            )}
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
                  <h4 className="text-sm font-semibold">Add New Feed</h4>
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
                  <div className="flex flex-wrap gap-2">
                    <Input
                      placeholder="Feed name..."
                      value={newFeedName}
                      onChange={(e) => setNewFeedName(e.target.value)}
                      className="min-w-[160px] flex-1"
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
                  <h4 className="text-sm font-semibold mb-3">Active Feeds ({rssFeeds?.filter(f => f.isActive).length || 0})</h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {rssFeeds?.map((feed) => (
                      <div 
                        key={feed.id} 
                        className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-md bg-muted/50 hover-elevate cursor-pointer"
                        onClick={() => {
                          setSelectedFeed(feed);
                          setIsFeedDetailsOpen(true);
                        }}
                        data-testid={`feed-item-${feed.id}`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div className={`w-2 h-2 shrink-0 rounded-full ${feed.isActive ? "bg-primary" : "bg-muted-foreground/40"}`} />
                          <span className="font-medium text-sm">{feed.name}</span>
                          <Badge variant="outline" className="text-xs font-normal capitalize text-muted-foreground">{feed.category}</Badge>
                          {feed.lastFetchStatus === "error" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Feed fetch error: {feed.lastFetchError || "Unknown error"}</p>
                              </TooltipContent>
                            </Tooltip>
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

          {/* Feed Details Dialog */}
          <Dialog open={isFeedDetailsOpen} onOpenChange={setIsFeedDetailsOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Rss className="h-4 w-4 text-muted-foreground" />
                  {selectedFeed?.name}
                </DialogTitle>
              </DialogHeader>
              
              {selectedFeed && (
                <div className="space-y-4">
                  {/* Feed Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <Badge variant="outline">{selectedFeed.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={selectedFeed.isActive ? "default" : "secondary"}>
                        {selectedFeed.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Last Sync:</span>
                      <span>{selectedFeed.lastFetchedAt 
                        ? formatDistanceToNow(new Date(selectedFeed.lastFetchedAt), { addSuffix: true })
                        : "Never"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Articles:</span>
                      <span>{selectedFeed.articleCount || 0}</span>
                    </div>
                    {selectedFeed.lastFetchStatus === "error" && selectedFeed.lastFetchError && (
                      <div className="p-2 rounded-md bg-destructive/5 border border-destructive/20 text-destructive text-xs">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        {selectedFeed.lastFetchError}
                      </div>
                    )}
                    <div className="pt-2">
                      <Label className="text-muted-foreground text-xs">Feed URL</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input 
                          value={selectedFeed.feedUrl} 
                          readOnly 
                          className="text-xs h-8"
                        />
                        <Button 
                          size="icon" 
                          variant="outline" 
                          className="h-8 w-8"
                          onClick={() => window.open(selectedFeed.feedUrl, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Client Assignments - Only for Super Admins */}
                  {isSuperAdmin && (
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4" />
                        <h4 className="text-sm font-semibold">Assign to Clients</h4>
                      </div>
                      
                      {clients && clients.length > 0 ? (
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-2">
                            {clients.map((client) => {
                              const isAssigned = feedAssignments?.some(a => a.clientId === client.id);
                              return (
                                <div 
                                  key={client.id}
                                  className="flex items-center justify-between p-2 rounded border hover-elevate"
                                >
                                  <div className="flex items-center gap-2">
                                    <Checkbox 
                                      checked={isAssigned}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          assignFeedMutation.mutate({ 
                                            feedId: selectedFeed.id, 
                                            clientId: client.id 
                                          });
                                        } else {
                                          unassignFeedMutation.mutate({ 
                                            feedId: selectedFeed.id, 
                                            clientId: client.id 
                                          });
                                        }
                                      }}
                                      disabled={assignFeedMutation.isPending || unassignFeedMutation.isPending}
                                      data-testid={`checkbox-assign-${client.id}`}
                                    />
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">{client.name}</span>
                                  </div>
                                  {isAssigned && (
                                    <Badge variant="secondary" className="text-xs">Assigned</Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No clients available to assign
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this feed?")) {
                          deleteFeedMutation.mutate(selectedFeed.id);
                        }
                      }}
                      disabled={deleteFeedMutation.isPending}
                      data-testid="button-delete-feed"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Feed
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsFeedDetailsOpen(false)}
                      data-testid="button-close-feed-details"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              )}
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
        </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card
          className={`hover-elevate cursor-pointer transition-colors ${activeTab === "all" ? "border-primary bg-primary/5" : ""}`}
          onClick={() => setActiveTab("all")}
          data-testid="card-total-articles"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
              Total articles
              <Newspaper className="h-3.5 w-3.5" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{articles?.length || 0}</p>
          </CardContent>
        </Card>
        <Card
          className={`hover-elevate cursor-pointer transition-colors ${activeTab === "high-relevance" ? "border-primary bg-primary/5" : ""}`}
          onClick={() => setActiveTab("high-relevance")}
          data-testid="card-high-relevance"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
              High relevance
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{highRelevanceCount}</p>
          </CardContent>
        </Card>
        <Card
          className={`hover-elevate cursor-pointer transition-colors ${activeTab === "unread" ? "border-primary bg-primary/5" : ""}`}
          onClick={() => setActiveTab("unread")}
          data-testid="card-unread"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
              Unread
              <AlertCircle className="h-3.5 w-3.5" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{unreadCount}</p>
          </CardContent>
        </Card>
        <Card
          className={`hover-elevate cursor-pointer transition-colors ${activeTab === "bookmarked" ? "border-primary bg-primary/5" : ""}`}
          onClick={() => setActiveTab("bookmarked")}
          data-testid="card-bookmarked"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
              Bookmarked
              <Bookmark className="h-3.5 w-3.5" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{bookmarkedCount}</p>
          </CardContent>
        </Card>
        <Card
          className={`hover-elevate cursor-pointer transition-colors ${activeTab === "assigned" ? "border-primary bg-primary/5" : ""}`}
          onClick={() => setActiveTab("assigned")}
          data-testid="card-assigned"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
              Assigned
              <Share2 className="h-3.5 w-3.5" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{assignedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            All Articles
          </TabsTrigger>
          <TabsTrigger value="high-relevance" data-testid="tab-high-relevance">
            <TrendingUp className="h-4 w-4 mr-1" />
            High Relevance ({highRelevanceCount})
          </TabsTrigger>
          <TabsTrigger value="unread" data-testid="tab-unread">
            <AlertCircle className="h-4 w-4 mr-1" />
            Unread ({unreadCount})
          </TabsTrigger>
          <TabsTrigger value="bookmarked" data-testid="tab-bookmarked">
            <Bookmark className="h-4 w-4 mr-1" />
            Bookmarked ({bookmarkedCount})
          </TabsTrigger>
          <TabsTrigger value="assigned" data-testid="tab-assigned">
            <Share2 className="h-4 w-4 mr-1" />
            Assigned ({assignedCount})
          </TabsTrigger>
          <TabsTrigger value="flagged" data-testid="tab-flagged">
            <Flag className="h-4 w-4 mr-1" />
            Flagged
          </TabsTrigger>
        </TabsList>
        </div>
      </Tabs>

      <Card>
        <CardHeader className="p-5 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
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
        <CardContent className="p-5 pt-0">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="rounded-lg border p-4">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-12 rounded-full" />
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <div className="hidden gap-1 sm:flex">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredArticles && filteredArticles.length > 0 ? (
            <div className="space-y-3">
              {filteredArticles.map((article) => (
                <Card 
                  key={article.id} 
                  className={`hover-elevate transition-colors shadow-none ${!article.isRead ? "border-l-2 border-l-primary" : ""}`}
                  data-testid={`news-card-${article.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {(article.relevanceScore || 0) > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium tabular-nums ${getRelevanceColor(article.relevanceScore || 0)}`}>
                              <Star className="h-3 w-3 inline mr-1" />
                              {article.relevanceScore}%
                            </span>
                          )}
                          {article.isFlagged && (
                            <Flag className="h-3.5 w-3.5 text-primary fill-primary" aria-label="Flagged" />
                          )}
                          {article.isBookmarked && (
                            <Bookmark className="h-3.5 w-3.5 text-primary fill-primary" aria-label="Bookmarked" />
                          )}
                        </div>
                        {article.url ? (
                          <a 
                            href={article.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="font-semibold leading-snug line-clamp-2 hover:text-primary cursor-pointer transition-colors"
                            onClick={() => markReadMutation.mutate({ id: article.id, isRead: true })}
                            data-testid={`link-article-${article.id}`}
                          >
                            {article.title}
                          </a>
                        ) : (
                          <h3 className="font-semibold leading-snug line-clamp-2">{article.title}</h3>
                        )}
                        {article.summary && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {article.summary}
                          </p>
                        )}
                        {Array.isArray(article.matchedTopics) && article.matchedTopics.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Matches:</span>
                            {(article.matchedTopics as string[]).slice(0, 3).map((topic, i) => (
                              <Badge key={i} variant="secondary" className="text-xs font-normal">
                                {String(topic)}
                              </Badge>
                            ))}
                            {(article.matchedTopics as string[]).length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{(article.matchedTopics as string[]).length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                        {getMatchingKeywords(article).length > 0 && (
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            <Target className="h-3 w-3 text-primary" />
                            <span className="text-xs text-primary font-medium">High intent:</span>
                            {getMatchingKeywords(article).map((keyword, i) => (
                              <Badge key={i} variant="outline" className="text-xs font-medium border-primary/20 bg-primary/5 text-primary">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {getPortalNameForArticle(article.id) && (
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            <Share2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-medium">Assigned to:</span>
                            <Badge variant="outline" className="text-xs font-normal">
                              {getPortalNameForArticle(article.id)}
                            </Badge>
                          </div>
                        )}
                        <div className="flex items-center gap-x-3 gap-y-1 mt-3 flex-wrap">
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
                      <div className="-ml-2 flex items-center gap-0.5 shrink-0 text-muted-foreground sm:ml-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => bookmarkMutation.mutate(article.id)}
                              aria-label={article.isBookmarked ? "Remove bookmark" : "Bookmark article"}
                              data-testid={`button-bookmark-${article.id}`}
                            >
                              <Bookmark className={`h-4 w-4 ${article.isBookmarked ? "text-primary fill-primary" : ""}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{article.isBookmarked ? "Remove bookmark" : "Bookmark article"}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleFlagMutation.mutate({ id: article.id, isFlagged: !article.isFlagged })}
                              aria-label={article.isFlagged ? "Remove flag" : "Flag for follow-up"}
                              data-testid={`button-flag-${article.id}`}
                            >
                              <Flag className={`h-4 w-4 ${article.isFlagged ? "text-primary fill-primary" : ""}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{article.isFlagged ? "Remove flag" : "Flag for follow-up"}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => markReadMutation.mutate({ id: article.id, isRead: !article.isRead })}
                              aria-label={article.isRead ? "Mark as unread" : "Mark as read"}
                              data-testid={`button-read-${article.id}`}
                            >
                              <Check className={`h-4 w-4 ${article.isRead ? "text-primary" : ""}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{article.isRead ? "Mark as unread" : "Mark as read"}</p>
                          </TooltipContent>
                        </Tooltip>
                        {article.url && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                              >
                                <a href={article.url} target="_blank" rel="noopener noreferrer" data-testid={`button-link-${article.id}`}>
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Open article in new tab</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="More actions" data-testid={`button-more-${article.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setForwardArticleId(article.id)}
                              data-testid={`menu-forward-${article.id}`}
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Forward via Email
                            </DropdownMenuItem>
                            {portals && portals.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                  Assign to Portal
                                </DropdownMenuItem>
                                {portals.map(portal => (
                                  <DropdownMenuItem
                                    key={portal.id}
                                    onClick={() => assignToPortalMutation.mutate({ articleId: article.id, portalId: portal.id })}
                                    data-testid={`menu-assign-portal-${portal.id}`}
                                  >
                                    <Share2 className="h-4 w-4 mr-2" />
                                    {portal.name}
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(article.id)}
                              className="text-destructive"
                              data-testid={`menu-delete-${article.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Article
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Newspaper className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-semibold">No articles found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || filterCategory !== "all" || filterRead !== "all"
                  ? "Try adjusting your filters."
                  : "Refresh to pull the latest articles from all sources."}
              </p>
              {!searchQuery && filterCategory === "all" && filterRead === "all" && (
                <Button
                  size="sm"
                  className="mt-4"
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

      {/* Forward Article Dialog */}
      <Dialog open={!!forwardArticleId} onOpenChange={(open) => !open && setForwardArticleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward Article via Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forward-email">Recipient Email</Label>
              <Input
                id="forward-email"
                type="email"
                placeholder="recipient@example.com"
                value={forwardEmail}
                onChange={(e) => setForwardEmail(e.target.value)}
                data-testid="input-forward-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forward-message">Message (optional)</Label>
              <Textarea
                id="forward-message"
                placeholder="Add a personal message..."
                value={forwardMessage}
                onChange={(e) => setForwardMessage(e.target.value)}
                data-testid="input-forward-message"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForwardArticleId(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (forwardArticleId && forwardEmail) {
                    forwardArticleMutation.mutate({
                      articleId: forwardArticleId,
                      email: forwardEmail,
                      message: forwardMessage
                    });
                  }
                }}
                disabled={!forwardEmail || forwardArticleMutation.isPending}
                data-testid="button-send-forward"
              >
                {forwardArticleMutation.isPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* High Intent Keywords Panel */}
      <Dialog open={isKeywordsOpen} onOpenChange={setIsKeywordsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              High Intent Keywords
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Articles matching these keywords will be highlighted. Use this to track important topics, legislation, or entities.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Add keyword..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newKeyword.trim()) {
                    e.preventDefault();
                    createKeywordMutation.mutate(newKeyword.trim());
                  }
                }}
                data-testid="input-new-keyword"
              />
              <Button
                onClick={() => {
                  if (newKeyword.trim()) {
                    createKeywordMutation.mutate(newKeyword.trim());
                  }
                }}
                disabled={!newKeyword.trim() || createKeywordMutation.isPending}
                aria-label="Add keyword"
                data-testid="button-add-keyword"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {highIntentKeywords && highIntentKeywords.length > 0 ? (
                highIntentKeywords.map((kw) => (
                  <div
                    key={kw.id}
                    className="flex items-center justify-between p-2 border rounded-md"
                    data-testid={`keyword-item-${kw.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">{kw.keyword}</Badge>
                      {(kw.matchCount ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {kw.matchCount} matches
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteKeywordMutation.mutate(kw.id)}
                      aria-label={`Remove ${kw.keyword}`}
                      data-testid={`button-delete-keyword-${kw.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-center text-muted-foreground py-4">
                  No keywords configured
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Users, 
  Plus, 
  RefreshCw, 
  ExternalLink, 
  Trash2, 
  Flag,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  CheckCircle,
  AlertCircle,
  Search,
  Tag,
  X,
  Edit2
} from "lucide-react";
import { SiInstagram, SiYoutube, SiTiktok, SiTwitch } from "react-icons/si";
import { FaXTwitter } from "react-icons/fa6";
import type { TrackedInfluencer, InfluencerPost } from "@shared/schema";

const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: SiInstagram, color: "text-pink-500" },
  { value: "youtube", label: "YouTube", icon: SiYoutube, color: "text-red-500" },
  { value: "tiktok", label: "TikTok", icon: SiTiktok, color: "text-foreground" },
  { value: "twitter", label: "X (Twitter)", icon: FaXTwitter, color: "text-foreground" },
  { value: "twitch", label: "Twitch", icon: SiTwitch, color: "text-purple-500" },
];

function getPlatformIcon(platform: string) {
  const p = PLATFORMS.find(pl => pl.value === platform);
  if (!p) return null;
  const Icon = p.icon;
  return <Icon className={`h-4 w-4 ${p.color}`} />;
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "-";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export default function InfluencerTrackingPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("influencers");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPlatform, setNewPlatform] = useState("instagram");
  const [newNotes, setNewNotes] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [selectedInfluencer, setSelectedInfluencer] = useState<string | null>(null);
  const [editingKeywords, setEditingKeywords] = useState<string | null>(null);
  const [editKeywordsValue, setEditKeywordsValue] = useState("");

  const { data: influencers, isLoading: loadingInfluencers } = useQuery<TrackedInfluencer[]>({
    queryKey: ["/api/influencers"],
  });

  const { data: posts, isLoading: loadingPosts } = useQuery<InfluencerPost[]>({
    queryKey: ["/api/influencers/posts"],
  });

  const addInfluencerMutation = useMutation({
    mutationFn: async (data: { username: string; platform: string; notes?: string; keywords?: string[] }) => {
      return apiRequest("POST", "/api/influencers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/influencers"] });
      setAddDialogOpen(false);
      setNewUsername("");
      setNewPlatform("instagram");
      setNewNotes("");
      setNewKeywords("");
      toast({ title: "Influencer added", description: "The influencer is now being tracked" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add influencer", 
        description: error.message || "Please try again", 
        variant: "destructive" 
      });
    },
  });

  const updateKeywordsMutation = useMutation({
    mutationFn: async ({ id, keywords }: { id: string; keywords: string[] }) => {
      return apiRequest("PATCH", `/api/influencers/${id}`, { keywords });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/influencers"] });
      setEditingKeywords(null);
      setEditKeywordsValue("");
      toast({ title: "Keywords updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update keywords", 
        description: error.message || "Please try again", 
        variant: "destructive" 
      });
    },
  });

  const syncInfluencerMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/influencers/${id}/sync`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/influencers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/influencers/posts"] });
      toast({ title: "Influencer synced", description: "Profile data has been updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Sync failed", 
        description: error.message || "Please try again", 
        variant: "destructive" 
      });
    },
  });

  const deleteInfluencerMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/influencers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/influencers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/influencers/posts"] });
      toast({ title: "Influencer removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove influencer", variant: "destructive" });
    },
  });

  const toggleFlagMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/influencer-posts/${id}/flag`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/influencers/posts"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/influencer-posts/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/influencers/posts"] });
    },
  });

  const filteredInfluencers = influencers?.filter(inf => {
    const matchesSearch = searchQuery === "" || 
      inf.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inf.displayName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = platformFilter === "all" || inf.platform === platformFilter;
    return matchesSearch && matchesPlatform;
  });

  const filteredPosts = posts?.filter(post => {
    if (selectedInfluencer && post.influencerId !== selectedInfluencer) return false;
    return true;
  });

  const getInfluencerById = (id: string) => influencers?.find(inf => inf.id === id);

  return (
    <div className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Influencer Tracking
            </h1>
            <p className="text-muted-foreground mt-1">
              Track social media influencers across multiple platforms
            </p>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-influencer">
                <Plus className="h-4 w-4 mr-2" />
                Add Influencer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Influencer to Track</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="platform">Platform</Label>
                  <Select value={newPlatform} onValueChange={setNewPlatform}>
                    <SelectTrigger data-testid="select-platform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          <div className="flex items-center gap-2">
                            <p.icon className={`h-4 w-4 ${p.color}`} />
                            {p.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="@username or username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    data-testid="input-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="keywords">Keywords to Watch (optional)</Label>
                  <Input
                    id="keywords"
                    placeholder="Comma-separated: policy, legislation, vote..."
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    data-testid="input-keywords"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter keywords separated by commas to highlight matching posts
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Why are you tracking this influencer?"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    data-testid="input-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const keywords = newKeywords.trim() 
                      ? newKeywords.split(",").map(k => k.trim()).filter(k => k.length > 0)
                      : undefined;
                    addInfluencerMutation.mutate({
                      username: newUsername,
                      platform: newPlatform,
                      notes: newNotes || undefined,
                      keywords,
                    });
                  }}
                  disabled={!newUsername || addInfluencerMutation.isPending}
                  data-testid="button-submit-influencer"
                >
                  {addInfluencerMutation.isPending ? "Adding..." : "Add Influencer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="influencers" data-testid="tab-influencers">
              Influencers ({influencers?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="posts" data-testid="tab-posts">
              Posts ({posts?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="influencers" className="mt-4">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search influencers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-influencers"
                />
              </div>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-full md:w-48" data-testid="select-filter-platform">
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <p.icon className={`h-4 w-4 ${p.color}`} />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingInfluencers ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : filteredInfluencers && filteredInfluencers.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredInfluencers.map(influencer => (
                  <Card key={influencer.id} data-testid={`card-influencer-${influencer.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={influencer.profilePictureUrl || undefined} />
                          <AvatarFallback>
                            {influencer.username.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {getPlatformIcon(influencer.platform)}
                            <span className="font-medium truncate">
                              {influencer.displayName || `@${influencer.username}`}
                            </span>
                            {influencer.isVerified && (
                              <CheckCircle className="h-4 w-4 text-blue-500" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">@{influencer.username}</p>
                          {influencer.lastSyncError && (
                            <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                              <AlertCircle className="h-3 w-3" />
                              <span className="truncate">{influencer.lastSyncError}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                        <div>
                          <p className="text-lg font-semibold">{formatNumber(influencer.followerCount)}</p>
                          <p className="text-xs text-muted-foreground">Followers</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{formatNumber(influencer.postCount)}</p>
                          <p className="text-xs text-muted-foreground">Posts</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">
                            {influencer.engagementRate ? `${parseFloat(influencer.engagementRate).toFixed(1)}%` : "-"}
                          </p>
                          <p className="text-xs text-muted-foreground">Engagement</p>
                        </div>
                      </div>

                      {influencer.bio && (
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                          {influencer.bio}
                        </p>
                      )}
                      
                      {/* Keywords Section */}
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Tag className="h-3 w-3" />
                            <span>Keywords</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => {
                              setEditingKeywords(influencer.id);
                              setEditKeywordsValue(influencer.keywords?.join(", ") || "");
                            }}
                            data-testid={`button-edit-keywords-${influencer.id}`}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {editingKeywords === influencer.id ? (
                          <div className="space-y-2">
                            <Input
                              placeholder="policy, legislation, vote..."
                              value={editKeywordsValue}
                              onChange={(e) => setEditKeywordsValue(e.target.value)}
                              className="h-8 text-xs"
                              data-testid="input-edit-keywords"
                            />
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  const keywords = editKeywordsValue.trim()
                                    ? editKeywordsValue.split(",").map(k => k.trim()).filter(k => k.length > 0)
                                    : [];
                                  updateKeywordsMutation.mutate({ id: influencer.id, keywords });
                                }}
                                disabled={updateKeywordsMutation.isPending}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  setEditingKeywords(null);
                                  setEditKeywordsValue("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : influencer.keywords && influencer.keywords.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {influencer.keywords.map((keyword, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No keywords set</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t">
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => syncInfluencerMutation.mutate(influencer.id)}
                            disabled={syncInfluencerMutation.isPending}
                            data-testid={`button-sync-${influencer.id}`}
                          >
                            <RefreshCw className={`h-4 w-4 ${syncInfluencerMutation.isPending ? "animate-spin" : ""}`} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedInfluencer(influencer.id);
                              setActiveTab("posts");
                            }}
                            data-testid={`button-view-posts-${influencer.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {influencer.profileUrl && (
                            <Button
                              size="icon"
                              variant="ghost"
                              asChild
                            >
                              <a href={influencer.profileUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Remove this influencer?")) {
                              deleteInfluencerMutation.mutate(influencer.id);
                            }
                          }}
                          data-testid={`button-delete-${influencer.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No influencers tracked</h3>
                  <p className="text-muted-foreground mt-1 mb-4">
                    Add influencers to start tracking their social media activity
                  </p>
                  <Button onClick={() => setAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Influencer
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="posts" className="mt-4">
            <div className="flex items-center gap-4 mb-4">
              <Select 
                value={selectedInfluencer || "all"} 
                onValueChange={(v) => setSelectedInfluencer(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-full md:w-64" data-testid="select-filter-influencer">
                  <SelectValue placeholder="All influencers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Influencers</SelectItem>
                  {influencers?.map(inf => (
                    <SelectItem key={inf.id} value={inf.id}>
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(inf.platform)}
                        @{inf.username}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedInfluencer && (
                <Button variant="outline" size="sm" onClick={() => setSelectedInfluencer(null)}>
                  Clear filter
                </Button>
              )}
            </div>

            {loadingPosts ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : filteredPosts && filteredPosts.length > 0 ? (
              <div className="space-y-3">
                {filteredPosts.map(post => {
                  const influencer = getInfluencerById(post.influencerId);
                  return (
                    <Card 
                      key={post.id} 
                      className={`${!post.isRead ? "bg-primary/5" : ""}`}
                      data-testid={`card-post-${post.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              {getPlatformIcon(post.platform)}
                              <span className="font-medium">
                                @{influencer?.username || "Unknown"}
                              </span>
                              {post.postType && (
                                <Badge variant="secondary">{post.postType}</Badge>
                              )}
                            </div>
                            {post.content && (
                              <p className="text-sm whitespace-pre-wrap line-clamp-3">{post.content}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {post.likes !== null && post.likes !== undefined && (
                                <span className="flex items-center gap-1">
                                  <Heart className="h-3 w-3" /> {formatNumber(post.likes)}
                                </span>
                              )}
                              {post.comments !== null && post.comments !== undefined && (
                                <span className="flex items-center gap-1">
                                  <MessageCircle className="h-3 w-3" /> {formatNumber(post.comments)}
                                </span>
                              )}
                              {post.shares !== null && post.shares !== undefined && (
                                <span className="flex items-center gap-1">
                                  <Share2 className="h-3 w-3" /> {formatNumber(post.shares)}
                                </span>
                              )}
                              {post.postedAt && (
                                <span>{new Date(post.postedAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => toggleFlagMutation.mutate(post.id)}
                              data-testid={`button-flag-${post.id}`}
                            >
                              <Flag className={`h-4 w-4 ${post.isFlagged ? "fill-orange-500 text-orange-500" : ""}`} />
                            </Button>
                            {!post.isRead && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => markReadMutation.mutate(post.id)}
                                data-testid={`button-mark-read-${post.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {post.postUrl && (
                              <Button size="icon" variant="ghost" asChild>
                                <a href={post.postUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No posts yet</h3>
                  <p className="text-muted-foreground mt-1">
                    {influencers?.length ? "Sync an influencer to fetch their recent posts" : "Add influencers to start tracking posts"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

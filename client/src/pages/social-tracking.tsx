import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { SiX } from "react-icons/si";
import { Search, Plus, RefreshCw, Trash2, ExternalLink, BookmarkPlus, Eye, Tag, User, AlertCircle, Flag, Check } from "lucide-react";
import type { TrackedSocialAccount, SocialTrackingKeyword, TrackedSocialPost } from "@shared/schema";

export default function SocialTrackingPage() {
  const { toast } = useToast();
  const [newUsername, setNewUsername] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [selectedAccountForKeyword, setSelectedAccountForKeyword] = useState<string | null>(null);
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const [showAddKeywordDialog, setShowAddKeywordDialog] = useState(false);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>("all");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const { data: accounts, isLoading: accountsLoading } = useQuery<TrackedSocialAccount[]>({
    queryKey: ["/api/social/accounts"],
  });

  const { data: keywords, isLoading: keywordsLoading } = useQuery<SocialTrackingKeyword[]>({
    queryKey: ["/api/social/keywords"],
  });

  const { data: posts, isLoading: postsLoading } = useQuery<TrackedSocialPost[]>({
    queryKey: ["/api/social/posts"],
  });

  const addAccountMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await apiRequest("POST", "/api/social/accounts", { username });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Account Added", description: "The X account is now being tracked." });
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });
      setNewUsername("");
      setShowAddAccountDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Add", description: error.message, variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/social/accounts/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Account Removed", description: "The account is no longer being tracked." });
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Remove", description: error.message, variant: "destructive" });
    },
  });

  const addKeywordMutation = useMutation({
    mutationFn: async ({ keyword, accountId }: { keyword: string; accountId: string | null }) => {
      const res = await apiRequest("POST", "/api/social/keywords", { keyword, accountId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Keyword Added", description: "Posts matching this keyword will be tracked." });
      queryClient.invalidateQueries({ queryKey: ["/api/social/keywords"] });
      setNewKeyword("");
      setShowAddKeywordDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Add", description: error.message, variant: "destructive" });
    },
  });

  const deleteKeywordMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/social/keywords/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Keyword Removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/social/keywords"] });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/social/sync");
      return res.json();
    },
    onSuccess: (data: { synced: number; added: number; errors: string[] }) => {
      if (data.errors.length > 0) {
        toast({ 
          title: "Sync Completed with Errors", 
          description: `Synced ${data.synced} accounts, added ${data.added} new posts. ${data.errors.length} errors.`,
          variant: "destructive"
        });
      } else {
        toast({ 
          title: "Sync Complete", 
          description: `Synced ${data.synced} accounts, added ${data.added} new posts.` 
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const syncAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/social/accounts/${id}/sync`);
      return res.json();
    },
    onSuccess: (data: { added: number; error?: string }) => {
      if (data.error) {
        toast({ title: "Sync Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Account Synced", description: `Added ${data.added} new posts.` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/social/posts/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
    },
  });

  const toggleFlagMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/social/posts/${id}/flag`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
    },
  });

  const filteredPosts = posts?.filter(post => {
    if (selectedAccountFilter !== "all" && post.accountId !== selectedAccountFilter) {
      return false;
    }
    if (showFlaggedOnly && !post.isFlagged) {
      return false;
    }
    if (showUnreadOnly && post.isRead) {
      return false;
    }
    return true;
  });

  const getAccountByPost = (accountId: string) => {
    return accounts?.find(a => a.id === accountId);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUsername.trim()) {
      addAccountMutation.mutate(newUsername.trim());
    }
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyword.trim()) {
      addKeywordMutation.mutate({ 
        keyword: newKeyword.trim(), 
        accountId: selectedAccountForKeyword 
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <SiX className="h-7 w-7" />
            Social Media Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor X (Twitter) accounts for relevant political content
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending}
            data-testid="button-sync-all"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncAllMutation.isPending ? "animate-spin" : ""}`} />
            Sync All
          </Button>
        </div>
      </div>

      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="posts" data-testid="tab-posts">
            Posts {posts && posts.filter(p => !p.isRead).length > 0 && (
              <Badge variant="secondary" className="ml-2">{posts.filter(p => !p.isRead).length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="accounts" data-testid="tab-accounts">
            Accounts ({accounts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="keywords" data-testid="tab-keywords">
            Keywords ({keywords?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Select 
              value={selectedAccountFilter} 
              onValueChange={setSelectedAccountFilter}
            >
              <SelectTrigger className="w-[200px]" data-testid="select-account-filter">
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts?.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    @{account.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                id="flagged-only"
                checked={showFlaggedOnly}
                onCheckedChange={setShowFlaggedOnly}
                data-testid="switch-flagged-only"
              />
              <Label htmlFor="flagged-only" className="text-sm">Flagged Only</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="unread-only"
                checked={showUnreadOnly}
                onCheckedChange={setShowUnreadOnly}
                data-testid="switch-unread-only"
              />
              <Label htmlFor="unread-only" className="text-sm">Unread Only</Label>
            </div>
          </div>

          {postsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : filteredPosts && filteredPosts.length > 0 ? (
            <div className="space-y-3">
              {filteredPosts.map(post => {
                const account = getAccountByPost(post.accountId);
                return (
                  <Card key={post.id} className={`${!post.isRead ? "bg-primary/5" : ""}`} data-testid={`card-post-${post.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <SiX className="h-4 w-4 text-muted-foreground" />
                            <a 
                              href={`https://x.com/${account?.username || post.authorUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium hover:underline"
                            >
                              @{account?.username || post.authorUsername}
                            </a>
                            {post.matchedKeywords && post.matchedKeywords.length > 0 && (
                              <div className="flex gap-1">
                                {post.matchedKeywords.map(kw => (
                                  <Badge key={kw} variant="secondary">{kw}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {post.postedAt && (
                              <span>{new Date(post.postedAt).toLocaleString()}</span>
                            )}
                            {post.likes !== null && <span>{post.likes} likes</span>}
                            {post.reposts !== null && <span>{post.reposts} reposts</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!post.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => markReadMutation.mutate(post.id)}
                              title="Mark as read"
                              data-testid={`button-mark-read-${post.id}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleFlagMutation.mutate(post.id)}
                            title={post.isFlagged ? "Remove flag" : "Flag for review"}
                            data-testid={`button-flag-${post.id}`}
                          >
                            <Flag className={`h-4 w-4 ${post.isFlagged ? "fill-yellow-500 text-yellow-500" : ""}`} />
                          </Button>
                          {post.postUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                            >
                              <a href={post.postUrl} target="_blank" rel="noopener noreferrer" data-testid={`button-open-post-${post.id}`}>
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
              <CardContent className="py-12 text-center">
                <SiX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Posts Yet</h3>
                <p className="text-muted-foreground mt-1">
                  {accounts && accounts.length > 0 
                    ? "Click 'Sync All' to fetch posts from tracked accounts"
                    : "Add accounts to track and set up keywords to monitor"
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showAddAccountDialog} onOpenChange={setShowAddAccountDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-account">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Track X Account</DialogTitle>
                  <DialogDescription>
                    Enter the X (Twitter) username to track. Posts from this account will be monitored for your keywords.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddAccount} className="space-y-4">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="@username or username"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      data-testid="input-username"
                    />
                  </div>
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={addAccountMutation.isPending || !newUsername.trim()}
                      data-testid="button-submit-account"
                    >
                      {addAccountMutation.isPending ? "Adding..." : "Add Account"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {accountsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : accounts && accounts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map(account => (
                <Card key={account.id} data-testid={`card-account-${account.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <SiX className="h-5 w-5" />
                        <CardTitle className="text-lg">@{account.username}</CardTitle>
                      </div>
                      <Badge variant={account.isActive ? "default" : "secondary"}>
                        {account.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <CardDescription>
                      {account.displayName || account.username}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      {account.lastSyncAt ? (
                        <span>Last synced: {new Date(account.lastSyncAt).toLocaleString()}</span>
                      ) : (
                        <span>Never synced</span>
                      )}
                      {account.lastSyncError && (
                        <div className="flex items-center gap-1 text-destructive mt-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>{account.lastSyncError}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncAccountMutation.mutate(account.id)}
                        disabled={syncAccountMutation.isPending}
                        data-testid={`button-sync-account-${account.id}`}
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${syncAccountMutation.isPending ? "animate-spin" : ""}`} />
                        Sync
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a href={account.profileUrl || `https://x.com/${account.username}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto text-destructive"
                        onClick={() => deleteAccountMutation.mutate(account.id)}
                        disabled={deleteAccountMutation.isPending}
                        data-testid={`button-delete-account-${account.id}`}
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
              <CardContent className="py-12 text-center">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Accounts Yet</h3>
                <p className="text-muted-foreground mt-1">
                  Add X accounts to start tracking their posts
                </p>
                <Button 
                  className="mt-4" 
                  onClick={() => setShowAddAccountDialog(true)}
                  data-testid="button-add-first-account"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Account
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="keywords" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showAddKeywordDialog} onOpenChange={setShowAddKeywordDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-keyword">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Keyword
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Tracking Keyword</DialogTitle>
                  <DialogDescription>
                    Posts containing this keyword will be captured. Optionally limit to a specific account.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddKeyword} className="space-y-4">
                  <div>
                    <Label htmlFor="keyword">Keyword or phrase</Label>
                    <Input
                      id="keyword"
                      placeholder="e.g., healthcare bill"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      data-testid="input-keyword"
                    />
                  </div>
                  <div>
                    <Label htmlFor="account-filter">Apply to (optional)</Label>
                    <Select 
                      value={selectedAccountForKeyword || "all"} 
                      onValueChange={(val) => setSelectedAccountForKeyword(val === "all" ? null : val)}
                    >
                      <SelectTrigger data-testid="select-keyword-account">
                        <SelectValue placeholder="All accounts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All accounts</SelectItem>
                        {accounts?.map(account => (
                          <SelectItem key={account.id} value={account.id}>
                            @{account.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={addKeywordMutation.isPending || !newKeyword.trim()}
                      data-testid="button-submit-keyword"
                    >
                      {addKeywordMutation.isPending ? "Adding..." : "Add Keyword"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {keywordsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : keywords && keywords.length > 0 ? (
            <div className="space-y-2">
              {keywords.map(kw => {
                const account = kw.accountId ? accounts?.find(a => a.id === kw.accountId) : null;
                return (
                  <Card key={kw.id} data-testid={`card-keyword-${kw.id}`}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{kw.keyword}</span>
                        {account && (
                          <Badge variant="outline">@{account.username}</Badge>
                        )}
                        {!kw.accountId && (
                          <Badge variant="secondary">All accounts</Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteKeywordMutation.mutate(kw.id)}
                        disabled={deleteKeywordMutation.isPending}
                        data-testid={`button-delete-keyword-${kw.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Keywords Yet</h3>
                <p className="text-muted-foreground mt-1">
                  Add keywords to filter posts from tracked accounts. Without keywords, all posts will be captured.
                </p>
                <Button 
                  className="mt-4" 
                  onClick={() => setShowAddKeywordDialog(true)}
                  data-testid="button-add-first-keyword"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Keyword
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

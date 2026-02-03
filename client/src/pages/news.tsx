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
import { Newspaper, Plus, Search, ExternalLink, Flag, Check, Clock } from "lucide-react";
import type { NewsArticle, InsertNewsArticle } from "@shared/schema";
import { format } from "date-fns";

export default function News() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterRead, setFilterRead] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<InsertNewsArticle>>({
    title: "",
    summary: "",
    source: "",
    url: "",
    category: "",
  });

  const { data: articles, isLoading } = useQuery<NewsArticle[]>({
    queryKey: ["/api/news"],
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

  const filteredArticles = articles?.filter((article) => {
    const matchesSearch = 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.source?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || article.category === filterCategory;
    const matchesRead = 
      filterRead === "all" || 
      (filterRead === "unread" && !article.isRead) ||
      (filterRead === "read" && article.isRead) ||
      (filterRead === "flagged" && article.isFlagged);
    return matchesSearch && matchesCategory && matchesRead;
  });

  const categories = ["Legislation", "Executive", "Judiciary", "Policy", "Campaign", "Other"];

  const getCategoryColor = (category: string | null) => {
    switch (category?.toLowerCase()) {
      case "legislation": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "executive": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "judiciary": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "policy": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "campaign": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif" data-testid="text-news-title">
            News
          </h1>
          <p className="text-muted-foreground mt-1">
            Stay informed on political developments
          </p>
        </div>
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
                        <SelectItem key={c} value={c}>{c}</SelectItem>
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
            <div className="flex gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[150px]" data-testid="filter-category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
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
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full mt-2" />
                    <Skeleton className="h-4 w-2/3 mt-1" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredArticles && filteredArticles.length > 0 ? (
            <div className="space-y-4">
              {filteredArticles.map((article) => (
                <Card 
                  key={article.id} 
                  className={`hover-elevate transition-colors ${!article.isRead ? "bg-primary/5" : ""}`}
                  data-testid={`news-card-${article.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium line-clamp-2">{article.title}</h3>
                          {article.isFlagged && (
                            <Flag className="h-4 w-4 text-orange-500 fill-orange-500 shrink-0" />
                          )}
                        </div>
                        {article.summary && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {article.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                          {article.category && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(article.category)}`}>
                              {article.category}
                            </span>
                          )}
                          {article.source && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {article.source}
                            </span>
                          )}
                          {article.publishedAt && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(article.publishedAt), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
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
              <p className="text-sm">
                {searchQuery || filterCategory !== "all" || filterRead !== "all" 
                  ? "Try adjusting your filters" 
                  : "Add your first article to get started"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, FileText, Edit, Trash2, FolderOpen, Book } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { KbCategory, KbArticle } from "@shared/schema";

export default function AdminKnowledgeBase() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isArticleDialogOpen, setIsArticleDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KbArticle | null>(null);

  const { data: categories = [] } = useQuery<KbCategory[]>({
    queryKey: ["/api/admin/kb/categories"],
  });

  const { data: articles = [] } = useQuery<KbArticle[]>({
    queryKey: ["/api/admin/kb/articles"],
  });

  const categoryForm = useForm({
    defaultValues: { name: "", description: "" },
  });

  const articleForm = useForm({
    defaultValues: { 
      title: "", 
      slug: "", 
      summary: "", 
      content: "", 
      categoryId: "",
      isPublished: false 
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      apiRequest("POST", "/api/admin/kb/categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kb/categories"] });
      toast({ title: "Category created" });
      setIsCategoryDialogOpen(false);
      categoryForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createArticleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/kb/articles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kb/articles"] });
      toast({ title: "Article created" });
      setIsArticleDialogOpen(false);
      articleForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateArticleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/admin/kb/articles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kb/articles"] });
      toast({ title: "Article updated" });
      setIsArticleDialogOpen(false);
      setEditingArticle(null);
      articleForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/kb/articles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kb/articles"] });
      toast({ title: "Article deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredArticles = selectedCategory
    ? articles.filter((a) => a.categoryId === selectedCategory)
    : articles;

  const handleEditArticle = (article: KbArticle) => {
    setEditingArticle(article);
    articleForm.reset({
      title: article.title,
      slug: article.slug,
      summary: article.summary || "",
      content: article.content || "",
      categoryId: article.categoryId || "",
      isPublished: article.isPublished || false,
    });
    setIsArticleDialogOpen(true);
  };

  const handleArticleSubmit = (data: any) => {
    if (editingArticle) {
      updateArticleMutation.mutate({ id: editingArticle.id, data });
    } else {
      createArticleMutation.mutate(data);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base Management</h1>
          <p className="text-muted-foreground">Manage platform documentation and help articles</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-category">
                <FolderOpen className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Category</DialogTitle>
              </DialogHeader>
              <Form {...categoryForm}>
                <form onSubmit={categoryForm.handleSubmit((data) => createCategoryMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={categoryForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Getting Started" data-testid="input-category-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={categoryForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Category description" data-testid="input-category-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={createCategoryMutation.isPending} data-testid="button-save-category">
                    {createCategoryMutation.isPending ? "Creating..." : "Create Category"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isArticleDialogOpen} onOpenChange={(open) => {
            setIsArticleDialogOpen(open);
            if (!open) {
              setEditingArticle(null);
              articleForm.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-article">
                <Plus className="w-4 h-4 mr-2" />
                Add Article
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingArticle ? "Edit Article" : "Create Article"}</DialogTitle>
              </DialogHeader>
              <Form {...articleForm}>
                <form onSubmit={articleForm.handleSubmit(handleArticleSubmit)} className="space-y-4">
                  <FormField
                    control={articleForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Article title" data-testid="input-article-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={articleForm.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL Slug</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="article-url-slug" data-testid="input-article-slug" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={articleForm.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-article-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={articleForm.control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Summary</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Brief description" data-testid="input-article-summary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={articleForm.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content (Markdown)</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="# Article content in markdown..." className="min-h-[200px] font-mono" data-testid="input-article-content" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={articleForm.control}
                    name="isPublished"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-article-published" />
                        </FormControl>
                        <FormLabel className="!mt-0">Published</FormLabel>
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={createArticleMutation.isPending || updateArticleMutation.isPending} data-testid="button-save-article">
                    {editingArticle ? "Update Article" : "Create Article"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant={selectedCategory === null ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setSelectedCategory(null)}
              data-testid="button-category-all"
            >
              <Book className="w-4 h-4 mr-2" />
              All Articles ({articles.length})
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setSelectedCategory(cat.id)}
                data-testid={`button-category-${cat.id}`}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                {cat.name} ({articles.filter((a) => a.categoryId === cat.id).length})
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="col-span-3 space-y-4">
          {filteredArticles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No articles found</p>
              </CardContent>
            </Card>
          ) : (
            filteredArticles.map((article) => (
              <Card key={article.id} data-testid={`card-article-${article.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {article.title}
                        <Badge variant={article.isPublished ? "default" : "secondary"}>
                          {article.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{article.summary}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleEditArticle(article)} data-testid={`button-edit-article-${article.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteArticleMutation.mutate(article.id)} data-testid={`button-delete-article-${article.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Slug: /{article.slug}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

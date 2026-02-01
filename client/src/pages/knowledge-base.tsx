import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, FolderOpen, Book, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { KbCategory, KbArticle } from "@shared/schema";

export default function KnowledgeBase() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<KbArticle | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: categories = [] } = useQuery<KbCategory[]>({
    queryKey: ["/api/kb/categories"],
  });

  const { data: articles = [] } = useQuery<KbArticle[]>({
    queryKey: ["/api/kb/articles"],
  });

  const { data: searchResults = [] } = useQuery<KbArticle[]>({
    queryKey: ["/api/kb/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [];
      const res = await fetch(`/api/kb/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: searchQuery.length > 2,
  });

  const displayArticles = searchQuery.length > 2 
    ? searchResults 
    : selectedCategory 
      ? articles.filter((a) => a.categoryId === selectedCategory)
      : articles;

  if (selectedArticle) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button variant="ghost" onClick={() => setSelectedArticle(null)} className="mb-4" data-testid="button-back-to-articles">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Knowledge Base
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{selectedArticle.title}</CardTitle>
            {selectedArticle.summary && (
              <CardDescription className="text-base">{selectedArticle.summary}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {selectedArticle.content || ""}
            </ReactMarkdown>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">Find help articles and documentation</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search articles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-kb-search"
        />
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
              onClick={() => {
                setSelectedCategory(null);
                setSearchQuery("");
              }}
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
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSearchQuery("");
                }}
                data-testid={`button-category-${cat.id}`}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                {cat.name}
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="col-span-3 space-y-4">
          {displayArticles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No articles found for your search" : "No articles available"}
                </p>
              </CardContent>
            </Card>
          ) : (
            displayArticles.map((article) => (
              <Card 
                key={article.id} 
                className="cursor-pointer hover-elevate"
                onClick={() => setSelectedArticle(article)}
                data-testid={`card-article-${article.id}`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {article.title}
                  </CardTitle>
                  <CardDescription>{article.summary}</CardDescription>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

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
import { PageHeader, PageShell } from "@/components/page-header";

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
      <PageShell width="narrow">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedArticle(null)}
          className="-ml-2 mb-3 h-8 px-2 text-muted-foreground hover:text-foreground"
          data-testid="button-back-to-articles"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          All articles
        </Button>
        <PageHeader
          eyebrow="Knowledge Base"
          title={<span className="break-words">{selectedArticle.title}</span>}
          description={selectedArticle.summary || undefined}
        />
        <Card>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none break-words p-5 sm:p-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {selectedArticle.content || ""}
            </ReactMarkdown>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        eyebrow="Brief"
        title="Knowledge Base"
        description="Find how-to guides and reference articles for your team."
        className="mb-0"
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search articles…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-kb-search"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="h-fit lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
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
              <span className="flex-1 text-left">All articles</span>
              <span className="text-xs text-muted-foreground">{articles.length}</span>
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
                <FolderOpen className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">{cat.name}</span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-3 lg:col-span-3">
          {displayArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border bg-card px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                {searchQuery ? (
                  <Search className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <h3 className="mt-4 text-sm font-semibold">
                {searchQuery ? "No articles match your search" : "No articles yet"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery ? "Try a different word or phrase." : "Articles will appear here once they're published."}
              </p>
            </div>
          ) : (
            displayArticles.map((article) => (
              <Card 
                key={article.id} 
                className="cursor-pointer hover-elevate"
                onClick={() => setSelectedArticle(article)}
                data-testid={`card-article-${article.id}`}
              >
                <CardHeader className="p-4 sm:p-5">
                  <CardTitle className="flex items-start gap-2 text-base font-semibold">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 break-words">{article.title}</span>
                  </CardTitle>
                  {article.summary && (
                    <CardDescription className="line-clamp-2 pl-6">{article.summary}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}

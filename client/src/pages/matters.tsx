import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Folder, Search, MessageCircle, FileText, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, PageShell } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Matter } from "@shared/schema";

export default function MattersPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newMatter, setNewMatter] = useState({ name: "", description: "" });
  const [searchQuery, setSearchQuery] = useState("");

  const { data: matters = [], isLoading } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
  });

  const createMatter = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiRequest("POST", "/api/matters", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters"] });
      setIsCreateOpen(false);
      setNewMatter({ name: "", description: "" });
      toast({ title: "Project created" });
    },
    onError: () => {
      toast({ title: "Couldn't create the project", variant: "destructive" });
    },
  });

  const deleteMatter = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/matters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters"] });
      toast({ title: "Project deleted" });
    },
  });

  const filteredMatters = matters.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <PageShell className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-full max-w-sm" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        eyebrow="Work"
        title="Research Projects"
        description="Keep the documents, notes and research for each client issue in one place."
        className="mb-0"
        actions={
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-matter">
              <Plus className="mr-2 h-4 w-4" />
              New project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New research project</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMatter.mutate(newMatter);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Project name</Label>
                <Input
                  id="name"
                  data-testid="input-matter-name"
                  placeholder="e.g., Client XYZ Policy Review"
                  value={newMatter.name}
                  onChange={(e) => setNewMatter({ ...newMatter, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  data-testid="input-matter-description"
                  placeholder="What is this project about?"
                  value={newMatter.description}
                  onChange={(e) => setNewMatter({ ...newMatter, description: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMatter.isPending} data-testid="button-submit-matter">
                {createMatter.isPending ? "Creating…" : "Create project"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        }
      />

      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-matters"
        />
      </div>

      {filteredMatters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            {matters.length > 0 ? (
              <Search className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Folder className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <h3 className="mt-4 text-sm font-semibold">
            {matters.length > 0 ? "No projects match your search" : "No research projects yet"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {matters.length > 0
              ? "Try a different name or keyword."
              : "Create a project to keep the research for a client issue together."}
          </p>
          {matters.length === 0 && (
            <Button className="mt-4" onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-matter">
              <Plus className="mr-2 h-4 w-4" />
              New project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMatters.map((matter) => (
            <Card key={matter.id} className="flex flex-col" data-testid={`card-matter-${matter.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Folder className="h-4 w-4 shrink-0 text-primary" />
                    <CardTitle className="truncate text-base font-semibold">{matter.name}</CardTitle>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 capitalize shadow-none ${matter.status === "active" ? "bg-primary/10 text-primary" : ""}`}
                  >
                    {matter.status}
                  </Badge>
                </div>
                {matter.description && (
                  <CardDescription className="line-clamp-2">{matter.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>Research folder</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/matters/${matter.id}`} className="flex-1">
                    <Button variant="outline" className="w-full" data-testid={`button-open-matter-${matter.id}`}>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Research Agent
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMatter.mutate(matter.id)}
                    aria-label={`Delete ${matter.name}`}
                    data-testid={`button-delete-matter-${matter.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}

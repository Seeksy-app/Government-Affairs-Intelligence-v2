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
      toast({ title: "Matter created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create matter", variant: "destructive" });
    },
  });

  const deleteMatter = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/matters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters"] });
      toast({ title: "Matter deleted" });
    },
  });

  const filteredMatters = matters.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Matters</h1>
          <p className="text-muted-foreground">Manage your client matters and research</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-matter">
              <Plus className="mr-2 h-4 w-4" />
              New Matter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Matter</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMatter.mutate(newMatter);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Matter Name</Label>
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
                  placeholder="Brief description of this matter..."
                  value={newMatter.description}
                  onChange={(e) => setNewMatter({ ...newMatter, description: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMatter.isPending} data-testid="button-submit-matter">
                {createMatter.isPending ? "Creating..." : "Create Matter"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search matters..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-matters"
        />
      </div>

      {filteredMatters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Folder className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No matters yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first matter to start organizing research for your clients.
            </p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-matter">
              <Plus className="mr-2 h-4 w-4" />
              Create Matter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMatters.map((matter) => (
            <Card key={matter.id} className="hover-elevate" data-testid={`card-matter-${matter.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Folder className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{matter.name}</CardTitle>
                  </div>
                  <Badge variant={matter.status === "active" ? "default" : "secondary"}>
                    {matter.status}
                  </Badge>
                </div>
                {matter.description && (
                  <CardDescription className="line-clamp-2">{matter.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
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
                    onClick={() => deleteMatter.mutate(matter.id)}
                    data-testid={`button-delete-matter-${matter.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

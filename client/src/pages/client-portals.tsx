import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ExternalLink, Copy, Settings, Users, Folder, Trash2, PanelsTopLeft } from "lucide-react";
import { PageHeader, PageShell } from "@/components/page-header";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ClientPortal, Matter, Client } from "@shared/schema";

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 50); // Limit length
}

export default function ClientPortals() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState<ClientPortal | null>(null);
  const [isManageMattersOpen, setIsManageMattersOpen] = useState(false);

  // Get client info for generating correct portal URL
  const { data: clientInfo } = useQuery<{ client: Client }>({
    queryKey: ["/api/client/info"],
    queryFn: async () => {
      const res = await fetch("/api/client/info");
      if (!res.ok) throw new Error("Failed to get client info");
      return res.json();
    },
  });

  const { data: portals = [] } = useQuery<ClientPortal[]>({
    queryKey: ["/api/portals"],
  });

  const { data: matters = [] } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
  });

  const { data: portalMatters = [] } = useQuery<Matter[]>({
    queryKey: ["/api/portals", selectedPortal?.id, "matters"],
    queryFn: async () => {
      if (!selectedPortal) return [];
      const res = await fetch(`/api/portals/${selectedPortal.id}/matters`);
      if (!res.ok) throw new Error("Failed to get portal matters");
      return res.json();
    },
    enabled: !!selectedPortal,
  });

  const portalForm = useForm({
    defaultValues: { name: "", slug: "", description: "" },
  });

  const createPortalMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/portals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
      toast({ title: "Portal created" });
      setIsCreateDialogOpen(false);
      portalForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updatePortalMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/portals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
      toast({ title: "Portal updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deletePortalMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/portals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
      toast({ title: "Portal deleted" });
      setSelectedPortal(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addMatterMutation = useMutation({
    mutationFn: ({ portalId, matterId }: { portalId: string; matterId: string }) =>
      apiRequest("POST", `/api/portals/${portalId}/matters`, { matterId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portals", selectedPortal?.id, "matters"] });
      toast({ title: "Project added to portal" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeMatterMutation = useMutation({
    mutationFn: ({ portalId, matterId }: { portalId: string; matterId: string }) =>
      apiRequest("DELETE", `/api/portals/${portalId}/matters/${matterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portals", selectedPortal?.id, "matters"] });
      toast({ title: "Project removed from portal" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getPortalUrl = (portal: ClientPortal) => {
    const clientSlug = clientInfo?.client?.slug || 'client';
    return `${window.location.origin}/portal/${clientSlug}/${portal.slug}`;
  };

  const copyPortalUrl = (portal: ClientPortal) => {
    navigator.clipboard.writeText(getPortalUrl(portal));
    toast({ title: "Link copied to clipboard" });
  };

  const portalMatterIds = portalMatters.map(m => m.id);

  return (
    <PageShell className="space-y-6">
      <PageHeader
        eyebrow="Work"
        title="Client Portals"
        description="Share bills, briefs and research with each client on a page of their own."
        className="mb-0"
        actions={
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-portal">
              <Plus className="w-4 h-4 mr-2" />
              New portal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New client portal</DialogTitle>
            </DialogHeader>
            <Form {...portalForm}>
              <form onSubmit={portalForm.handleSubmit((data) => createPortalMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={portalForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Portal name</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Acme Corporation" 
                          data-testid="input-portal-name"
                          onChange={(e) => {
                            field.onChange(e);
                            // Auto-generate slug from name
                            const slug = generateSlug(e.target.value);
                            portalForm.setValue("slug", slug);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={portalForm.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL slug</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="acme-corp" data-testid="input-portal-slug" />
                      </FormControl>
                      <FormDescription className="break-all">
                        Your portal will be available at: {window.location.origin}/portal/{clientInfo?.client?.slug || 'client'}/{field.value || "your-slug"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={portalForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Portal description for your client" data-testid="input-portal-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={createPortalMutation.isPending} data-testid="button-save-portal">
                  Create portal
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        }
      />

      {portals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <PanelsTopLeft className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-sm font-semibold">No client portals yet</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            A portal is a branded page where a client sees the bills, briefs and research you choose to share with them.
          </p>
          <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-portal">
            <Plus className="w-4 h-4 mr-2" />
            Create your first portal
          </Button>
        </div>
      ) : (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <h2 className="text-base font-semibold">Your portals</h2>
          {portals.map((portal) => (
              <Card
                key={portal.id}
                className={`cursor-pointer transition-colors hover:border-primary/40 ${selectedPortal?.id === portal.id ? "border-primary bg-primary/5" : ""}`}
                onClick={() => setSelectedPortal(portal)}
                data-testid={`card-portal-${portal.id}`}
              >
                <CardHeader className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="truncate text-sm font-semibold">{portal.name}</CardTitle>
                    <Badge
                      variant="secondary"
                      className={`shrink-0 shadow-none ${portal.isActive ? "bg-primary/10 text-primary" : ""}`}
                    >
                      {portal.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription className="truncate text-xs">/{portal.slug}</CardDescription>
                </CardHeader>
              </Card>
            ))}
        </div>

        <div className="min-w-0 lg:col-span-2">
          {selectedPortal ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="break-words text-lg font-semibold">{selectedPortal.name}</CardTitle>
                    {selectedPortal.description && (
                      <CardDescription className="mt-1">{selectedPortal.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyPortalUrl(selectedPortal)} data-testid="button-copy-portal-url">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy link
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={getPortalUrl(selectedPortal)} target="_blank" rel="noopener noreferrer" data-testid="button-view-portal">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deletePortalMutation.mutate(selectedPortal.id)}
                      aria-label="Delete portal"
                      title="Delete portal"
                      data-testid="button-delete-portal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">Portal access</p>
                    <p className="text-sm text-muted-foreground">Turn off to stop your client from opening this portal.</p>
                  </div>
                  <Switch
                    checked={selectedPortal.isActive || false}
                    onCheckedChange={(checked) => updatePortalMutation.mutate({ id: selectedPortal.id, data: { isActive: checked } })}
                    data-testid="switch-portal-active"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">Shared research projects</h3>
                    <Dialog open={isManageMattersOpen} onOpenChange={setIsManageMattersOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" data-testid="button-manage-matters">
                          <Settings className="w-4 h-4 mr-2" />
                          Manage
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Choose projects to share</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {matters.map((matter) => {
                            const isShared = portalMatterIds.includes(matter.id);
                            return (
                              <div key={matter.id} className="flex items-center gap-3 p-3 border rounded-lg">
                                <Checkbox
                                  checked={isShared}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      addMatterMutation.mutate({ portalId: selectedPortal.id, matterId: matter.id });
                                    } else {
                                      removeMatterMutation.mutate({ portalId: selectedPortal.id, matterId: matter.id });
                                    }
                                  }}
                                  data-testid={`checkbox-matter-${matter.id}`}
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">{matter.name}</p>
                                  {matter.description && <p className="text-sm text-muted-foreground">{matter.description}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {portalMatters.length === 0 ? (
                    <div className="flex flex-col items-center rounded-lg border border-dashed px-6 py-8 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Folder className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="mt-4 text-sm font-semibold">Nothing shared yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">Choose the research projects this client should see.</p>
                      <Button variant="outline" size="sm" onClick={() => setIsManageMattersOpen(true)} className="mt-4">
                        <Plus className="w-4 h-4 mr-2" />
                        Add projects
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {portalMatters.map((matter) => (
                        <div key={matter.id} className="flex items-center justify-between gap-3 rounded-lg border p-3" data-testid={`shared-matter-${matter.id}`}>
                          <div className="flex min-w-0 items-center gap-3">
                            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate text-sm">{matter.name}</span>
                          </div>
                          <Badge variant="secondary" className="shrink-0 capitalize shadow-none">{matter.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-muted/60 p-4">
                  <p className="mb-1 text-sm font-medium">Portal link</p>
                  <code className="break-all text-xs text-muted-foreground">{getPortalUrl(selectedPortal)}</code>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-semibold">Select a portal</p>
              <p className="mt-1 text-sm text-muted-foreground">Choose one of your portals to manage what it shares.</p>
            </div>
          )}
        </div>
      </div>
      )}
    </PageShell>
  );
}

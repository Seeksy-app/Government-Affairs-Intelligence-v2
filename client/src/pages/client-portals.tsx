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
import { Plus, ExternalLink, Copy, Settings, Users, Folder, Trash2 } from "lucide-react";
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
      toast({ title: "Matter added to portal" });
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
      toast({ title: "Matter removed from portal" });
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Client Portals</h1>
          <p className="text-muted-foreground">Share research with your clients through custom portals</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-portal">
              <Plus className="w-4 h-4 mr-2" />
              Create Portal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Client Portal</DialogTitle>
            </DialogHeader>
            <Form {...portalForm}>
              <form onSubmit={portalForm.handleSubmit((data) => createPortalMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={portalForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Portal Name</FormLabel>
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
                      <FormLabel>URL Slug</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="acme-corp" data-testid="input-portal-slug" />
                      </FormControl>
                      <FormDescription>
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
                  Create Portal
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-4">
          <h2 className="text-lg font-semibold">Your Portals</h2>
          {portals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No portals created yet</p>
              </CardContent>
            </Card>
          ) : (
            portals.map((portal) => (
              <Card
                key={portal.id}
                className={`cursor-pointer ${selectedPortal?.id === portal.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => setSelectedPortal(portal)}
                data-testid={`card-portal-${portal.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{portal.name}</CardTitle>
                    <Badge variant={portal.isActive ? "default" : "secondary"}>
                      {portal.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">/{portal.slug}</CardDescription>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        <div className="col-span-2">
          {selectedPortal ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedPortal.name}</CardTitle>
                    <CardDescription>{selectedPortal.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyPortalUrl(selectedPortal)} data-testid="button-copy-portal-url">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={getPortalUrl(selectedPortal)} target="_blank" rel="noopener noreferrer" data-testid="button-view-portal">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View
                      </a>
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deletePortalMutation.mutate(selectedPortal.id)} data-testid="button-delete-portal">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Portal Status</p>
                    <p className="text-sm text-muted-foreground">Toggle to enable or disable access</p>
                  </div>
                  <Switch
                    checked={selectedPortal.isActive || false}
                    onCheckedChange={(checked) => updatePortalMutation.mutate({ id: selectedPortal.id, data: { isActive: checked } })}
                    data-testid="switch-portal-active"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Shared Matters</h3>
                    <Dialog open={isManageMattersOpen} onOpenChange={setIsManageMattersOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" data-testid="button-manage-matters">
                          <Settings className="w-4 h-4 mr-2" />
                          Manage
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Select Matters to Share</DialogTitle>
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
                                <div>
                                  <p className="font-medium">{matter.name}</p>
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
                    <div className="text-center py-8 border rounded-lg">
                      <Folder className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No matters shared with this portal</p>
                      <Button variant="ghost" onClick={() => setIsManageMattersOpen(true)} className="text-primary">
                        Add matters
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {portalMatters.map((matter) => (
                        <div key={matter.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`shared-matter-${matter.id}`}>
                          <div className="flex items-center gap-3">
                            <Folder className="w-4 h-4" />
                            <span>{matter.name}</span>
                          </div>
                          <Badge variant="secondary">{matter.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Portal URL</p>
                  <code className="text-xs">{getPortalUrl(selectedPortal)}</code>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Select a portal to manage or create a new one</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

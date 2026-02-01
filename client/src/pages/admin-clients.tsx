import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, Search, MoreHorizontal, Edit, Trash2, UserCheck } from "lucide-react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Client, InsertClient } from "@shared/schema";

export default function AdminClients() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<Partial<InsertClient>>({
    name: "",
    slug: "",
    industry: "",
    isActive: true,
  });

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/admin/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      return apiRequest("POST", "/api/admin/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Client created successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error creating client", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertClient> }) => {
      return apiRequest("PATCH", `/api/admin/clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      toast({ title: "Client updated successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error updating client", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Client deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting client", description: error.message, variant: "destructive" });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (clientId: string) => {
      return apiRequest("POST", `/api/admin/impersonate/${clientId}`);
    },
    onSuccess: (_, clientId) => {
      const client = clients?.find(c => c.id === clientId);
      queryClient.invalidateQueries({ queryKey: ["/api/user/role"] });
      toast({ title: `Now viewing as ${client?.name || 'client'}` });
      navigate("/dashboard");
    },
    onError: (error: Error) => {
      toast({ title: "Error impersonating client", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", slug: "", industry: "", isActive: true });
    setEditingClient(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data: formData });
    } else {
      createMutation.mutate(formData as InsertClient);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      slug: client.slug,
      industry: client.industry || "",
      isActive: client.isActive ?? true,
    });
    setIsDialogOpen(true);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  };

  const filteredClients = clients?.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif" data-testid="text-clients-title">
            Clients
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage client firms that license the platform
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} data-testid="button-add-client">
              <Plus className="w-4 h-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Client Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ 
                      ...formData, 
                      name: e.target.value,
                      slug: editingClient ? formData.slug : generateSlug(e.target.value),
                    });
                  }}
                  placeholder="Acme Government Affairs"
                  required
                  data-testid="input-client-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="acme-government-affairs"
                  required
                  data-testid="input-client-slug"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={formData.industry || ""}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="Government Affairs"
                  data-testid="input-client-industry"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-client"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingClient ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
              data-testid="input-search-clients"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : filteredClients && filteredClients.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{client.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{client.slug}</TableCell>
                    <TableCell>{client.industry || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={client.isActive ? "default" : "secondary"}>
                        {client.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-client-menu-${client.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => impersonateMutation.mutate(client.id)}
                            data-testid={`button-impersonate-${client.id}`}
                          >
                            <UserCheck className="w-4 h-4 mr-2" />
                            View as Client
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(client)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(client.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No clients found</p>
              <p className="text-sm">
                {searchQuery ? "Try a different search term" : "Add your first client to get started"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

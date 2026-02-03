import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, Users, Building2, Briefcase, UserCircle, 
  MoreVertical, Trash2, Edit, Mail, Phone, MapPin,
  Plus, Crown, Star
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer } from "@shared/schema";

type ResourceTab = "all" | "leadership" | "staffers" | "contacts";

export default function ClientResources() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ResourceTab>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const addForm = useForm({
    defaultValues: {
      name: "",
      title: "",
      organization: "",
      email: "",
      phone: "",
      party: "",
      state: "",
      notes: "",
      sourceType: "manual" as string,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Resource added" });
      setIsAddDialogOpen(false);
      addForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Resource updated" });
      setEditingResource(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Resource removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredResources = customers.filter((c) => {
    const matchesSearch = searchQuery === "" ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.organization?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "all") return true;
    if (activeTab === "leadership") return c.sourceType === "congress_member";
    if (activeTab === "staffers") return c.sourceType === "staffer";
    if (activeTab === "contacts") return c.sourceType === "manual";
    return true;
  });

  const leadershipCount = customers.filter(c => c.sourceType === "congress_member").length;
  const stafferCount = customers.filter(c => c.sourceType === "staffer").length;
  const contactCount = customers.filter(c => c.sourceType === "manual").length;

  const getPartyColor = (party?: string) => {
    if (party === "D" || party === "Democratic") return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
    if (party === "R" || party === "Republican") return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
    return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
  };

  const getTypeIcon = (sourceType: string) => {
    if (sourceType === "congress_member") return <Crown className="w-4 h-4" />;
    if (sourceType === "staffer") return <Briefcase className="w-4 h-4" />;
    return <UserCircle className="w-4 h-4" />;
  };

  const ResourceCard = ({ resource }: { resource: Customer }) => (
    <Card className="hover-elevate" data-testid={`card-resource-${resource.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            {resource.imageUrl ? (
              <AvatarImage src={resource.imageUrl} alt={resource.name} className="object-cover" />
            ) : null}
            <AvatarFallback>
              {resource.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{resource.name}</h3>
              {resource.party && (
                <Badge variant="secondary" className={getPartyColor(resource.party)}>
                  {resource.party}
                </Badge>
              )}
            </div>
            {resource.title && (
              <p className="text-sm text-muted-foreground truncate">{resource.title}</p>
            )}
            {resource.organization && (
              <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {resource.organization}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-resource-menu-${resource.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingResource(resource)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive"
                onClick={() => deleteMutation.mutate(resource.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            {getTypeIcon(resource.sourceType)}
            {resource.sourceType === "congress_member" ? "Leadership" : 
             resource.sourceType === "staffer" ? "Staffer" : "Contact"}
          </Badge>
          {resource.state && (
            <Badge variant="outline" className="gap-1">
              <MapPin className="w-3 h-3" />
              {resource.state}
            </Badge>
          )}
        </div>
        {(resource.email || resource.phone) && (
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-3 text-sm text-muted-foreground">
            {resource.email && (
              <a href={`mailto:${resource.email}`} className="flex items-center gap-1 hover:text-foreground">
                <Mail className="w-3 h-3" />
                {resource.email}
              </a>
            )}
            {resource.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {resource.phone}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Client Resources</h1>
          <p className="text-muted-foreground">Manage your leadership, staffers, and key contacts</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-resource">
              <Plus className="w-4 h-4 mr-2" />
              Add Resource
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Resource</DialogTitle>
            </DialogHeader>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={addForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Full name" data-testid="input-resource-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Chief of Staff" data-testid="input-resource-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="organization"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Office of Sen. Smith" data-testid="input-resource-org" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="email@example.gov" data-testid="input-resource-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="(202) 555-1234" data-testid="input-resource-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="party"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Party</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="D, R, or I" data-testid="input-resource-party" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., CA" data-testid="input-resource-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={addForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Additional notes..." data-testid="input-resource-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-resource">
                  Add Resource
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-resources"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ResourceTab)}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            All ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="leadership" data-testid="tab-leadership">
            <Crown className="w-4 h-4 mr-1" />
            Leadership ({leadershipCount})
          </TabsTrigger>
          <TabsTrigger value="staffers" data-testid="tab-staffers">
            <Briefcase className="w-4 h-4 mr-1" />
            Staffers ({stafferCount})
          </TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            <UserCircle className="w-4 h-4 mr-1" />
            Contacts ({contactCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredResources.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredResources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">No Resources Found</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {searchQuery 
                    ? "Try adjusting your search query"
                    : "Add leadership, staffers, or contacts from the Network page or manually here"}
                </p>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Resource
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingResource} onOpenChange={(open) => !open && setEditingResource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Resource</DialogTitle>
          </DialogHeader>
          {editingResource && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    defaultValue={editingResource.title || ""}
                    onChange={(e) => setEditingResource({ ...editingResource, title: e.target.value })}
                    data-testid="input-edit-title"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Organization</label>
                  <Input
                    defaultValue={editingResource.organization || ""}
                    onChange={(e) => setEditingResource({ ...editingResource, organization: e.target.value })}
                    data-testid="input-edit-org"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    defaultValue={editingResource.email || ""}
                    onChange={(e) => setEditingResource({ ...editingResource, email: e.target.value })}
                    data-testid="input-edit-email"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    defaultValue={editingResource.phone || ""}
                    onChange={(e) => setEditingResource({ ...editingResource, phone: e.target.value })}
                    data-testid="input-edit-phone"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  defaultValue={editingResource.notes || ""}
                  onChange={(e) => setEditingResource({ ...editingResource, notes: e.target.value })}
                  data-testid="input-edit-notes"
                />
              </div>
              <Button 
                onClick={() => updateMutation.mutate({ 
                  id: editingResource.id, 
                  data: {
                    title: editingResource.title,
                    organization: editingResource.organization,
                    email: editingResource.email,
                    phone: editingResource.phone,
                    notes: editingResource.notes,
                  }
                })}
                disabled={updateMutation.isPending}
                data-testid="button-update-resource"
              >
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

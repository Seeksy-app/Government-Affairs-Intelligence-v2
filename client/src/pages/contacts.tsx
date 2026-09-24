import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatUsPhone } from "@/lib/phone";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Plus, Search, MoreHorizontal, Edit, Trash2, Star, Mail, Phone, Building2, FolderOpen, X } from "lucide-react";
import { getAvatarUrl } from "@/lib/avatar-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Contact, InsertContact, ContactList } from "@shared/schema";
import { PageHeader, PageShell } from "@/components/page-header";

export default function Contacts() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterChamber, setFilterChamber] = useState<string>("all");
  const [filterList, setFilterList] = useState<string>("all");
  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showNewListDialog, setShowNewListDialog] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState<Partial<InsertContact>>({
    firstName: "",
    lastName: "",
    title: "",
    organization: "",
    email: "",
    phone: "",
    party: "",
    state: "",
    chamber: "",
    notes: "",
    priority: 0,
  });

  // Global search links here as /contacts?q=<name>: pre-fill the filter.
  const urlSearch = useSearch();
  useEffect(() => {
    const q = new URLSearchParams(urlSearch).get("q");
    if (q) {
      setSearchQuery(q);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [urlSearch]);

  // Handle query parameters for adding a new contact from staffer lookup
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('add') === 'true') {
      const firstName = urlParams.get('firstName') || '';
      const lastName = urlParams.get('lastName') || '';
      const email = urlParams.get('email') || '';
      const title = urlParams.get('title') || '';
      const organization = urlParams.get('organization') || '';
      
      setFormData({
        firstName,
        lastName,
        email,
        title,
        organization,
        phone: "",
        party: "",
        state: "",
        chamber: "",
        notes: "",
        priority: 0,
      });
      setEditingContact(null);
      setIsDialogOpen(true);
      // Clear the URL params without reloading
      window.history.replaceState({}, '', '/contacts');
    }
  }, []);

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: contactLists } = useQuery<ContactList[]>({
    queryKey: ["/api/contact-lists"],
  });

  const createListMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/contact-lists", { name });
      return res.json();
    },
    onSuccess: (list: ContactList) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists"] });
      if (isDialogOpen) setFormData((prev) => ({ ...prev, listId: list.id }));
      setCreatingList(false);
      setShowNewListDialog(false);
      setNewListName("");
      toast({ title: `List "${list.name}" created` });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating list", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertContact) => {
      return apiRequest("POST", "/api/contacts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Contact created successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error creating contact", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertContact> }) => {
      return apiRequest("PATCH", `/api/contacts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Contact updated successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error updating contact", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Contact deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting contact", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      title: "",
      organization: "",
      email: "",
      phone: "",
      party: "",
      state: "",
      chamber: "",
      notes: "",
      priority: 0,
    });
    setEditingContact(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: formData });
    } else {
      createMutation.mutate(formData as InsertContact);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      firstName: contact.firstName,
      lastName: contact.lastName,
      title: contact.title || "",
      organization: contact.organization || "",
      email: contact.email || "",
      phone: contact.phone || "",
      party: contact.party || "",
      state: contact.state || "",
      chamber: contact.chamber || "",
      notes: contact.notes || "",
      priority: contact.priority || 0,
      listId: contact.listId || null,
    });
    setIsDialogOpen(true);
  };

  const filteredContacts = contacts?.filter((contact) => {
    const matchesSearch = 
      `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.organization?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChamber = filterChamber === "all" || contact.chamber === filterChamber;
    const matchesList =
      filterList === "all" ||
      (filterList === "unlisted" ? !contact.listId : contact.listId === filterList);
    return matchesSearch && matchesChamber && matchesList;
  });

  const chambers = ["House", "Senate", "Administration", "Agency", "Lobbyist", "Other"];

  return (
    <PageShell className="space-y-6">
      <PageHeader
        eyebrow="Reach"
        title={<span data-testid="text-contacts-title">Contacts</span>}
        description="Keep the people you reach on the Hill organized by list, chamber, and priority."
        className="mb-0"
        actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} data-testid="button-add-contact">
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingContact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="John"
                    required
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Smith"
                    required
                    data-testid="input-last-name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title || ""}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Chief of Staff"
                    data-testid="input-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization">Organization</Label>
                  <Input
                    id="organization"
                    value={formData.organization || ""}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    placeholder="Office of Senator..."
                    data-testid="input-organization"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.gov"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: formatUsPhone(e.target.value) })}
                    placeholder="(202) 555-0100"
                    data-testid="input-phone"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="chamber">Chamber/Type</Label>
                  <Select
                    value={formData.chamber || ""}
                    onValueChange={(value) => setFormData({ ...formData, chamber: value })}
                  >
                    <SelectTrigger data-testid="select-chamber">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {chambers.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="party">Party</Label>
                  <Select
                    value={formData.party || ""}
                    onValueChange={(value) => setFormData({ ...formData, party: value })}
                  >
                    <SelectTrigger data-testid="select-party">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="D">Democrat</SelectItem>
                      <SelectItem value="R">Republican</SelectItem>
                      <SelectItem value="I">Independent</SelectItem>
                      <SelectItem value="N/A">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority (0-5)</Label>
                  <Select
                    value={String(formData.priority || 0)}
                    onValueChange={(value) => setFormData({ ...formData, priority: parseInt(value) })}
                  >
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5].map((p) => (
                        <SelectItem key={p} value={String(p)}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="list">List</Label>
                {creatingList ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      placeholder="New list name (e.g., VA priority targets)"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newListName.trim()) createListMutation.mutate(newListName.trim());
                        }
                      }}
                      data-testid="input-new-list-name"
                    />
                    <Button
                      type="button"
                      onClick={() => newListName.trim() && createListMutation.mutate(newListName.trim())}
                      disabled={!newListName.trim() || createListMutation.isPending}
                      data-testid="button-create-list"
                    >
                      Create
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => { setCreatingList(false); setNewListName(""); }}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={formData.listId || "none"}
                    onValueChange={(value) => {
                      if (value === "__create__") {
                        setCreatingList(true);
                      } else {
                        setFormData({ ...formData, listId: value === "none" ? null : value });
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-list">
                      <SelectValue placeholder="No list" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No list</SelectItem>
                      {contactLists?.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                      <SelectItem value="__create__">+ Create new list…</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes about this contact..."
                  rows={3}
                  data-testid="input-notes"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-contact"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingContact ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        }
      />

      <Dialog open={showNewListDialog} onOpenChange={(open) => { setShowNewListDialog(open); if (!open) setNewListName(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create a contact list</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="e.g., VA priority targets"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newListName.trim()) createListMutation.mutate(newListName.trim());
              }}
              data-testid="input-standalone-list-name"
            />
            <Button
              className="w-full"
              onClick={() => newListName.trim() && createListMutation.mutate(newListName.trim())}
              disabled={!newListName.trim() || createListMutation.isPending}
              data-testid="button-standalone-create-list"
            >
              {createListMutation.isPending ? "Creating…" : "Create List"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Then use a contact's ⋯ menu to add them, or set the list when creating a contact.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9"
                data-testid="input-search-contacts"
              />
            </div>
            <Select value={filterList} onValueChange={setFilterList}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="filter-list">
                <SelectValue placeholder="Filter by list" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lists</SelectItem>
                <SelectItem value="unlisted">Not in a list</SelectItem>
                {contactLists?.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterChamber} onValueChange={setFilterChamber}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="filter-chamber">
                <SelectValue placeholder="Filter by chamber" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chambers</SelectItem>
                {chambers.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setShowNewListDialog(true)}
              data-testid="button-new-list-standalone"
            >
              <Plus className="w-4 h-4 mr-2" /> New List
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredContacts && filteredContacts.length > 0 ? (
            <>
            <p className="text-sm text-muted-foreground mb-3" data-testid="text-contacts-count">
              {filteredContacts.length === (contacts?.length || 0)
                ? `${filteredContacts.length} contact${filteredContacts.length !== 1 ? "s" : ""} found`
                : `${filteredContacts.length} of ${contacts?.length || 0} contacts found`}
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredContacts.map((contact) => (
                <Card key={contact.id} className="hover-elevate" data-testid={`contact-card-${contact.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={getAvatarUrl(`${contact.firstName} ${contact.lastName}`, contact.imageUrl)} alt={`${contact.firstName} ${contact.lastName}`} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                            {contact.firstName[0]}{contact.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="text-sm font-semibold truncate">
                              {contact.firstName} {contact.lastName}
                            </p>
                            {typeof contact.priority === "number" && contact.priority >= 4 && (
                              <Star className="h-3 w-3 text-primary fill-primary shrink-0" aria-label="High priority" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {contact.title || "No title"}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" data-testid={`button-contact-menu-${contact.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(contact)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {(contactLists?.length ?? 0) > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              {contactLists!.map((l) => (
                                <DropdownMenuItem
                                  key={l.id}
                                  disabled={contact.listId === l.id}
                                  onClick={() => updateMutation.mutate({ id: contact.id, data: { listId: l.id } })}
                                  data-testid={`menu-add-to-list-${l.id}`}
                                >
                                  <FolderOpen className="w-4 h-4 mr-2" />
                                  {contact.listId === l.id ? `In "${l.name}"` : `Add to "${l.name}"`}
                                </DropdownMenuItem>
                              ))}
                              {contact.listId && (
                                <DropdownMenuItem
                                  onClick={() => updateMutation.mutate({ id: contact.id, data: { listId: null } })}
                                  data-testid={`menu-remove-from-list-${contact.id}`}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Remove from list
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(contact.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {contact.organization && (
                        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{contact.organization}</span>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="tabular-nums">{contact.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {contact.chamber && (
                        <Badge variant="secondary" className="text-xs">{contact.chamber}</Badge>
                      )}
                      {contact.party && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            contact.party === "D" ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300" :
                            contact.party === "R" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300" : ""
                          }`}
                        >
                          {contact.party}
                        </Badge>
                      )}
                      {contact.state && (
                        <Badge variant="outline" className="text-xs">{contact.state}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            </>
          ) : (
            <Card>
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm font-semibold">No contacts found</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {searchQuery || filterChamber !== "all" ? "Try adjusting your filters" : "Add your first contact to get started"}
                </p>
                {!(searchQuery || filterChamber !== "all") && (
                  <Button className="mt-4" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
                  </Button>
                )}
              </div>
            </Card>
          )}
      </div>
    </PageShell>
  );
}

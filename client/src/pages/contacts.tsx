import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatUsPhone } from "@/lib/phone";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
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
import { Users, Plus, Search, MoreHorizontal, Edit, Trash2, Star, Mail, Phone, Building2 } from "lucide-react";
import { getAvatarUrl } from "@/lib/avatar-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Contact, InsertContact } from "@shared/schema";

export default function Contacts() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterChamber, setFilterChamber] = useState<string>("all");
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
    });
    setIsDialogOpen(true);
  };

  const filteredContacts = contacts?.filter((contact) => {
    const matchesSearch = 
      `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.organization?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChamber = filterChamber === "all" || contact.chamber === filterChamber;
    return matchesSearch && matchesChamber;
  });

  const chambers = ["House", "Senate", "Administration", "Agency", "Lobbyist", "Other"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif" data-testid="text-contacts-title">
            Contacts
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your political network
          </p>
        </div>
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
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
                data-testid="input-search-contacts"
              />
            </div>
            <Select value={filterChamber} onValueChange={setFilterChamber}>
              <SelectTrigger className="w-[180px]" data-testid="filter-chamber">
                <SelectValue placeholder="Filter by chamber" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chambers</SelectItem>
                {chambers.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24 mt-1" />
                      </div>
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
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={getAvatarUrl(`${contact.firstName} ${contact.lastName}`, contact.imageUrl)} alt={`${contact.firstName} ${contact.lastName}`} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                            {contact.firstName[0]}{contact.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">
                              {contact.firstName} {contact.lastName}
                            </p>
                            {contact.priority && contact.priority >= 4 && (
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {contact.title || "No title"}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-contact-menu-${contact.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(contact)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
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
                    <div className="mt-3 space-y-2">
                      {contact.organization && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{contact.organization}</span>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{contact.phone}</span>
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
                            contact.party === "D" ? "border-blue-500 text-blue-600" : 
                            contact.party === "R" ? "border-red-500 text-red-600" : ""
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
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No contacts found</p>
              <p className="text-sm">
                {searchQuery || filterChamber !== "all" ? "Try adjusting your filters" : "Add your first contact to get started"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

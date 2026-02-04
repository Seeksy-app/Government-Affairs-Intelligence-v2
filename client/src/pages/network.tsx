import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Network, Users, Building2, ArrowRight, Search, X, Landmark, Phone, Globe, MapPin, FileText, ExternalLink, Mail, Calendar, UserSearch, Loader2, UserPlus, Map, Star, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Contact, CareerHistory, Matter, FavoriteCongressMember, Customer, ClientPortal } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StaffNetworkDialog } from "@/components/staff-network-dialog";

interface CongressMember {
  bioguideId: string;
  name: string;
  firstName: string;
  lastName: string;
  state: string;
  district?: number;
  party: string;
  chamber: string;
  imageUrl?: string;
  phone?: string;
  officeAddress?: string;
  website?: string;
  leadership?: string[];
}

interface MemberBill {
  congress: number;
  type: string;
  number: number;
  title: string;
  introducedDate: string;
  latestAction?: {
    actionDate: string;
    text: string;
  };
}

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }, { code: "DC", name: "DC" },
  { code: "PR", name: "Puerto Rico" }, { code: "GU", name: "Guam" }, { code: "VI", name: "Virgin Islands" },
  { code: "AS", name: "American Samoa" }, { code: "MP", name: "Northern Mariana Islands" },
];

interface ContactWithHistory extends Contact {
  careerHistory?: CareerHistory[];
}

interface ParsedStaffer {
  role: string;
  name: string;
  email?: string;
}

function parseStafferInfo(text: string): { intro: string; staffers: ParsedStaffer[] } {
  const lines = text.split('\n');
  const staffers: ParsedStaffer[] = [];
  let introLines: string[] = [];
  let currentStaffer: Partial<ParsedStaffer> = {};
  let foundFirstStaffer = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Format 1: Numbered list like "1. Chief of Staff:" or "1. Chief of Staff"
    const numberedRoleMatch = trimmed.match(/^\d+\.\s*(.+?)(?::|$)/);
    if (numberedRoleMatch && !trimmed.startsWith('- ')) {
      // Save previous staffer
      if (currentStaffer.role && currentStaffer.name) {
        staffers.push(currentStaffer as ParsedStaffer);
      }
      foundFirstStaffer = true;
      currentStaffer = { role: numberedRoleMatch[1].replace(/:$/, '').trim() };
      continue;
    }
    
    // Format 2: Bold markdown like **Chief of Staff:**
    const boldRoleMatch = trimmed.match(/^\*\*(.+?):\*\*$/);
    if (boldRoleMatch) {
      if (currentStaffer.role && currentStaffer.name) {
        staffers.push(currentStaffer as ParsedStaffer);
      }
      foundFirstStaffer = true;
      currentStaffer = { role: boldRoleMatch[1] };
      continue;
    }
    
    // Name line: "- Name: Chris Arndt" or "- **Chris Arndt**"
    const nameMatch = trimmed.match(/^-\s*Name:\s*(.+)$/i) || trimmed.match(/^-\s*\*\*(.+?)\*\*$/);
    if (nameMatch) {
      currentStaffer.name = nameMatch[1].trim();
      continue;
    }
    
    // Email line: "- Email: email@domain.gov" or "- **Email:** email@domain.gov"
    const emailMatch = trimmed.match(/^-\s*(?:\*\*)?Email(?:\*\*)?:\s*(.+)$/i);
    if (emailMatch) {
      currentStaffer.email = emailMatch[1].trim();
      continue;
    }
    
    // Title line (skip if we already have role): "- Title: Chief of Staff"
    const titleMatch = trimmed.match(/^-\s*Title:\s*(.+)$/i);
    if (titleMatch) {
      // Use title as role if role is generic
      continue;
    }
    
    // If we haven't found first staffer yet, this is intro text
    if (!foundFirstStaffer) {
      introLines.push(trimmed.replace(/\*\*/g, ''));
    }
  }
  
  // Don't forget the last staffer
  if (currentStaffer.role && currentStaffer.name) {
    staffers.push(currentStaffer as ParsedStaffer);
  }
  
  return { intro: introLines.join(' '), staffers };
}

export default function NetworkPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Congress Member filters
  const [memberSearch, setMemberSearch] = useState("");
  const [chamberFilter, setChamberFilter] = useState<string>("all");
  const [partyFilter, setPartyFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [showMemberSearch, setShowMemberSearch] = useState(false);
  
  // Staffer lookup
  const [stafferInfo, setStafferInfo] = useState<string | null>(null);
  const [stafferLoading, setStafferLoading] = useState(false);
  const [showNetworkDialog, setShowNetworkDialog] = useState(false);
  const [networkDialogData, setNetworkDialogData] = useState<{
    memberName: string;
    memberTitle?: string;
    memberParty?: string;
    memberState?: string;
    staffers: { id: number; name: string; title: string; email?: string; pathwayType?: string; yearsInCurrentRole?: number }[];
  } | null>(null);
  
  const { data: contacts, isLoading } = useQuery<ContactWithHistory[]>({
    queryKey: ["/api/contacts/with-history"],
  });

  // Favorites
  const { data: favorites, refetch: refetchFavorites } = useQuery<FavoriteCongressMember[]>({
    queryKey: ["/api/congress/favorites"],
  });

  // Matters for assignment
  const { data: matters } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
  });

  // Client portals for "Assign to Client" dropdown
  const { data: portals } = useQuery<ClientPortal[]>({
    queryKey: ["/api/portals"],
  });

  const addFavoriteMutation = useMutation({
    mutationFn: async (member: CongressMember) => {
      return apiRequest("POST", "/api/congress/favorites", {
        bioguideId: member.bioguideId,
        name: member.name,
        party: member.party,
        state: member.state,
        chamber: member.chamber,
        imageUrl: member.imageUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/congress/favorites"] });
      toast({ title: "Added to favorites" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add favorite", description: error.message, variant: "destructive" });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: async (bioguideId: string) => {
      return apiRequest("DELETE", `/api/congress/favorites/by-bioguide/${bioguideId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/congress/favorites"] });
      toast({ title: "Removed from favorites" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove favorite", description: error.message, variant: "destructive" });
    },
  });

  const assignToMatterMutation = useMutation({
    mutationFn: async ({ favoriteId, matterId }: { favoriteId: string; matterId: string | null }) => {
      return apiRequest("PATCH", `/api/congress/favorites/${favoriteId}`, { matterId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/congress/favorites"] });
      toast({ title: "Matter assignment updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to assign matter", description: error.message, variant: "destructive" });
    },
  });

  const isFavorite = (bioguideId: string) => favorites?.some(f => f.bioguideId === bioguideId) || false;
  const getFavorite = (bioguideId: string) => favorites?.find(f => f.bioguideId === bioguideId);

  // Customers Portal
  const { data: customersList, isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Helper functions for customer/portal assignment
  const getCustomerBySource = (sourceType: string, sourceId: string) => 
    customersList?.find(c => c.sourceType === sourceType && c.sourceId === sourceId);
  
  const getCustomerPortalName = (sourceType: string, sourceId: string) => {
    const customer = getCustomerBySource(sourceType, sourceId);
    if (!customer?.portalId) return null;
    return portals?.find(p => p.id === customer.portalId)?.name;
  };

  const addCustomerMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      title?: string;
      organization?: string;
      email?: string;
      phone?: string;
      party?: string;
      state?: string;
      sourceType: string;
      sourceId?: string;
      imageUrl?: string;
      notes?: string;
      matterId?: string;
      portalId?: string;
    }) => {
      return apiRequest("POST", "/api/customers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Assigned to client" });
    },
    onError: (error: Error) => {
      if (error.message.includes("already")) {
        toast({ title: "Already assigned", description: "This person is already assigned to a client" });
      } else {
        toast({ title: "Failed to assign", description: error.message, variant: "destructive" });
      }
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Removed from customers" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove customer", description: error.message, variant: "destructive" });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Customer> }) => {
      return apiRequest("PATCH", `/api/customers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update customer", description: error.message, variant: "destructive" });
    },
  });

  const isCustomer = (sourceType: string, sourceId: string) => 
    customersList?.some(c => c.sourceType === sourceType && c.sourceId === sourceId) || false;
  
  // Build query key with filter params - state to track when search should run
  const [searchTrigger, setSearchTrigger] = useState(0);
  
  // Build the URL with query parameters
  const buildMemberSearchUrl = () => {
    const params = new URLSearchParams();
    if (memberSearch) params.set("search", memberSearch);
    if (chamberFilter !== "all") params.set("chamber", chamberFilter);
    if (partyFilter !== "all") params.set("party", partyFilter);
    if (stateFilter !== "all") params.set("state", stateFilter);
    const queryStr = params.toString();
    return `/api/congress/members${queryStr ? `?${queryStr}` : ""}`;
  };
  
  const memberSearchUrl = buildMemberSearchUrl();
  
  // Track if filters were applied (so we can auto-refresh on filter change)
  const hasFilters = chamberFilter !== "all" || partyFilter !== "all" || stateFilter !== "all";
  
  const { data: congressMembers, isLoading: membersLoading, refetch: refetchMembers } = useQuery<CongressMember[]>({
    queryKey: ["congress-members", memberSearch, chamberFilter, partyFilter, stateFilter, searchTrigger],
    queryFn: async () => {
      // Build URL inside queryFn to avoid stale closure
      const params = new URLSearchParams();
      if (memberSearch) params.set("search", memberSearch);
      if (chamberFilter !== "all") params.set("chamber", chamberFilter);
      if (partyFilter !== "all") params.set("party", partyFilter);
      if (stateFilter !== "all") params.set("state", stateFilter);
      const queryStr = params.toString();
      const url = `/api/congress/members${queryStr ? `?${queryStr}` : ""}`;
      
      console.log("Fetching Congress members:", url);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        console.error("Congress API error:", res.status, await res.text());
        throw new Error("Failed to fetch members");
      }
      const data = await res.json();
      console.log("Congress members result:", data.length, "members");
      return data;
    },
    enabled: showMemberSearch && (searchTrigger > 0 || hasFilters),
    select: (data) => {
      if (!memberSearch.trim()) return data;
      const searchTerms = memberSearch.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      
      // Sort by match quality: exact full name > exact last name > partial matches
      return [...data].sort((a, b) => {
        const aFullName = `${a.firstName} ${a.lastName}`.toLowerCase();
        const bFullName = `${b.firstName} ${b.lastName}`.toLowerCase();
        const aLastName = a.lastName.toLowerCase();
        const bLastName = b.lastName.toLowerCase();
        const searchLower = memberSearch.toLowerCase().trim();
        
        // Exact full name match gets highest priority
        const aExactFull = aFullName === searchLower ? 3 : 0;
        const bExactFull = bFullName === searchLower ? 3 : 0;
        
        // Exact last name match gets second priority
        const aExactLast = aLastName === searchTerms[searchTerms.length - 1] ? 2 : 0;
        const bExactLast = bLastName === searchTerms[searchTerms.length - 1] ? 2 : 0;
        
        // Leadership roles get bonus
        const aHasLeadership = (a.leadership?.length ?? 0) > 0 ? 1 : 0;
        const bHasLeadership = (b.leadership?.length ?? 0) > 0 ? 1 : 0;
        
        const aScore = aExactFull + aExactLast + aHasLeadership;
        const bScore = bExactFull + bExactLast + bHasLeadership;
        
        return bScore - aScore;
      });
    },
  });
  
  // Staffer lookup mutation
  const stafferMutation = useMutation({
    mutationFn: async (member: CongressMember) => {
      const prompt = `Find the current key staff members for ${member.firstName} ${member.lastName}, ${member.chamber === "House" ? "Representative" : "Senator"} from ${member.state}.

Please format your response as a numbered list with each staffer in this exact format:
1. [Title/Role]:
- Name: [Full Name]
- Email: [email@domain.gov if available]

2. [Title/Role]:
- Name: [Full Name]
- Email: [email@domain.gov if available]

Focus on: Chief of Staff, Legislative Director, Communications Director, Press Secretary, Scheduler, and other senior staff. Include as many staffers as you can find with their actual names.`;
      const res = await apiRequest("POST", "/api/research/chat", {
        message: prompt,
        context: "",
        history: []
      });
      return res.json();
    },
    onSuccess: (data) => {
      setStafferInfo(data.response);
      setStafferLoading(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to find staffers", 
        description: error.message, 
        variant: "destructive" 
      });
      setStafferLoading(false);
    },
  });
  
  const handleFindStaffers = (member: CongressMember) => {
    setStafferInfo(null);
    setStafferLoading(true);
    stafferMutation.mutate(member);
  };

  const handleShowNetworkMap = (member: CongressMember, staffers: ParsedStaffer[]) => {
    if (staffers.length === 0) {
      toast({ title: "No staffers to map", description: "Find staffers first before viewing network", variant: "destructive" });
      return;
    }
    
    setNetworkDialogData({
      memberName: `${member.firstName} ${member.lastName}`,
      memberTitle: member.chamber === "house" ? "Representative" : "Senator",
      memberParty: member.party,
      memberState: member.state,
      staffers: staffers.map((s, idx) => ({
        id: idx + 1,
        name: s.name,
        title: s.role,
        email: s.email || undefined,
      }))
    });
    setShowNetworkDialog(true);
  };
  
  const handleMemberSearch = () => {
    setSearchTrigger(t => t + 1);
  };
  
  // Auto-search when filters change and search panel is open
  const handleFilterChange = (setter: (val: string) => void, value: string) => {
    setter(value);
    if (showMemberSearch && searchTrigger === 0) {
      setSearchTrigger(1);
    }
  };

  // Selected member for detail view
  const [selectedMember, setSelectedMember] = useState<CongressMember | null>(null);
  
  // Clear staffer info when member changes
  const handleSelectMember = (member: CongressMember | null) => {
    setSelectedMember(member);
    setStafferInfo(null);
    setStafferLoading(false);
  };
  
  // Fetch member details when selected
  const { data: memberDetails, isLoading: detailsLoading } = useQuery<CongressMember>({
    queryKey: ["/api/congress/members", selectedMember?.bioguideId],
    queryFn: async () => {
      const res = await fetch(`/api/congress/members/${selectedMember?.bioguideId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch member details");
      return res.json();
    },
    enabled: !!selectedMember?.bioguideId,
  });
  
  // Fetch member bills when selected
  const { data: memberBills, isLoading: billsLoading } = useQuery<{ sponsoredLegislation: MemberBill[] }>({
    queryKey: ["/api/congress/members", selectedMember?.bioguideId, "bills"],
    queryFn: async () => {
      const res = await fetch(`/api/congress/members/${selectedMember?.bioguideId}/bills`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch member bills");
      return res.json();
    },
    enabled: !!selectedMember?.bioguideId,
  });

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !contacts) return [];
    const query = searchQuery.toLowerCase();
    return contacts.filter(c => 
      c.firstName.toLowerCase().includes(query) ||
      c.lastName.toLowerCase().includes(query) ||
      (c.organization && c.organization.toLowerCase().includes(query)) ||
      (c.title && c.title.toLowerCase().includes(query))
    );
  }, [searchQuery, contacts]);

  const highPriorityContacts = contacts?.filter(c => c.priority && c.priority >= 4) || [];
  const recentContacts = contacts?.slice(0, 10) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif" data-testid="text-network-title">
            Network
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize career paths and connections
          </p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staffers by name, title, or org..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            data-testid="input-search-staffers"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Favorite Congress Members */}
      {favorites && favorites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              Favorite Members ({favorites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {favorites.map((fav) => (
                <div 
                  key={fav.id} 
                  className="p-3 border rounded-lg hover-elevate cursor-pointer"
                  onClick={() => {
                    // Create a CongressMember-like object from the favorite
                    const member: CongressMember = {
                      bioguideId: fav.bioguideId,
                      name: fav.name,
                      firstName: fav.name.split(' ')[0],
                      lastName: fav.name.split(' ').slice(1).join(' '),
                      party: fav.party || '',
                      state: fav.state || '',
                      chamber: fav.chamber || '',
                      imageUrl: fav.imageUrl || undefined,
                    };
                    handleSelectMember(member);
                  }}
                  data-testid={`card-favorite-${fav.bioguideId}`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={fav.imageUrl || undefined} alt={fav.name} />
                      <AvatarFallback>{fav.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{fav.name}</p>
                      <div className="flex items-center gap-1">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            fav.party === "D" ? "border-blue-500 text-blue-600" : 
                            fav.party === "R" ? "border-red-500 text-red-600" : ""
                          }`}
                        >
                          {fav.party}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{fav.state}</span>
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const existingCustomer = getCustomerBySource('congress_member', fav.bioguideId);
                    const currentPortalName = existingCustomer?.portalId 
                      ? portals?.find(p => p.id === existingCustomer.portalId)?.name 
                      : null;
                    return currentPortalName ? (
                      <Badge variant="secondary" className="mt-2 text-xs gap-1">
                        <Briefcase className="h-3 w-3" />
                        {currentPortalName}
                      </Badge>
                    ) : null;
                  })()}
                  <div className="mt-2 flex items-center gap-1">
                    {(() => {
                      const existingCustomer = getCustomerBySource('congress_member', fav.bioguideId);
                      const currentPortalId = existingCustomer?.portalId || "";
                      const currentPortalName = existingCustomer?.portalId 
                        ? portals?.find(p => p.id === existingCustomer.portalId)?.name 
                        : null;
                      
                      return portals && portals.length > 0 ? (
                        <Select 
                          value={currentPortalId} 
                          onValueChange={(portalId) => {
                            if (existingCustomer) {
                              updateCustomerMutation.mutate({
                                id: existingCustomer.id,
                                data: { portalId }
                              });
                            } else {
                              addCustomerMutation.mutate({
                                name: fav.name,
                                title: fav.chamber === "House" ? "Representative" : "Senator",
                                organization: `U.S. ${fav.chamber}`,
                                party: fav.party || undefined,
                                state: fav.state || undefined,
                                sourceType: 'congress_member',
                                sourceId: fav.bioguideId,
                                imageUrl: fav.imageUrl || undefined,
                                portalId,
                              });
                            }
                          }}
                          disabled={addCustomerMutation.isPending || updateCustomerMutation.isPending}
                        >
                          <SelectTrigger className="text-xs" onClick={(e) => e.stopPropagation()}>
                            <SelectValue placeholder={currentPortalName || "Assign to Client"} />
                          </SelectTrigger>
                          <SelectContent>
                            {portals.map((portal) => (
                              <SelectItem key={portal.id} value={portal.id}>{portal.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">No clients</span>
                      );
                    })()}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavoriteMutation.mutate(fav.bioguideId);
                      }}
                      data-testid="button-remove-favorite"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members of Congress Search Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Members of Congress
            </CardTitle>
            <Button
              variant={showMemberSearch ? "default" : "outline"}
              onClick={() => setShowMemberSearch(!showMemberSearch)}
              data-testid="button-toggle-member-search"
            >
              {showMemberSearch ? "Hide Search" : "Search Members"}
            </Button>
          </div>
        </CardHeader>
        {showMemberSearch && (
          <CardContent>
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name (e.g. Johnson, Mike Johnson)..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleMemberSearch()}
                      className="pl-9"
                      data-testid="input-member-search"
                    />
                  </div>
                  <Button 
                    onClick={handleMemberSearch}
                    disabled={membersLoading}
                    data-testid="button-search-members"
                  >
                    {membersLoading ? "Searching..." : "Search"}
                  </Button>
                </div>
                
                <Select value={chamberFilter} onValueChange={(v) => handleFilterChange(setChamberFilter, v)}>
                  <SelectTrigger className="w-full md:w-40" data-testid="select-chamber">
                    <SelectValue placeholder="Chamber" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Chambers</SelectItem>
                    <SelectItem value="senate">Senate</SelectItem>
                    <SelectItem value="house">House</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={partyFilter} onValueChange={(v) => handleFilterChange(setPartyFilter, v)}>
                  <SelectTrigger className="w-full md:w-40" data-testid="select-party">
                    <SelectValue placeholder="Party" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Parties</SelectItem>
                    <SelectItem value="D">Democrat</SelectItem>
                    <SelectItem value="R">Republican</SelectItem>
                    <SelectItem value="I">Independent</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={stateFilter} onValueChange={(v) => handleFilterChange(setStateFilter, v)}>
                  <SelectTrigger className="w-full md:w-44" data-testid="select-state">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {US_STATES.map(state => (
                      <SelectItem key={state.code} value={state.code}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {(memberSearch || chamberFilter !== "all" || partyFilter !== "all" || stateFilter !== "all") && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setMemberSearch("");
                      setChamberFilter("all");
                      setPartyFilter("all");
                      setStateFilter("all");
                    }}
                    data-testid="button-clear-filters"
                  >
                    Clear
                  </Button>
                )}
              </div>
              
              {/* Results */}
              {membersLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24 mt-1" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : congressMembers && congressMembers.length > 0 ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Showing {Math.min(congressMembers.length, 50)} of {congressMembers.length} members
                  </p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {congressMembers.slice(0, 50).map((member) => (
                      <div
                        key={member.bioguideId}
                        className="p-4 rounded-lg border hover-elevate cursor-pointer"
                        onClick={() => handleSelectMember(member)}
                        data-testid={`member-card-${member.bioguideId}`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={member.imageUrl} alt={member.name} />
                            <AvatarFallback>
                              {member.firstName?.[0]}{member.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{member.firstName} {member.lastName}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge 
                                variant="outline" 
                                className={
                                  member.party === "D" 
                                    ? "border-blue-500 text-blue-600 dark:text-blue-400" 
                                    : member.party === "R" 
                                    ? "border-red-500 text-red-600 dark:text-red-400"
                                    : "border-gray-500"
                                }
                              >
                                {member.party === "D" ? "Democrat" : member.party === "R" ? "Republican" : "Independent"}
                              </Badge>
                              <Badge variant="secondary">
                                {member.state}{member.district ? `-${member.district}` : ""}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {member.chamber === "House" ? "Representative" : member.chamber === "Senate" ? "Senator" : member.chamber}
                            </p>
                          </div>
                        </div>
                        
                        {member.leadership && member.leadership.length > 0 && (
                          <div className="mt-2 pt-2 border-t">
                            <div className="flex flex-wrap gap-1">
                              {member.leadership.map((role, idx) => (
                                <Badge key={idx} variant="default" className="text-xs">
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {(member.phone || member.website) && (
                          <div className="mt-2 pt-2 border-t space-y-1">
                            {member.phone && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{member.phone}</span>
                              </div>
                            )}
                            {member.website && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Globe className="h-3 w-3" />
                                <a 
                                  href={member.website} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="hover:underline truncate"
                                >
                                  Official Website
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Landmark className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No members found</p>
                  <p className="text-sm">Try adjusting your filters or search term</p>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {searchQuery.trim() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Results ({searchResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {searchResults.length > 0 ? (
              <div className="space-y-4">
                {searchResults.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-4 rounded-lg border hover-elevate"
                    data-testid={`search-result-${contact.id}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {contact.firstName[0]}{contact.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {contact.title} {contact.organization ? `at ${contact.organization}` : ""}
                        </p>
                      </div>
                      {contact.priority && contact.priority >= 4 && (
                        <Badge variant="outline">Priority {contact.priority}</Badge>
                      )}
                    </div>
                    
                    {contact.careerHistory && contact.careerHistory.length > 0 ? (
                      <div className="relative pl-4 border-l-2 border-primary/30 space-y-3 ml-6">
                        {contact.careerHistory.map((career) => (
                          <div key={career.id} className="relative">
                            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                            <div className="pl-3">
                              <p className="text-sm font-medium">{career.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {career.organization}
                                {career.startYear && ` (${career.startYear}${career.endYear ? `-${career.endYear}` : "-present"})`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground ml-6">No career history recorded</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No staffers found for "{searchQuery}"</p>
                <p className="text-sm">Try a different name, title, or organization</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Key Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Key Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : highPriorityContacts.length > 0 ? (
              <div className="space-y-4">
                {highPriorityContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-3 rounded-lg border hover-elevate"
                    data-testid={`key-contact-${contact.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {contact.firstName[0]}{contact.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {contact.title} {contact.organization ? `at ${contact.organization}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline">Priority {contact.priority}</Badge>
                    </div>
                    {contact.careerHistory && contact.careerHistory.length > 0 && (
                      <div className="mt-3 pl-15">
                        <p className="text-xs text-muted-foreground mb-2">Career Path</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {contact.careerHistory.slice(0, 3).map((career, idx) => (
                            <div key={career.id} className="flex items-center gap-1">
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {career.organization} ({career.startYear})
                              </span>
                              {idx < Math.min(contact.careerHistory!.length - 1, 2) && (
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No high-priority contacts</p>
                <p className="text-sm">Mark contacts as priority 4-5 to see them here</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Career Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Career Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : recentContacts.length > 0 ? (
              <div className="space-y-4">
                {recentContacts.filter(c => c.careerHistory && c.careerHistory.length > 0).slice(0, 5).map((contact) => (
                  <div
                    key={contact.id}
                    className="p-3 rounded-lg border space-y-2"
                    data-testid={`career-pattern-${contact.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {contact.firstName[0]}{contact.lastName[0]}
                      </div>
                      <span className="font-medium text-sm">
                        {contact.firstName} {contact.lastName}
                      </span>
                    </div>
                    {contact.careerHistory && (
                      <div className="relative pl-4 border-l-2 border-muted space-y-2">
                        {contact.careerHistory.map((career) => (
                          <div key={career.id} className="relative">
                            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                            <div className="pl-3">
                              <p className="text-sm font-medium">{career.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {career.organization}
                                {career.startYear && ` (${career.startYear}${career.endYear ? `-${career.endYear}` : "-present"})`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {recentContacts.filter(c => c.careerHistory && c.careerHistory.length > 0).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Network className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No career history recorded</p>
                    <p className="text-sm">Add career history to contacts to see patterns</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Network className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No contacts with career history</p>
                <p className="text-sm">Add career history to see patterns</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Organizations Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : contacts && contacts.length > 0 ? (
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(
                contacts.reduce((acc, contact) => {
                  const org = contact.organization || "Unknown";
                  acc[org] = (acc[org] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([org, count]) => (
                  <Card key={org} className="hover-elevate">
                    <CardContent className="p-4">
                      <p className="font-medium text-sm truncate">{org}</p>
                      <p className="text-2xl font-bold mt-1">{count}</p>
                      <p className="text-xs text-muted-foreground">contact{count !== 1 ? "s" : ""}</p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No organizations yet</p>
              <p className="text-sm">Add contacts with organizations to see them here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Detail Sheet */}
      <Sheet open={!!selectedMember} onOpenChange={(open) => !open && handleSelectMember(null)}>
        <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-3">
              <Avatar className="h-16 w-16">
                <AvatarImage src={memberDetails?.imageUrl || selectedMember?.imageUrl} alt={selectedMember?.name || ""} />
                <AvatarFallback className="text-lg">
                  {selectedMember?.firstName?.[0]}{selectedMember?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span>{selectedMember?.firstName} {selectedMember?.lastName}</span>
                  {selectedMember && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isFavorite(selectedMember.bioguideId)) {
                            removeFavoriteMutation.mutate(selectedMember.bioguideId);
                          } else {
                            addFavoriteMutation.mutate(selectedMember);
                          }
                        }}
                        data-testid="button-toggle-favorite"
                      >
                        <Star 
                          className={`h-5 w-5 ${isFavorite(selectedMember.bioguideId) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} 
                        />
                      </Button>
                      {portals && portals.length > 0 ? (() => {
                          const existingCustomer = getCustomerBySource('congress_member', selectedMember.bioguideId);
                          const currentPortalName = existingCustomer?.portalId 
                            ? portals.find(p => p.id === existingCustomer.portalId)?.name 
                            : null;
                          
                          return (
                            <Select
                              value={existingCustomer?.portalId || ""}
                              onValueChange={(portalId) => {
                                if (existingCustomer) {
                                  updateCustomerMutation.mutate({
                                    id: existingCustomer.id,
                                    data: { portalId }
                                  });
                                } else {
                                  addCustomerMutation.mutate({
                                    name: `${selectedMember.firstName} ${selectedMember.lastName}`,
                                    title: selectedMember.chamber === "House" ? "Representative" : "Senator",
                                    organization: `U.S. ${selectedMember.chamber}`,
                                    party: selectedMember.party,
                                    state: selectedMember.state,
                                    sourceType: 'congress_member',
                                    sourceId: selectedMember.bioguideId,
                                    imageUrl: selectedMember.imageUrl,
                                    portalId,
                                  });
                                }
                              }}
                              disabled={addCustomerMutation.isPending || updateCustomerMutation.isPending}
                            >
                              <SelectTrigger className="w-[160px]" data-testid="select-assign-to-client">
                                <SelectValue placeholder={currentPortalName || "Assign to Client"} />
                              </SelectTrigger>
                              <SelectContent>
                                {portals.map((portal) => (
                                  <SelectItem key={portal.id} value={portal.id} data-testid={`select-portal-${portal.id}`}>
                                    {portal.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })() : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          data-testid="button-no-clients"
                        >
                          No Clients
                        </Button>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="outline" 
                    className={
                      (memberDetails?.party || selectedMember?.party) === "D" 
                        ? "border-blue-500 text-blue-600 dark:text-blue-400" 
                        : (memberDetails?.party || selectedMember?.party) === "R" 
                        ? "border-red-500 text-red-600 dark:text-red-400"
                        : "border-gray-500"
                    }
                  >
                    {(memberDetails?.party || selectedMember?.party) === "D" ? "Democrat" : 
                     (memberDetails?.party || selectedMember?.party) === "R" ? "Republican" : "Independent"}
                  </Badge>
                  <Badge variant="secondary">
                    {selectedMember?.state}{selectedMember?.district ? `-${selectedMember?.district}` : ""}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedMember?.chamber === "House" ? "Representative" : 
                   selectedMember?.chamber === "Senate" ? "Senator" : selectedMember?.chamber}
                </p>
              </div>
            </SheetTitle>
            <SheetDescription className="sr-only">
              Details for {selectedMember?.firstName} {selectedMember?.lastName}
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 pb-6">
              {/* Leadership Roles */}
              {(memberDetails?.leadership && memberDetails.leadership.length > 0) && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Leadership Roles</h4>
                  <div className="flex flex-wrap gap-2">
                    {memberDetails.leadership.map((role, idx) => (
                      <Badge key={idx}>{role}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Contact Information */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Contact Information</h4>
                <div className="space-y-2">
                  {(memberDetails?.phone || selectedMember?.phone) && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${memberDetails?.phone || selectedMember?.phone}`} className="hover:underline">
                        {memberDetails?.phone || selectedMember?.phone}
                      </a>
                    </div>
                  )}
                  {(memberDetails?.officeAddress || selectedMember?.officeAddress) && (
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>{memberDetails?.officeAddress || selectedMember?.officeAddress}</span>
                    </div>
                  )}
                  {(memberDetails?.website || selectedMember?.website) && (
                    <div className="flex items-center gap-3 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={memberDetails?.website || selectedMember?.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline flex items-center gap-1"
                      >
                        Official Website <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
              
              <Separator />
              
              {/* Staff Lookup */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <UserSearch className="h-4 w-4" />
                    Staff Members
                  </h4>
                  {selectedMember && !stafferInfo && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFindStaffers(selectedMember)}
                      disabled={stafferLoading}
                      data-testid="button-find-staffers"
                    >
                      {stafferLoading ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="h-3 w-3 mr-2" />
                          Find Staffers
                        </>
                      )}
                    </Button>
                  )}
                </div>
                
                {stafferLoading && (
                  <div className="p-4 rounded-lg border bg-muted/30 flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Looking up staff information...</span>
                  </div>
                )}
                
                {stafferInfo && (() => {
                  const { intro, staffers } = parseStafferInfo(stafferInfo);
                  return (
                    <div className="space-y-3">
                      {intro && (
                        <p className="text-sm text-muted-foreground">{intro}</p>
                      )}
                      {staffers.length > 0 ? (
                        <div className="space-y-2">
                          {staffers.map((staffer, idx) => (
                            <div key={idx} className="p-3 rounded-lg border bg-card">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm">{staffer.name}</span>
                                    <Badge variant="secondary" className="text-xs">{staffer.role}</Badge>
                                  </div>
                                  {staffer.email && (
                                    <a 
                                      href={`mailto:${staffer.email}`}
                                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1"
                                    >
                                      <Mail className="h-3 w-3" />
                                      {staffer.email}
                                    </a>
                                  )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => selectedMember && handleShowNetworkMap(selectedMember, [staffer])}
                                    data-testid={`button-map-staffer-${idx}`}
                                  >
                                    <Map className="h-4 w-4 mr-1" />
                                    Map
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const nameParts = staffer.name.split(' ');
                                      const firstName = nameParts[0] || '';
                                      const lastName = nameParts.slice(1).join(' ') || '';
                                      window.location.href = `/contacts?add=true&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&email=${encodeURIComponent(staffer.email || '')}&title=${encodeURIComponent(staffer.role)}&organization=${encodeURIComponent(selectedMember ? `Office of ${selectedMember.name}` : '')}`;
                                    }}
                                    data-testid={`button-add-staffer-contact-${idx}`}
                                  >
                                    <UserPlus className="h-4 w-4 mr-1" />
                                    Contact
                                  </Button>
                                </div>
                              </div>
                              {portals && portals.length > 0 && (() => {
                                  const stafferId = `${staffer.name}-${selectedMember?.bioguideId || 'unknown'}`;
                                  const existingCustomer = getCustomerBySource('staffer', stafferId);
                                  const currentPortalName = existingCustomer?.portalId 
                                    ? portals.find(p => p.id === existingCustomer.portalId)?.name 
                                    : null;
                                  
                                  return (
                                    <div className="mt-2 pt-2 border-t flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">Assign to Client:</span>
                                      <Select
                                        value={existingCustomer?.portalId || ""}
                                        onValueChange={(portalId) => {
                                          if (existingCustomer) {
                                            updateCustomerMutation.mutate({
                                              id: existingCustomer.id,
                                              data: { portalId }
                                            });
                                          } else {
                                            addCustomerMutation.mutate({
                                              name: staffer.name,
                                              title: staffer.role,
                                              organization: selectedMember ? `Office of ${selectedMember.name}` : undefined,
                                              email: staffer.email,
                                              party: selectedMember?.party,
                                              state: selectedMember?.state,
                                              sourceType: 'staffer',
                                              sourceId: stafferId,
                                              portalId,
                                            });
                                          }
                                        }}
                                        disabled={addCustomerMutation.isPending || updateCustomerMutation.isPending}
                                      >
                                        <SelectTrigger className="w-[140px] text-xs" data-testid={`select-staffer-client-${idx}`}>
                                          <SelectValue placeholder={currentPortalName || "Select client..."} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {portals.map((portal) => (
                                            <SelectItem key={portal.id} value={portal.id} data-testid={`select-staffer-portal-${idx}-${portal.id}`}>
                                              {portal.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  );
                                })()}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{stafferInfo.replace(/\*\*/g, '')}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {staffers.length > 0 && selectedMember && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleShowNetworkMap(selectedMember, staffers)}
                            data-testid="button-map-office"
                          >
                            <Map className="h-4 w-4 mr-1" />
                            View Network Map
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => setStafferInfo(null)}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  );
                })()}
                
                {!stafferInfo && !stafferLoading && (
                  <p className="text-sm text-muted-foreground">
                    Click "Find Staffers" to look up key staff members using AI research.
                  </p>
                )}
              </div>
              
              <Separator />
              
              {/* Sponsored Bills */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Sponsored Legislation
                </h4>
                {billsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-3 rounded-lg border">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    ))}
                  </div>
                ) : memberBills?.sponsoredLegislation && memberBills.sponsoredLegislation.length > 0 ? (
                  <div className="space-y-3">
                    {memberBills.sponsoredLegislation.slice(0, 10).map((bill) => (
                      <div key={`${bill.type}-${bill.number}`} className="p-3 rounded-lg border hover-elevate">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            {bill.type.toUpperCase()} {bill.number}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(bill.introducedDate).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium line-clamp-2">{bill.title}</p>
                        {bill.latestAction && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            Latest: {bill.latestAction.text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No sponsored legislation found</p>
                )}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Staff Network Dialog */}
      {networkDialogData && (
        <StaffNetworkDialog
          open={showNetworkDialog}
          onOpenChange={setShowNetworkDialog}
          memberName={networkDialogData.memberName}
          memberTitle={networkDialogData.memberTitle}
          memberParty={networkDialogData.memberParty}
          memberState={networkDialogData.memberState}
          staffers={networkDialogData.staffers}
        />
      )}
    </div>
  );
}

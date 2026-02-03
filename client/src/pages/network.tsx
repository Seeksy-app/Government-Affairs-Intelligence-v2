import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Network, Users, Building2, ArrowRight, Search, X, Landmark, Phone, Globe, MapPin, FileText, ExternalLink, Mail, Calendar, UserSearch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Contact, CareerHistory } from "@shared/schema";

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
  
  const { data: contacts, isLoading } = useQuery<ContactWithHistory[]>({
    queryKey: ["/api/contacts/with-history"],
  });
  
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
      const prompt = `Find the current key staff members for ${member.firstName} ${member.lastName}, ${member.chamber === "House" ? "Representative" : "Senator"} from ${member.state}. Include their names, titles, and contact information if available. Focus on Chief of Staff, Legislative Director, Communications Director, and other senior staff.`;
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
              <div>
                <div className="flex items-center gap-2">
                  <span>{selectedMember?.firstName} {selectedMember?.lastName}</span>
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
                
                {stafferInfo && (
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{stafferInfo}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 text-xs"
                      onClick={() => setStafferInfo(null)}
                    >
                      Clear
                    </Button>
                  </div>
                )}
                
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
    </div>
  );
}

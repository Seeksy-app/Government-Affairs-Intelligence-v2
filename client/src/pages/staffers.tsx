import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLocation } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, 
  Plus, 
  Search,
  Building2,
  Briefcase,
  MapPin,
  GraduationCap,
  Link as LinkIcon,
  Mail,
  Calendar,
  Network,
  FileDown,
  Upload,
  BarChart3,
  RefreshCw,
  User,
  ExternalLink,
  CheckSquare
} from "lucide-react";
import type { Staffer } from "@shared/schema";

const CHAMBERS = [
  { value: "all", label: "All Chambers" },
  { value: "House", label: "House" },
  { value: "Senate", label: "Senate" },
  { value: "Both", label: "Both" },
  { value: "Former", label: "Former" },
];

const PARTIES = [
  { value: "all", label: "All Parties" },
  { value: "Republican", label: "Republican" },
  { value: "Democrat", label: "Democrat" },
  { value: "Independent", label: "Independent" },
];

const SPECIALTIES = [
  "Communications",
  "Policy",
  "Legal",
  "Operations",
  "Legislative Affairs",
  "Scheduling",
  "Press",
  "Outreach",
];

const US_STATES = [
  { value: "all", label: "All States" },
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

function getPartyColor(party: string | null): string {
  switch (party) {
    case "Republican": return "bg-red-500/10 text-red-500 border-red-500/20";
    case "Democrat": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "Independent": return "bg-green-500/10 text-green-500 border-green-500/20";
    default: return "bg-muted text-muted-foreground";
  }
}

function getChamberColor(chamber: string | null): string {
  switch (chamber) {
    case "House": return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
    case "Senate": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    case "Both": return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
    case "Former": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function StaffersPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("search");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedStaffers, setSelectedStaffers] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [exportingMiro, setExportingMiro] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [chamberFilter, setChamberFilter] = useState("all");
  const [partyFilter, setPartyFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  
  const [newStaffer, setNewStaffer] = useState({
    name: "",
    currentPosition: "",
    currentOrganization: "",
    currentMember: "",
    chamber: "",
    party: "",
    state: "",
    specialty: "",
    bio: "",
    contactEmail: "",
    linkedinUrl: "",
  });

  const searchParams = new URLSearchParams();
  if (searchQuery) searchParams.set("q", searchQuery);
  if (memberFilter) searchParams.set("member", memberFilter);
  if (chamberFilter !== "all") searchParams.set("chamber", chamberFilter);
  if (partyFilter !== "all") searchParams.set("party", partyFilter);
  if (stateFilter !== "all") searchParams.set("state", stateFilter);
  if (specialtyFilter) searchParams.set("specialty", specialtyFilter);

  const { data: searchResult, isLoading } = useQuery<{ staffers: Staffer[]; total: number }>({
    queryKey: ["/api/staffers/search", searchParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/staffers/search?${searchParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to search staffers");
      return res.json();
    },
  });

  const { data: stats } = useQuery<{
    totalStaffers: number;
    byChamber: Record<string, number>;
    byParty: Record<string, number>;
    topOrganizations: { name: string; count: number }[];
  }>({
    queryKey: ["/api/staffers/stats"],
  });

  const createStafferMutation = useMutation({
    mutationFn: async (data: typeof newStaffer) => {
      return apiRequest("/api/staffers", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staffers"] });
      toast({ title: "Staffer added successfully" });
      setAddDialogOpen(false);
      setNewStaffer({
        name: "",
        currentPosition: "",
        currentOrganization: "",
        currentMember: "",
        chamber: "",
        party: "",
        state: "",
        specialty: "",
        bio: "",
        contactEmail: "",
        linkedinUrl: "",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add staffer", description: error.message, variant: "destructive" });
    },
  });

  const staffers = searchResult?.staffers || [];

  const toggleSelectStaffer = (id: string) => {
    setSelectedStaffers((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const selectAllStaffers = () => {
    if (selectedStaffers.length === staffers.length) {
      setSelectedStaffers([]);
    } else {
      setSelectedStaffers(staffers.map((s) => s.id));
    }
  };

  const handleMapSelectedToMiro = async () => {
    if (selectedStaffers.length === 0) return;
    setExportingMiro(true);
    try {
      const res = await apiRequest("/api/miro/map-multiple", {
        method: "POST",
        body: JSON.stringify({
          stafferIds: selectedStaffers,
          boardName: `Selected Staffers (${selectedStaffers.length})`,
        }),
      });
      toast({ title: "Miro board created", description: `Created board with ${res.itemsCreated} items` });
      window.open(res.miroBoardUrl, "_blank");
      setSelectedStaffers([]);
      setSelectMode(false);
    } catch (error) {
      toast({
        title: "Failed to create Miro board",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setExportingMiro(false);
    }
  };

  const handleMapOfficeToMiro = async () => {
    if (!memberFilter) return;
    setExportingMiro(true);
    try {
      const res = await apiRequest("/api/miro/map-office", {
        method: "POST",
        body: JSON.stringify({ memberName: memberFilter }),
      });
      toast({ title: "Miro board created", description: `Created board with ${res.itemsCreated} items for ${memberFilter}` });
      window.open(res.miroBoardUrl, "_blank");
    } catch (error) {
      toast({
        title: "Failed to create Miro board",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setExportingMiro(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Political Staffers
          </h1>
          <p className="text-muted-foreground">
            Search and track congressional staffers, map career trajectories, and visualize networks
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-staffer">
                <Plus className="h-4 w-4 mr-2" />
                Add Staffer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Staffer</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      data-testid="input-staffer-name"
                      value={newStaffer.name}
                      onChange={(e) => setNewStaffer({ ...newStaffer, name: e.target.value })}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">Current Position</Label>
                    <Input
                      id="position"
                      data-testid="input-staffer-position"
                      value={newStaffer.currentPosition}
                      onChange={(e) => setNewStaffer({ ...newStaffer, currentPosition: e.target.value })}
                      placeholder="e.g., Chief of Staff"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="organization">Current Organization</Label>
                    <Input
                      id="organization"
                      data-testid="input-staffer-organization"
                      value={newStaffer.currentOrganization}
                      onChange={(e) => setNewStaffer({ ...newStaffer, currentOrganization: e.target.value })}
                      placeholder="e.g., Office of the Speaker"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="member">Current Member</Label>
                    <Input
                      id="member"
                      data-testid="input-staffer-member"
                      value={newStaffer.currentMember}
                      onChange={(e) => setNewStaffer({ ...newStaffer, currentMember: e.target.value })}
                      placeholder="e.g., Mike Johnson"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Chamber</Label>
                    <Select
                      value={newStaffer.chamber}
                      onValueChange={(v) => setNewStaffer({ ...newStaffer, chamber: v })}
                    >
                      <SelectTrigger data-testid="select-staffer-chamber">
                        <SelectValue placeholder="Select chamber" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="House">House</SelectItem>
                        <SelectItem value="Senate">Senate</SelectItem>
                        <SelectItem value="Both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Party</Label>
                    <Select
                      value={newStaffer.party}
                      onValueChange={(v) => setNewStaffer({ ...newStaffer, party: v })}
                    >
                      <SelectTrigger data-testid="select-staffer-party">
                        <SelectValue placeholder="Select party" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Republican">Republican</SelectItem>
                        <SelectItem value="Democrat">Democrat</SelectItem>
                        <SelectItem value="Independent">Independent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Select
                      value={newStaffer.state}
                      onValueChange={(v) => setNewStaffer({ ...newStaffer, state: v })}
                    >
                      <SelectTrigger data-testid="select-staffer-state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.filter(s => s.value !== "all").map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">Specialty</Label>
                  <Select
                    value={newStaffer.specialty}
                    onValueChange={(v) => setNewStaffer({ ...newStaffer, specialty: v })}
                  >
                    <SelectTrigger data-testid="select-staffer-specialty">
                      <SelectValue placeholder="Select specialty" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIALTIES.map((specialty) => (
                        <SelectItem key={specialty} value={specialty}>
                          {specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Contact Email</Label>
                    <Input
                      id="email"
                      type="email"
                      data-testid="input-staffer-email"
                      value={newStaffer.contactEmail}
                      onChange={(e) => setNewStaffer({ ...newStaffer, contactEmail: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn URL</Label>
                    <Input
                      id="linkedin"
                      data-testid="input-staffer-linkedin"
                      value={newStaffer.linkedinUrl}
                      onChange={(e) => setNewStaffer({ ...newStaffer, linkedinUrl: e.target.value })}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    data-testid="input-staffer-bio"
                    value={newStaffer.bio}
                    onChange={(e) => setNewStaffer({ ...newStaffer, bio: e.target.value })}
                    placeholder="Brief biography..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createStafferMutation.mutate(newStaffer)}
                  disabled={!newStaffer.name || createStafferMutation.isPending}
                  data-testid="button-submit-staffer"
                >
                  {createStafferMutation.isPending ? "Adding..." : "Add Staffer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="search" data-testid="tab-search">
            <Search className="h-4 w-4 mr-2" />
            Search
          </TabsTrigger>
          <TabsTrigger value="stats" data-testid="tab-stats">
            <BarChart3 className="h-4 w-4 mr-2" />
            Statistics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="xl:col-span-2">
                  <Input
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                    data-testid="input-search-name"
                  />
                </div>
                <Input
                  placeholder="Filter by member..."
                  value={memberFilter}
                  onChange={(e) => setMemberFilter(e.target.value)}
                  data-testid="input-filter-member"
                />
                <Select value={chamberFilter} onValueChange={setChamberFilter}>
                  <SelectTrigger data-testid="select-filter-chamber">
                    <SelectValue placeholder="Chamber" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAMBERS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={partyFilter} onValueChange={setPartyFilter}>
                  <SelectTrigger data-testid="select-filter-party">
                    <SelectValue placeholder="Party" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger data-testid="select-filter-state">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-12 w-12 rounded-full mb-4" />
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-4" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : staffers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No staffers found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {searchQuery || memberFilter || chamberFilter !== "all" || partyFilter !== "all" || stateFilter !== "all"
                    ? "Try adjusting your search filters"
                    : "Add your first staffer to get started"}
                </p>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Staffer
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Found {searchResult?.total || staffers.length} staffer(s)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staffers.map((staffer) => (
                  <Card 
                    key={staffer.id} 
                    className="hover-elevate cursor-pointer transition-all"
                    onClick={() => navigate(`/staffers/${staffer.id}`)}
                    data-testid={`card-staffer-${staffer.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          {staffer.photoUrl ? (
                            <AvatarImage src={staffer.photoUrl} alt={staffer.name} />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {staffer.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{staffer.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {staffer.currentPosition}
                          </p>
                          {staffer.currentMember && (
                            <p className="text-sm text-muted-foreground truncate">
                              {staffer.currentMember}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        {staffer.party && (
                          <Badge variant="outline" className={getPartyColor(staffer.party)}>
                            {staffer.party}
                          </Badge>
                        )}
                        {staffer.chamber && (
                          <Badge variant="outline" className={getChamberColor(staffer.chamber)}>
                            {staffer.chamber}
                          </Badge>
                        )}
                        {staffer.state && (
                          <Badge variant="outline">
                            {staffer.state}
                          </Badge>
                        )}
                        {staffer.pathwayType && (
                          <Badge variant="secondary">
                            {staffer.pathwayType}
                          </Badge>
                        )}
                      </div>
                      {staffer.yearsInCurrentRole && (
                        <p className="text-xs text-muted-foreground mt-3">
                          {staffer.yearsInCurrentRole}y in current role
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Total Staffers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalStaffers || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">House Staff</CardTitle>
                <Building2 className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.byChamber?.House || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Senate Staff</CardTitle>
                <Building2 className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.byChamber?.Senate || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Organizations</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.topOrganizations?.length || 0}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>By Party</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats?.byParty && Object.entries(stats.byParty).map(([party, count]) => (
                  <div key={party} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getPartyColor(party)}>
                        {party}
                      </Badge>
                    </div>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
                {(!stats?.byParty || Object.keys(stats.byParty).length === 0) && (
                  <p className="text-muted-foreground text-sm">No data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Organizations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats?.topOrganizations?.slice(0, 5).map((org) => (
                  <div key={org.name} className="flex items-center justify-between">
                    <span className="text-sm truncate flex-1">{org.name}</span>
                    <Badge variant="secondary">{org.count}</Badge>
                  </div>
                ))}
                {(!stats?.topOrganizations || stats.topOrganizations.length === 0) && (
                  <p className="text-muted-foreground text-sm">No data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

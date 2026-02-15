import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy, Search, Plus, Loader2, Globe, MapPin, Users, Building2,
  ExternalLink, Phone, Mail, Brain, FileText, UserSearch, Link2,
  Trash2, Edit, ChevronRight, Target, Handshake, Clock, X, RefreshCw,
  Star, Check, ChevronsUpDown, Zap
} from "lucide-react";
import type { SportsTeam, SportsContact } from "@shared/schema";
import { PROFESSIONAL_TEAMS, getTeamLogoUrl, type ProfessionalTeam } from "@/lib/professional-teams";

const LEAGUES = [
  { value: "all", label: "All Leagues" },
  { value: "NFL", label: "NFL" },
  { value: "NBA", label: "NBA" },
  { value: "MLB", label: "MLB" },
  { value: "NHL", label: "NHL" },
  { value: "MLS", label: "MLS" },
  { value: "WNBA", label: "WNBA" },
  { value: "NWSL", label: "NWSL" },
  { value: "NCAA", label: "NCAA" },
  { value: "USL", label: "USL" },
  { value: "XFL", label: "XFL" },
  { value: "Other", label: "Other" },
];

const SPORTS = [
  { value: "all", label: "All Sports" },
  { value: "Football", label: "Football" },
  { value: "Basketball", label: "Basketball" },
  { value: "Baseball", label: "Baseball" },
  { value: "Hockey", label: "Hockey" },
  { value: "Soccer", label: "Soccer" },
  { value: "Lacrosse", label: "Lacrosse" },
  { value: "Other", label: "Other" },
];

const OUTREACH_STATUSES = [
  { value: "not_started", label: "Not Started", color: "secondary" },
  { value: "researching", label: "Researching", color: "outline" },
  { value: "targeted", label: "Targeted", color: "default" },
  { value: "contacted", label: "Contacted", color: "default" },
  { value: "meeting", label: "Meeting Set", color: "default" },
  { value: "partnered", label: "Partnered", color: "default" },
  { value: "declined", label: "Declined", color: "destructive" },
];

function getStatusBadge(status: string) {
  const s = OUTREACH_STATUSES.find(o => o.value === status) || OUTREACH_STATUSES[0];
  return <Badge variant={s.color as any}>{s.label}</Badge>;
}

function TeamLogo({ team, size = "md", testId }: { team: { logoUrl?: string | null; abbreviation?: string | null; league?: string | null; name: string }; size?: "sm" | "md" | "lg"; testId?: string }) {
  const logoUrl = getTeamLogoUrl(team);
  const sizeClasses = { sm: "h-6 w-6", md: "h-10 w-10", lg: "h-14 w-14" };
  const fallbackSizeClasses = { sm: "h-6 w-6 text-[8px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-sm" };

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${team.name} logo`}
        className={`${sizeClasses[size]} object-contain shrink-0`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        data-testid={testId || `img-team-logo`}
      />
    );
  }

  return (
    <div className={`${fallbackSizeClasses[size]} rounded-md bg-primary/10 flex items-center justify-center font-semibold text-primary shrink-0`}>
      {team.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
    </div>
  );
}

export default function SportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: moduleCheck, isLoading: moduleCheckLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/modules/check/sports"],
  });

  const [activeTab, setActiveTab] = useState("teams");
  const [searchQuery, setSearchQuery] = useState("");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [sportFilter, setSportFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [selectedTeam, setSelectedTeam] = useState<SportsTeam | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [selectedContact, setSelectedContact] = useState<SportsContact | null>(null);
  const [aiSearchQuery, setAiSearchQuery] = useState("");

  const [addTeamStep, setAddTeamStep] = useState<"select" | "confirm" | "manual">("select");
  const [teamSearchOpen, setTeamSearchOpen] = useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [selectedProTeam, setSelectedProTeam] = useState<ProfessionalTeam | null>(null);

  const [newTeam, setNewTeam] = useState({
    name: "", league: "", sport: "", level: "professional", city: "", state: "", venue: "", website: "",
    conference: "", division: "", abbreviation: "", logoUrl: "",
  });
  const [newContact, setNewContact] = useState({
    name: "", title: "", department: "", email: "", phone: "", linkedinUrl: "", roleType: "", teamId: "", notes: "",
  });

  const { data: teams, isLoading: teamsLoading } = useQuery<SportsTeam[]>({
    queryKey: ["/api/sports/teams"],
  });

  const { data: allContacts, isLoading: contactsLoading } = useQuery<SportsContact[]>({
    queryKey: ["/api/sports/contacts"],
  });

  const { data: teamContacts } = useQuery<SportsContact[]>({
    queryKey: ["/api/sports/teams", selectedTeam?.id, "contacts"],
    queryFn: async () => {
      if (!selectedTeam) return [];
      const res = await fetch(`/api/sports/teams/${selectedTeam.id}/contacts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedTeam,
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: typeof newTeam) => {
      const res = await apiRequest("POST", "/api/sports/teams", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sports/teams"] });
      setShowAddTeam(false);
      resetAddTeamState();
      toast({ title: "Team added successfully" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SportsTeam> }) => {
      const res = await apiRequest("PATCH", `/api/sports/teams/${id}`, data);
      return res.json();
    },
    onSuccess: (updated: SportsTeam) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sports/teams"] });
      setSelectedTeam(updated);
      toast({ title: "Team updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/sports/teams/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sports/teams"] });
      setSelectedTeam(null);
      toast({ title: "Team removed" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const searchTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      let researchContent = "";
      let scrapeContent = "";

      const researchPromise = apiRequest("POST", `/api/sports/teams/${id}/research`)
        .then(r => r.json())
        .then((data: any) => {
          let content = data.content || data.summary || "";
          if (content && typeof content === "string") {
            try {
              const parsed = JSON.parse(content);
              content = parsed?.rawContent || parsed?.content || parsed?.bio || Object.values(parsed).filter((v: any) => typeof v === "string" && v.length > 20).join("\n\n") || content;
            } catch {}
          }
          researchContent = content;
        })
        .catch((e: Error) => console.error("Research failed:", e.message));

      const team = selectedTeam;
      const scrapePromise = team?.website
        ? apiRequest("POST", `/api/sports/teams/${id}/scrape`)
            .then(r => r.json())
            .then((data: any) => {
              if (data?.data?.content || data?.data?.markdown) {
                scrapeContent = data.data.content || data.data.markdown || "";
              }
            })
            .catch((e: Error) => console.error("Scrape failed:", e.message))
        : Promise.resolve();

      await Promise.all([researchPromise, scrapePromise]);

      let combined = researchContent;
      if (scrapeContent && researchContent) {
        combined = researchContent + "\n\n---\n\n**Website Data:**\n" + scrapeContent.substring(0, 2000);
      } else if (scrapeContent) {
        combined = scrapeContent;
      }
      return combined;
    },
    onSuccess: (content: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sports/teams"] });
      if (selectedTeam && content) {
        setSelectedTeam({ ...selectedTeam, aiResearch: content });
      }
      toast({ title: "Team research complete" });
    },
    onError: (error: Error) => toast({ title: "Search failed", description: error.message, variant: "destructive" }),
  });

  const findPeopleMutation = useMutation({
    mutationFn: async ({ id, jobTitle, searchType }: { id: string; jobTitle?: string; searchType?: "people" | "leadership" }) => {
      const res = await apiRequest("POST", `/api/sports/teams/${id}/find-people`, { jobTitle, searchType: searchType || "people" });
      return res.json();
    },
    onError: (error: Error) => toast({ title: "Search failed", description: error.message, variant: "destructive" }),
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await apiRequest("POST", "/api/sports/contacts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sports/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sports/teams", selectedTeam?.id, "contacts"] });
      setShowAddContact(false);
      setNewContact({ name: "", title: "", department: "", email: "", phone: "", linkedinUrl: "", roleType: "", teamId: "", notes: "" });
      toast({ title: "Contact added" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/sports/contacts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sports/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sports/teams", selectedTeam?.id, "contacts"] });
      toast({ title: "Contact removed" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const enrichContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/sports/contacts/${id}/enrich`);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/sports/contacts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sports/teams", selectedTeam?.id, "contacts"] });
        if (data.contact && selectedContact) {
          setSelectedContact(data.contact);
        }
        toast({ title: "Contact enriched", description: `Found: ${data.fieldsUpdated?.join(", ") || "contact info"}` });
      } else {
        toast({ title: "No results", description: data.message || "Could not find contact information", variant: "destructive" });
      }
    },
    onError: (error: Error) => toast({ title: "Enrichment failed", description: error.message, variant: "destructive" }),
  });

  const aiSearchMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/sports/search", { query, sport: sportFilter !== "all" ? sportFilter : undefined, level: levelFilter !== "all" ? levelFilter : undefined });
      return res.json();
    },
    onError: (error: Error) => toast({ title: "Search failed", description: error.message, variant: "destructive" }),
  });

  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    let result = teams;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.city && t.city.toLowerCase().includes(q)) ||
        (t.state && t.state.toLowerCase().includes(q)) ||
        (t.league && t.league.toLowerCase().includes(q)) ||
        (t.sport && t.sport.toLowerCase().includes(q))
      );
    }
    if (leagueFilter !== "all") result = result.filter(t => t.league === leagueFilter);
    if (sportFilter !== "all") result = result.filter(t => t.sport === sportFilter);
    if (levelFilter !== "all") result = result.filter(t => t.level === levelFilter);
    return result;
  }, [teams, searchQuery, leagueFilter, sportFilter, levelFilter]);

  const favoriteTeams = useMemo(() => {
    if (!teams) return [];
    return teams.filter(t => t.isFavorite);
  }, [teams]);

  const pipelineTeams = useMemo(() => {
    if (!teams) return {};
    const groups: Record<string, SportsTeam[]> = {};
    for (const status of OUTREACH_STATUSES) {
      groups[status.value] = [];
    }
    for (const team of teams) {
      const status = team.outreachStatus || "not_started";
      if (!groups[status]) groups[status] = [];
      groups[status].push(team);
    }
    return groups;
  }, [teams]);

  const stats = useMemo(() => {
    if (!teams) return { total: 0, tracked: 0, partnered: 0, contacted: 0 };
    return {
      total: teams.length,
      tracked: teams.filter(t => t.isTracked).length,
      partnered: teams.filter(t => t.outreachStatus === "partnered").length,
      contacted: teams.filter(t => ["contacted", "meeting", "partnered"].includes(t.outreachStatus || "")).length,
    };
  }, [teams]);

  const filteredProTeams = useMemo(() => {
    if (!teamSearchQuery.trim()) return PROFESSIONAL_TEAMS.slice(0, 50);
    const q = teamSearchQuery.toLowerCase();
    return PROFESSIONAL_TEAMS.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q) ||
      t.league.toLowerCase().includes(q) ||
      t.abbreviation.toLowerCase().includes(q) ||
      t.sport.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [teamSearchQuery]);

  function resetAddTeamState() {
    setAddTeamStep("select");
    setSelectedProTeam(null);
    setTeamSearchQuery("");
    setNewTeam({ name: "", league: "", sport: "", level: "professional", city: "", state: "", venue: "", website: "", conference: "", division: "", abbreviation: "", logoUrl: "" });
  }

  function selectProTeam(proTeam: ProfessionalTeam) {
    setSelectedProTeam(proTeam);
    setNewTeam({
      name: proTeam.name,
      league: proTeam.league,
      sport: proTeam.sport,
      level: "professional",
      city: proTeam.city,
      state: proTeam.state,
      venue: proTeam.venue,
      website: proTeam.website,
      conference: proTeam.conference,
      division: proTeam.division,
      abbreviation: proTeam.abbreviation,
      logoUrl: proTeam.logoUrl,
    });
    setAddTeamStep("confirm");
  }

  if (moduleCheckLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!moduleCheck?.enabled) {
    return (
      <div className="p-6 space-y-4 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-semibold">Sports Intelligence Module</h2>
        <p className="text-muted-foreground">This module is not enabled for your organization. Contact your administrator to enable it from the Modules page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-sports-title">
            <Trophy className="h-7 w-7" />
            Sports Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            Research and track sports teams, find key contacts, and manage partnership outreach.
          </p>
        </div>
        <Dialog open={showAddTeam} onOpenChange={(open) => { setShowAddTeam(open); if (!open) resetAddTeamState(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-team">
              <Plus className="h-4 w-4 mr-2" />
              Add Team
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>
                {addTeamStep === "select" ? "Select a Team" : addTeamStep === "confirm" ? "Confirm Team" : "Add Custom Team"}
              </DialogTitle>
            </DialogHeader>

            {addTeamStep === "select" && (
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Search for a professional team below, or add a custom team manually.
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by team name, city, or league..."
                    value={teamSearchQuery}
                    onChange={e => setTeamSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-pro-teams"
                  />
                </div>
                <ScrollArea className="h-[350px] rounded-md border">
                  <div className="p-1">
                    {filteredProTeams.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Search className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">No teams found</p>
                      </div>
                    ) : (
                      filteredProTeams.map((proTeam, idx) => (
                        <button
                          key={`${proTeam.league}-${proTeam.abbreviation}-${idx}`}
                          className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer text-left"
                          onClick={() => selectProTeam(proTeam)}
                          data-testid={`button-select-team-${proTeam.abbreviation}-${proTeam.league}`}
                        >
                          <img
                            src={proTeam.logoUrl}
                            alt={proTeam.name}
                            className="h-8 w-8 object-contain shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{proTeam.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {proTeam.league} &middot; {proTeam.city}, {proTeam.state}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">{proTeam.league}</Badge>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setAddTeamStep("manual")} data-testid="button-add-custom-team">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Custom Team
                  </Button>
                </div>
              </div>
            )}

            {addTeamStep === "confirm" && selectedProTeam && (
              <div className="space-y-4 py-2">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={selectedProTeam.logoUrl}
                        alt={selectedProTeam.name}
                        className="h-16 w-16 object-contain shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold">{selectedProTeam.name}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline">{selectedProTeam.league}</Badge>
                          <Badge variant="secondary">{selectedProTeam.sport}</Badge>
                          {selectedProTeam.conference && <Badge variant="secondary" className="text-xs">{selectedProTeam.conference}</Badge>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <p className="text-sm font-medium text-center">Is this the team you are looking for?</p>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">City</p>
                    <p className="font-medium">{selectedProTeam.city}, {selectedProTeam.state}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Venue</p>
                    <p className="font-medium">{selectedProTeam.venue}</p>
                  </div>
                  {selectedProTeam.conference && (
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Conference</p>
                      <p className="font-medium">{selectedProTeam.conference}</p>
                    </div>
                  )}
                  {selectedProTeam.division && (
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Division</p>
                      <p className="font-medium">{selectedProTeam.division}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => { setAddTeamStep("select"); setSelectedProTeam(null); }} data-testid="button-back-to-search">
                    Back
                  </Button>
                  <Button className="flex-1" onClick={() => createTeamMutation.mutate(newTeam)} disabled={createTeamMutation.isPending} data-testid="button-confirm-add-team">
                    {createTeamMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</> : <><Check className="h-4 w-4 mr-2" /> Yes, Add Team</>}
                  </Button>
                </div>
              </div>
            )}

            {addTeamStep === "manual" && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Team Name *</Label>
                  <Input value={newTeam.name} onChange={e => setNewTeam(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Arizona Cardinals" data-testid="input-team-name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>League</Label>
                    <Select value={newTeam.league} onValueChange={v => setNewTeam(p => ({ ...p, league: v }))}>
                      <SelectTrigger data-testid="select-team-league"><SelectValue placeholder="Select league" /></SelectTrigger>
                      <SelectContent>
                        {LEAGUES.filter(l => l.value !== "all").map(l => (
                          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Sport</Label>
                    <Select value={newTeam.sport} onValueChange={v => setNewTeam(p => ({ ...p, sport: v }))}>
                      <SelectTrigger data-testid="select-team-sport"><SelectValue placeholder="Select sport" /></SelectTrigger>
                      <SelectContent>
                        {SPORTS.filter(s => s.value !== "all").map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Level</Label>
                    <Select value={newTeam.level} onValueChange={v => setNewTeam(p => ({ ...p, level: v }))}>
                      <SelectTrigger data-testid="select-team-level"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="college">College</SelectItem>
                        <SelectItem value="minor_league">Minor League</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>City</Label>
                    <Input value={newTeam.city} onChange={e => setNewTeam(p => ({ ...p, city: e.target.value }))} placeholder="City" data-testid="input-team-city" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>State</Label>
                    <Input value={newTeam.state} onChange={e => setNewTeam(p => ({ ...p, state: e.target.value }))} placeholder="AZ" data-testid="input-team-state" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Venue</Label>
                    <Input value={newTeam.venue} onChange={e => setNewTeam(p => ({ ...p, venue: e.target.value }))} placeholder="State Farm Stadium" data-testid="input-team-venue" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Website</Label>
                  <Input value={newTeam.website} onChange={e => setNewTeam(p => ({ ...p, website: e.target.value }))} placeholder="https://www.azcardinals.com" data-testid="input-team-website" />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => { setAddTeamStep("select"); resetAddTeamState(); }} data-testid="button-back-from-manual">
                    Back
                  </Button>
                  <Button className="flex-1" onClick={() => createTeamMutation.mutate(newTeam)} disabled={!newTeam.name || createTeamMutation.isPending} data-testid="button-submit-team">
                    {createTeamMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</> : "Add Team"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-stat-total">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Teams Tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-stat-contacted">{stats.contacted}</div>
            <p className="text-sm text-muted-foreground">In Pipeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-stat-partnered">{stats.partnered}</div>
            <p className="text-sm text-muted-foreground">Partnered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-stat-contacts">{allContacts?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Key Contacts</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="teams" data-testid="tab-teams">
            <Trophy className="h-4 w-4 mr-2" />
            Teams
          </TabsTrigger>
          <TabsTrigger value="pipeline" data-testid="tab-pipeline">
            <Target className="h-4 w-4 mr-2" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            <Users className="h-4 w-4 mr-2" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="research" data-testid="tab-research">
            <Brain className="h-4 w-4 mr-2" />
            AI Research
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teams" className="space-y-4 mt-4">
          {favoriteTeams.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                Favorite Teams
              </h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {favoriteTeams.map(team => (
                  <Card
                    key={team.id}
                    className="cursor-pointer hover-elevate border-yellow-500/20"
                    onClick={() => setSelectedTeam(team)}
                    data-testid={`card-fav-team-${team.id}`}
                  >
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center gap-3">
                        <TeamLogo team={team} size="md" testId={`img-team-logo-fav-${team.id}`} />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{team.name}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {team.league && <Badge variant="outline" className="text-xs">{team.league}</Badge>}
                            {team.sport && <Badge variant="secondary" className="text-xs">{team.sport}</Badge>}
                          </div>
                        </div>
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Separator />
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams by name, city, league..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-teams"
              />
            </div>
            <Select value={leagueFilter} onValueChange={setLeagueFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-league-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAGUES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sportFilter} onValueChange={setSportFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-sport-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPORTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-level-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="college">College</SelectItem>
                <SelectItem value="minor_league">Minor League</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {teamsLoading ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : filteredTeams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Trophy className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground font-medium">No teams found</p>
                <p className="text-sm text-muted-foreground">Add a team to start tracking.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredTeams.map(team => (
                <Card
                  key={team.id}
                  className="cursor-pointer hover-elevate"
                  onClick={() => setSelectedTeam(team)}
                  data-testid={`card-team-${team.id}`}
                >
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <TeamLogo team={team} size="md" testId={`img-team-logo-${team.id}`} />
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">{team.name}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {team.league && <Badge variant="outline" className="text-xs">{team.league}</Badge>}
                            {team.sport && <Badge variant="secondary" className="text-xs">{team.sport}</Badge>}
                            {team.level === "college" && <Badge variant="secondary" className="text-xs">College</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {team.isFavorite && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />}
                        {getStatusBadge(team.outreachStatus || "not_started")}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {(team.city || team.state) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {[team.city, team.state].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {team.venue && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {team.venue}
                        </span>
                      )}
                    </div>
                    {team.aiResearch && (() => {
                      let preview = team.aiResearch;
                      if (preview.trimStart().startsWith("{")) {
                        try {
                          const p = JSON.parse(preview);
                          preview = p?.rawContent || p?.content || preview;
                        } catch {}
                      }
                      preview = preview.replace(/\\n/g, " ").replace(/\*\*/g, "").replace(/#+\s*/g, "");
                      return <p className="text-xs text-muted-foreground line-clamp-2">{preview.substring(0, 120)}...</p>;
                    })()}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {OUTREACH_STATUSES.filter(s => s.value !== "not_started").map(status => (
              <div key={status.value} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{status.label}</h3>
                  <Badge variant="secondary" className="text-xs">{(pipelineTeams[status.value] || []).length}</Badge>
                </div>
                <div className="space-y-2">
                  {(pipelineTeams[status.value] || []).map(team => (
                    <Card key={team.id} className="cursor-pointer hover-elevate" onClick={() => setSelectedTeam(team)} data-testid={`card-pipeline-team-${team.id}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <TeamLogo team={team} size="sm" testId={`img-team-logo-pipeline-${team.id}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{team.name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {team.league && <Badge variant="outline" className="text-xs">{team.league}</Badge>}
                              {(team.city || team.state) && (
                                <span className="text-xs text-muted-foreground">
                                  {[team.city, team.state].filter(Boolean).join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {team.outreachNotes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{team.outreachNotes}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {(pipelineTeams[status.value] || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No teams</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {allContacts?.length || 0} contacts across all teams
            </p>
            <Button onClick={() => { setShowAddContact(true); setNewContact(p => ({ ...p, teamId: "" })); }} data-testid="button-add-contact">
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>

          {contactsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : !allContacts || allContacts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No contacts yet. Add contacts manually or use Find People on a team.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {allContacts.map(contact => {
                const team = teams?.find(t => t.id === contact.teamId);
                return (
                  <Card key={contact.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedContact(contact)} data-testid={`card-contact-${contact.id}`}>
                    <CardContent className="flex items-center justify-between gap-4 py-3 flex-wrap">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-9 w-9 shrink-0">
                          {contact.imageUrl && <AvatarImage src={contact.imageUrl} alt={contact.name} />}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                            {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{contact.name}</span>
                            {contact.roleType && <Badge variant="outline" className="text-xs">{contact.roleType}</Badge>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            {contact.title && <span>{contact.title}</span>}
                            {team && <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />{team.name}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid={`link-email-${contact.id}`}>
                                <Mail className="h-3 w-3" />
                                <span className="truncate max-w-[180px]">{contact.email}</span>
                              </a>
                            )}
                            {contact.phone && (
                              <a href={`tel:${contact.phone}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid={`link-phone-${contact.id}`}>
                                <Phone className="h-3 w-3" />
                                <span>{contact.phone}</span>
                              </a>
                            )}
                            {contact.linkedinUrl && (
                              <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid={`link-linkedin-${contact.id}`}>
                                <Link2 className="h-3 w-3" />
                                <span>LinkedIn</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteContactMutation.mutate(contact.id); }} data-testid={`button-delete-contact-${contact.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="research" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI-Powered Team Discovery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use AI to discover sports teams in a specific market, conference, or sport. Results include team details, community programs, and partnership opportunities.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="e.g. Arizona sports teams, Big 12 football, Texas pro teams..."
                    value={aiSearchQuery}
                    onChange={e => setAiSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-ai-search"
                    onKeyDown={e => e.key === "Enter" && aiSearchQuery.trim() && aiSearchMutation.mutate(aiSearchQuery)}
                  />
                </div>
                <Button
                  onClick={() => aiSearchMutation.mutate(aiSearchQuery)}
                  disabled={!aiSearchQuery.trim() || aiSearchMutation.isPending}
                  data-testid="button-ai-search"
                >
                  {aiSearchMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Searching...</> : <><Brain className="h-4 w-4 mr-2" /> Search</>}
                </Button>
              </div>

              {aiSearchMutation.data && (
                <div className="p-4 rounded-md bg-muted/50 text-sm max-h-[500px] overflow-y-auto space-y-2">
                  {(aiSearchMutation.data.content || aiSearchMutation.data.summary || "").split(/\n{2,}/).map((block: string, bIdx: number) => {
                    const trimmed = block.trim();
                    if (!trimmed) return null;
                    if (trimmed.startsWith("### ")) {
                      return <h4 key={bIdx} className="font-semibold text-sm mt-2 first:mt-0 text-foreground">{trimmed.replace(/^###\s*/, "").replace(/\*\*/g, "")}</h4>;
                    }
                    if (trimmed.startsWith("## ")) {
                      return <h3 key={bIdx} className="font-semibold text-base mt-2 first:mt-0 text-foreground">{trimmed.replace(/^##\s*/, "").replace(/\*\*/g, "")}</h3>;
                    }
                    const lines = trimmed.split("\n");
                    const isList = lines.every((l: string) => /^\s*[-*]\s/.test(l) || !l.trim());
                    if (isList) {
                      return (
                        <ul key={bIdx} className="space-y-1 pl-1">
                          {lines.filter((l: string) => l.trim()).map((line: string, lIdx: number) => (
                            <li key={lIdx} className="flex gap-2 text-muted-foreground leading-relaxed">
                              <span className="text-muted-foreground/60 mt-0.5 shrink-0">-</span>
                              <span>{line.replace(/^\s*[-*]\s*/, "").replace(/\[\d+\]/g, "")}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return <p key={bIdx} className="text-muted-foreground leading-relaxed">{trimmed.replace(/\[\d+\]/g, "")}</p>;
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Team Detail Sheet */}
      <Sheet open={!!selectedTeam} onOpenChange={(open) => { if (!open) { setSelectedTeam(null); findPeopleMutation.reset(); } }}>
        <SheetContent className="sm:max-w-[550px] overflow-y-auto">
          {selectedTeam && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <TeamLogo team={selectedTeam} size="lg" testId={`img-team-logo-detail-${selectedTeam.id}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-lg">{selectedTeam.name}</span>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {selectedTeam.league && <Badge variant="outline" className="text-xs">{selectedTeam.league}</Badge>}
                      {selectedTeam.sport && <Badge variant="secondary" className="text-xs">{selectedTeam.sport}</Badge>}
                      {selectedTeam.conference && <Badge variant="secondary" className="text-xs">{selectedTeam.conference}</Badge>}
                      {getStatusBadge(selectedTeam.outreachStatus || "not_started")}
                    </div>
                  </div>
                </SheetTitle>
                <SheetDescription>Team details and research</SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-6">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Details
                  </h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newVal = !selectedTeam.isFavorite;
                      updateTeamMutation.mutate({ id: selectedTeam.id, data: { isFavorite: newVal } });
                      setSelectedTeam({ ...selectedTeam, isFavorite: newVal });
                    }}
                    data-testid="button-toggle-favorite"
                  >
                    <Star className={`h-5 w-5 ${selectedTeam.isFavorite ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                  </Button>
                </div>

                <div className="space-y-2">
                  {(selectedTeam.city || selectedTeam.state) && (
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      {[selectedTeam.city, selectedTeam.state].filter(Boolean).join(", ")}
                    </div>
                  )}
                  {selectedTeam.venue && (
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      {selectedTeam.venue}
                    </div>
                  )}
                  {selectedTeam.website && (
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a href={selectedTeam.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary flex items-center gap-1">
                        {selectedTeam.website} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {selectedTeam.conference && (
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
                      {selectedTeam.conference}{selectedTeam.division ? ` - ${selectedTeam.division}` : ""}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Outreach Status
                  </h4>
                  <Select
                    value={selectedTeam.outreachStatus || "not_started"}
                    onValueChange={v => updateTeamMutation.mutate({ id: selectedTeam.id, data: { outreachStatus: v } })}
                  >
                    <SelectTrigger data-testid="select-outreach-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OUTREACH_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Textarea
                    placeholder="Outreach notes..."
                    value={selectedTeam.outreachNotes || ""}
                    onChange={e => setSelectedTeam({ ...selectedTeam, outreachNotes: e.target.value })}
                    onBlur={() => updateTeamMutation.mutate({ id: selectedTeam.id, data: { outreachNotes: selectedTeam.outreachNotes } })}
                    className="text-sm"
                    data-testid="textarea-outreach-notes"
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    AI Research
                  </h4>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={() => searchTeamMutation.mutate(selectedTeam.id)}
                      disabled={searchTeamMutation.isPending}
                      data-testid="button-search-team"
                    >
                      {searchTeamMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Searching...</> : <><Search className="h-4 w-4 mr-2" /> Search Team</>}
                    </Button>
                  </div>
                  {selectedTeam.aiResearch && (() => {
                    let displayContent = selectedTeam.aiResearch;
                    if (displayContent.trimStart().startsWith("{")) {
                      try {
                        const parsed = JSON.parse(displayContent);
                        displayContent = parsed?.rawContent || parsed?.content || parsed?.bio || Object.values(parsed).filter((v: any) => typeof v === "string" && v.length > 20).join("\n\n") || displayContent;
                      } catch {}
                    }
                    displayContent = displayContent.replace(/\\n/g, "\n");
                    return (
                    <div className="p-4 rounded-md bg-muted/50 text-sm max-h-[300px] overflow-y-auto space-y-2">
                      {displayContent.split(/\n{2,}/).map((block: string, bIdx: number) => {
                        const trimmed = block.trim();
                        if (!trimmed) return null;
                        if (trimmed.startsWith("### ")) return <h4 key={bIdx} className="font-semibold text-sm mt-2 first:mt-0 text-foreground">{trimmed.replace(/^###\s*/, "").replace(/\*\*/g, "")}</h4>;
                        if (trimmed.startsWith("## ")) return <h3 key={bIdx} className="font-semibold text-base mt-2 first:mt-0 text-foreground">{trimmed.replace(/^##\s*/, "").replace(/\*\*/g, "")}</h3>;
                        const lines = trimmed.split("\n");
                        const isList = lines.every(l => /^\s*[-*]\s/.test(l) || !l.trim());
                        if (isList) {
                          return (
                            <ul key={bIdx} className="space-y-1 pl-1">
                              {lines.filter(l => l.trim()).map((line, lIdx) => (
                                <li key={lIdx} className="flex gap-2 text-muted-foreground leading-relaxed">
                                  <span className="text-muted-foreground/60 mt-0.5 shrink-0">-</span>
                                  <span>{line.replace(/^\s*[-*]\s*/, "").replace(/\[\d+\]/g, "")}</span>
                                </li>
                              ))}
                            </ul>
                          );
                        }
                        return <p key={bIdx} className="text-muted-foreground leading-relaxed">{trimmed.replace(/\[\d+\]/g, "")}</p>;
                      })}
                    </div>
                    );
                  })()}
                  {selectedTeam.aiResearchedAt && (
                    <p className="text-xs text-muted-foreground">Last researched: {new Date(selectedTeam.aiResearchedAt).toLocaleDateString()}</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <UserSearch className="h-4 w-4" />
                    Find Staff
                  </h4>
                  <p className="text-xs text-muted-foreground">Searches PDL, AI research, and team websites</p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => findPeopleMutation.mutate({ id: selectedTeam.id })}
                    disabled={findPeopleMutation.isPending}
                    data-testid="button-find-staff"
                  >
                    {findPeopleMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Searching...</> : <><UserSearch className="h-4 w-4 mr-2" /> Find Staff</>}
                  </Button>
                  {findPeopleMutation.data?.sources && findPeopleMutation.data.sources.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">Sources:</span>
                      {findPeopleMutation.data.sources.map((source: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{source}</Badge>
                      ))}
                    </div>
                  )}
                  {findPeopleMutation.data?.data && findPeopleMutation.data.data.length > 0 && (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {findPeopleMutation.data.data.map((person: any, idx: number) => (
                        <Card key={idx}>
                          <CardContent className="py-2 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Avatar className="h-8 w-8 shrink-0">
                                {(person.imageUrl || person.profilePicUrl) && <AvatarImage src={person.imageUrl || person.profilePicUrl} alt={person.fullName || person.name} />}
                                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                                  {(person.fullName || person.full_name || person.name || "").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{person.fullName || person.full_name || person.name}</p>
                              <p className="text-xs text-muted-foreground">{person.title || person.job_title}</p>
                              {person.department && <p className="text-xs text-muted-foreground">{person.department}</p>}
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {person.email && (
                                  <a href={`mailto:${person.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid={`link-email-person-${idx}`}>
                                    <Mail className="h-3 w-3" /><span className="truncate max-w-[160px]">{person.email}</span>
                                  </a>
                                )}
                                {person.phone && (
                                  <a href={`tel:${person.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid={`link-phone-person-${idx}`}>
                                    <Phone className="h-3 w-3" /><span>{person.phone}</span>
                                  </a>
                                )}
                              </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {(person.linkedinUrl || person.linkedin_url) && (
                                <Button variant="ghost" size="icon" asChild>
                                  <a href={person.linkedinUrl || person.linkedin_url} target="_blank" rel="noopener noreferrer"><Link2 className="h-4 w-4" /></a>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  createContactMutation.mutate({
                                    teamId: selectedTeam.id,
                                    name: person.fullName || person.full_name || person.name || "",
                                    title: person.title || person.job_title || "",
                                    email: person.email || person.work_email || "",
                                    phone: person.phone || "",
                                    linkedinUrl: person.linkedinUrl || person.linkedin_url || "",
                                    imageUrl: person.imageUrl || person.image_url || person.profilePicUrl || "",
                                    roleType: person.source === "pdl" ? "pdl_discovered" : person.source === "ai_research" ? "ai_discovered" : "web_discovered",
                                    department: person.department || "",
                                    notes: "",
                                  });
                                }}
                                data-testid={`button-save-person-${idx}`}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  {findPeopleMutation.data?.data?.length === 0 && (
                    <p className="text-sm text-muted-foreground">No people found for this team.</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Team Contacts
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowAddContact(true); setNewContact(p => ({ ...p, teamId: selectedTeam.id })); }}
                      data-testid="button-add-team-contact"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  {teamContacts && teamContacts.length > 0 ? (
                    <div className="space-y-2">
                      {teamContacts.map(contact => (
                        <div key={contact.id} className="flex items-center justify-between gap-2 text-sm p-2 rounded-md bg-muted/30">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Avatar className="h-7 w-7 shrink-0">
                              {contact.imageUrl && <AvatarImage src={contact.imageUrl} alt={contact.name} />}
                              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                                {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium">{contact.name}</p>
                              {contact.title && <p className="text-xs text-muted-foreground truncate">{contact.title}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {contact.email && (
                              <Button variant="ghost" size="icon" asChild data-testid={`button-email-team-contact-${contact.id}`}>
                                <a href={`mailto:${contact.email}`}><Mail className="h-3 w-3" /></a>
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => deleteContactMutation.mutate(contact.id)} data-testid={`button-delete-team-contact-${contact.id}`}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No contacts for this team yet.</p>
                  )}
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => deleteTeamMutation.mutate(selectedTeam.id)}
                    disabled={deleteTeamMutation.isPending}
                    data-testid="button-delete-team"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Team
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))} placeholder="John Smith" data-testid="input-contact-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Title</Label>
                <Input value={newContact.title} onChange={e => setNewContact(p => ({ ...p, title: e.target.value }))} placeholder="VP Community Relations" data-testid="input-contact-title" />
              </div>
              <div className="grid gap-2">
                <Label>Role Type</Label>
                <Select value={newContact.roleType} onValueChange={v => setNewContact(p => ({ ...p, roleType: v }))}>
                  <SelectTrigger data-testid="select-contact-role"><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="executive">Executive</SelectItem>
                    <SelectItem value="partnerships">Partnerships</SelectItem>
                    <SelectItem value="community_relations">Community Relations</SelectItem>
                    <SelectItem value="ticket_operations">Ticket Operations</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="gm">General Manager</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} placeholder="email@team.com" data-testid="input-contact-email" />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 123-4567" data-testid="input-contact-phone" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>LinkedIn URL</Label>
              <Input value={newContact.linkedinUrl} onChange={e => setNewContact(p => ({ ...p, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/..." data-testid="input-contact-linkedin" />
            </div>
            {!newContact.teamId && teams && teams.length > 0 && (
              <div className="grid gap-2">
                <Label>Team</Label>
                <Select value={newContact.teamId} onValueChange={v => setNewContact(p => ({ ...p, teamId: v }))}>
                  <SelectTrigger data-testid="select-contact-team"><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea value={newContact.notes} onChange={e => setNewContact(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." data-testid="textarea-contact-notes" />
            </div>
            <Button onClick={() => createContactMutation.mutate(newContact)} disabled={!newContact.name || createContactMutation.isPending} data-testid="button-submit-contact">
              {createContactMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</> : "Add Contact"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Detail Sheet */}
      <Sheet open={!!selectedContact} onOpenChange={(open) => { if (!open) setSelectedContact(null); }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {selectedContact?.imageUrl && <AvatarImage src={selectedContact.imageUrl} alt={selectedContact.name} />}
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {selectedContact?.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle data-testid="text-contact-detail-name">{selectedContact?.name}</SheetTitle>
                <SheetDescription>{selectedContact?.title || "Contact"}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          {selectedContact && (() => {
            const contactTeam = teams?.find(t => t.id === selectedContact.teamId);
            return (
              <div className="space-y-6 mt-6">
                {contactTeam && (
                  <div className="flex items-center gap-3">
                    <TeamLogo team={contactTeam} size="sm" testId="img-contact-detail-team" />
                    <div>
                      <p className="text-sm font-medium">{contactTeam.name}</p>
                      {contactTeam.league && <p className="text-xs text-muted-foreground">{contactTeam.league}</p>}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Contact Information</h4>
                  {selectedContact.email ? (
                    <a href={`mailto:${selectedContact.email}`} className="flex items-center gap-3 text-sm hover:text-foreground text-muted-foreground" data-testid="link-contact-detail-email">
                      <Mail className="h-4 w-4 shrink-0" />
                      <span>{selectedContact.email}</span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground/50">
                      <Mail className="h-4 w-4 shrink-0" />
                      <span>No email on file</span>
                    </div>
                  )}
                  {selectedContact.phone ? (
                    <a href={`tel:${selectedContact.phone}`} className="flex items-center gap-3 text-sm hover:text-foreground text-muted-foreground" data-testid="link-contact-detail-phone">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{selectedContact.phone}</span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground/50">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>No phone on file</span>
                    </div>
                  )}
                  {selectedContact.linkedinUrl ? (
                    <a href={selectedContact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm hover:text-foreground text-muted-foreground" data-testid="link-contact-detail-linkedin">
                      <Link2 className="h-4 w-4 shrink-0" />
                      <span>LinkedIn Profile</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground/50">
                      <Link2 className="h-4 w-4 shrink-0" />
                      <span>No LinkedIn on file</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Details</h4>
                  {selectedContact.department && (
                    <div className="flex items-center gap-3 text-sm">
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{selectedContact.department}</span>
                    </div>
                  )}
                  {selectedContact.roleType && (
                    <div className="flex items-center gap-3 text-sm">
                      <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="capitalize">{selectedContact.roleType.replace(/_/g, ' ')}</span>
                    </div>
                  )}
                  {selectedContact.source && (
                    <div className="flex items-center gap-3 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>Source: {selectedContact.source === "manual" ? "Manual" : selectedContact.source === "pdl" ? "People Data Labs" : selectedContact.source === "ai_research" ? "AI Research" : selectedContact.source}</span>
                    </div>
                  )}
                </div>

                {selectedContact.notes && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Notes</h4>
                      <p className="text-sm text-muted-foreground">{selectedContact.notes}</p>
                    </div>
                  </>
                )}

                <Separator />

                {(!selectedContact.email || !selectedContact.phone || !selectedContact.linkedinUrl) && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => enrichContactMutation.mutate(selectedContact.id)}
                    disabled={enrichContactMutation.isPending}
                    data-testid="button-enrich-contact"
                  >
                    {enrichContactMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    {enrichContactMutation.isPending ? "Searching..." : "Find Contact Info"}
                  </Button>
                )}

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    deleteContactMutation.mutate(selectedContact.id);
                    setSelectedContact(null);
                  }}
                  data-testid="button-delete-contact-detail"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Contact
                </Button>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

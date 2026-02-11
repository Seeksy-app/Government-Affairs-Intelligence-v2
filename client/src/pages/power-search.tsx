import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Search, Plus, Trash2, Globe, Users, MapPin,
  Loader2, ExternalLink, Briefcase, Brain, Landmark,
  Scale, BookOpen, Flag, UserSearch, Calendar, X, UserPlus, Zap,
  ChevronRight
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { PoliticalOrganization, Client, KbCategory } from "@shared/schema";

interface CompanyEnrichResult {
  name: string;
  displayName?: string;
  website?: string;
  linkedinUrl?: string;
  industry?: string;
  size?: string;
  founded?: number;
  type?: string;
  description?: string;
  headquarters?: { city?: string; state?: string; country?: string };
  employeeCount?: number;
  employeeCountRange?: string;
  tags?: string[];
  politicalClassification?: {
    isLobbyingFirm: boolean;
    isPAC: boolean;
    isThinkTank: boolean;
    isGovernmentAgency: boolean;
    isPoliticalOrg: boolean;
    isCampaign: boolean;
  };
}

interface PersonResult {
  id?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  linkedinUrl?: string;
  profilePicUrl?: string;
  jobTitle?: string;
  jobCompany?: string;
  location?: string;
  industry?: string;
  skills?: string[];
}

function getOrgTypeIcon(org: PoliticalOrganization) {
  if (org.isLobbyingFirm) return <Scale className="h-4 w-4" />;
  if (org.isPAC) return <Flag className="h-4 w-4" />;
  if (org.isThinkTank) return <BookOpen className="h-4 w-4" />;
  if (org.isGovernmentAgency) return <Landmark className="h-4 w-4" />;
  if (org.isPoliticalOrg) return <Flag className="h-4 w-4" />;
  if (org.isCampaign) return <Flag className="h-4 w-4" />;
  return <Building2 className="h-4 w-4" />;
}

function getOrgTypeBadge(org: PoliticalOrganization) {
  if (org.isLobbyingFirm) return <Badge variant="default" data-testid="badge-lobbying">Lobbying Firm</Badge>;
  if (org.isPAC) return <Badge variant="secondary" data-testid="badge-pac">PAC</Badge>;
  if (org.isThinkTank) return <Badge variant="outline" data-testid="badge-think-tank">Think Tank</Badge>;
  if (org.isGovernmentAgency) return <Badge variant="outline" data-testid="badge-gov-agency">Gov Agency</Badge>;
  if (org.isPoliticalOrg) return <Badge variant="secondary" data-testid="badge-political-org">Political Org</Badge>;
  if (org.isCampaign) return <Badge variant="secondary" data-testid="badge-campaign">Campaign</Badge>;
  if (org.orgType) return <Badge variant="outline" data-testid="badge-org-type">{org.orgType}</Badge>;
  return null;
}

function getClassificationBadges(classification: CompanyEnrichResult["politicalClassification"]) {
  if (!classification) return null;
  const badges = [];
  if (classification.isLobbyingFirm) badges.push(<Badge key="lobby" variant="default">Lobbying Firm</Badge>);
  if (classification.isPAC) badges.push(<Badge key="pac" variant="secondary">PAC</Badge>);
  if (classification.isThinkTank) badges.push(<Badge key="think" variant="outline">Think Tank</Badge>);
  if (classification.isGovernmentAgency) badges.push(<Badge key="gov" variant="outline">Gov Agency</Badge>);
  if (classification.isPoliticalOrg) badges.push(<Badge key="pol" variant="secondary">Political Org</Badge>);
  if (classification.isCampaign) badges.push(<Badge key="camp" variant="secondary">Campaign</Badge>);
  return badges.length > 0 ? badges : null;
}

const PEOPLE_PRESETS = [
  { label: "Lobbyists in DC", company: "", title: "lobbyist", location: "washington dc", industry: "", school: "" },
  { label: "Government Affairs", company: "", title: "government affairs", location: "washington dc", industry: "", school: "" },
  { label: "PAC Directors", company: "", title: "director", location: "", industry: "political", school: "" },
  { label: "Chiefs of Staff", company: "", title: "chief of staff", location: "washington dc", industry: "government", school: "" },
  { label: "Policy Advisors", company: "", title: "policy", location: "washington dc", industry: "government", school: "" },
  { label: "Legislative Directors", company: "", title: "legislative director", location: "washington dc", industry: "", school: "" },
  { label: "Think Tank Staff", company: "", title: "", location: "washington dc", industry: "think tank", school: "" },
  { label: "Campaign Staff", company: "", title: "campaign", location: "", industry: "political", school: "" },
  { label: "City Managers", company: "", title: "city manager", location: "", industry: "government", school: "" },
  { label: "County Administrators", company: "", title: "county administrator", location: "", industry: "government", school: "" },
  { label: "State Grant Officers", company: "", title: "grant", location: "", industry: "government", school: "" },
  { label: "Municipal Finance Directors", company: "", title: "finance director", location: "", industry: "government", school: "" },
];

export default function PowerSearchPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const defaultTab = location === "/organizations" ? "organizations" : "people";
  const [mainTab, setMainTab] = useState(defaultTab);

  const [personSearchCompany, setPersonSearchCompany] = useState("");
  const [personSearchTitle, setPersonSearchTitle] = useState("");
  const [personSearchLocation, setPersonSearchLocation] = useState("");
  const [personSearchIndustry, setPersonSearchIndustry] = useState("");
  const [personSearchSchool, setPersonSearchSchool] = useState("");
  const [personSearchResults, setPersonSearchResults] = useState<PersonResult[]>([]);
  const [personSearchLoading, setPersonSearchLoading] = useState(false);

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactDialogPerson, setContactDialogPerson] = useState<PersonResult | null>(null);
  const [contactAssignType, setContactAssignType] = useState<"client" | "general" | "kb">("general");
  const [contactClientId, setContactClientId] = useState("");
  const [contactKbId, setContactKbId] = useState("");
  const [contactNotes, setContactNotes] = useState("");
  const [newKbName, setNewKbName] = useState("");
  const [showNewKbInput, setShowNewKbInput] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);

  const { data: clientsList = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: kbCategories = [] } = useQuery<KbCategory[]>({ queryKey: ["/api/admin/kb/categories"] });

  const openContactDialog = (person: PersonResult) => {
    setContactDialogPerson(person);
    setContactAssignType("general");
    setContactClientId("");
    setContactKbId("");
    setContactNotes("");
    setNewKbName("");
    setShowNewKbInput(false);
    setContactDialogOpen(true);
  };

  const handleCreateKb = async () => {
    if (!newKbName.trim()) return;
    try {
      const res = await apiRequest("POST", "/api/admin/kb/categories", {
        name: newKbName.trim(),
        scope: "owner",
        description: "",
      });
      const created = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kb/categories"] });
      setContactKbId(created.id);
      setNewKbName("");
      setShowNewKbInput(false);
      toast({ title: "Knowledge Base created", description: `"${created.name}" is now available` });
    } catch (error: any) {
      toast({ title: "Failed to create KB", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveContact = async () => {
    if (!contactDialogPerson) return;
    setContactSaving(true);
    try {
      const nameParts = (contactDialogPerson.fullName || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const body: Record<string, any> = {
        firstName,
        lastName,
        title: contactDialogPerson.jobTitle || '',
        organization: contactDialogPerson.jobCompany || '',
        notes: contactNotes || undefined,
      };

      if (contactAssignType === "client" && contactClientId) {
        body.assignToClientId = contactClientId;
      }
      if (contactAssignType === "kb" && contactKbId) {
        body.kbCategoryId = contactKbId;
      }

      await apiRequest("POST", "/api/contacts/from-search", body);
      toast({ title: "Contact saved", description: `${firstName} ${lastName} has been added` });
      setContactDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Failed to save contact", description: error.message, variant: "destructive" });
    } finally {
      setContactSaving(false);
    }
  };

  const runPersonSearch = async (params: { company?: string; title?: string; location?: string; industry?: string; school?: string }) => {
    setPersonSearchLoading(true);
    try {
      const body: Record<string, any> = { limit: 25 };
      if (params.company) body.company = params.company;
      if (params.title) body.jobTitle = params.title;
      if (params.location) body.location = params.location;
      if (params.industry) body.industry = params.industry;
      if (params.school) body.school = params.school;
      const res = await apiRequest("POST", "/api/research/people/search", body);
      const result = await res.json();
      if (result.success) {
        setPersonSearchResults(result.data || []);
        if (result.data?.length === 0) {
          toast({ title: "No Results", description: "No people matched your search criteria." });
        }
      } else {
        toast({ title: "Search Error", description: result.message || "Search failed", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Search Failed", description: error.message || "Failed to search", variant: "destructive" });
    } finally {
      setPersonSearchLoading(false);
    }
  };

  const handlePersonSearch = () => {
    if (!personSearchCompany && !personSearchTitle && !personSearchLocation && !personSearchIndustry && !personSearchSchool) {
      toast({ title: "Please fill in at least one field", variant: "destructive" });
      return;
    }
    runPersonSearch({
      company: personSearchCompany,
      title: personSearchTitle,
      location: personSearchLocation,
      industry: personSearchIndustry,
      school: personSearchSchool,
    });
  };

  const handlePresetSearch = (preset: typeof PEOPLE_PRESETS[0]) => {
    setPersonSearchCompany(preset.company);
    setPersonSearchTitle(preset.title);
    setPersonSearchLocation(preset.location);
    setPersonSearchIndustry(preset.industry);
    setPersonSearchSchool(preset.school);
    runPersonSearch({
      company: preset.company,
      title: preset.title,
      location: preset.location,
      industry: preset.industry,
      school: preset.school,
    });
  };

  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [orgSearchType, setOrgSearchType] = useState<"name" | "website">("name");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedOrg, setSelectedOrg] = useState<PoliticalOrganization | null>(null);
  const [enrichResult, setEnrichResult] = useState<CompanyEnrichResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [peopleResults, setPeopleResults] = useState<PersonResult[]>([]);
  const [isPeopleLoading, setIsPeopleLoading] = useState(false);
  const [isAiResearching, setIsAiResearching] = useState(false);
  const [orgActiveTab, setOrgActiveTab] = useState("tracked");

  const { data: organizations = [], isLoading: orgsLoading } = useQuery<PoliticalOrganization[]>({
    queryKey: ["/api/organizations"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/organizations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      if (selectedOrg) setSelectedOrg(null);
      toast({ title: "Organization removed from tracking" });
    },
  });

  const handleOrgSearch = async () => {
    if (!orgSearchQuery.trim()) return;
    setIsSearching(true);
    setEnrichResult(null);
    try {
      const body: any = { saveToTracked: false };
      if (orgSearchType === "website") {
        body.website = orgSearchQuery.trim();
      } else {
        body.name = orgSearchQuery.trim();
      }
      const res = await apiRequest("POST", "/api/organizations/enrich", body);
      const data = await res.json();
      if (data.success && data.data) {
        setEnrichResult(data.data);
        setOrgActiveTab("search");
      } else {
        toast({ title: "Not found", description: "Organization not found. Try a different name or website.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleTrackOrg = async () => {
    if (!enrichResult) return;
    try {
      const body: any = { saveToTracked: true, name: enrichResult.name };
      if (enrichResult.website) body.website = enrichResult.website;
      if (enrichResult.linkedinUrl) body.linkedinUrl = enrichResult.linkedinUrl;
      const res = await apiRequest("POST", "/api/organizations/enrich", body);
      const data = await res.json();
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
        setEnrichResult(null);
        setOrgSearchQuery("");
        setOrgActiveTab("tracked");
        toast({ title: "Organization tracked", description: `${enrichResult.name} added to your tracked organizations` });
      }
    } catch (error: any) {
      toast({ title: "Failed to track", description: error.message, variant: "destructive" });
    }
  };

  const handleFindPeople = async (orgId: string) => {
    setIsPeopleLoading(true);
    setPeopleResults([]);
    try {
      const res = await apiRequest("POST", `/api/organizations/${orgId}/people`, { limit: 25 });
      const data = await res.json();
      if (data.success) {
        setPeopleResults(data.data || []);
      }
    } catch (error: any) {
      toast({ title: "People search failed", description: error.message, variant: "destructive" });
    } finally {
      setIsPeopleLoading(false);
    }
  };

  const handleAiResearch = async (orgId: string) => {
    setIsAiResearching(true);
    try {
      const res = await apiRequest("POST", `/api/organizations/${orgId}/ai-research`);
      const data = await res.json();
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
        setSelectedOrg(prev => prev ? { ...prev, aiSummary: data.summary, aiSources: data.sources } : null);
        toast({ title: "AI Research complete", description: "Intelligence report generated" });
      }
    } catch (error: any) {
      toast({ title: "Research failed", description: error.message, variant: "destructive" });
    } finally {
      setIsAiResearching(false);
    }
  };

  const filteredOrgs = organizations.filter(org => {
    if (filterType === "all") return true;
    if (filterType === "lobbying") return org.isLobbyingFirm;
    if (filterType === "pac") return org.isPAC;
    if (filterType === "think_tank") return org.isThinkTank;
    if (filterType === "government") return org.isGovernmentAgency;
    if (filterType === "political") return org.isPoliticalOrg;
    if (filterType === "campaign") return org.isCampaign;
    return true;
  });

  const orgCounts = {
    total: organizations.length,
    lobbying: organizations.filter(o => o.isLobbyingFirm).length,
    pac: organizations.filter(o => o.isPAC).length,
    thinkTank: organizations.filter(o => o.isThinkTank).length,
    government: organizations.filter(o => o.isGovernmentAgency).length,
  };

  return (
    <div className="flex flex-col h-full" data-testid="power-search-page">
      <div className="p-4 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5" />
          <h1 className="text-lg font-semibold" data-testid="text-page-title">Power Search</h1>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList>
            <TabsTrigger value="people" data-testid="tab-people-search">
              <UserSearch className="h-4 w-4 mr-1.5" />
              People
            </TabsTrigger>
            <TabsTrigger value="organizations" data-testid="tab-organizations">
              <Building2 className="h-4 w-4 mr-1.5" />
              Organizations
              {organizations.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px]">{organizations.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden">
        {mainTab === "people" && (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-5">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Search millions of professional profiles by company, title, location, industry, or school.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {PEOPLE_PRESETS.map((preset) => (
                        <Button
                          key={preset.label}
                          variant="outline"
                          size="sm"
                          disabled={personSearchLoading}
                          onClick={() => handlePresetSearch(preset)}
                          data-testid={`button-preset-${preset.label.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Company</Label>
                      <Input
                        placeholder="e.g. Akin Gump"
                        value={personSearchCompany}
                        onChange={(e) => setPersonSearchCompany(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePersonSearch()}
                        data-testid="input-person-search-company"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Job Title</Label>
                      <Input
                        placeholder="e.g. Lobbyist"
                        value={personSearchTitle}
                        onChange={(e) => setPersonSearchTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePersonSearch()}
                        data-testid="input-person-search-title"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Location</Label>
                      <Input
                        placeholder="e.g. Washington DC"
                        value={personSearchLocation}
                        onChange={(e) => setPersonSearchLocation(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePersonSearch()}
                        data-testid="input-person-search-location"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Industry</Label>
                      <Input
                        placeholder="e.g. Government"
                        value={personSearchIndustry}
                        onChange={(e) => setPersonSearchIndustry(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePersonSearch()}
                        data-testid="input-person-search-industry"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">School</Label>
                      <Input
                        placeholder="e.g. Georgetown"
                        value={personSearchSchool}
                        onChange={(e) => setPersonSearchSchool(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePersonSearch()}
                        data-testid="input-person-search-school"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {(personSearchCompany || personSearchTitle || personSearchLocation || personSearchIndustry || personSearchSchool) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPersonSearchCompany("");
                            setPersonSearchTitle("");
                            setPersonSearchLocation("");
                            setPersonSearchIndustry("");
                            setPersonSearchSchool("");
                          }}
                          data-testid="button-clear-fields"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Clear Fields
                        </Button>
                      )}
                    </div>
                    <Button
                      onClick={handlePersonSearch}
                      disabled={personSearchLoading}
                      data-testid="button-run-person-search"
                    >
                      {personSearchLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      {personSearchLoading ? "Searching..." : "Search People"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {personSearchLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {Array(6).fill(0).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!personSearchLoading && personSearchResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{personSearchResults.length} results found</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPersonSearchResults([])}
                      data-testid="button-clear-person-results"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Clear Results
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {personSearchResults.map((person, idx) => (
                      <Card
                        key={person.id || idx}
                        className="hover-elevate"
                        data-testid={`person-result-${idx}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10 shrink-0">
                              {person.profilePicUrl && (
                                <AvatarImage src={person.profilePicUrl} alt={person.fullName} />
                              )}
                              <AvatarFallback className="text-xs">
                                {person.firstName?.[0] || ''}{person.lastName?.[0] || ''}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{person.fullName}</p>
                                  {person.jobTitle && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {person.jobTitle}
                                      {person.jobCompany && ` at ${person.jobCompany}`}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {person.linkedinUrl && (
                                    <a
                                      href={person.linkedinUrl.startsWith('http') ? person.linkedinUrl : `https://${person.linkedinUrl}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      data-testid={`link-linkedin-${idx}`}
                                    >
                                      <Button variant="ghost" size="icon">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </Button>
                                    </a>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openContactDialog(person)}
                                    data-testid={`button-add-person-contact-${idx}`}
                                  >
                                    <UserPlus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              {person.location && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{person.location}</span>
                                </p>
                              )}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {person.industry && (
                                  <Badge variant="secondary" className="text-[10px]">{person.industry}</Badge>
                                )}
                                {person.skills?.slice(0, 3).map((skill, sIdx) => (
                                  <Badge key={sIdx} variant="outline" className="text-[10px]">{skill}</Badge>
                                ))}
                                {person.skills && person.skills.length > 3 && (
                                  <Badge variant="outline" className="text-[10px]">+{person.skills.length - 3} more</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {mainTab === "organizations" && (
          <div className="flex-1 overflow-hidden flex h-full">
            <div className="w-full flex flex-col lg:flex-row h-full">
              <div className="lg:w-[400px] border-r flex flex-col">
                <div className="p-3 border-b space-y-3">
                  <div className="flex gap-2">
                    <Select value={orgSearchType} onValueChange={(v: "name" | "website") => setOrgSearchType(v)}>
                      <SelectTrigger className="w-[110px]" data-testid="select-search-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={orgSearchType === "name" ? "Search organization..." : "Enter website URL..."}
                      value={orgSearchQuery}
                      onChange={(e) => setOrgSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleOrgSearch()}
                      data-testid="input-org-search"
                    />
                    <Button onClick={handleOrgSearch} disabled={isSearching || !orgSearchQuery.trim()} size="icon" data-testid="button-search-org">
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>

                  <Tabs value={orgActiveTab} onValueChange={setOrgActiveTab}>
                    <TabsList className="w-full">
                      <TabsTrigger value="tracked" className="flex-1" data-testid="tab-tracked">Tracked ({filteredOrgs.length})</TabsTrigger>
                      <TabsTrigger value="search" className="flex-1" data-testid="tab-search">Search Results</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {orgActiveTab === "tracked" && (
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger data-testid="select-org-filter">
                        <SelectValue placeholder="Filter by type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Organizations ({orgCounts.total})</SelectItem>
                        <SelectItem value="lobbying">Lobbying Firms ({orgCounts.lobbying})</SelectItem>
                        <SelectItem value="pac">PACs ({orgCounts.pac})</SelectItem>
                        <SelectItem value="think_tank">Think Tanks ({orgCounts.thinkTank})</SelectItem>
                        <SelectItem value="government">Government ({orgCounts.government})</SelectItem>
                        <SelectItem value="political">Political Orgs</SelectItem>
                        <SelectItem value="campaign">Campaigns</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <ScrollArea className="flex-1">
                  {orgActiveTab === "tracked" ? (
                    <div className="p-2 space-y-1">
                      {orgsLoading ? (
                        Array(5).fill(0).map((_, i) => (
                          <div key={i} className="p-3 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        ))
                      ) : filteredOrgs.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground">
                          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm font-medium">No organizations tracked</p>
                          <p className="text-xs mt-1">Search above to enrich and track organizations</p>
                        </div>
                      ) : (
                        filteredOrgs.map(org => (
                          <div
                            key={org.id}
                            className={`p-3 rounded-md cursor-pointer hover-elevate ${selectedOrg?.id === org.id ? "bg-accent" : ""}`}
                            onClick={() => {
                              setSelectedOrg(org);
                              setPeopleResults([]);
                            }}
                            data-testid={`card-org-${org.id}`}
                          >
                            <div className="flex items-start gap-2">
                              <Avatar className="h-8 w-8 mt-0.5">
                                <AvatarFallback className="text-xs">
                                  {getOrgTypeIcon(org)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" data-testid={`text-org-name-${org.id}`}>{org.name}</p>
                                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                  {getOrgTypeBadge(org)}
                                  {org.pdlEnriched && <Badge variant="outline" className="text-[10px]">PDL</Badge>}
                                </div>
                                {org.headquartersCity && (
                                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {org.headquartersCity}{org.headquartersState ? `, ${org.headquartersState}` : ""}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="p-3">
                      {enrichResult ? (
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <CardTitle className="text-base" data-testid="text-enrich-name">{enrichResult.name}</CardTitle>
                              <Button size="sm" onClick={handleTrackOrg} data-testid="button-track-org">
                                <Plus className="h-3 w-3 mr-1" /> Track
                              </Button>
                            </div>
                            {enrichResult.description && (
                              <CardDescription className="text-xs">{enrichResult.description}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex flex-wrap gap-1">
                              {getClassificationBadges(enrichResult.politicalClassification)}
                              {enrichResult.industry && <Badge variant="outline">{enrichResult.industry}</Badge>}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {enrichResult.website && (
                                <div className="flex items-center gap-1">
                                  <Globe className="h-3 w-3 text-muted-foreground" />
                                  <a href={enrichResult.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate" data-testid="link-enrich-website">
                                    {enrichResult.website.replace(/^https?:\/\//, "")}
                                  </a>
                                </div>
                              )}
                              {enrichResult.headquarters && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  <span>{enrichResult.headquarters.city}{enrichResult.headquarters.state ? `, ${enrichResult.headquarters.state}` : ""}</span>
                                </div>
                              )}
                              {enrichResult.employeeCount && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3 text-muted-foreground" />
                                  <span>{enrichResult.employeeCount.toLocaleString()} employees</span>
                                </div>
                              )}
                              {enrichResult.founded && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span>Founded {enrichResult.founded}</span>
                                </div>
                              )}
                            </div>
                            {enrichResult.tags && enrichResult.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {enrichResult.tags.slice(0, 8).map(tag => (
                                  <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="p-6 text-center text-muted-foreground">
                          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm font-medium">Search for an organization</p>
                          <p className="text-xs mt-1">Enter a name or website to look up and enrich</p>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="flex-1 overflow-hidden">
                {selectedOrg ? (
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-semibold" data-testid="text-detail-name">{selectedOrg.name}</h2>
                            {getOrgTypeBadge(selectedOrg)}
                            {selectedOrg.pdlEnriched && <Badge variant="outline">PDL Enriched</Badge>}
                          </div>
                          {selectedOrg.description && (
                            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{selectedOrg.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFindPeople(selectedOrg.id)}
                            disabled={isPeopleLoading}
                            data-testid="button-find-people"
                          >
                            {isPeopleLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserSearch className="h-4 w-4 mr-1" />}
                            Find People
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAiResearch(selectedOrg.id)}
                            disabled={isAiResearching}
                            data-testid="button-ai-research"
                          >
                            {isAiResearching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Brain className="h-4 w-4 mr-1" />}
                            AI Research
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Remove this organization from tracking?")) {
                                deleteMutation.mutate(selectedOrg.id);
                              }
                            }}
                            data-testid="button-delete-org"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {selectedOrg.industry && (
                          <Card>
                            <CardContent className="p-3">
                              <p className="text-xs text-muted-foreground">Industry</p>
                              <p className="text-sm font-medium" data-testid="text-industry">{selectedOrg.industry}</p>
                            </CardContent>
                          </Card>
                        )}
                        {selectedOrg.employeeCount && (
                          <Card>
                            <CardContent className="p-3">
                              <p className="text-xs text-muted-foreground">Employees</p>
                              <p className="text-sm font-medium" data-testid="text-employees">{selectedOrg.employeeCount.toLocaleString()}</p>
                            </CardContent>
                          </Card>
                        )}
                        {(selectedOrg.headquartersCity || selectedOrg.headquartersState) && (
                          <Card>
                            <CardContent className="p-3">
                              <p className="text-xs text-muted-foreground">Headquarters</p>
                              <p className="text-sm font-medium" data-testid="text-hq">
                                {selectedOrg.headquartersCity}{selectedOrg.headquartersState ? `, ${selectedOrg.headquartersState}` : ""}
                              </p>
                            </CardContent>
                          </Card>
                        )}
                        {selectedOrg.founded && (
                          <Card>
                            <CardContent className="p-3">
                              <p className="text-xs text-muted-foreground">Founded</p>
                              <p className="text-sm font-medium" data-testid="text-founded">{selectedOrg.founded}</p>
                            </CardContent>
                          </Card>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {selectedOrg.website && (
                          <a href={selectedOrg.website.startsWith("http") ? selectedOrg.website : `https://${selectedOrg.website}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" data-testid="link-website">
                              <Globe className="h-3 w-3 mr-1" /> Website
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </a>
                        )}
                        {selectedOrg.linkedinUrl && (
                          <a href={selectedOrg.linkedinUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" data-testid="link-linkedin">
                              <Briefcase className="h-3 w-3 mr-1" /> LinkedIn
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </a>
                        )}
                      </div>

                      {selectedOrg.tags && selectedOrg.tags.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Tags</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedOrg.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedOrg.aiSummary && (
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <Brain className="h-4 w-4" />
                              <CardTitle className="text-sm">AI Intelligence Report</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-ai-summary">{selectedOrg.aiSummary}</div>
                            {selectedOrg.aiSources && selectedOrg.aiSources.length > 0 && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Sources</p>
                                <div className="space-y-0.5">
                                  {selectedOrg.aiSources.map((src, i) => (
                                    <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block truncate" data-testid={`link-source-${i}`}>
                                      {src}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {(peopleResults.length > 0 || isPeopleLoading) && (
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <CardTitle className="text-sm">Key People ({peopleResults.length})</CardTitle>
                              </div>
                              {!isPeopleLoading && peopleResults.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => setPeopleResults([])} data-testid="button-clear-people">
                                  <X className="h-3 w-3 mr-1" /> Clear
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            {isPeopleLoading ? (
                              <div className="space-y-3">
                                {Array(3).fill(0).map((_, i) => (
                                  <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <div className="flex-1">
                                      <Skeleton className="h-4 w-3/4" />
                                      <Skeleton className="h-3 w-1/2 mt-1" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {peopleResults.map((person, idx) => (
                                  <div key={person.id || idx} className="flex items-start gap-3 p-2 rounded-md hover-elevate" data-testid={`org-person-${idx}`}>
                                    <Avatar className="h-8 w-8">
                                      {person.profilePicUrl && (
                                        <AvatarImage src={person.profilePicUrl} alt={person.fullName} />
                                      )}
                                      <AvatarFallback className="text-xs">
                                        {person.firstName?.[0] || ''}{person.lastName?.[0] || ''}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{person.fullName}</p>
                                      {person.jobTitle && (
                                        <p className="text-xs text-muted-foreground truncate">{person.jobTitle}</p>
                                      )}
                                      {person.location && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />{person.location}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      {person.linkedinUrl && (
                                        <a href={person.linkedinUrl.startsWith('http') ? person.linkedinUrl : `https://${person.linkedinUrl}`} target="_blank" rel="noopener noreferrer">
                                          <Button variant="ghost" size="icon">
                                            <ExternalLink className="h-3.5 w-3.5" />
                                          </Button>
                                        </a>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openContactDialog(person)}
                                        data-testid={`button-add-org-person-${idx}`}
                                      >
                                        <UserPlus className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">Select an organization</p>
                      <p className="text-sm mt-1">Search and track organizations, or select one from the list</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Save Contact
            </DialogTitle>
          </DialogHeader>
          {contactDialogPerson && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                <Avatar className="h-10 w-10">
                  {contactDialogPerson.profilePicUrl && (
                    <AvatarImage src={contactDialogPerson.profilePicUrl} alt={contactDialogPerson.fullName} />
                  )}
                  <AvatarFallback className="text-xs">
                    {contactDialogPerson.firstName?.[0]}{contactDialogPerson.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{contactDialogPerson.fullName}</p>
                  {contactDialogPerson.jobTitle && (
                    <p className="text-xs text-muted-foreground truncate">
                      {contactDialogPerson.jobTitle}
                      {contactDialogPerson.jobCompany && ` at ${contactDialogPerson.jobCompany}`}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Assign To</Label>
                <Select value={contactAssignType} onValueChange={(v) => setContactAssignType(v as "client" | "general" | "kb")}>
                  <SelectTrigger data-testid="select-contact-assign-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Contact</SelectItem>
                    <SelectItem value="client">Assign to Client</SelectItem>
                    <SelectItem value="kb">Assign to Knowledge Base</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {contactAssignType === "client" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Client</Label>
                  <Select value={contactClientId} onValueChange={setContactClientId}>
                    <SelectTrigger data-testid="select-contact-client">
                      <SelectValue placeholder="Select a client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientsList.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {contactAssignType === "kb" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Knowledge Base</Label>
                  <Select value={contactKbId} onValueChange={setContactKbId}>
                    <SelectTrigger data-testid="select-contact-kb">
                      <SelectValue placeholder="Select a KB..." />
                    </SelectTrigger>
                    <SelectContent>
                      {kbCategories.map((kb) => (
                        <SelectItem key={kb.id} value={kb.id}>
                          {kb.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!showNewKbInput ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewKbInput(true)}
                      data-testid="button-show-create-kb"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Create New KB
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="New KB name..."
                        value={newKbName}
                        onChange={(e) => setNewKbName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateKb()}
                        data-testid="input-new-kb-name"
                      />
                      <Button
                        size="sm"
                        onClick={handleCreateKb}
                        disabled={!newKbName.trim()}
                        data-testid="button-create-kb"
                      >
                        Create
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowNewKbInput(false); setNewKbName(""); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Notes (optional)</Label>
                <Textarea
                  placeholder="Add notes about this contact..."
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  className="resize-none"
                  rows={2}
                  data-testid="textarea-contact-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContactDialogOpen(false)} data-testid="button-cancel-contact">
              Cancel
            </Button>
            <Button
              onClick={handleSaveContact}
              disabled={contactSaving || (contactAssignType === "client" && !contactClientId)}
              data-testid="button-save-contact"
            >
              {contactSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Save Contact
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

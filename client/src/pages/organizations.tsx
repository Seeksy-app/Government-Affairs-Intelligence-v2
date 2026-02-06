import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Search, Plus, Trash2, Globe, Users, MapPin,
  Loader2, ExternalLink, Briefcase, Brain, RefreshCw, Landmark,
  Scale, BookOpen, Flag, UserSearch, Calendar, Hash
} from "lucide-react";
import type { PoliticalOrganization } from "@shared/schema";

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

export default function OrganizationsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"name" | "website">("name");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedOrg, setSelectedOrg] = useState<PoliticalOrganization | null>(null);
  const [enrichResult, setEnrichResult] = useState<CompanyEnrichResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [peopleResults, setPeopleResults] = useState<PersonResult[]>([]);
  const [isPeopleLoading, setIsPeopleLoading] = useState(false);
  const [isAiResearching, setIsAiResearching] = useState(false);
  const [activeTab, setActiveTab] = useState("tracked");

  const { data: organizations = [], isLoading } = useQuery<PoliticalOrganization[]>({
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setEnrichResult(null);
    try {
      const body: any = { saveToTracked: false };
      if (searchType === "website") {
        body.website = searchQuery.trim();
      } else {
        body.name = searchQuery.trim();
      }
      const res = await apiRequest("POST", "/api/organizations/enrich", body);
      const data = await res.json();
      if (data.success && data.data) {
        setEnrichResult(data.data);
        setActiveTab("search");
      } else {
        toast({ title: "Not found", description: "Organization not found in the database. Try a different name or website.", variant: "destructive" });
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
        setSearchQuery("");
        setActiveTab("tracked");
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
    <div className="flex flex-col h-full" data-testid="organizations-page">
      <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <h1 className="text-lg font-semibold" data-testid="text-page-title">Organizations</h1>
          <Badge variant="outline" data-testid="badge-org-count">{organizations.length} tracked</Badge>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="w-full flex flex-col lg:flex-row">
          <div className="lg:w-[420px] border-r flex flex-col">
            <div className="p-3 border-b space-y-3">
              <div className="flex gap-2">
                <Select value={searchType} onValueChange={(v: "name" | "website") => setSearchType(v)}>
                  <SelectTrigger className="w-[110px]" data-testid="select-search-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={searchType === "name" ? "Search organization name..." : "Enter website URL..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  data-testid="input-org-search"
                />
                <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()} data-testid="button-search-org">
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="tracked" className="flex-1" data-testid="tab-tracked">Tracked ({filteredOrgs.length})</TabsTrigger>
                  <TabsTrigger value="search" className="flex-1" data-testid="tab-search">Search Results</TabsTrigger>
                </TabsList>
              </Tabs>

              {activeTab === "tracked" && (
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
              {activeTab === "tracked" ? (
                <div className="p-2 space-y-1">
                  {isLoading ? (
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
                      <p className="text-xs mt-1">Search for an organization above to enrich and track it</p>
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
                      <p className="text-xs mt-1">Enter a company name or website to look up and enrich with People Data Labs</p>
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
                            <CardTitle className="text-sm">Key People</CardTitle>
                            {peopleResults.length > 0 && <Badge variant="outline">{peopleResults.length} found</Badge>}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleFindPeople(selectedOrg.id)} disabled={isPeopleLoading} data-testid="button-refresh-people">
                            <RefreshCw className={`h-3 w-3 ${isPeopleLoading ? "animate-spin" : ""}`} />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isPeopleLoading ? (
                          <div className="space-y-2">
                            {Array(5).fill(0).map((_, i) => (
                              <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <div className="space-y-1 flex-1">
                                  <Skeleton className="h-3 w-32" />
                                  <Skeleton className="h-3 w-48" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {peopleResults.map((person, idx) => (
                              <div key={idx} className="flex items-center gap-3 p-2 rounded-md hover-elevate" data-testid={`card-person-${idx}`}>
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs">
                                    {person.firstName?.[0] || ""}{person.lastName?.[0] || ""}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium truncate" data-testid={`text-person-name-${idx}`}>{person.fullName}</p>
                                    {person.linkedinUrl && (
                                      <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-person-linkedin-${idx}`}>
                                        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                      </a>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {person.jobTitle}{person.jobCompany ? ` at ${person.jobCompany}` : ""}
                                  </p>
                                  {person.location && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <MapPin className="h-3 w-3" /> {person.location}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    window.location.href = `/contacts?add=true&firstName=${encodeURIComponent(person.firstName || "")}&lastName=${encodeURIComponent(person.lastName || "")}&title=${encodeURIComponent(person.jobTitle || "")}&organization=${encodeURIComponent(person.jobCompany || selectedOrg.name)}`;
                                  }}
                                  data-testid={`button-add-contact-${idx}`}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
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
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Select an organization</p>
                  <p className="text-sm mt-1">Search and enrich organizations using People Data Labs</p>
                  <p className="text-xs mt-2 max-w-sm mx-auto">Track lobbying firms, PACs, think tanks, and other political organizations with enriched data and AI-powered intelligence</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

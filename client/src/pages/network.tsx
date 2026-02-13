import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Network, Users, Building2, ArrowRight, Search, X, Landmark, Phone, Globe, MapPin, FileText, ExternalLink, Mail, Calendar, UserSearch, Loader2, UserPlus, Map, Star, Briefcase, RefreshCw, AlertTriangle, ChevronUp, ChevronDown, Shield, Award, BookOpen } from "lucide-react";
import { LegistormDirectory } from "@/components/legistorm-directory";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Contact, CareerHistory, Matter, FavoriteCongressMember, Customer, ClientPortal, VeteranCongressMember, LegistormStaffer } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StafferProfileDialog } from "@/components/staffer-profile-dialog";
import { ErrorBoundary } from "@/components/error-boundary";

function renderInlineMarkdown(text: string) {
  const parts = text.replace(/\[\d+\]/g, "").split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function renderMarkdownBlock(content: string) {
  const normalized = content.replace(/\\n/g, "\n");
  return normalized.split(/\n{2,}/).map((block, bIdx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("# ")) {
      return <h2 key={bIdx} className="font-bold text-base mt-3 first:mt-0 text-foreground">{renderInlineMarkdown(trimmed.replace(/^#\s*/, ""))}</h2>;
    }
    if (trimmed.startsWith("## ")) {
      return <h3 key={bIdx} className="font-semibold text-base mt-3 first:mt-0 text-foreground">{renderInlineMarkdown(trimmed.replace(/^##\s*/, ""))}</h3>;
    }
    if (trimmed.startsWith("### ")) {
      return <h4 key={bIdx} className="font-semibold text-sm mt-2 first:mt-0 text-foreground">{renderInlineMarkdown(trimmed.replace(/^###\s*/, ""))}</h4>;
    }
    const lines = trimmed.split("\n");
    const isList = lines.every(l => /^\s*[-*]\s/.test(l) || !l.trim());
    if (isList) {
      return (
        <ul key={bIdx} className="space-y-1 pl-1">
          {lines.filter(l => l.trim()).map((line, lIdx) => (
            <li key={lIdx} className="flex gap-2 text-muted-foreground leading-relaxed">
              <span className="text-muted-foreground/60 mt-0.5 shrink-0">-</span>
              <span>{renderInlineMarkdown(line.replace(/^\s*[-*]\s*/, ""))}</span>
            </li>
          ))}
        </ul>
      );
    }
    const singleLines = trimmed.split("\n");
    if (singleLines.length > 1) {
      return (
        <div key={bIdx} className="space-y-1">
          {singleLines.map((line, lIdx) => {
            const l = line.trim();
            if (!l) return null;
            if (l.startsWith("### ")) return <h4 key={lIdx} className="font-semibold text-sm mt-2 text-foreground">{renderInlineMarkdown(l.replace(/^###\s*/, ""))}</h4>;
            if (l.startsWith("## ")) return <h3 key={lIdx} className="font-semibold text-base mt-2 text-foreground">{renderInlineMarkdown(l.replace(/^##\s*/, ""))}</h3>;
            if (/^\s*[-*]\s/.test(l)) {
              return (
                <div key={lIdx} className="flex gap-2 text-muted-foreground leading-relaxed pl-1">
                  <span className="text-muted-foreground/60 mt-0.5 shrink-0">-</span>
                  <span>{renderInlineMarkdown(l.replace(/^\s*[-*]\s*/, ""))}</span>
                </div>
              );
            }
            return <p key={lIdx} className="text-muted-foreground leading-relaxed">{renderInlineMarkdown(l)}</p>;
          })}
        </div>
      );
    }
    return <p key={bIdx} className="text-muted-foreground leading-relaxed">{renderInlineMarkdown(trimmed)}</p>;
  });
}

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
  phone?: string;
  office?: string;
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
    
    // Phone line: "- Phone: (202) 225-4000"
    const phoneMatch = trimmed.match(/^-\s*(?:\*\*)?Phone(?:\*\*)?:\s*(.+)$/i);
    if (phoneMatch) {
      currentStaffer.phone = phoneMatch[1].trim();
      continue;
    }
    
    // Office line: "- Office: Johnson, Mike"
    const officeMatch = trimmed.match(/^-\s*(?:\*\*)?Office(?:\*\*)?:\s*(.+)$/i);
    if (officeMatch) {
      currentStaffer.office = officeMatch[1].trim();
      continue;
    }
    
    // Title line (skip if we already have role): "- Title: Chief of Staff"
    const titleMatch = trimmed.match(/^-\s*Title:\s*(.+)$/i);
    if (titleMatch) {
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

interface VeteranMemberRecord {
  id: string;
  bioguideId: string;
  memberName: string;
  chamber: string | null;
  state: string | null;
  party: string | null;
  isVeteran: boolean;
  serviceBranch: string | null;
  serviceDetails: string | null;
  yearsOfService: string | null;
  rank: string | null;
  source: string | null;
  confidence: string | null;
  researchedAt: string | null;
}


function VeteransSearch() {
  const { toast } = useToast();
  const [veteranMemberSearch, setVeteranMemberSearch] = useState("");
  const [veteranChamberFilter, setVeteranChamberFilter] = useState("all");
  const [researchingMembers, setResearchingMembers] = useState(false);
  const [researchProgress, setResearchProgress] = useState({ done: 0, total: 0, veteransFound: 0 });
  const [selectedVeteran, setSelectedVeteran] = useState<VeteranMemberRecord | null>(null);
  const [memberResearchResult, setMemberResearchResult] = useState<string | null>(null);

  const { data: veteranMembers, isLoading: veteranMembersLoading } = useQuery<VeteranMemberRecord[]>({
    queryKey: ["/api/veterans/members"],
  });

  const { data: congressMembers } = useQuery<CongressMember[]>({
    queryKey: ["congress-members-all"],
    queryFn: async () => {
      const res = await fetch("/api/congress/members", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const researchBatch = async (members: { bioguideId: string; memberName: string; chamber: string; state: string; party: string }[]) => {
    const res = await apiRequest("POST", "/api/veterans/batch-research", { members });
    return res.json();
  };

  const handleBatchResearch = async () => {
    if (!congressMembers || congressMembers.length === 0) {
      toast({ title: "No members loaded", description: "Wait for congress members to load first", variant: "destructive" });
      return;
    }
    setResearchingMembers(true);

    try {
      const alreadyResearched = new Set(veteranMembers?.map(v => v.bioguideId) || []);
      let toResearch = congressMembers
        .filter(m => !alreadyResearched.has(m.bioguideId))
        .map(m => ({
          bioguideId: m.bioguideId,
          memberName: `${m.firstName} ${m.lastName}`,
          chamber: m.chamber,
          state: m.state,
          party: m.party,
        }));

      if (veteranChamberFilter !== "all") {
        toResearch = toResearch.filter(m => m.chamber.toLowerCase() === veteranChamberFilter.toLowerCase());
      }

      if (toResearch.length === 0) {
        toast({ title: "All members already researched", description: "No new members to research for veteran status" });
        return;
      }

      setResearchProgress({ done: 0, total: toResearch.length, veteransFound: 0 });
      let totalVeteransFound = 0;
      const batchSize = 20;

      for (let i = 0; i < toResearch.length; i += batchSize) {
        const batch = toResearch.slice(i, i + batchSize);
        try {
          const data = await researchBatch(batch);
          const batchVeterans = data.results?.filter((r: any) => r.isVeteran)?.length || 0;
          totalVeteransFound += batchVeterans;
          setResearchProgress({ done: Math.min(i + batchSize, toResearch.length), total: toResearch.length, veteransFound: totalVeteransFound });
          queryClient.invalidateQueries({ queryKey: ["/api/veterans/members"] });
        } catch (err: any) {
          console.error("Batch research error:", err);
          toast({ title: "Batch Error", description: `Error researching batch ${Math.floor(i/batchSize) + 1}: ${err.message}`, variant: "destructive" });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/veterans/members"] });
      toast({
        title: "Research Complete",
        description: `Researched ${toResearch.length} members. Found ${totalVeteransFound} veterans.`,
      });
    } finally {
      setResearchingMembers(false);
    }
  };

  const singleResearchMutation = useMutation({
    mutationFn: async (member: { bioguideId: string; memberName: string; chamber: string; state: string; party: string }) => {
      const res = await apiRequest("POST", "/api/veterans/research", member);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/veterans/members"] });
    },
    onError: (error: any) => {
      toast({ title: "Research Failed", description: error.message, variant: "destructive" });
    },
  });

  const memberEntityResearchMutation = useMutation({
    mutationFn: async (memberName: string) => {
      const res = await apiRequest("POST", "/api/research/entity", {
        entityName: memberName,
        entityType: "person",
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      const content = data?.data?.rawContent || data?.data?.content || data?.rawContent || data?.content || data?.summary || "";
      setMemberResearchResult(content || (typeof data === "string" ? data : "No research content available."));
    },
    onError: (error: Error) => {
      toast({ title: "Research failed", description: error.message, variant: "destructive" });
    },
  });

  const filteredVeterans = useMemo(() => {
    if (!veteranMembers) return [];
    let result = veteranMembers.filter(v => v.isVeteran);
    if (veteranChamberFilter !== "all") {
      result = result.filter(v => {
        const member = congressMembers?.find(m => m.bioguideId === v.bioguideId);
        const chamber = member?.chamber || v.chamber || "";
        return chamber.toLowerCase() === veteranChamberFilter.toLowerCase();
      });
    }
    if (veteranMemberSearch.trim()) {
      const q = veteranMemberSearch.toLowerCase();
      result = result.filter(v =>
        v.memberName.toLowerCase().includes(q) ||
        (v.serviceBranch && v.serviceBranch.toLowerCase().includes(q)) ||
        (v.rank && v.rank.toLowerCase().includes(q))
      );
    }
    return result;
  }, [veteranMembers, veteranMemberSearch, veteranChamberFilter, congressMembers]);

  const branchColors: Record<string, string> = {
    "army": "border-green-600 text-green-700 dark:text-green-400",
    "navy": "border-blue-700 text-blue-700 dark:text-blue-400",
    "marine": "border-red-700 text-red-700 dark:text-red-400",
    "marines": "border-red-700 text-red-700 dark:text-red-400",
    "marine corps": "border-red-700 text-red-700 dark:text-red-400",
    "air force": "border-sky-600 text-sky-700 dark:text-sky-400",
    "coast guard": "border-orange-600 text-orange-700 dark:text-orange-400",
    "space force": "border-indigo-600 text-indigo-700 dark:text-indigo-400",
    "national guard": "border-yellow-600 text-yellow-700 dark:text-yellow-400",
  };

  const getBranchColor = (branch: string | null) => {
    if (!branch) return "";
    const lower = branch.toLowerCase();
    for (const [key, cls] of Object.entries(branchColors)) {
      if (lower.includes(key)) return cls;
    }
    return "";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2" data-testid="text-veterans-title">
                <Shield className="h-5 w-5" />
                Veteran Members of Congress
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Find congressional leaders with military service backgrounds
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={veteranChamberFilter} onValueChange={setVeteranChamberFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-veteran-chamber">
                  <SelectValue placeholder="Chamber" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chambers</SelectItem>
                  <SelectItem value="house">House</SelectItem>
                  <SelectItem value="senate">Senate</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleBatchResearch}
                disabled={researchingMembers}
                data-testid="button-research-veterans"
              >
                {researchingMembers ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {researchProgress.total > 0 
                      ? `${researchProgress.done}/${researchProgress.total} (${researchProgress.veteransFound} found)`
                      : "Researching..."}
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Discover Veterans
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search veterans by name, branch, or rank..."
                value={veteranMemberSearch}
                onChange={(e) => setVeteranMemberSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-veterans"
              />
            </div>
          </div>

          {veteranMembersLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-4 rounded-lg border">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-24 mt-1" />
                  <Skeleton className="h-3 w-40 mt-1" />
                </div>
              ))}
            </div>
          ) : filteredVeterans.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-veteran-count">
                {filteredVeterans.length} veteran{filteredVeterans.length !== 1 ? "s" : ""} found
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVeterans.map((vet) => {
                  const member = congressMembers?.find(m => m.bioguideId === vet.bioguideId);
                  return (
                    <Card key={vet.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedVeteran(vet)} data-testid={`card-veteran-${vet.bioguideId}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {member?.imageUrl ? (
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={member.imageUrl} alt={vet.memberName} />
                              <AvatarFallback>{vet.memberName.split(' ').map(n => n[0]).join('').substring(0, 2)}</AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                              <Shield className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate" data-testid={`text-veteran-name-${vet.bioguideId}`}>{vet.memberName}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {vet.serviceBranch && (
                                <Badge variant="outline" className={`text-xs ${getBranchColor(vet.serviceBranch)}`} data-testid={`badge-branch-${vet.bioguideId}`}>
                                  <Shield className="h-3 w-3 mr-1" />
                                  {vet.serviceBranch}
                                </Badge>
                              )}
                              {vet.rank && (
                                <Badge variant="secondary" className="text-xs" data-testid={`badge-rank-${vet.bioguideId}`}>
                                  <Award className="h-3 w-3 mr-1" />
                                  {vet.rank}
                                </Badge>
                              )}
                            </div>
                            {vet.yearsOfService && (
                              <p className="text-xs text-muted-foreground mt-1">{vet.yearsOfService}</p>
                            )}
                            {vet.serviceDetails && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{vet.serviceDetails}</p>
                            )}
                            {(() => {
                              const p = member?.party || vet.party;
                              const s = member?.state || vet.state;
                              const ch = member?.chamber || vet.chamber;
                              return (p || s || ch) ? (
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {p && (
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${p === "R" ? "border-red-500 text-red-600 dark:text-red-400" : p === "D" ? "border-blue-500 text-blue-600 dark:text-blue-400" : ""}`}
                                    >
                                      {p === "R" ? "Republican" : p === "D" ? "Democrat" : "Independent"}
                                    </Badge>
                                  )}
                                  {s && <span className="text-xs text-muted-foreground">{s}{member?.district ? `-${member.district}` : ""}</span>}
                                  {ch && <span className="text-xs text-muted-foreground">{ch}</span>}
                                </div>
                              ) : null;
                            })()}
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className={`text-xs ${vet.confidence === 'high' ? 'border-green-500 text-green-600' : vet.confidence === 'medium' ? 'border-yellow-500 text-yellow-600' : 'border-gray-500 text-gray-500'}`}>
                                {vet.confidence} confidence
                              </Badge>
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {veteranMembers && veteranMembers.length > 0
                  ? "No veterans match your search"
                  : "No veteran data yet. Click \"Discover Veterans\" to research members of Congress for military service."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedVeteran} onOpenChange={(open) => { if (!open) { setSelectedVeteran(null); setMemberResearchResult(null); } }}>
        <SheetContent className="sm:max-w-[500px] overflow-y-auto">
          {selectedVeteran && (() => {
            const member = congressMembers?.find(m => m.bioguideId === selectedVeteran.bioguideId);
            const p = member?.party || selectedVeteran.party;
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-3">
                    {member?.imageUrl ? (
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={member.imageUrl} alt={selectedVeteran.memberName} />
                        <AvatarFallback>{selectedVeteran.memberName.split(' ').map(n => n[0]).join('').substring(0, 2)}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <Shield className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <span className="text-lg">{selectedVeteran.memberName}</span>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {p && (
                          <Badge variant="outline" className={`text-xs ${p === "R" ? "border-red-500 text-red-600 dark:text-red-400" : p === "D" ? "border-blue-500 text-blue-600 dark:text-blue-400" : ""}`}>
                            {p === "R" ? "Republican" : p === "D" ? "Democrat" : "Independent"}
                          </Badge>
                        )}
                        {(member?.state || selectedVeteran.state) && (
                          <span className="text-sm text-muted-foreground">{member?.state || selectedVeteran.state}{member?.district ? `-${member.district}` : ""}</span>
                        )}
                        {(member?.chamber || selectedVeteran.chamber) && (
                          <Badge variant="outline" className="text-xs">{member?.chamber || selectedVeteran.chamber}</Badge>
                        )}
                      </div>
                    </div>
                  </SheetTitle>
                  <SheetDescription>Veteran Military Service Details</SheetDescription>
                </SheetHeader>
                <div className="space-y-4 mt-6">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Military Service
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedVeteran.serviceBranch && (
                        <div>
                          <p className="text-xs text-muted-foreground">Branch</p>
                          <Badge variant="outline" className={`mt-1 ${getBranchColor(selectedVeteran.serviceBranch)}`}>
                            <Shield className="h-3 w-3 mr-1" />
                            {selectedVeteran.serviceBranch}
                          </Badge>
                        </div>
                      )}
                      {selectedVeteran.rank && (
                        <div>
                          <p className="text-xs text-muted-foreground">Rank</p>
                          <Badge variant="secondary" className="mt-1">
                            <Award className="h-3 w-3 mr-1" />
                            {selectedVeteran.rank}
                          </Badge>
                        </div>
                      )}
                      {selectedVeteran.yearsOfService && (
                        <div>
                          <p className="text-xs text-muted-foreground">Years of Service</p>
                          <p className="text-sm mt-1">{selectedVeteran.yearsOfService}</p>
                        </div>
                      )}
                      {selectedVeteran.confidence && (
                        <div>
                          <p className="text-xs text-muted-foreground">Confidence</p>
                          <Badge variant="outline" className={`mt-1 text-xs ${selectedVeteran.confidence === 'high' ? 'border-green-500 text-green-600' : selectedVeteran.confidence === 'medium' ? 'border-yellow-500 text-yellow-600' : 'border-gray-500'}`}>
                            {selectedVeteran.confidence}
                          </Badge>
                        </div>
                      )}
                    </div>
                    {selectedVeteran.serviceDetails && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Service Details</p>
                        <p className="text-sm leading-relaxed">{selectedVeteran.serviceDetails}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {member && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Landmark className="h-4 w-4" />
                        Congressional Info
                      </h4>
                      {member.officeAddress && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{member.officeAddress}</span>
                        </div>
                      )}
                      {member.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${member.phone}`} className="text-sm hover:text-primary">{member.phone}</a>
                        </div>
                      )}
                      {member.website && (
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <a href={member.website} target="_blank" rel="noopener noreferrer" className="text-sm hover:text-primary truncate">{member.website}</a>
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      AI Research
                    </h4>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => memberEntityResearchMutation.mutate(selectedVeteran.memberName)}
                      disabled={memberEntityResearchMutation.isPending}
                      data-testid="button-research-veteran-member"
                    >
                      {memberEntityResearchMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Researching...</>
                      ) : (
                        <><Search className="h-4 w-4 mr-2" /> Research {selectedVeteran.memberName}</>
                      )}
                    </Button>
                    {memberResearchResult && (
                      <div className="p-4 rounded-md bg-muted/50 text-sm max-h-[300px] overflow-y-auto space-y-2">
                        {renderMarkdownBlock(memberResearchResult)}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {selectedVeteran.researchedAt && (
                    <p className="text-xs text-muted-foreground">
                      Researched: {new Date(selectedVeteran.researchedAt).toLocaleDateString()}
                    </p>
                  )}

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      singleResearchMutation.mutate({
                        bioguideId: selectedVeteran.bioguideId,
                        memberName: selectedVeteran.memberName,
                        chamber: member?.chamber || selectedVeteran.chamber || "",
                        state: member?.state || selectedVeteran.state || "",
                        party: member?.party || selectedVeteran.party || "",
                      });
                    }}
                    disabled={singleResearchMutation.isPending}
                    data-testid="button-re-research-veteran"
                  >
                    {singleResearchMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Re-researching...</>
                    ) : (
                      <><RefreshCw className="h-4 w-4 mr-2" /> Re-research Veteran Status</>
                    )}
                  </Button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

    </div>
  );
}

export default function NetworkPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("network");
  
  // Congress Member filters
  const [memberSearch, setMemberSearch] = useState("");
  const [chamberFilter, setChamberFilter] = useState<string>("all");
  const [partyFilter, setPartyFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [showMemberSearch, setShowMemberSearch] = useState(true);
  

  // Staffer lookup - initialize from localStorage based on saved member
  const [stafferInfo, setStafferInfo] = useState<string | null>(() => {
    try {
      const savedMember = localStorage.getItem('network_selectedMember');
      if (savedMember) {
        const member = JSON.parse(savedMember);
        if (member?.bioguideId) {
          return localStorage.getItem(`network_stafferInfo_${member.bioguideId}`) || null;
        }
      }
      return null;
    } catch {
      return null;
    }
  });
  const [stafferLoading, setStafferLoading] = useState(false);
  const [showNetworkDialog, setShowNetworkDialog] = useState(false);
  const [networkDialogData, setNetworkDialogData] = useState<{
    memberName: string;
    memberTitle?: string;
    memberParty?: string;
    memberState?: string;
    staffers: { 
      id: number; 
      name: string; 
      title: string; 
      email?: string; 
      pathwayType?: string; 
      yearsInCurrentRole?: number;
      careerHistory?: { title: string; organization: string; startYear?: number; endYear?: number; memberServed?: string }[];
      previousMembers?: string[];
      policyAreas?: string[];
    }[];
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

  // Customer portal assignments (many-to-many)
  interface CustomerPortalAssignment {
    id: string;
    customerId: string;
    portalId: string;
    assignedAt: string;
  }

  // Helper to get all portal assignments for a customer
  const getCustomerPortalAssignments = (customerId: string): CustomerPortalAssignment[] => {
    // For now, we'll use the portalId from the customer record as a single assignment
    // TODO: Fetch from the many-to-many table when we have the query
    return [];
  };

  // Helper to get portal names for a customer's assignments
  const getAssignedPortalNames = (customerId: string): { id: string; name: string }[] => {
    const customer = customersList?.find(c => c.id === customerId);
    if (!customer?.portalId || !portals) return [];
    const portal = portals.find(p => p.id === customer.portalId);
    return portal ? [{ id: portal.id, name: portal.name }] : [];
  };

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

  // Multi-assignment mutations for customer portal assignments
  const addPortalAssignmentMutation = useMutation({
    mutationFn: async ({ customerId, portalId }: { customerId: string; portalId: string }) => {
      return apiRequest("POST", "/api/customer-portal-assignments", { customerId, portalId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-portal-assignments"] });
      toast({ title: "Added to client" });
    },
    onError: (error: Error) => {
      if (error.message.includes("already")) {
        toast({ title: "Already assigned", description: "Already assigned to this client" });
      } else {
        toast({ title: "Failed to add", description: error.message, variant: "destructive" });
      }
    },
  });

  const removePortalAssignmentMutation = useMutation({
    mutationFn: async ({ customerId, portalId }: { customerId: string; portalId: string }) => {
      return apiRequest("DELETE", `/api/customer-portal-assignments/${customerId}/${portalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-portal-assignments"] });
      toast({ title: "Removed from client" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
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
      const directoryRes = await fetch(
        `/api/congress/staff-directory/lookup?lastName=${encodeURIComponent(member.lastName)}&firstName=${encodeURIComponent(member.firstName)}&state=${encodeURIComponent(member.state)}`,
        { credentials: 'include' }
      );
      
      if (directoryRes.ok) {
        const directoryData = await directoryRes.json();
        if (directoryData.success && directoryData.staff && directoryData.staff.length > 0) {
          return { source: 'directory', staff: directoryData.staff };
        }
      }
      
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
      const data = await res.json();
      return { source: 'ai', response: data.response };
    },
    onSuccess: (data) => {
      if (data.source === 'directory') {
        const staffList = data.staff.map((s: any, idx: number) => {
          const phone = s.telephone ? `\n- Phone: ${s.telephone}` : '';
          const office = s.officeName ? `\n- Office: ${s.officeName}` : '';
          const nameParts = s.name?.split(' ').filter((p: string) => p && !p.match(/^(Jr\.?|Sr\.?|III|IV|II)$/i)).map((p: string) => p.replace(/[^a-zA-Z'-]/g, '')) || [];
          const firstName = nameParts[0]?.toLowerCase() || '';
          const lastName = nameParts[nameParts.length - 1]?.toLowerCase() || '';
          const email = firstName && lastName && firstName !== lastName
            ? `\n- Email: ${firstName}.${lastName}@mail.house.gov`
            : '';
          return `${idx + 1}. ${s.jobTitle}:\n- Name: ${s.name}${email}${phone}${office}`;
        }).join('\n\n');
        const intro = `Official staff from the House Telephone Directory (directory.house.gov) - ${data.staff.length} staff members found:`;
        setStafferInfo(`${intro}\n\n${staffList}`);
      } else {
        setStafferInfo(data.response);
      }
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

  const handleShowNetworkMap = async (member: CongressMember, staffers: ParsedStaffer[]) => {
    if (staffers.length === 0) {
      toast({ title: "No staffers to map", description: "Find staffers first before viewing network", variant: "destructive" });
      return;
    }
    
    // Determine pathway type based on role (categorization only, not fabricated data)
    const getPathwayType = (role: string) => {
      if (role.toLowerCase().includes('chief') || role.toLowerCase().includes('director')) return 'executive';
      if (role.toLowerCase().includes('counsel') || role.toLowerCase().includes('legal')) return 'legal';
      if (role.toLowerCase().includes('policy') || role.toLowerCase().includes('legislative')) return 'legislative';
      if (role.toLowerCase().includes('press') || role.toLowerCase().includes('communications')) return 'communications';
      return 'administrative';
    };
    
    // Look up career history for staffers from contacts database
    let careerDataByName: Record<string, { careerHistory: any[]; policyAreas: string[] }> = {};
    try {
      const response = await fetch('/api/contacts/lookup-career', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ names: staffers.map(s => s.name) }),
      });
      if (response.ok) {
        careerDataByName = await response.json();
      }
    } catch (error) {
      console.log('Could not look up career data:', error);
    }
    
    // Map parsed staffers - enrich with career history if available
    setNetworkDialogData({
      memberName: `${member.firstName} ${member.lastName}`,
      memberTitle: member.chamber === "house" ? "Representative" : "Senator",
      memberParty: member.party,
      memberState: member.state,
      staffers: staffers.map((s, idx) => {
        const careerData = careerDataByName[s.name];
        return {
          id: idx + 1,
          name: s.name,
          title: s.role,
          email: s.email || undefined,
          pathwayType: getPathwayType(s.role),
          careerHistory: careerData?.careerHistory,
          policyAreas: careerData?.policyAreas,
        };
      })
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

  // Selected member for detail view - initialize from localStorage
  const [selectedMember, setSelectedMember] = useState<CongressMember | null>(() => {
    try {
      const saved = localStorage.getItem('network_selectedMember');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (!parsed || !parsed.bioguideId || !parsed.name) {
        localStorage.removeItem('network_selectedMember');
        return null;
      }
      return parsed;
    } catch {
      localStorage.removeItem('network_selectedMember');
      return null;
    }
  });
  
  // Persist selectedMember to localStorage
  useEffect(() => {
    if (selectedMember) {
      localStorage.setItem('network_selectedMember', JSON.stringify(selectedMember));
    } else {
      localStorage.removeItem('network_selectedMember');
    }
  }, [selectedMember]);
  
  // Persist stafferInfo to localStorage  
  useEffect(() => {
    if (stafferInfo && selectedMember) {
      localStorage.setItem(`network_stafferInfo_${selectedMember.bioguideId}`, stafferInfo);
    }
  }, [stafferInfo, selectedMember]);
  
  // Restore stafferInfo from localStorage when member is loaded
  useEffect(() => {
    if (selectedMember) {
      const savedStafferInfo = localStorage.getItem(`network_stafferInfo_${selectedMember.bioguideId}`);
      if (savedStafferInfo && !stafferInfo) {
        setStafferInfo(savedStafferInfo);
      }
    }
  }, [selectedMember?.bioguideId]);
  

  const handleSelectMember = (member: CongressMember | null) => {
    setSelectedMember(member);
    if (!member) {
      setStafferInfo(null);
      setStafferLoading(false);
      localStorage.removeItem('network_selectedMember');
    } else {
      const cachedStafferInfo = localStorage.getItem(`network_stafferInfo_${member.bioguideId}`);
      if (cachedStafferInfo) {
        setStafferInfo(cachedStafferInfo);
        setStafferLoading(false);
      } else {
        setStafferInfo(null);
      }
    }
  };

  useEffect(() => {
    if (selectedMember && !stafferInfo && !stafferLoading && selectedMember.chamber === "House") {
      const cachedStafferInfo = localStorage.getItem(`network_stafferInfo_${selectedMember.bioguideId}`);
      if (!cachedStafferInfo) {
        handleFindStaffers(selectedMember);
      }
    }
  }, [selectedMember?.bioguideId]);
  
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
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="network" data-testid="tab-network">
            <Users className="h-4 w-4 mr-2" />
            Network
          </TabsTrigger>
          <TabsTrigger value="veterans" data-testid="tab-veterans">
            <Shield className="h-4 w-4 mr-2" />
            Veterans
          </TabsTrigger>
          <TabsTrigger value="legistorm" data-testid="tab-legistorm">
            <BookOpen className="h-4 w-4 mr-2" />
            LegiStorm Directory
          </TabsTrigger>
        </TabsList>

        <TabsContent value="network" className="space-y-6 mt-4">
        <div className="flex justify-end">
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

      {/* Members Search Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Search Members
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMemberSearch(!showMemberSearch)}
              data-testid="button-toggle-member-search"
            >
              {showMemberSearch ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showMemberSearch && (
          <CardContent>
            <div className="space-y-4">
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

      </TabsContent>

        <TabsContent value="veterans" className="space-y-6 mt-4">
          <VeteransSearch />
        </TabsContent>

        <TabsContent value="legistorm" className="space-y-6 mt-4">
          <LegistormDirectory />
        </TabsContent>
      </Tabs>

      {/* Member Detail Sheet */}
      <Sheet open={!!selectedMember} onOpenChange={(open) => !open && handleSelectMember(null)}>
        <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col">
          <ErrorBoundary onReset={() => handleSelectMember(null)}>
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-3">
              <Avatar className="h-16 w-16">
                <AvatarImage src={memberDetails?.imageUrl || selectedMember?.imageUrl} alt={selectedMember?.name || ""} />
                <AvatarFallback className="text-lg">
                  {selectedMember?.firstName?.[0]}{selectedMember?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
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
                          try {
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
                          } catch (e) {
                            console.error("Error rendering portal selector:", e);
                            return null;
                          }
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
                <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                  <div className="flex gap-1 flex-wrap">
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
                    {selectedMember && stafferInfo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (selectedMember) {
                            localStorage.removeItem(`network_stafferInfo_${selectedMember.bioguideId}`);
                          }
                          handleFindStaffers(selectedMember);
                        }}
                        disabled={stafferLoading}
                        data-testid="button-refresh-staffers"
                      >
                        {stafferLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                
                {stafferLoading && (
                  <div className="p-4 rounded-lg border bg-muted/30 flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Looking up staff information...</span>
                  </div>
                )}
                
                {stafferInfo && (() => {
                  try {
                  const { intro, staffers } = parseStafferInfo(stafferInfo);
                  const isOfficial = stafferInfo.includes('House Telephone Directory') || stafferInfo.includes('directory.house.gov');
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isOfficial ? (
                          <Badge variant="default" className="text-xs" data-testid="badge-source-official">
                            <Landmark className="h-3 w-3 mr-1" />
                            Official Directory
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs" data-testid="badge-source-ai">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            AI Research - Verify Names
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{staffers.length} staff found</span>
                      </div>
                      {!isOfficial && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Names from AI research may be inaccurate. Verify against official sources before use.</p>
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
                                  {staffer.phone && (
                                    <a 
                                      href={`tel:${staffer.phone.replace(/[^\d]/g, '')}`}
                                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1"
                                    >
                                      <Phone className="h-3 w-3" />
                                      {staffer.phone}
                                    </a>
                                  )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => selectedMember && handleShowNetworkMap(selectedMember, [staffer])}
                                    data-testid={`button-view-staffer-${idx}`}
                                  >
                                    <Users className="h-4 w-4 mr-1" />
                                    Profile
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
                                  const assignedPortals = existingCustomer?.portalId 
                                    ? [portals.find(p => p.id === existingCustomer.portalId)].filter(Boolean)
                                    : [];
                                  const unassignedPortals = portals.filter(p => !assignedPortals.some(ap => ap?.id === p.id));
                                  
                                  return (
                                    <div className="mt-2 pt-2 border-t space-y-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs text-muted-foreground shrink-0">Clients:</span>
                                        {assignedPortals.length > 0 ? (
                                          assignedPortals.map(portal => portal && (
                                            <Badge 
                                              key={portal.id} 
                                              variant="secondary" 
                                              className="text-xs gap-1 pr-1"
                                            >
                                              <Briefcase className="h-3 w-3" />
                                              {portal.name}
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-4 w-4 ml-1 hover:bg-destructive/20"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (existingCustomer) {
                                                    updateCustomerMutation.mutate({
                                                      id: existingCustomer.id,
                                                      data: { portalId: null }
                                                    });
                                                  }
                                                }}
                                                data-testid={`button-remove-portal-${idx}-${portal.id}`}
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </Badge>
                                          ))
                                        ) : (
                                          <span className="text-xs text-muted-foreground italic">Not assigned</span>
                                        )}
                                        {unassignedPortals.length > 0 && (
                                          <Select
                                            value=""
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
                                            <SelectTrigger className="w-[100px] h-6 text-xs" data-testid={`select-staffer-client-${idx}`}>
                                              <SelectValue placeholder="+ Add" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {unassignedPortals.map((portal) => (
                                                <SelectItem key={portal.id} value={portal.id} data-testid={`select-staffer-portal-${idx}-${portal.id}`}>
                                                  {portal.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        )}
                                      </div>
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
                            <Users className="h-4 w-4 mr-1" />
                            View Staff Profiles
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
                  } catch (e) {
                    console.error("Error rendering staffer info:", e);
                    return <p className="text-sm text-muted-foreground">Error displaying staff data. Try refreshing.</p>;
                  }
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
                    {memberBills.sponsoredLegislation.slice(0, 10).map((bill, idx) => (
                      <div key={`${bill.type || 'bill'}-${bill.number || idx}`} className="p-3 rounded-lg border hover-elevate">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            {(bill.type || '').toUpperCase()} {bill.number}
                          </Badge>
                          {bill.introducedDate && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(bill.introducedDate).toLocaleDateString()}
                          </span>
                          )}
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
          </ErrorBoundary>
        </SheetContent>
      </Sheet>

      {/* Staffer Profile Dialog */}
      {networkDialogData && (
        <StafferProfileDialog
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

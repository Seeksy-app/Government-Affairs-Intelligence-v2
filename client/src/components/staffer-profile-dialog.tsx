import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  X, 
  ChevronRight, 
  Building2, 
  Calendar, 
  Briefcase, 
  Users, 
  GraduationCap,
  Mail,
  MapPin,
  ExternalLink,
  Linkedin,
  UserPlus,
  ChevronLeft,
  Award,
  Search,
  Loader2,
  Sparkles
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface CareerPosition {
  title: string;
  organization: string;
  startYear?: number;
  endYear?: number;
  memberServed?: string;
  organizationType?: string;
}

interface Staffer {
  id: number;
  name: string;
  title: string;
  email?: string;
  pathwayType?: string;
  yearsInCurrentRole?: number;
  careerHistory?: CareerPosition[];
  previousMembers?: string[];
  policyAreas?: string[];
  education?: { degree: string; institution: string; year?: number }[];
  bio?: string;
}

interface StafferProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  memberTitle?: string;
  memberParty?: string;
  memberState?: string;
  staffers: Staffer[];
}

const pathwayLabels: Record<string, { label: string; color: string; bg: string }> = {
  executive: { label: "Executive Track", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-900/30" },
  legislative: { label: "Legislative Track", color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-50 dark:bg-purple-900/30" },
  legal: { label: "Legal/Counsel Track", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-900/30" },
  communications: { label: "Communications Track", color: "text-green-700 dark:text-green-300", bg: "bg-green-50 dark:bg-green-900/30" },
  administrative: { label: "Administrative Track", color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-900/30" },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function StafferCard({ staffer, isSelected, onClick }: { staffer: Staffer; isSelected: boolean; onClick: () => void }) {
  const pathway = pathwayLabels[staffer.pathwayType || ''] || pathwayLabels.administrative;
  
  return (
    <Card 
      className={`cursor-pointer transition-all hover-elevate ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={onClick}
      data-testid={`staffer-card-${staffer.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 bg-gradient-to-br from-primary/80 to-primary shrink-0">
            <AvatarFallback className="bg-transparent text-primary-foreground font-semibold text-sm">
              {getInitials(staffer.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{staffer.name}</h4>
            <p className="text-xs text-muted-foreground truncate">{staffer.title}</p>
            <Badge variant="secondary" className={`mt-1 text-xs ${pathway.bg} ${pathway.color} border-0`}>
              {pathway.label}
            </Badge>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

interface LinkedInExperience {
  starts_at?: { day?: number; month?: number; year?: number };
  ends_at?: { day?: number; month?: number; year?: number } | null;
  company: string;
  title: string;
  description?: string;
}

interface LinkedInEducation {
  starts_at?: { day?: number; month?: number; year?: number };
  ends_at?: { day?: number; month?: number; year?: number };
  field_of_study?: string;
  degree_name?: string;
  school: string;
}

interface LinkedInData {
  profileUrl: string | null;
  fullName?: string;
  headline?: string;
  summary?: string;
  location?: string;
  profilePicUrl?: string;
  experiences: LinkedInExperience[];
  education: LinkedInEducation[];
  skills?: string[];
  careerAnalysis?: {
    totalYearsExperience: number;
    sectors: string[];
    careerTrajectory: string;
    keyTransitions: string[];
    governmentExperience: boolean;
    campaignExperience: boolean;
    lobbyingExperience: boolean;
    thinkTankExperience: boolean;
  };
}

interface CompanyData {
  name: string;
  displayName?: string;
  website?: string;
  linkedinUrl?: string;
  industry?: string;
  size?: string;
  founded?: number;
  description?: string;
  headquarters?: {
    city?: string;
    state?: string;
    country?: string;
  };
  employeeCount?: number;
  politicalClassification?: {
    isLobbyingFirm: boolean;
    isPAC: boolean;
    isThinkTank: boolean;
    isGovernmentAgency: boolean;
    isPoliticalOrg: boolean;
    isCampaign: boolean;
  };
}

function StafferProfile({ staffer, memberName, onBack, onNavigate, onEnrichData }: { staffer: Staffer; memberName: string; onBack: () => void; onNavigate: (path: string) => void; onEnrichData: (data: Partial<Staffer>) => void }) {
  const pathway = pathwayLabels[staffer.pathwayType || ''] || pathwayLabels.administrative;
  const [isResearching, setIsResearching] = useState(false);
  const [isLinkedInResearching, setIsLinkedInResearching] = useState(false);
  const [linkedInData, setLinkedInData] = useState<LinkedInData | null>(null);
  const [isCompanyResearching, setIsCompanyResearching] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState<Record<string, CompanyData>>({});
  const [showLinkedInInput, setShowLinkedInInput] = useState(false);
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [isFindingLinkedIn, setIsFindingLinkedIn] = useState(false);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [accessStrategy, setAccessStrategy] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFindLinkedIn = async () => {
    setIsFindingLinkedIn(true);
    try {
      const nameParts = staffer.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const res = await apiRequest("POST", "/api/research/people/search", {
        jobTitle: staffer.title || '',
        company: memberName || '',
        limit: 5,
      });
      const result = await res.json();
      if (result.success && result.data?.length > 0) {
        const nameToMatch = staffer.name.toLowerCase();
        const match = result.data.find((p: any) =>
          p.fullName?.toLowerCase() === nameToMatch ||
          (p.firstName?.toLowerCase() === firstName.toLowerCase() && p.lastName?.toLowerCase() === lastName.toLowerCase())
        );
        if (match?.linkedinUrl) {
          const url = match.linkedinUrl.startsWith('http') ? match.linkedinUrl : `https://${match.linkedinUrl}`;
          setLinkedInUrl(url);
          toast({ title: "LinkedIn Found", description: `Found LinkedIn profile for ${staffer.name}` });
        } else if (result.data[0]?.linkedinUrl) {
          const url = result.data[0].linkedinUrl.startsWith('http') ? result.data[0].linkedinUrl : `https://${result.data[0].linkedinUrl}`;
          setLinkedInUrl(url);
          toast({ title: "Possible Match", description: `Found a possible LinkedIn match: ${result.data[0].fullName}. Please verify before using.` });
        } else {
          toast({ title: "Not Found", description: "Could not find a LinkedIn profile. Try searching manually.", variant: "destructive" });
        }
      } else {
        toast({ title: "Not Found", description: "No results found. Try pasting the URL manually.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Search Failed", description: error.message || "Failed to search for LinkedIn profile", variant: "destructive" });
    } finally {
      setIsFindingLinkedIn(false);
    }
  };

  const handleCompanyResearch = async (companyName: string) => {
    if (companyData[companyName]) return; // Already researched
    
    setIsCompanyResearching(companyName);
    try {
      const response = await apiRequest("POST", "/api/research/company", {
        companyName
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setCompanyData(prev => ({ ...prev, [companyName]: result.data }));
        toast({
          title: "Company Found",
          description: `Found details for ${result.data.displayName || companyName}`,
        });
      } else {
        toast({
          title: "Company Not Found",
          description: result.message || `Could not find details for ${companyName}`,
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error("Company research error:", error);
      toast({
        title: "Research Error",
        description: "Could not research company. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCompanyResearching(null);
    }
  };
  
  const handleAddToContacts = () => {
    const nameParts = staffer.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const path = `/contacts?add=true&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&email=${encodeURIComponent(staffer.email || '')}&title=${encodeURIComponent(staffer.title)}&organization=${encodeURIComponent(`Office of ${memberName}`)}`;
    onNavigate(path);
  };

  const handleResearch = async () => {
    setIsResearching(true);
    try {
      const response = await apiRequest("POST", "/api/research/staffer", {
        name: staffer.name,
        title: staffer.title,
        organization: `Office of ${memberName}`,
        memberName: memberName
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        onEnrichData(result.data);
        toast({
          title: "Research Complete",
          description: `Found career data for ${staffer.name}`,
        });
      } else {
        toast({
          title: "Research Complete",
          description: "Limited information found. Try LinkedIn for more details.",
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error("Research error:", error);
      let errorMessage = "Could not complete research. Please try again.";
      if (error?.message) {
        // Try to extract JSON message from the error
        const jsonMatch = error.message.match(/\{.*"message":\s*"([^"]+)"/);
        if (jsonMatch) {
          errorMessage = jsonMatch[1];
        } else {
          errorMessage = error.message;
        }
      }
      toast({
        title: "Research Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsResearching(false);
    }
  };

  const handleGenerateStrategy = async () => {
    setIsGeneratingStrategy(true);
    try {
      const careerContext = staffer.careerHistory?.map(p =>
        `${p.title} at ${p.organization}${p.startYear ? ` (${p.startYear}${p.endYear ? `–${p.endYear}` : '–present'})` : ''}`
      ).join('; ') || 'No prior career history recorded';

      const response = await apiRequest("POST", "/api/research/staffer", {
        name: staffer.name,
        title: staffer.title,
        organization: `Office of ${memberName}`,
        memberName: memberName,
        customPrompt: `You are a government affairs strategist advising a lobbying firm. Analyze ${staffer.name}, ${staffer.title} in the Office of ${memberName}, and provide a detailed relationship intelligence report for a lobbyist seeking to build access to ${memberName}'s office.

Career context: ${careerContext}

Provide a structured intelligence report with these sections:

**ROLE & INFLUENCE**
What decisions does this staffer influence? What is their actual power in the office vs. their title?

**CAREER BACKGROUND**
What private sector, campaign, or other Hill experience do they have? What industries have they been adjacent to?

**RELATIONSHIP PATHWAYS**
List 3–5 specific, realistic ways a lobbyist could build a relationship with or through this staffer:
- Former colleagues now in industry who may know them
- Trade associations or organizations they're likely connected to
- Events, conferences, or caucus meetings where they'd be present
- Alumni networks (schools, previous offices)

**POLICY LEVERAGE POINTS**
What issues does this staffer likely own or influence? What would make them take a meeting?

**APPROACH STRATEGY**
Recommended first move for a lobbyist wanting access to ${memberName}'s office through this staffer. Be specific and actionable.

**RISK FACTORS**
Any sensitivities, political dynamics, or relationship landmines to be aware of.`
      });

      const result = await response.json();
      if (result.success && result.data?.rawContent) {
        setAccessStrategy(result.data.rawContent);
        toast({ title: "Intelligence Report Generated", description: `Access strategy ready for ${staffer.name}` });
      } else {
        throw new Error("No content returned");
      }
    } catch (error: any) {
      toast({ title: "Strategy Generation Failed", description: error?.message || "Could not generate strategy", variant: "destructive" });
    } finally {
      setIsGeneratingStrategy(false);
    }
  };

  const handleLinkedInResearch = async (customUrl?: string) => {
    setIsLinkedInResearching(true);
    try {
      const urlToUse = customUrl || linkedInUrl;
      
      const urlToSearch = urlToUse && urlToUse.includes("linkedin.com") ? urlToUse : null;
      
      let requestBody: Record<string, string>;
      if (urlToSearch) {
        requestBody = { linkedinUrl: urlToSearch };
      } else {
        const nameParts = staffer.name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        requestBody = { firstName, lastName, organization: `Office of ${memberName}` };
      }
      
      const response = await apiRequest("POST", "/api/research/linkedin", requestBody);
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setLinkedInData(result.data);
        if (urlToSearch) {
          setShowLinkedInInput(false);
          setLinkedInUrl("");
        }
        
        const careerHistory = result.data.experiences?.map((exp: LinkedInExperience) => ({
          title: exp.title,
          organization: exp.company,
          startYear: exp.starts_at?.year,
          endYear: exp.ends_at?.year
        })) || [];
        
        const education = result.data.education?.map((edu: LinkedInEducation) => ({
          degree: edu.degree_name || 'Degree',
          institution: edu.school,
          year: edu.ends_at?.year
        })) || [];
        
        onEnrichData({
          careerHistory,
          education,
          bio: result.data.summary || staffer.bio
        });
        
        toast({
          title: "LinkedIn Research Complete",
          description: `Found ${result.data.experiences?.length || 0} positions and ${result.data.education?.length || 0} education entries`,
        });
      } else {
        toast({
          title: "Profile Not Found",
          description: result.message || "Could not find LinkedIn profile. Try the search button instead.",
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error("LinkedIn research error:", error);
      let errorMessage = "Could not complete LinkedIn research.";
      // Extract error message from the response if available
      try {
        if (error?.message) {
          const parsed = JSON.parse(error.message.match(/\{.*\}/)?.[0] || "{}");
          if (parsed.message) {
            errorMessage = parsed.message;
          }
        }
      } catch {
        // Use default message
      }
      toast({
        title: "LinkedIn Research Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLinkedInResearching(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-to-list">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h3 className="font-semibold" data-testid="text-staffer-name">{staffer.name}</h3>
          <p className="text-sm text-muted-foreground" data-testid="text-staffer-title">{staffer.title}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleResearch}
            disabled={isResearching}
            data-testid="button-research-staffer"
          >
            {isResearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Researching...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                Research
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              if (showLinkedInInput) {
                handleLinkedInResearch();
              } else {
                setShowLinkedInInput(true);
              }
            }}
            disabled={isLinkedInResearching}
            data-testid="button-linkedin-research"
          >
            {isLinkedInResearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Linkedin className="h-4 w-4 mr-1" />
                LinkedIn
              </>
            )}
          </Button>
          <Button 
            variant="default" 
            size="sm"
            onClick={handleAddToContacts}
            data-testid="button-add-to-contacts"
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Add to Contacts
          </Button>
        </div>
      </div>
      
      {showLinkedInInput && (
        <div className="px-6 py-3 border-b bg-muted/30">
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <input
                type="url"
                placeholder="Paste LinkedIn URL (e.g., linkedin.com/in/username)"
                value={linkedInUrl}
                onChange={(e) => setLinkedInUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="input-linkedin-url"
              />
            </div>
            <Button 
              size="sm" 
              onClick={() => handleLinkedInResearch()}
              disabled={isLinkedInResearching || !linkedInUrl}
              data-testid="button-submit-linkedin-url"
            >
              {isLinkedInResearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleFindLinkedIn}
              disabled={isFindingLinkedIn || isLinkedInResearching}
              data-testid="button-find-linkedin"
            >
              {isFindingLinkedIn ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Finding...
                </>
              ) : (
                <>
                  <Linkedin className="h-4 w-4 mr-1" />
                  Find
                </>
              )}
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => {
                setShowLinkedInInput(false);
                setLinkedInUrl("");
              }}
              data-testid="button-cancel-linkedin"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Paste a LinkedIn URL or click "Find" to auto-search for their profile
          </p>
        </div>
      )}
      
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 bg-gradient-to-br from-primary/80 to-primary shrink-0">
              <AvatarFallback className="bg-transparent text-primary-foreground font-bold text-xl">
                {getInitials(staffer.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div>
                <h2 className="text-xl font-bold">{staffer.name}</h2>
                <p className="text-muted-foreground">{staffer.title}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Building2 className="h-3 w-3" />
                  Office of {memberName}
                </p>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary" className={`${pathway.bg} ${pathway.color} border-0`}>
                  {pathway.label}
                </Badge>
                {staffer.yearsInCurrentRole && (
                  <Badge variant="outline" className="text-xs">
                    {staffer.yearsInCurrentRole}+ years in role
                  </Badge>
                )}
              </div>
              
              {staffer.email && (
                <a 
                  href={`mailto:${staffer.email}`} 
                  className="text-sm text-primary hover:underline flex items-center gap-1 mt-2"
                >
                  <Mail className="h-3 w-3" />
                  {staffer.email}
                </a>
              )}
            </div>
          </div>
          
          {staffer.bio && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Bio</h3>
              <p className="text-sm leading-relaxed">{staffer.bio}</p>
            </div>
          )}
          
          {staffer.policyAreas && staffer.policyAreas.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                <Award className="h-3 w-3" />
                Policy Expertise
              </h3>
              <div className="flex flex-wrap gap-2">
                {staffer.policyAreas.map((area, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">{area}</Badge>
                ))}
              </div>
            </div>
          )}
          
          {linkedInData?.careerAnalysis && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1">
                  <Linkedin className="h-3 w-3" />
                  Career Analysis
                  {linkedInData.profileUrl && (
                    <a 
                      href={linkedInData.profileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline ml-auto text-xs font-normal flex items-center gap-1"
                    >
                      View Profile <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </h3>
                
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                      {linkedInData.careerAnalysis.totalYearsExperience}+ years experience
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                      {linkedInData.careerAnalysis.careerTrajectory}
                    </Badge>
                  </div>
                  
                  {linkedInData.careerAnalysis.sectors.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Sectors:</p>
                      <div className="flex flex-wrap gap-1">
                        {linkedInData.careerAnalysis.sectors.map((sector, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">{sector}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    {linkedInData.careerAnalysis.governmentExperience && (
                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                        Government Experience
                      </Badge>
                    )}
                    {linkedInData.careerAnalysis.campaignExperience && (
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                        Campaign Experience
                      </Badge>
                    )}
                    {linkedInData.careerAnalysis.lobbyingExperience && (
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800">
                        Lobbying Experience
                      </Badge>
                    )}
                    {linkedInData.careerAnalysis.thinkTankExperience && (
                      <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                        Think Tank Experience
                      </Badge>
                    )}
                  </div>
                  
                  {linkedInData.careerAnalysis.keyTransitions.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Key Career Transitions:</p>
                      <div className="flex flex-wrap gap-1">
                        {linkedInData.careerAnalysis.keyTransitions.map((transition, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{transition}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          
          {linkedInData?.skills && linkedInData.skills.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                Skills
              </h3>
              <div className="flex flex-wrap gap-1">
                {linkedInData.skills.slice(0, 15).map((skill, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">{skill}</Badge>
                ))}
                {linkedInData.skills.length > 15 && (
                  <Badge variant="outline" className="text-xs">+{linkedInData.skills.length - 15} more</Badge>
                )}
              </div>
            </div>
          )}
          
          <Separator />
          
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              Career Path
            </h3>
            
            {staffer.careerHistory && staffer.careerHistory.length > 0 ? (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                
                <div className="space-y-4">
                  <div className="relative pl-10">
                    <div className="absolute left-2 top-1 w-4 h-4 rounded-full bg-primary border-2 border-background shadow" />
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs">Current</Badge>
                        <span className="text-xs text-muted-foreground">Present</span>
                      </div>
                      <h4 className="font-semibold mt-2">{staffer.title}</h4>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        Office of {memberName}
                      </p>
                    </div>
                  </div>
                  
                  {staffer.careerHistory.map((position, idx) => (
                    <div key={idx} className="relative pl-10">
                      <div className="absolute left-2 top-1 w-4 h-4 rounded-full bg-muted border-2 border-background shadow" />
                      <div className="bg-card border rounded-lg p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <Calendar className="h-3 w-3" />
                          {position.startYear}{position.endYear ? ` - ${position.endYear}` : " - Present"}
                        </div>
                        <h4 className="font-semibold">{position.title}</h4>
                        <button
                          onClick={() => handleCompanyResearch(position.organization)}
                          className="text-sm text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors text-left"
                          disabled={isCompanyResearching === position.organization}
                          data-testid={`btn-research-company-${idx}`}
                        >
                          {isCompanyResearching === position.organization ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Building2 className="h-3 w-3" />
                          )}
                          {position.organization}
                          {!companyData[position.organization] && (
                            <Search className="h-3 w-3 ml-1 opacity-50" />
                          )}
                        </button>
                        {companyData[position.organization] && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                            {companyData[position.organization].industry && (
                              <p><span className="text-muted-foreground">Industry:</span> {companyData[position.organization].industry}</p>
                            )}
                            {companyData[position.organization].size && (
                              <p><span className="text-muted-foreground">Size:</span> {companyData[position.organization].size}</p>
                            )}
                            {companyData[position.organization].headquarters && (
                              <p><span className="text-muted-foreground">HQ:</span> {[companyData[position.organization].headquarters?.city, companyData[position.organization].headquarters?.state].filter(Boolean).join(", ")}</p>
                            )}
                            {companyData[position.organization].politicalClassification && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {companyData[position.organization].politicalClassification?.isLobbyingFirm && (
                                  <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">Lobbying Firm</Badge>
                                )}
                                {companyData[position.organization].politicalClassification?.isPAC && (
                                  <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">PAC</Badge>
                                )}
                                {companyData[position.organization].politicalClassification?.isThinkTank && (
                                  <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">Think Tank</Badge>
                                )}
                                {companyData[position.organization].politicalClassification?.isGovernmentAgency && (
                                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Government</Badge>
                                )}
                              </div>
                            )}
                            {companyData[position.organization].website && (
                              <a href={companyData[position.organization].website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" /> Website
                              </a>
                            )}
                          </div>
                        )}
                        {position.memberServed && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Served under {position.memberServed}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="relative pl-10">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                <div className="absolute left-2 top-1 w-4 h-4 rounded-full bg-primary border-2 border-background shadow" />
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs">Current</Badge>
                    <span className="text-xs text-muted-foreground">Present</span>
                  </div>
                  <h4 className="font-semibold mt-2">{staffer.title}</h4>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Office of {memberName}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mt-4 ml-1">
                  Career history can be enriched through research.
                </p>
              </div>
            )}
          </div>
          
          {staffer.education && staffer.education.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-1">
                  <GraduationCap className="h-3 w-3" />
                  Education
                </h3>
                <div className="space-y-3">
                  {staffer.education.map((edu, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{edu.degree}</h4>
                        <p className="text-sm text-muted-foreground">{edu.institution}</p>
                        {edu.year && <p className="text-xs text-muted-foreground">{edu.year}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {/* ── Relationship Intelligence ── */}
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <span>🎯</span>
                Relationship Intelligence
              </h3>
              {!accessStrategy && (
                <button
                  onClick={handleGenerateStrategy}
                  disabled={isGeneratingStrategy}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
                  style={{ background: "#f59e0b", color: "#fff", border: "none" }}
                >
                  {isGeneratingStrategy ? (
                    <><span className="animate-spin">⟳</span> Generating...</>
                  ) : (
                    <>⚡ Generate Access Strategy</>
                  )}
                </button>
              )}
              {accessStrategy && (
                <button
                  onClick={handleGenerateStrategy}
                  disabled={isGeneratingStrategy}
                  className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {isGeneratingStrategy ? "Refreshing..." : "↺ Refresh"}
                </button>
              )}
            </div>

            {!accessStrategy && !isGeneratingStrategy && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4">
                <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-1">AI-Powered Access Strategy</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Generate a relationship intelligence report showing connection pathways, policy leverage points,
                  and a recommended approach strategy for reaching {memberName}'s office through this staffer.
                </p>
              </div>
            )}

            {isGeneratingStrategy && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-center gap-3">
                <span className="text-amber-600 animate-spin text-lg">⟳</span>
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Analyzing {staffer.name}...</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Researching career background, connections, and policy leverage points</p>
                </div>
              </div>
            )}

            {accessStrategy && (
              <div className="rounded-xl border bg-card p-4">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {accessStrategy.split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={i} className="font-bold text-sm mt-3 mb-1 text-foreground">{line.replace(/\*\*/g, '')}</p>;
                    }
                    if (line.startsWith('- ') || line.startsWith('• ')) {
                      return <p key={i} className="text-xs text-muted-foreground ml-3 mb-0.5">• {line.slice(2)}</p>;
                    }
                    if (line.trim()) {
                      return <p key={i} className="text-xs text-muted-foreground mb-1">{line}</p>;
                    }
                    return null;
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t">
                  ⚡ Generated by AI — verify key facts before using in outreach
                </p>
              </div>
            )}
          </div>

          {staffer.previousMembers && staffer.previousMembers.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Previous Leadership Experience
                </h3>
                <div className="flex flex-wrap gap-2">
                  {staffer.previousMembers.map((member, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {member}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function StafferProfileDialog({
  open,
  onOpenChange,
  memberName,
  memberTitle,
  memberParty,
  memberState,
  staffers,
}: StafferProfileDialogProps) {
  const [selectedStaffer, setSelectedStaffer] = useState<Staffer | null>(null);
  const [enrichedData, setEnrichedData] = useState<Record<number, Partial<Staffer>>>({});
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (open && staffers.length === 1 && !selectedStaffer) {
      setSelectedStaffer(staffers[0]);
    }
  }, [open, staffers]);
  
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedStaffer(null);
    }
    onOpenChange(isOpen);
  };
  
  const handleNavigate = (path: string) => {
    onOpenChange(false);
    setSelectedStaffer(null);
    setLocation(path);
  };

  const handleEnrichData = (data: Partial<Staffer>) => {
    if (selectedStaffer) {
      setEnrichedData(prev => ({
        ...prev,
        [selectedStaffer.id]: data
      }));
      setSelectedStaffer(prev => prev ? { ...prev, ...data } : null);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
        {!selectedStaffer ? (
          <>
            <DialogHeader className="px-6 py-4 border-b shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {memberName}'s Staff
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {memberTitle} {memberParty && memberState && `(${memberParty}-${memberState})`} • {staffers.length} staff member{staffers.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleOpenChange(false)} data-testid="button-close-dialog">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>
            
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-3">
                {staffers.map((staffer) => (
                  <StafferCard
                    key={staffer.id}
                    staffer={staffer}
                    isSelected={false}
                    onClick={() => setSelectedStaffer(staffer)}
                  />
                ))}
              </div>
              
              {staffers.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No staff information available.</p>
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <StafferProfile 
            staffer={selectedStaffer} 
            memberName={memberName}
            onBack={() => staffers.length === 1 ? handleOpenChange(false) : setSelectedStaffer(null)}
            onNavigate={handleNavigate}
            onEnrichData={handleEnrichData}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

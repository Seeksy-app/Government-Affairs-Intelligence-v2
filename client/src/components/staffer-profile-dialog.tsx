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
import { useState } from "react";
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

function StafferProfile({ staffer, memberName, onBack, onNavigate, onEnrichData }: { staffer: Staffer; memberName: string; onBack: () => void; onNavigate: (path: string) => void; onEnrichData: (data: Partial<Staffer>) => void }) {
  const pathway = pathwayLabels[staffer.pathwayType || ''] || pathwayLabels.administrative;
  const [isResearching, setIsResearching] = useState(false);
  const { toast } = useToast();
  
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
            onClick={() => window.open(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(staffer.name)}`, '_blank')}
            data-testid="button-linkedin-search"
          >
            <Linkedin className="h-4 w-4 mr-1" />
            LinkedIn
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
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {position.organization}
                        </p>
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
            onBack={() => setSelectedStaffer(null)}
            onNavigate={handleNavigate}
            onEnrichData={handleEnrichData}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

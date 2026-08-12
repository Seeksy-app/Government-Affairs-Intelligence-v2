import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Target, Users, FileText, Network, LayoutGrid,
  Search, ChevronRight, GripVertical, Plus, Trash2,
  User, Building2, Star, ArrowRight, Brain, Briefcase,
  Mail, Phone, ExternalLink, Crown, Shield, AlertCircle,
  Sparkles, MapPin, Loader2,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/avatar-utils";
import type { StrategyBoard, StrategyCard, LegistormStaffer } from "@shared/schema";

type ActiveView = "access" | "kanban" | "bill-influence" | "pathfinder" | "power-grid";

const INFLUENCE_TIERS: Record<string, { score: number; label: string; color: string; pillClass: string }> = {
  "Chief of Staff": { score: 95, label: "Critical", color: "destructive", pillClass: "bg-red-500 text-white" },
  "Legislative Director": { score: 90, label: "Critical", color: "destructive", pillClass: "bg-red-500 text-white" },
  "Deputy Chief of Staff": { score: 88, label: "Very High", color: "destructive", pillClass: "bg-orange-500 text-white" },
  "Policy Director": { score: 85, label: "Very High", color: "destructive", pillClass: "bg-orange-500 text-white" },
  "Communications Director": { score: 80, label: "High", color: "default", pillClass: "bg-blue-500 text-white" },
  "Senior Policy Advisor": { score: 78, label: "High", color: "default", pillClass: "bg-blue-500 text-white" },
  "Senior Advisor": { score: 78, label: "High", color: "default", pillClass: "bg-blue-500 text-white" },
  "Counsel": { score: 75, label: "High", color: "default", pillClass: "bg-blue-500 text-white" },
  "General Counsel": { score: 75, label: "High", color: "default", pillClass: "bg-blue-500 text-white" },
  "Press Secretary": { score: 72, label: "High", color: "default", pillClass: "bg-blue-500 text-white" },
  "Scheduler": { score: 70, label: "Moderate", color: "secondary", pillClass: "bg-amber-500 text-white" },
  "Legislative Assistant": { score: 65, label: "Moderate", color: "secondary", pillClass: "bg-amber-500 text-white" },
  "Legislative Aide": { score: 60, label: "Moderate", color: "secondary", pillClass: "bg-amber-500 text-white" },
  "Legislative Correspondent": { score: 55, label: "Moderate", color: "secondary", pillClass: "bg-amber-500 text-white" },
  "Staff Assistant": { score: 40, label: "Entry", color: "outline", pillClass: "bg-gray-400 text-white" },
  "Intern": { score: 20, label: "Entry", color: "outline", pillClass: "bg-gray-400 text-white" },
};

function getInfluenceScore(title: string): { score: number; label: string; color: string; pillClass: string } {
  const normalizedTitle = title?.toLowerCase() || "";
  for (const [key, value] of Object.entries(INFLUENCE_TIERS)) {
    if (normalizedTitle.includes(key.toLowerCase())) return value;
  }
  if (normalizedTitle.includes("director")) return { score: 80, label: "High", color: "default", pillClass: "bg-blue-500 text-white" };
  if (normalizedTitle.includes("senior")) return { score: 75, label: "High", color: "default", pillClass: "bg-blue-500 text-white" };
  if (normalizedTitle.includes("advisor") || normalizedTitle.includes("adviser")) return { score: 70, label: "Moderate", color: "secondary", pillClass: "bg-amber-500 text-white" };
  if (normalizedTitle.includes("manager")) return { score: 65, label: "Moderate", color: "secondary", pillClass: "bg-amber-500 text-white" };
  if (normalizedTitle.includes("assistant")) return { score: 45, label: "Entry", color: "outline", pillClass: "bg-gray-400 text-white" };
  return { score: 50, label: "Moderate", color: "secondary", pillClass: "bg-amber-500 text-white" };
}

function renderMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// Named saves for Strategy Board tools. Saves the view's *parameters* (not a
// snapshot) — loading one re-runs against live data.
function SavedViewsBar({
  view,
  currentName,
  currentParams,
  onLoad,
}: {
  view: string;
  currentName: string;
  currentParams: Record<string, unknown> | null;
  onLoad: (params: any) => void;
}) {
  const { toast } = useToast();

  const { data: savedViews } = useQuery<Array<{ id: string; name: string; params: any }>>({
    queryKey: ["/api/strategy/saved-views", view],
    queryFn: async () => {
      const res = await fetch(`/api/strategy/saved-views?view=${encodeURIComponent(view)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 10000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/strategy/saved-views", {
        view,
        name: currentName,
        params: currentParams,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategy/saved-views", view] });
      toast({ title: `Saved "${currentName}"` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/strategy/saved-views/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategy/saved-views", view] });
    },
  });

  const alreadySaved = savedViews?.some((v) => v.name === currentName) ?? false;
  const hasContent = (savedViews?.length ?? 0) > 0 || currentParams !== null;
  if (!hasContent) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-muted-foreground">Saved:</span>
      {savedViews?.map((v) => (
        <Badge
          key={v.id}
          variant="outline"
          className="cursor-pointer hover-elevate gap-1.5 py-1 pl-2.5 pr-1.5"
          onClick={() => onLoad(v.params)}
          data-testid={`saved-view-${v.id}`}
        >
          {v.name}
          <button
            type="button"
            className="opacity-50 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate(v.id);
            }}
            aria-label={`Delete saved view ${v.name}`}
            data-testid={`delete-saved-view-${v.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {(savedViews?.length ?? 0) === 0 && (
        <span className="text-xs text-muted-foreground">none yet</span>
      )}
      {currentParams !== null && !alreadySaved && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          data-testid="button-save-view"
        >
          <Star className="h-3.5 w-3.5 mr-1" /> Save current
        </Button>
      )}
    </div>
  );
}

function AccessMappingBoard() {
  const [targetQuery, setTargetQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState("");
  const { toast } = useToast();

  const { data: memberResultsRaw, isLoading: searchingMembers } = useQuery<any[]>({
    queryKey: ["/api/congress/members", targetQuery],
    queryFn: async () => {
      if (!targetQuery || targetQuery.length < 2) return [];
      const res = await fetch(`/api/congress/members?search=${encodeURIComponent(targetQuery)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: targetQuery.length >= 2,
    staleTime: 30000,
  });

  const memberResults = useMemo(() => {
    if (!memberResultsRaw || memberResultsRaw.length === 0) return memberResultsRaw;
    const q = targetQuery.toLowerCase().trim();
    const qWords = q.split(/\s+/);
    return [...memberResultsRaw].sort((a, b) => {
      const aName = (a.name || "").toLowerCase();
      const bName = (b.name || "").toLowerCase();
      const aFirst = (a.firstName || "").toLowerCase();
      const aLast = (a.lastName || "").toLowerCase();
      const bFirst = (b.firstName || "").toLowerCase();
      const bLast = (b.lastName || "").toLowerCase();

      const scoreMatch = (name: string, first: string, last: string) => {
        if (name === q) return 100;
        if (qWords.length >= 2 && qWords.every(w => name.includes(w))) return 90;
        if (qWords.length >= 2 && qWords.some(w => last === w) && qWords.some(w => first.startsWith(w))) return 85;
        if (last === qWords[qWords.length - 1]) return 70;
        if (name.startsWith(q)) return 60;
        return 0;
      };

      return scoreMatch(bName, bFirst, bLast) - scoreMatch(aName, aFirst, aLast);
    });
  }, [memberResultsRaw, targetQuery]);

  const { data: staffersForMember, isLoading: loadingStaffers } = useQuery<{
    staffers: LegistormStaffer[];
    total: number;
  }>({
    queryKey: ["/api/strategy/access-map", selectedMember],
    queryFn: async () => {
      const res = await fetch(`/api/strategy/access-map?memberName=${encodeURIComponent(selectedMemberName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch staffers");
      return res.json();
    },
    enabled: !!selectedMember,
    staleTime: 30000,
  });

  const { data: aiStrategy, isLoading: loadingAI, refetch: fetchAIStrategy } = useQuery<{ strategy: string }>({
    queryKey: ["/api/strategy/ai-access", selectedMember],
    queryFn: async () => {
      const res = await fetch(`/api/strategy/ai-access?memberName=${encodeURIComponent(selectedMemberName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to get AI strategy");
      return res.json();
    },
    enabled: false,
  });

  const rankedStaffers = useMemo(() => {
    if (!staffersForMember?.staffers) return [];
    return [...staffersForMember.staffers].sort((a, b) => {
      const scoreA = getInfluenceScore(a.currentTitle || "");
      const scoreB = getInfluenceScore(b.currentTitle || "");
      return scoreB.score - scoreA.score;
    });
  }, [staffersForMember]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1" data-testid="text-access-mapping-title">Access Mapping</h2>
        <p className="text-sm text-muted-foreground">Select a Member of Congress to see their staff ranked by influence and accessibility</p>
      </div>

      <SavedViewsBar
        view="access"
        currentName={selectedMemberName}
        currentParams={selectedMember ? { memberId: selectedMember, memberName: selectedMemberName } : null}
        onLoad={(p) => {
          setSelectedMember(p.memberId);
          setSelectedMemberName(p.memberName);
          setTargetQuery(p.memberName);
        }}
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for a Senator or Representative..."
                value={targetQuery}
                onChange={(e) => { setTargetQuery(e.target.value); setSelectedMember(null); }}
                className="pl-9"
                data-testid="input-member-search"
              />
            </div>
            {searchingMembers && <Skeleton className="h-10 w-full" />}
            {memberResults && memberResults.length > 0 && !selectedMember && (
              <div className="border rounded-md max-h-96 overflow-auto">
                {memberResults.map((m: any) => (
                  <button
                    key={m.bioguideId || m.name}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-3 border-b last:border-b-0 transition-colors"
                    onClick={() => {
                      setSelectedMember(m.bioguideId || m.name);
                      setSelectedMemberName(m.name || m.directoryName || "");
                      setTargetQuery(m.name || m.directoryName || "");
                    }}
                    data-testid={`button-select-member-${m.bioguideId}`}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={getAvatarUrl(m.name, m.imageUrl)} alt={m.name} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {(m.firstName?.[0] || "") + (m.lastName?.[0] || "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{m.name || m.directoryName}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.partyName} - {m.state} {m.district ? `District ${m.district}` : ""} ({m.terms?.[0]?.chamber || "Congress"})
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedMember && (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold">{selectedMemberName}</h3>
              <p className="text-sm text-muted-foreground">
                {rankedStaffers.length} staffers found - ranked by influence level
              </p>
            </div>
            <Button
              onClick={() => fetchAIStrategy()}
              disabled={loadingAI}
              data-testid="button-ai-strategy"
            >
              {loadingAI ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              AI Access Strategy
            </Button>
          </div>

          {aiStrategy?.strategy && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI-Recommended Access Strategy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm whitespace-pre-wrap" data-testid="text-ai-strategy">{renderMarkdown(aiStrategy.strategy)}</div>
              </CardContent>
            </Card>
          )}

          {loadingStaffers ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rankedStaffers.map((staffer, idx) => {
                const influence = getInfluenceScore(staffer.currentTitle || "");
                return (
                  <Card key={staffer.id} data-testid={`card-staffer-${staffer.legistormId}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{staffer.fullName}</p>
                            <p className="text-xs text-muted-foreground truncate">{staffer.currentTitle}</p>
                          </div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${influence.pillClass}`}>
                                {influence.label}
                              </span>
                              <span className="text-xs text-muted-foreground">{influence.score}/100</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="font-medium">{influence.label} Influence ({influence.score}/100)</p>
                            <p className="text-xs text-muted-foreground">Based on title: {staffer.currentTitle}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 items-center">
                        {staffer.email && (
                          <a href={`mailto:${staffer.email}`} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
                            <Mail className="h-3 w-3" /> {staffer.email}
                          </a>
                        )}
                        {staffer.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {staffer.phone}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {staffer.chamber && <Badge variant="outline" className="text-xs">{staffer.chamber}</Badge>}
                        {staffer.state && <Badge variant="outline" className="text-xs">{staffer.state}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {rankedStaffers.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Users className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No staffers found for this member in the LegiStorm directory</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const KANBAN_STAGES = ["Identify", "Research", "Outreach", "In Progress", "Connected"];
const STAGE_COLORS: Record<string, string> = {
  "Identify": "bg-muted",
  "Research": "bg-blue-500/10",
  "Outreach": "bg-amber-500/10",
  "In Progress": "bg-purple-500/10",
  "Connected": "bg-green-500/10",
};

function StrategyKanbanBoard() {
  const { toast } = useToast();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDesc, setNewBoardDesc] = useState("");
  const [newBoardKeywords, setNewBoardKeywords] = useState("");
  const [addCardStage, setAddCardStage] = useState<string | null>(null);
  const [addCardSearch, setAddCardSearch] = useState("");
  const [dragCard, setDragCard] = useState<string | null>(null);

  const { data: boards, isLoading: loadingBoards } = useQuery<StrategyBoard[]>({
    queryKey: ["/api/strategy/boards"],
    queryFn: async () => {
      const res = await fetch("/api/strategy/boards", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch boards");
      return res.json();
    },
    staleTime: 10000,
  });

  const { data: cards } = useQuery<StrategyCard[]>({
    queryKey: ["/api/strategy/boards", selectedBoardId, "cards"],
    queryFn: async () => {
      const res = await fetch(`/api/strategy/boards/${selectedBoardId}/cards`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cards");
      return res.json();
    },
    enabled: !!selectedBoardId,
    staleTime: 5000,
  });

  const { data: searchResults } = useQuery<{ staffers: LegistormStaffer[] }>({
    queryKey: ["/api/legistorm/staffers", addCardSearch],
    queryFn: async () => {
      const res = await fetch(`/api/legistorm/staffers?q=${encodeURIComponent(addCardSearch)}&limit=10`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: addCardSearch.length >= 2,
    staleTime: 30000,
  });

  const createBoardMutation = useMutation({
    mutationFn: async () => {
      const desc = newBoardKeywords
        ? `${newBoardDesc}\n\nKeywords: ${newBoardKeywords}`.trim()
        : newBoardDesc;
      return apiRequest("POST", "/api/strategy/boards", { name: newBoardName, description: desc });
    },
    onSuccess: async (res) => {
      const board = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/strategy/boards"] });
      setSelectedBoardId(board.id);
      setShowNewBoard(false);
      setNewBoardName("");
      setNewBoardDesc("");
      setNewBoardKeywords("");
      toast({ title: "Board created" });
    },
  });

  const addCardMutation = useMutation({
    mutationFn: async (data: { entityType: string; entityId: string; entityName: string; entityMeta: any; stage: string }) => {
      return apiRequest("POST", `/api/strategy/boards/${selectedBoardId}/cards`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategy/boards", selectedBoardId, "cards"] });
      setAddCardStage(null);
      setAddCardSearch("");
    },
  });

  const moveCardMutation = useMutation({
    mutationFn: async ({ cardId, stage }: { cardId: string; stage: string }) => {
      return apiRequest("PATCH", `/api/strategy/cards/${cardId}`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategy/boards", selectedBoardId, "cards"] });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      return apiRequest("DELETE", `/api/strategy/cards/${cardId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategy/boards", selectedBoardId, "cards"] });
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: async (boardId: string) => {
      return apiRequest("DELETE", `/api/strategy/boards/${boardId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategy/boards"] });
      setSelectedBoardId(null);
    },
  });

  const selectedBoard = boards?.find(b => b.id === selectedBoardId);
  const boardKeywords = selectedBoard?.description?.includes("Keywords:")
    ? selectedBoard.description.split("Keywords:")[1].split(",").map(k => k.trim()).filter(Boolean)
    : [];

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/strategy/boards/${selectedBoardId}/suggest-cards`);
      return res.json();
    },
    onSuccess: (data: { created: unknown[]; message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategy/boards", selectedBoardId, "cards"] });
      toast({
        title: data.created.length > 0 ? `Added ${data.created.length} suggested staffers to Identify` : "No new suggestions",
        description: data.message ?? (data.created.length > 0 ? "Ranked by fit against this board's keywords." : undefined),
      });
    },
    onError: (error: Error) => {
      toast({ title: "AI suggest failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold" data-testid="text-kanban-title">Strategy Pipeline</h2>
          <p className="text-sm text-muted-foreground">Organize staffers and contacts into engagement stages</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedBoardId || ""} onValueChange={setSelectedBoardId}>
            <SelectTrigger className="w-[200px]" data-testid="select-board">
              <SelectValue placeholder="Select a board" />
            </SelectTrigger>
            <SelectContent>
              {boards?.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedBoardId && (
            <Button
              variant="outline"
              onClick={() => suggestMutation.mutate()}
              disabled={suggestMutation.isPending || boardKeywords.length === 0}
              title={boardKeywords.length === 0 ? "Add keywords to this board to enable AI suggestions" : undefined}
              data-testid="button-ai-suggest"
            >
              {suggestMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Thinking…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-1" /> AI Suggest</>
              )}
            </Button>
          )}
          <Button onClick={() => setShowNewBoard(true)} data-testid="button-new-board">
            <Plus className="h-4 w-4 mr-1" /> New Board
          </Button>
        </div>
      </div>

      <Dialog open={showNewBoard} onOpenChange={setShowNewBoard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Strategy Board</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Board Name</label>
              <Input
                placeholder="e.g., Senate Outreach Q1, Veteran Affairs Strategy"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                data-testid="input-board-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Textarea
                placeholder="What is this board for? (optional)"
                value={newBoardDesc}
                onChange={(e) => setNewBoardDesc(e.target.value)}
                data-testid="input-board-desc"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Keywords</label>
              <Input
                placeholder="e.g., veterans, defense, healthcare, infrastructure"
                value={newBoardKeywords}
                onChange={(e) => setNewBoardKeywords(e.target.value)}
                data-testid="input-board-keywords"
              />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated keywords to help find related bills and staffers</p>
            </div>
            <Button onClick={() => createBoardMutation.mutate()} disabled={!newBoardName || createBoardMutation.isPending} data-testid="button-create-board">
              Create Board
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!selectedBoardId && !loadingBoards && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No board selected</h3>
            <p className="text-sm text-muted-foreground mb-4">Select an existing board or create a new one to start tracking your engagement pipeline</p>
            <Button onClick={() => setShowNewBoard(true)} data-testid="button-create-first-board">
              <Plus className="h-4 w-4 mr-1" /> Create Your First Board
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedBoard && selectedBoard.description?.includes("Keywords:") && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Keywords:</span>
          {selectedBoard.description
            .split("Keywords:")[1]
            .split(",")
            .map(k => k.trim())
            .filter(Boolean)
            .map((keyword, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{keyword}</Badge>
            ))
          }
        </div>
      )}

      {selectedBoard && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {KANBAN_STAGES.map((stage) => {
            const stageCards = (cards || []).filter(c => c.stage === stage).sort((a, b) => (a.position || 0) - (b.position || 0));
            return (
              <div
                key={stage}
                className={`flex-shrink-0 w-64 rounded-lg ${STAGE_COLORS[stage] || "bg-muted"} p-3`}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-primary"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-primary"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("ring-2", "ring-primary");
                  if (dragCard) {
                    moveCardMutation.mutate({ cardId: dragCard, stage });
                    setDragCard(null);
                  }
                }}
                data-testid={`kanban-column-${stage.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="font-medium text-sm">{stage}</h4>
                  <Badge variant="secondary" className="text-xs">{stageCards.length}</Badge>
                </div>

                <div className="space-y-2 min-h-[100px]">
                  {stageCards.map((card) => {
                    const meta = (card.entityMeta || {}) as Record<string, any>;
                    return (
                      <Card
                        key={card.id}
                        draggable
                        onDragStart={() => setDragCard(card.id)}
                        onDragEnd={() => setDragCard(null)}
                        className={`cursor-grab active:cursor-grabbing ${dragCard === card.id ? "opacity-50" : ""}`}
                        data-testid={`card-kanban-${card.id}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{card.entityName}</p>
                              {meta.title && <p className="text-xs text-muted-foreground truncate">{meta.title}</p>}
                              {meta.office && <p className="text-xs text-muted-foreground truncate">{meta.office}</p>}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="shrink-0 h-6 w-6"
                              onClick={() => deleteCardMutation.mutate(card.id)}
                              data-testid={`button-delete-card-${card.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          {card.notes && <p className="text-xs text-muted-foreground mt-2 italic">{card.notes}</p>}
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Badge variant="outline" className="text-xs">{card.entityType}</Badge>
                            {card.priority === "high" && <Badge variant="destructive" className="text-xs">High</Badge>}
                            {card.priority === "critical" && <Badge variant="destructive" className="text-xs">Critical</Badge>}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Dialog open={addCardStage === stage} onOpenChange={(open) => { if (!open) { setAddCardStage(null); setAddCardSearch(""); } }}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => {
                        setAddCardStage(stage);
                        // Seed the search with the board's first keyword so
                        // relevant staffers appear before any typing.
                        if (boardKeywords[0]) setAddCardSearch(boardKeywords[0]);
                      }}
                      data-testid={`button-add-card-${stage.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add to {stage}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Input
                        placeholder="Search staffers..."
                        value={addCardSearch}
                        onChange={(e) => setAddCardSearch(e.target.value)}
                        data-testid="input-add-card-search"
                      />
                      {searchResults?.staffers?.map((s) => (
                        <button
                          key={s.id}
                          className="w-full text-left px-3 py-2 hover-elevate rounded-md border"
                          onClick={() => addCardMutation.mutate({
                            entityType: "staffer",
                            entityId: String(s.legistormId),
                            entityName: s.fullName || "",
                            entityMeta: { title: s.currentTitle, office: s.currentOffice, party: s.party, chamber: s.chamber, email: s.email },
                            stage,
                          })}
                          data-testid={`button-add-staffer-${s.legistormId}`}
                        >
                          <p className="text-sm font-medium">{s.fullName}</p>
                          <p className="text-xs text-muted-foreground">{s.currentTitle} - {s.currentOffice}</p>
                        </button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BillInfluenceView() {
  const [billSearch, setBillSearch] = useState("");
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedBillLabel, setSelectedBillLabel] = useState("");
  const { toast } = useToast();

  const { data: billResults, isLoading: searchingBills } = useQuery<any[]>({
    queryKey: ["/api/strategy/bill-search", billSearch],
    queryFn: async () => {
      if (!billSearch || billSearch.length < 2) return [];
      const res = await fetch(`/api/strategy/bill-search?q=${encodeURIComponent(billSearch)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: billSearch.length >= 2,
    staleTime: 30000,
  });

  const { data: billInfluence, isLoading: loadingInfluence } = useQuery<{
    staffers: any[];
    aiStrategy: string;
  }>({
    queryKey: ["/api/strategy/bill-influence", selectedBillId],
    queryFn: async () => {
      const res = await fetch(`/api/strategy/bill-influence?billId=${encodeURIComponent(selectedBillId!)}&billLabel=${encodeURIComponent(selectedBillLabel)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch influence data");
      return res.json();
    },
    enabled: !!selectedBillId,
    staleTime: 60000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold" data-testid="text-bill-influence-title">Bill Influence Map</h2>
        <p className="text-sm text-muted-foreground">See who worked on a bill and find the best paths to influence its outcome</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bills by number or keyword (e.g., HR 1234, infrastructure)..."
              value={billSearch}
              onChange={(e) => { setBillSearch(e.target.value); setSelectedBillId(null); }}
              className="pl-9"
              data-testid="input-bill-search"
            />
          </div>
          {billResults && billResults.length > 0 && !selectedBillId && (
            <div className="border rounded-md mt-3 max-h-60 overflow-auto">
              {billResults.map((b: any, idx: number) => (
                <button
                  key={idx}
                  className="w-full text-left px-4 py-3 hover-elevate border-b last:border-b-0"
                  onClick={() => {
                    setSelectedBillId(b.billId || b.number);
                    setSelectedBillLabel(b.title || b.number);
                    setBillSearch(b.title || b.number);
                  }}
                  data-testid={`button-select-bill-${idx}`}
                >
                  <p className="text-sm font-medium">{b.type?.toUpperCase()}.{b.number} - {b.title}</p>
                  <p className="text-xs text-muted-foreground">Congress {b.congress}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedBillId && (
        <>
          {loadingInfluence ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (<Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>))}
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-lg">{selectedBillLabel}</h3>

              {billInfluence?.staffers && billInfluence.staffers.length > 0 ? (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Connected Staffers ({billInfluence.staffers.length})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {billInfluence.staffers.map((s: any, idx: number) => (
                      <Card key={idx} data-testid={`card-bill-staffer-${idx}`}>
                        <CardContent className="p-4">
                          <p className="font-medium text-sm">{s.stafferName}</p>
                          <p className="text-xs text-muted-foreground">{s.positionTitle}</p>
                          {s.role && <Badge variant="secondary" className="text-xs mt-1">{s.role}</Badge>}
                          {s.positionMemberName && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <User className="h-3 w-3" /> {s.positionMemberName}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No staffer connections found for this bill yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Use Bill Mapping to connect staffers to bills</p>
                  </CardContent>
                </Card>
              )}

              {billInfluence?.aiStrategy && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Brain className="h-4 w-4" /> AI Influence Strategy
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm whitespace-pre-wrap" data-testid="text-bill-ai-strategy">{renderMarkdown(billInfluence.aiStrategy)}</div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function NetworkPathFinder() {
  const [targetInput, setTargetInput] = useState("");
  const [pathResult, setPathResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const findPath = async (targetOverride?: string) => {
    const target = (targetOverride ?? targetInput).trim();
    if (!target) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/strategy/find-path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target }),
      });
      if (!res.ok) throw new Error("Failed to find path");
      const data = await res.json();
      setPathResult(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold" data-testid="text-pathfinder-title">Network Path Finder</h2>
        <p className="text-sm text-muted-foreground">Find the shortest path to reach a target through your network of contacts and staffers</p>
      </div>

      <SavedViewsBar
        view="pathfinder"
        currentName={targetInput.trim()}
        currentParams={pathResult && targetInput.trim() ? { target: targetInput.trim() } : null}
        onLoad={(p) => {
          setTargetInput(p.target);
          findPath(p.target);
        }}
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Target className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Who do you need access to? (e.g., Senator Warren, Energy Committee Chair)"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === "Enter" && findPath()}
                data-testid="input-pathfinder-target"
              />
            </div>
            <Button onClick={() => findPath()} disabled={loading || !targetInput.trim()} data-testid="button-find-path">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Find Path
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Analyzing network connections and finding optimal paths...</p>
          </CardContent>
        </Card>
      )}

      {pathResult && !loading && (
        <div className="space-y-4">
          {pathResult.aiRecommendation && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4" /> AI-Recommended Strategy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm whitespace-pre-wrap" data-testid="text-path-ai-recommendation">
                  {pathResult.aiRecommendation.split("\n").map((line: string, lineIdx: number) => (
                    <span key={lineIdx}>
                      {renderMarkdown(line)}
                      {lineIdx < pathResult.aiRecommendation.split("\n").length - 1 && "\n"}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {pathResult.directStaffers && pathResult.directStaffers.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> Direct Access Points ({pathResult.directStaffers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pathResult.directStaffers.map((s: any, idx: number) => {
                    const influence = getInfluenceScore(s.currentTitle || "");
                    return (
                      <div key={idx} className="flex items-center gap-3 p-3 border rounded-md" data-testid={`path-staffer-${idx}`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                              {influence.score}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{influence.label} Influence ({influence.score}/100)</p>
                            <p className="text-xs text-muted-foreground">Based on title: {s.currentTitle}</p>
                          </TooltipContent>
                        </Tooltip>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.currentTitle}</p>
                          {s.email && <p className="text-xs text-muted-foreground">{s.email}</p>}
                        </div>
                        <span className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${influence.pillClass}`}>{influence.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {pathResult.committeeConnections && pathResult.committeeConnections.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Committee Connections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pathResult.committeeConnections.map((c: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-2 border rounded-md" data-testid={`path-committee-${idx}`}>
                      <Badge variant="outline" className="text-xs">{c.committee}</Badge>
                      <span className="text-xs text-muted-foreground">{c.role}</span>
                      {c.stafferName && <span className="text-xs font-medium ml-auto">{c.stafferName}</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(!pathResult.directStaffers?.length && !pathResult.committeeConnections?.length && !pathResult.aiRecommendation) && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No direct paths found</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function PowerGridDashboard() {
  const [chamberFilter, setChamberFilter] = useState("all");
  const [partyFilter, setPartyFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: gridData, isLoading } = useQuery<any[]>({
    queryKey: ["/api/strategy/power-grid", chamberFilter, partyFilter, stateFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (chamberFilter !== "all") params.set("chamber", chamberFilter);
      if (partyFilter !== "all") params.set("party", partyFilter);
      if (stateFilter) params.set("state", stateFilter);
      const res = await fetch(`/api/strategy/power-grid?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch power grid");
      return res.json();
    },
    staleTime: 60000,
  });

  const filteredGrid = useMemo(() => {
    if (!gridData) return [];
    if (!searchQuery) return gridData;
    const q = searchQuery.toLowerCase();
    return gridData.filter((item: any) =>
      item.memberName?.toLowerCase().includes(q) ||
      item.state?.toLowerCase().includes(q)
    );
  }, [gridData, searchQuery]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold" data-testid="text-power-grid-title">Power Grid</h2>
        <p className="text-sm text-muted-foreground">Overview of Members of Congress with their key staff and influence indicators</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-power-grid-search"
              />
            </div>
            <Select value={chamberFilter} onValueChange={setChamberFilter}>
              <SelectTrigger data-testid="select-power-grid-chamber">
                <SelectValue placeholder="Chamber" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chambers</SelectItem>
                <SelectItem value="House">House</SelectItem>
                <SelectItem value="Senate">Senate</SelectItem>
              </SelectContent>
            </Select>
            <Select value={partyFilter} onValueChange={setPartyFilter}>
              <SelectTrigger data-testid="select-power-grid-party">
                <SelectValue placeholder="Party" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Parties</SelectItem>
                <SelectItem value="Republican">Republican</SelectItem>
                <SelectItem value="Democrat">Democrat</SelectItem>
                <SelectItem value="Independent">Independent</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="State (e.g., CA, TX)"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value.toUpperCase())}
              maxLength={2}
              data-testid="input-power-grid-state"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (<Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGrid.map((member: any, idx: number) => {
            const partyColor = member.party === "Republican" ? "text-red-500" : member.party === "Democrat" ? "text-blue-500" : "text-muted-foreground";
            return (
              <Card key={idx} data-testid={`card-power-grid-${idx}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-sm">{member.memberName}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">{member.chamber}</Badge>
                        <span className={`text-xs font-medium ${partyColor}`}>{member.party}</span>
                        <span className="text-xs text-muted-foreground">{member.state}</span>
                      </div>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-primary">{member.staffCount}</p>
                          <p className="text-xs text-muted-foreground">staff</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total staffers tracked for {member.memberName}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {member.topStaffers && member.topStaffers.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Key Staff:</p>
                      {member.topStaffers.slice(0, 3).map((s: any, sIdx: number) => {
                        const inf = getInfluenceScore(s.title || "");
                        return (
                          <div key={sIdx} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{s.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{s.title}</p>
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant={inf.color as any} className="text-xs shrink-0 cursor-help">{inf.score}</Badge>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p className="font-medium">{inf.label} Influence</p>
                                <p className="text-xs text-muted-foreground">{s.title} — Score: {inf.score}/100</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {filteredGrid.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <LayoutGrid className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No members found matching your filters</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function StrategyBoardPage() {
  const [activeView, setActiveView] = useState<ActiveView>("access");

  const views = [
    { id: "access" as ActiveView, label: "Access Map", icon: Target, desc: "Find the best path to a member" },
    { id: "kanban" as ActiveView, label: "Pipeline", icon: LayoutGrid, desc: "Track engagement stages" },
    { id: "bill-influence" as ActiveView, label: "Bill Influence", icon: FileText, desc: "Map bill stakeholders" },
    { id: "pathfinder" as ActiveView, label: "Path Finder", icon: Network, desc: "AI-powered network paths" },
    { id: "power-grid" as ActiveView, label: "Power Grid", icon: Crown, desc: "Member overview dashboard" },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Target className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-strategy-page-title">Strategy Board</h1>
        </div>
        <p className="text-muted-foreground">Strategic intelligence tools for political access and engagement</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-center transition-colors ${
              activeView === v.id
                ? "border-primary bg-primary/5"
                : "border-transparent hover-elevate"
            }`}
            data-testid={`button-view-${v.id}`}
          >
            <v.icon className={`h-5 w-5 ${activeView === v.id ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`text-xs font-medium ${activeView === v.id ? "text-primary" : ""}`}>{v.label}</span>
          </button>
        ))}
      </div>

      {activeView === "access" && <AccessMappingBoard />}
      {activeView === "kanban" && <StrategyKanbanBoard />}
      {activeView === "bill-influence" && <BillInfluenceView />}
      {activeView === "pathfinder" && <NetworkPathFinder />}
      {activeView === "power-grid" && <PowerGridDashboard />}
    </div>
  );
}

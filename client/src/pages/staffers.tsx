import { useState, useEffect } from "react";
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
import { getAvatarUrl } from "@/lib/avatar-utils";
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
  CheckSquare,
  Database,
  Phone,
  ChevronLeft,
  ChevronRight,
  History,
  FileText,
  Linkedin,
  MoreHorizontal,
  UserPlus,
  FolderOpen,
  BookOpen,
  Copy,
  Book,
  Building,
  Shield,
  Award,
  Loader2,
  Landmark,
  ArrowRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type { Staffer, LegistormStaffer } from "@shared/schema";

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

interface VeteranStaffer {
  id: string;
  fullName: string;
  currentTitle: string | null;
  currentOffice: string | null;
  currentMemberName: string | null;
  chamber: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  careerResearch: string | null;
  linkedinUrl: string | null;
  photoUrl?: string | null;
}

function detectMilitaryBranch(title: string | null, research: string | null): string | null {
  const text = ((title || "") + " " + (research || "")).toLowerCase();
  if (/\b(marine corps|marines|usmc)\b/.test(text)) return "Marines";
  if (/\b(air force|usaf)\b/.test(text)) return "Air Force";
  if (/\b(space force|ussf)\b/.test(text)) return "Space Force";
  if (/\b(coast guard|uscg)\b/.test(text)) return "Coast Guard";
  if (/\b(national guard)\b/.test(text)) return "National Guard";
  if (/\b(navy|usn|naval)\b/.test(text)) return "Navy";
  if (/\b(army|usa soldier)\b/.test(text)) return "Army";
  if (/\bveteran\b/.test(text) && /\baffairs\b/.test(text)) return null;
  return null;
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function renderMarkdownBlock(content: string) {
  const normalized = content.replace(/\\n/g, "\n");
  const renderInline = (text: string) => {
    const parts = text.replace(/\[\d+\]/g, "").split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };
  return normalized.split(/\n{2,}/).map((block, bIdx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("### ")) return <h4 key={bIdx} className="font-semibold text-sm mt-2 first:mt-0 text-foreground">{renderInline(trimmed.replace(/^###\s*/, ""))}</h4>;
    if (trimmed.startsWith("## ")) return <h3 key={bIdx} className="font-semibold text-base mt-3 first:mt-0 text-foreground">{renderInline(trimmed.replace(/^##\s*/, ""))}</h3>;
    if (trimmed.startsWith("# ")) return <h2 key={bIdx} className="font-bold text-base mt-3 first:mt-0 text-foreground">{renderInline(trimmed.replace(/^#\s*/, ""))}</h2>;
    const lines = trimmed.split("\n");
    return (
      <div key={bIdx} className="space-y-1">
        {lines.map((line, lIdx) => {
          const l = line.trim();
          if (!l) return null;
          if (l.startsWith("### ")) return <h4 key={lIdx} className="font-semibold text-sm mt-2 text-foreground">{renderInline(l.replace(/^###\s*/, ""))}</h4>;
          if (l.startsWith("## ")) return <h3 key={lIdx} className="font-semibold text-base mt-2 text-foreground">{renderInline(l.replace(/^##\s*/, ""))}</h3>;
          if (/^\s*[-*]\s/.test(l)) {
            return (
              <div key={lIdx} className="flex gap-2 text-muted-foreground leading-relaxed pl-1">
                <span className="text-muted-foreground/60 mt-0.5 shrink-0">-</span>
                <span>{renderInline(l.replace(/^\s*[-*]\s*/, ""))}</span>
              </div>
            );
          }
          return <p key={lIdx} className="text-muted-foreground leading-relaxed">{renderInline(l)}</p>;
        })}
      </div>
    );
  });
}

function renderFormattedText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-medium text-foreground">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function StaffersPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("legistorm");
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

  const [lsQuery, setLsQuery] = useState("");
  const [lsChamber, setLsChamber] = useState("all");
  const [lsParty, setLsParty] = useState("all");
  const [lsState, setLsState] = useState("all");
  const [lsPage, setLsPage] = useState(0);
  const [lsSelectedId, setLsSelectedId] = useState<number | null>(null);
  const [lsResearchResult, setLsResearchResult] = useState<string | null>(null);
  const [linkedinLookupLoading, setLinkedinLookupLoading] = useState(false);

  const [vetStafferSearch, setVetStafferSearch] = useState("");
  const [selectedVetStaffer, setSelectedVetStaffer] = useState<VeteranStaffer | null>(null);
  const [vetStafferResearchResult, setVetStafferResearchResult] = useState<string | null>(null);
  
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

  const lsSearchParams = new URLSearchParams();
  if (lsQuery) lsSearchParams.set("q", lsQuery);
  if (lsChamber !== "all") lsSearchParams.set("chamber", lsChamber);
  if (lsParty !== "all") lsSearchParams.set("party", lsParty);
  if (lsState !== "all") lsSearchParams.set("state", lsState);
  lsSearchParams.set("limit", "50");
  lsSearchParams.set("offset", (lsPage * 50).toString());

  const lsSearchUrl = `/api/legistorm/staffers?${lsSearchParams.toString()}`;

  const { data: lsResult, isLoading: lsLoading, error: lsError } = useQuery<{
    staffers: LegistormStaffer[];
    total: number;
    limit: number;
    offset: number;
  }>({
    queryKey: ["/api/legistorm/staffers", lsQuery, lsChamber, lsParty, lsState, lsPage],
    queryFn: async () => {
      const res = await fetch(lsSearchUrl, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: activeTab === "legistorm",
    staleTime: 30000,
    retry: 1,
  });

  const { data: lsStatus } = useQuery<{
    syncHistory: any[];
    totalStaffers: number;
    currentStaffers: number;
    isConfigured: boolean;
  }>({
    queryKey: ["/api/legistorm/status"],
    enabled: activeTab === "legistorm",
    refetchInterval: (query) => {
      const data = query.state.data;
      const isRunning = data?.syncHistory?.some((s: any) => s.status === "running");
      return isRunning ? 3000 : false;
    },
  });

  const { data: lsStafferDetail } = useQuery<LegistormStaffer>({
    queryKey: [`/api/legistorm/staffers/${lsSelectedId}`],
    enabled: !!lsSelectedId,
  });

  const { data: veteranStaffers, isLoading: veteranStaffersLoading } = useQuery<VeteranStaffer[]>({
    queryKey: ["/api/veterans/staffers"],
    enabled: activeTab === "veterans",
  });

  const filteredVetStaffers = (veteranStaffers || []).filter(s => {
    if (!vetStafferSearch.trim()) return true;
    const q = vetStafferSearch.toLowerCase();
    return s.fullName.toLowerCase().includes(q) ||
      (s.currentTitle && s.currentTitle.toLowerCase().includes(q)) ||
      (s.currentMemberName && s.currentMemberName.toLowerCase().includes(q)) ||
      (s.state && s.state.toLowerCase().includes(q));
  });

  const vetStafferResearchMutation = useMutation({
    mutationFn: async (staffer: VeteranStaffer) => {
      const res = await apiRequest("POST", "/api/research/staffer", {
        name: staffer.fullName,
        title: staffer.currentTitle,
        organization: staffer.currentOffice,
        memberName: staffer.currentMemberName,
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      let content = data?.data?.rawContent || data?.data?.content || data?.data?.bio || data?.content || data?.summary || "";
      if (!content && data?.data && typeof data.data === "object") {
        const vals = Object.values(data.data).filter((v: any) => typeof v === "string" && v.length > 20);
        if (vals.length > 0) content = vals.join("\n\n");
      }
      if (content && typeof content === "string") {
        try {
          const parsed = JSON.parse(content);
          content = parsed?.rawContent || parsed?.content || parsed?.bio || Object.values(parsed).filter((v: any) => typeof v === "string" && v.length > 20).join("\n\n") || content;
        } catch {}
      }
      setVetStafferResearchResult(content || (typeof data === "string" ? data : "No research content available."));
    },
    onError: (error: Error) => {
      toast({ title: "Research failed", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (lsStafferDetail?.careerResearch) {
      setLsResearchResult(lsStafferDetail.careerResearch);
    } else {
      setLsResearchResult(null);
    }
  }, [lsStafferDetail, lsSelectedId]);

  const syncMutation = useMutation({
    mutationFn: async (type: "full" | "incremental") => {
      return apiRequest("POST", `/api/legistorm/sync/${type}`);
    },
    onSuccess: () => {
      toast({ title: "Sync started", description: "LegiStorm sync is running in the background." });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/legistorm");
        },
      });
    },
    onError: (error: Error) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const lsResearchMutation = useMutation({
    mutationFn: async (staffer: LegistormStaffer) => {
      const res = await apiRequest("POST", "/api/research/staffer", {
        name: staffer.fullName,
        title: staffer.currentTitle,
        organization: staffer.currentOffice,
        memberName: staffer.currentMemberName,
        legistormId: staffer.legistormId,
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      let content = data?.content || data?.summary || "";
      if (content && typeof content === "string") {
        try {
          const parsed = JSON.parse(content);
          content = parsed?.rawContent || parsed?.content || parsed?.bio || Object.values(parsed).filter((v: any) => typeof v === "string" && v.length > 20).join("\n\n") || content;
        } catch {}
      }
      setLsResearchResult(content || "No research content available.");
      const foundLinkedin = data?.data?.linkedinUrl;
      if (foundLinkedin) {
        toast({ title: "Research Complete", description: `Career research done and LinkedIn profile found.` });
        queryClient.invalidateQueries({ queryKey: [`/api/legistorm/staffers/${lsSelectedId}`] });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Research failed", description: error.message, variant: "destructive" });
    },
  });

  const { data: lsStafferBills } = useQuery<any[]>({
    queryKey: ["/api/legistorm/staffers", lsSelectedId, "bills"],
    queryFn: async () => {
      const res = await fetch(`/api/legistorm/staffers/${lsSelectedId}/bills`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!lsSelectedId,
  });

  const linkedinLookupMutation = useMutation({
    mutationFn: async (legistormId: number) => {
      setLinkedinLookupLoading(true);
      const res = await apiRequest("POST", `/api/legistorm/staffers/${legistormId}/linkedin`);
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data.success && data.linkedinUrl) {
        toast({ title: "LinkedIn Found", description: "Profile URL saved to staffer record." });
        queryClient.invalidateQueries({ queryKey: [`/api/legistorm/staffers/${lsSelectedId}`] });
      } else {
        toast({ title: "Not Found", description: data.error || "Could not find a LinkedIn profile for this staffer.", variant: "destructive" });
      }
      setLinkedinLookupLoading(false);
    },
    onError: (error: Error) => {
      toast({ title: "Lookup failed", description: error.message, variant: "destructive" });
      setLinkedinLookupLoading(false);
    },
  });

  const createStafferMutation = useMutation({
    mutationFn: async (data: typeof newStaffer) => {
      return apiRequest("POST", "/api/staffers", data);
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
      const res = await apiRequest("POST", "/api/miro/map-multiple", {
        stafferIds: selectedStaffers,
        boardName: `Selected Staffers (${selectedStaffers.length})`,
      });
      const data = await res.json();
      toast({ title: "Miro board created", description: `Created board with ${data.itemsCreated} items` });
      window.open(data.miroBoardUrl, "_blank");
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
      const res = await apiRequest("POST", "/api/miro/map-office", { memberName: memberFilter });
      const data = await res.json();
      toast({ title: "Miro board created", description: `Created board with ${data.itemsCreated} items for ${memberFilter}` });
      window.open(data.miroBoardUrl, "_blank");
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
          <TabsTrigger value="legistorm" data-testid="tab-legistorm">
            <Database className="h-4 w-4 mr-2" />
            LegiStorm Directory
          </TabsTrigger>
          <TabsTrigger value="veterans" data-testid="tab-veterans">
            <Shield className="h-4 w-4 mr-2" />
            Veterans
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
              <p className="text-sm text-muted-foreground" data-testid="text-staffer-count">
                {(search || chamber !== "all" || party !== "all") && stats?.totalStaffers
                  ? `${searchResult?.total || staffers.length} of ${stats.totalStaffers} staffers found`
                  : `${searchResult?.total || staffers.length} staffer${(searchResult?.total || staffers.length) !== 1 ? "s" : ""} found`}
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
                          <AvatarImage src={getAvatarUrl(staffer.name, staffer.photoUrl)} alt={staffer.name} />
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

        <TabsContent value="legistorm" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-sm">
                {lsStatus?.totalStaffers?.toLocaleString() || 0} total staffers
              </Badge>
              <Badge variant="outline" className="text-sm">
                {lsStatus?.currentStaffers?.toLocaleString() || 0} current
              </Badge>
              {lsStatus?.syncHistory?.[0] && (
                <span className="text-xs text-muted-foreground">
                  Last sync: {lsStatus.syncHistory[0].status === "running"
                    ? `In progress... (${(lsStatus.syncHistory[0].recordsProcessed || 0).toLocaleString()} records processed)`
                    : lsStatus.syncHistory[0].status === "failed"
                      ? `Failed: ${lsStatus.syncHistory[0].errorMessage || "Unknown error"}`
                      : lsStatus.syncHistory[0].completedAt
                        ? new Date(lsStatus.syncHistory[0].completedAt).toLocaleDateString()
                        : "Never"
                  }
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate("incremental")}
                disabled={syncMutation.isPending || lsStatus?.syncHistory?.[0]?.status === "running"}
                data-testid="button-incremental-sync"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Incremental Sync
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate("full")}
                disabled={syncMutation.isPending || lsStatus?.syncHistory?.[0]?.status === "running"}
                data-testid="button-full-sync"
              >
                <Database className="h-4 w-4 mr-2" />
                {lsStatus?.syncHistory?.[0]?.status === "running" ? "Syncing..." : "Full Sync"}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search LegiStorm Directory</CardTitle>
              <CardDescription>Search across {lsStatus?.totalStaffers?.toLocaleString() || 0} congressional staffers from LegiStorm</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-1">
                  <Input
                    placeholder="Search by name, title, office..."
                    value={lsQuery}
                    onChange={(e) => { setLsQuery(e.target.value); setLsPage(0); }}
                    className="w-full"
                    data-testid="input-ls-search"
                  />
                </div>
                <Select value={lsChamber} onValueChange={(v) => { setLsChamber(v); setLsPage(0); }}>
                  <SelectTrigger data-testid="select-ls-chamber">
                    <SelectValue placeholder="Chamber" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAMBERS.filter(c => c.value !== "Both" && c.value !== "Former").map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={lsParty} onValueChange={(v) => { setLsParty(v); setLsPage(0); }}>
                  <SelectTrigger data-testid="select-ls-party">
                    <SelectValue placeholder="Party" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={lsState} onValueChange={(v) => { setLsState(v); setLsPage(0); }}>
                  <SelectTrigger data-testid="select-ls-state">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {lsLoading ? (
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
          ) : (lsResult?.staffers?.length || 0) === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Database className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {(lsStatus?.totalStaffers || 0) === 0 ? "No LegiStorm data synced yet" : "No staffers match your search"}
                </h3>
                <p className="text-muted-foreground text-center mb-4">
                  {(lsStatus?.totalStaffers || 0) === 0
                    ? "Run a full sync to download congressional staff data from LegiStorm"
                    : "Try adjusting your search filters"
                  }
                </p>
                {(lsStatus?.totalStaffers || 0) === 0 && (
                  <Button onClick={() => syncMutation.mutate("full")} disabled={syncMutation.isPending}>
                    <Database className="h-4 w-4 mr-2" />
                    Start Full Sync
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Showing {(lsResult?.offset || 0) + 1}-{Math.min((lsResult?.offset || 0) + (lsResult?.limit || 50), lsResult?.total || 0)} of {lsResult?.total?.toLocaleString()} staffers
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setLsPage(p => Math.max(0, p - 1))}
                    disabled={lsPage === 0}
                    data-testid="button-ls-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {lsPage + 1} of {Math.ceil((lsResult?.total || 0) / 50)}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setLsPage(p => p + 1)}
                    disabled={(lsPage + 1) * 50 >= (lsResult?.total || 0)}
                    data-testid="button-ls-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lsResult?.staffers?.map((staffer) => (
                  <Card
                    key={staffer.id}
                    className="hover-elevate cursor-pointer transition-all"
                    onClick={() => setLsSelectedId(staffer.legistormId)}
                    data-testid={`card-ls-staffer-${staffer.legistormId}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={getAvatarUrl(staffer.fullName)} alt={staffer.fullName} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {staffer.fullName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{staffer.fullName}</h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {staffer.currentTitle || "Staff"}
                          </p>
                          {staffer.currentMemberName && (
                            <p className="text-sm text-muted-foreground truncate">
                              {staffer.currentMemberName}
                            </p>
                          )}
                          {staffer.currentOffice && !staffer.currentMemberName && (
                            <p className="text-sm text-muted-foreground truncate">
                              {staffer.currentOffice}
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
                      </div>
                      {staffer.email && (
                        <p className="text-xs text-muted-foreground mt-3 truncate flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {staffer.email}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          <Dialog open={!!lsSelectedId} onOpenChange={(open) => { if (!open) { setLsSelectedId(null); setLsResearchResult(null); } }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="text-xl">{lsStafferDetail?.fullName || "Staffer Details"}</DialogTitle>
                  {lsStafferDetail && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid="button-staffer-actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            const firstName = lsStafferDetail.firstName || lsStafferDetail.fullName.split(" ")[0] || "";
                            const lastName = lsStafferDetail.lastName || lsStafferDetail.fullName.split(" ").slice(1).join(" ") || "";
                            const path = `/contacts?add=true&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&email=${encodeURIComponent(lsStafferDetail.email || "")}&title=${encodeURIComponent(lsStafferDetail.currentTitle || "")}&organization=${encodeURIComponent(lsStafferDetail.currentOffice || "")}`;
                            navigate(path);
                          }}
                          data-testid="menu-add-to-contacts"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add to Client Contacts
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            const stafferContent = `Staffer: ${lsStafferDetail.fullName}\nTitle: ${lsStafferDetail.currentTitle || ""}\nOffice: ${lsStafferDetail.currentOffice || ""}\nMember: ${lsStafferDetail.currentMemberName || ""}\nEmail: ${lsStafferDetail.email || ""}\nPhone: ${lsStafferDetail.phone || ""}\n${(lsStafferDetail as any).linkedinUrl ? "LinkedIn: " + (lsStafferDetail as any).linkedinUrl : ""}`;
                            navigate(`/admin/kb?addArticle=true&title=${encodeURIComponent(lsStafferDetail.fullName + " - Staffer Profile")}&content=${encodeURIComponent(stafferContent)}`);
                          }}
                          data-testid="menu-add-to-kb"
                        >
                          <Book className="h-4 w-4 mr-2" />
                          Knowledge Base
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            navigate(`/matters?addDoc=true&title=${encodeURIComponent(lsStafferDetail.fullName + " - Staffer Profile")}&content=${encodeURIComponent(`Staffer: ${lsStafferDetail.fullName}\nTitle: ${lsStafferDetail.currentTitle || ""}\nOffice: ${lsStafferDetail.currentOffice || ""}\nMember: ${lsStafferDetail.currentMemberName || ""}\nEmail: ${lsStafferDetail.email || ""}\nPhone: ${lsStafferDetail.phone || ""}\n${(lsStafferDetail as any).linkedinUrl ? "LinkedIn: " + (lsStafferDetail as any).linkedinUrl : ""}`)}`);
                          }}
                          data-testid="menu-add-to-research"
                        >
                          <FolderOpen className="h-4 w-4 mr-2" />
                          Research Project
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            const firstName = lsStafferDetail.firstName || lsStafferDetail.fullName.split(" ")[0] || "";
                            const lastName = lsStafferDetail.lastName || lsStafferDetail.fullName.split(" ").slice(1).join(" ") || "";
                            navigate(`/admin/clients?addClient=true&name=${encodeURIComponent(lsStafferDetail.fullName)}&contactName=${encodeURIComponent(firstName + " " + lastName)}&contactEmail=${encodeURIComponent(lsStafferDetail.email || "")}`);
                          }}
                          data-testid="menu-add-as-client"
                        >
                          <Building className="h-4 w-4 mr-2" />
                          Add as Client
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            const info = [
                              lsStafferDetail.fullName,
                              lsStafferDetail.currentTitle,
                              lsStafferDetail.currentOffice,
                              lsStafferDetail.email,
                              lsStafferDetail.phone,
                              (lsStafferDetail as any).linkedinUrl,
                            ].filter(Boolean).join("\n");
                            navigator.clipboard.writeText(info);
                            toast({ title: "Copied", description: "Staffer info copied to clipboard" });
                          }}
                          data-testid="menu-copy-info"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Info
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </DialogHeader>
              {lsStafferDetail ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {lsStafferDetail.currentTitle && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Title</p>
                        <p className="text-sm">{lsStafferDetail.currentTitle}</p>
                      </div>
                    )}
                    {lsStafferDetail.currentMemberName && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Member</p>
                        <p className="text-sm">{lsStafferDetail.currentMemberName}</p>
                      </div>
                    )}
                    {lsStafferDetail.currentOffice && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Office</p>
                        <p className="text-sm">{lsStafferDetail.currentOffice}</p>
                      </div>
                    )}
                    {lsStafferDetail.chamber && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Chamber</p>
                        <Badge variant="outline" className={getChamberColor(lsStafferDetail.chamber)}>
                          {lsStafferDetail.chamber}
                        </Badge>
                      </div>
                    )}
                    {lsStafferDetail.party && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Party</p>
                        <Badge variant="outline" className={getPartyColor(lsStafferDetail.party)}>
                          {lsStafferDetail.party}
                        </Badge>
                      </div>
                    )}
                    {lsStafferDetail.state && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">State</p>
                        <p className="text-sm">{lsStafferDetail.state}{lsStafferDetail.district ? ` - District ${lsStafferDetail.district}` : ""}</p>
                      </div>
                    )}
                  </div>

                  {(lsStafferDetail.email || lsStafferDetail.phone || lsStafferDetail.officeAddress || (lsStafferDetail as any).linkedinUrl) && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Contact Information</h4>
                      {lsStafferDetail.email && (
                        <p className="text-sm flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${lsStafferDetail.email}`} className="text-primary hover:underline">{lsStafferDetail.email}</a>
                        </p>
                      )}
                      {lsStafferDetail.phone && (
                        <p className="text-sm flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {lsStafferDetail.phone}
                        </p>
                      )}
                      {lsStafferDetail.officeAddress && (
                        <p className="text-sm flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {lsStafferDetail.officeAddress}
                        </p>
                      )}
                      {(lsStafferDetail as any).linkedinUrl && (
                        <p className="text-sm flex items-center gap-2">
                          <Linkedin className="h-4 w-4 text-muted-foreground" />
                          <a href={(lsStafferDetail as any).linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid="link-linkedin-profile">
                            {(lsStafferDetail as any).linkedinUrl}
                          </a>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => lsStafferDetail && lsResearchMutation.mutate(lsStafferDetail)}
                      disabled={lsResearchMutation.isPending}
                      data-testid="button-research-career"
                    >
                      {lsResearchMutation.isPending ? (
                        <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Researching...</>
                      ) : (
                        <><Search className="h-4 w-4 mr-2" /> Research Career + LinkedIn</>
                      )}
                    </Button>
                    {!(lsStafferDetail as any).linkedinUrl && !lsResearchMutation.isPending && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => lsStafferDetail && linkedinLookupMutation.mutate(lsStafferDetail.legistormId)}
                        disabled={linkedinLookupLoading}
                        data-testid="button-find-linkedin"
                      >
                        {linkedinLookupLoading ? (
                          <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Finding LinkedIn...</>
                        ) : (
                          <><Linkedin className="h-4 w-4 mr-2" /> Find LinkedIn Only</>
                        )}
                      </Button>
                    )}
                  </div>

                  {lsResearchResult && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        AI Career Research
                      </h4>
                      <div className="p-4 rounded-md bg-muted/50 text-sm max-h-[400px] overflow-y-auto space-y-3">
                        {lsResearchResult.split(/\n{2,}/).map((block, bIdx) => {
                          const trimmed = block.trim();
                          if (!trimmed) return null;

                          if (trimmed.startsWith("### ")) {
                            const heading = trimmed.replace(/^###\s*/, "").replace(/\*\*/g, "").replace(/\[\d+\]/g, "");
                            return <h4 key={bIdx} className="font-semibold text-sm mt-3 first:mt-0 text-foreground">{heading}</h4>;
                          }
                          if (trimmed.startsWith("## ")) {
                            const heading = trimmed.replace(/^##\s*/, "").replace(/\*\*/g, "").replace(/\[\d+\]/g, "");
                            return <h3 key={bIdx} className="font-semibold text-base mt-3 first:mt-0 text-foreground">{heading}</h3>;
                          }

                          const lines = trimmed.split("\n");
                          const isList = lines.every(l => /^\s*[-*•]\s/.test(l) || !l.trim());
                          if (isList) {
                            return (
                              <ul key={bIdx} className="space-y-1 pl-1">
                                {lines.filter(l => l.trim()).map((line, lIdx) => {
                                  const content = line.replace(/^\s*[-*•]\s*/, "")
                                    .replace(/\[\d+\]/g, "")
                                    .replace(/\*\*([^*]+)\*\*/g, "$1");
                                  const parts = content.split(/\*\*([^*]+)\*\*/);
                                  return (
                                    <li key={lIdx} className="flex gap-2 text-muted-foreground leading-relaxed">
                                      <span className="text-muted-foreground/60 mt-0.5 shrink-0">-</span>
                                      <span>{renderFormattedText(content)}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            );
                          }

                          const cleanedText = trimmed.replace(/\[\d+\]/g, "");
                          return <p key={bIdx} className="text-muted-foreground leading-relaxed">{renderFormattedText(cleanedText)}</p>;
                        })}
                      </div>
                    </div>
                  )}

                  {lsStafferDetail.positions && (lsStafferDetail.positions as any[]).length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Position History ({(lsStafferDetail.positions as any[]).length})
                      </h4>
                      <div className="space-y-2">
                        {(lsStafferDetail.positions as any[]).map((pos: any, i: number) => {
                          const posStartYear = pos.startDate ? parseInt(pos.startDate.split("-")[0]) : null;
                          const posEndYear = pos.endDate ? parseInt(pos.endDate.split("-")[0]) : new Date().getFullYear();
                          const matchingBills = (lsStafferBills || []).filter((bill: any) => {
                            if (!bill.yearStart && !bill.yearEnd) {
                              if (bill.positionMemberName && pos.memberName) {
                                return bill.positionMemberName.toLowerCase().includes(pos.memberName.toLowerCase().split(" ").pop() || "");
                              }
                              return false;
                            }
                            const billStart = bill.yearStart || bill.yearEnd;
                            const billEnd = bill.yearEnd || bill.yearStart;
                            if (posStartYear && posEndYear) {
                              return billStart <= posEndYear && billEnd >= posStartYear;
                            }
                            return false;
                          });

                          return (
                            <div key={pos.id || i} className="p-3 rounded-md bg-muted/50 space-y-2 hover-elevate group/pos">
                              <div className="flex items-start gap-3">
                                <div className={`h-2 w-2 mt-2 rounded-full shrink-0 ${pos.isCurrent ? "bg-green-500" : "bg-muted-foreground/50"}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{pos.title}</p>
                                  {pos.memberName && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {pos.memberName}
                                      {pos.chamber && <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1">{pos.chamber}</Badge>}
                                      {pos.state && <span className="text-muted-foreground/70">({pos.state}{pos.district ? `-${pos.district}` : ""})</span>}
                                    </p>
                                  )}
                                  {pos.officeName && !pos.memberName && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Building2 className="h-3 w-3" />
                                      {pos.officeName}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {pos.startDate || "Unknown"} - {pos.isCurrent ? "Present" : pos.endDate || "Unknown"}
                                  </p>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover/pos:opacity-100 focus:opacity-100 transition-opacity" data-testid={`button-position-actions-${i}`}>
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        const firstName = lsStafferDetail?.firstName || lsStafferDetail?.fullName.split(" ")[0] || "";
                                        const lastName = lsStafferDetail?.lastName || lsStafferDetail?.fullName.split(" ").slice(1).join(" ") || "";
                                        navigate(`/contacts?add=true&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&email=${encodeURIComponent(lsStafferDetail?.email || "")}&title=${encodeURIComponent(pos.title || "")}&organization=${encodeURIComponent(pos.officeName || "")}`);
                                      }}
                                      data-testid={`menu-position-add-contact-${i}`}
                                    >
                                      <UserPlus className="h-4 w-4 mr-2" />
                                      Add to Client Contacts
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        const posContent = `${lsStafferDetail?.fullName || ""}\nPosition: ${pos.title}\nMember: ${pos.memberName || "N/A"}\nOffice: ${pos.officeName || "N/A"}\nChamber: ${pos.chamber || "N/A"}\nState: ${pos.state || "N/A"}\nPeriod: ${pos.startDate || "?"} - ${pos.isCurrent ? "Present" : pos.endDate || "?"}`;
                                        navigate(`/admin/kb?addArticle=true&title=${encodeURIComponent(`${lsStafferDetail?.fullName || ""} - ${pos.title}`)}&content=${encodeURIComponent(posContent)}`);
                                      }}
                                      data-testid={`menu-position-add-kb-${i}`}
                                    >
                                      <Book className="h-4 w-4 mr-2" />
                                      Knowledge Base
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        const positionInfo = `${lsStafferDetail?.fullName || ""} - ${pos.title}${pos.memberName ? ` under ${pos.memberName}` : ""}${pos.officeName ? ` at ${pos.officeName}` : ""} (${pos.startDate || "?"} - ${pos.isCurrent ? "Present" : pos.endDate || "?"})`;
                                        navigate(`/matters?addDoc=true&title=${encodeURIComponent(positionInfo)}&content=${encodeURIComponent(`Position: ${pos.title}\nMember: ${pos.memberName || "N/A"}\nOffice: ${pos.officeName || "N/A"}\nChamber: ${pos.chamber || "N/A"}\nState: ${pos.state || "N/A"}\nPeriod: ${pos.startDate || "?"} - ${pos.isCurrent ? "Present" : pos.endDate || "?"}`)}`);
                                      }}
                                      data-testid={`menu-position-add-research-${i}`}
                                    >
                                      <FolderOpen className="h-4 w-4 mr-2" />
                                      Research Project
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        navigate(`/admin/clients?addClient=true&name=${encodeURIComponent(lsStafferDetail?.fullName || "")}&contactName=${encodeURIComponent(lsStafferDetail?.fullName || "")}&contactEmail=${encodeURIComponent(lsStafferDetail?.email || "")}`);
                                      }}
                                      data-testid={`menu-position-add-client-${i}`}
                                    >
                                      <Building className="h-4 w-4 mr-2" />
                                      Add as Client
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        const positionInfo = `${pos.title}${pos.memberName ? ` - ${pos.memberName}` : ""}${pos.officeName ? ` - ${pos.officeName}` : ""} (${pos.startDate || "?"} - ${pos.isCurrent ? "Present" : pos.endDate || "?"})`;
                                        navigator.clipboard.writeText(positionInfo);
                                        toast({ title: "Copied", description: "Position info copied to clipboard" });
                                      }}
                                      data-testid={`menu-position-copy-${i}`}
                                    >
                                      <Copy className="h-4 w-4 mr-2" />
                                      Copy Info
                                    </DropdownMenuItem>
                                    {pos.memberName && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          navigate(`/congress?search=${encodeURIComponent(pos.memberName)}`);
                                        }}
                                        data-testid={`menu-position-view-member-${i}`}
                                      >
                                        <User className="h-4 w-4 mr-2" />
                                        View Member
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              {matchingBills.length > 0 && (
                                <div className="ml-5 pl-3 border-l-2 border-muted-foreground/20">
                                  <p className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    Bills ({matchingBills.length})
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {matchingBills.map((bill: any) => (
                                      <Badge key={bill.id} variant="outline" className="text-[10px] py-0 px-1.5" data-testid={`badge-bill-${bill.id}`}>
                                        {bill.billType?.toUpperCase()}.{bill.billNumber}
                                        {bill.role && <span className="ml-1 text-muted-foreground/70">({bill.role})</span>}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="veterans" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2" data-testid="text-veteran-staffers-title">
                    <Shield className="h-5 w-5" />
                    Veteran Staffers & Military Liaisons
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Congressional staffers with military or veterans affairs backgrounds
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {veteranStaffersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-3 rounded-lg border">
                      <Skeleton className="h-4 w-48 mb-2" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  ))}
                </div>
              ) : veteranStaffers && veteranStaffers.length > 0 ? (
                <>
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <p className="text-sm text-muted-foreground" data-testid="text-veteran-staffer-count">
                      {filteredVetStaffers.length} of {veteranStaffers.length} staffer{veteranStaffers.length !== 1 ? "s" : ""} with military/veterans-related roles
                    </p>
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search staffers by name, title, office..."
                        value={vetStafferSearch}
                        onChange={(e) => setVetStafferSearch(e.target.value)}
                        className="pl-9"
                        data-testid="input-search-vet-staffers"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {filteredVetStaffers.map((staffer) => {
                      const branch = detectMilitaryBranch(staffer.currentTitle, staffer.careerResearch);
                      return (
                      <div key={staffer.id} className="p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => setSelectedVetStaffer(staffer)} data-testid={`card-veteran-staffer-${staffer.id}`}>
                        <div className="flex items-start gap-3">
                          <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
                            <AvatarImage src={getAvatarUrl(staffer.fullName)} alt={staffer.fullName} />
                            <AvatarFallback className="text-xs">{getInitials(staffer.fullName)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm" data-testid={`text-vet-staffer-name-${staffer.id}`}>{staffer.fullName}</span>
                              {staffer.currentTitle && (
                                <Badge variant="secondary" className="text-xs">{staffer.currentTitle}</Badge>
                              )}
                              {branch && (
                                <Badge variant="outline" className="text-xs">
                                  <Shield className="h-3 w-3 mr-1" />
                                  {branch}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {staffer.currentMemberName && (
                                <span className="text-xs text-muted-foreground">
                                  Office: {staffer.currentMemberName}
                                </span>
                              )}
                              {staffer.currentOffice && !staffer.currentMemberName && (
                                <span className="text-xs text-muted-foreground">
                                  {staffer.currentOffice}
                                </span>
                              )}
                              {staffer.chamber && (
                                <Badge variant="outline" className="text-xs">{staffer.chamber}</Badge>
                              )}
                              {staffer.state && (
                                <span className="text-xs text-muted-foreground">{staffer.state}</span>
                              )}
                            </div>
                            {staffer.email && (
                              <a href={`mailto:${staffer.email}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                                <Mail className="h-3 w-3" />
                                {staffer.email}
                              </a>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                        </div>
                      </div>
                    );})}
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No staffers with military/veterans-related titles found in the directory.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Sheet open={!!selectedVetStaffer} onOpenChange={(open) => { if (!open) { setSelectedVetStaffer(null); setVetStafferResearchResult(null); } }}>
            <SheetContent className="sm:max-w-[500px] overflow-y-auto">
              {selectedVetStaffer && (
                <>
                  <SheetHeader>
                    <div className="flex items-center justify-between gap-2">
                      <SheetTitle className="flex items-center gap-3">
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={getAvatarUrl(selectedVetStaffer.fullName)} alt={selectedVetStaffer.fullName} />
                          <AvatarFallback className="text-lg">{getInitials(selectedVetStaffer.fullName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="text-lg">{selectedVetStaffer.fullName}</span>
                          {selectedVetStaffer.currentTitle && (
                            <div className="mt-1">
                              <Badge variant="secondary" className="text-xs">{selectedVetStaffer.currentTitle}</Badge>
                            </div>
                          )}
                          {(() => {
                            const branch = detectMilitaryBranch(selectedVetStaffer.currentTitle, selectedVetStaffer.careerResearch);
                            return branch ? (
                              <div className="mt-1">
                                <Badge variant="outline" className="text-xs">
                                  <Shield className="h-3 w-3 mr-1" />
                                  {branch}
                                </Badge>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </SheetTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid="button-vet-staffer-actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              const parts = selectedVetStaffer.fullName.split(" ");
                              const firstName = parts[0] || "";
                              const lastName = parts.slice(1).join(" ") || "";
                              navigate(`/contacts?add=true&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&email=${encodeURIComponent(selectedVetStaffer.email || "")}&title=${encodeURIComponent(selectedVetStaffer.currentTitle || "")}&organization=${encodeURIComponent(selectedVetStaffer.currentOffice || "")}`);
                            }}
                            data-testid="menu-vet-add-to-contacts"
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add to Client Contacts
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const stafferContent = `Staffer: ${selectedVetStaffer.fullName}\nTitle: ${selectedVetStaffer.currentTitle || ""}\nOffice: ${selectedVetStaffer.currentOffice || ""}\nMember: ${selectedVetStaffer.currentMemberName || ""}\nEmail: ${selectedVetStaffer.email || ""}\nPhone: ${selectedVetStaffer.phone || ""}`;
                              navigate(`/admin/kb?addArticle=true&title=${encodeURIComponent(selectedVetStaffer.fullName + " - Veteran Staffer Profile")}&content=${encodeURIComponent(stafferContent)}`);
                            }}
                            data-testid="menu-vet-add-to-kb"
                          >
                            <Book className="h-4 w-4 mr-2" />
                            Knowledge Base
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const stafferContent = `Staffer: ${selectedVetStaffer.fullName}\nTitle: ${selectedVetStaffer.currentTitle || ""}\nOffice: ${selectedVetStaffer.currentOffice || ""}\nMember: ${selectedVetStaffer.currentMemberName || ""}\nEmail: ${selectedVetStaffer.email || ""}\nPhone: ${selectedVetStaffer.phone || ""}`;
                              navigate(`/matters?addDoc=true&title=${encodeURIComponent(selectedVetStaffer.fullName + " - Veteran Staffer Profile")}&content=${encodeURIComponent(stafferContent)}`);
                            }}
                            data-testid="menu-vet-add-to-research"
                          >
                            <FolderOpen className="h-4 w-4 mr-2" />
                            Research Project
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const parts = selectedVetStaffer.fullName.split(" ");
                              const firstName = parts[0] || "";
                              const lastName = parts.slice(1).join(" ") || "";
                              navigate(`/admin/clients?addClient=true&name=${encodeURIComponent(selectedVetStaffer.fullName)}&contactName=${encodeURIComponent(firstName + " " + lastName)}&contactEmail=${encodeURIComponent(selectedVetStaffer.email || "")}`);
                            }}
                            data-testid="menu-vet-add-as-client"
                          >
                            <Building className="h-4 w-4 mr-2" />
                            Add as Client
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              const info = [
                                selectedVetStaffer.fullName,
                                selectedVetStaffer.currentTitle,
                                selectedVetStaffer.currentOffice,
                                selectedVetStaffer.currentMemberName ? "Office of " + selectedVetStaffer.currentMemberName : null,
                                selectedVetStaffer.email,
                                selectedVetStaffer.phone,
                              ].filter(Boolean).join("\n");
                              navigator.clipboard.writeText(info);
                              toast({ title: "Copied", description: "Staffer info copied to clipboard" });
                            }}
                            data-testid="menu-vet-copy-info"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Info
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <SheetDescription>Veteran Staffer Details</SheetDescription>
                  </SheetHeader>
                  <div className="space-y-4 mt-6">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Current Position
                      </h4>
                      {selectedVetStaffer.currentMemberName && (
                        <div className="flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Office of {selectedVetStaffer.currentMemberName}</span>
                        </div>
                      )}
                      {selectedVetStaffer.currentOffice && !selectedVetStaffer.currentMemberName && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{selectedVetStaffer.currentOffice}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedVetStaffer.chamber && (
                          <Badge variant="outline" className="text-xs">{selectedVetStaffer.chamber}</Badge>
                        )}
                        {selectedVetStaffer.state && (
                          <span className="text-sm text-muted-foreground">{selectedVetStaffer.state}</span>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Contact
                      </h4>
                      {selectedVetStaffer.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${selectedVetStaffer.email}`} className="text-sm hover:text-primary">{selectedVetStaffer.email}</a>
                        </div>
                      )}
                      {selectedVetStaffer.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${selectedVetStaffer.phone}`} className="text-sm hover:text-primary">{selectedVetStaffer.phone}</a>
                        </div>
                      )}
                      {selectedVetStaffer.linkedinUrl && (
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          <a href={selectedVetStaffer.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm hover:text-primary">LinkedIn Profile</a>
                        </div>
                      )}
                      {!selectedVetStaffer.email && !selectedVetStaffer.phone && !selectedVetStaffer.linkedinUrl && (
                        <p className="text-sm text-muted-foreground">No contact information available</p>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        AI Research
                      </h4>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => vetStafferResearchMutation.mutate(selectedVetStaffer)}
                        disabled={vetStafferResearchMutation.isPending}
                        data-testid="button-research-veteran-staffer"
                      >
                        {vetStafferResearchMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Researching...</>
                        ) : (
                          <><Search className="h-4 w-4 mr-2" /> Research Career + Background</>
                        )}
                      </Button>
                      {(vetStafferResearchResult || selectedVetStaffer.careerResearch) && (
                        <div className="p-4 rounded-md bg-muted/50 text-sm max-h-[300px] overflow-y-auto space-y-2">
                          {renderMarkdownBlock(vetStafferResearchResult || selectedVetStaffer.careerResearch || "")}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        </TabsContent>
      </Tabs>
    </div>
  );
}

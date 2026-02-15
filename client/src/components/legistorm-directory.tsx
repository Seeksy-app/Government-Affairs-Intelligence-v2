import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLocation } from "wouter";
import {
  Users,
  Search,
  Building2,
  Briefcase,
  MapPin,
  Mail,
  RefreshCw,
  User,
  ExternalLink,
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
  Book,
  Building,
  Copy,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LegistormStaffer } from "@shared/schema";

const CHAMBERS = [
  { value: "all", label: "All Chambers" },
  { value: "House", label: "House" },
  { value: "Senate", label: "Senate" },
];

const PARTIES = [
  { value: "all", label: "All Parties" },
  { value: "Republican", label: "Republican" },
  { value: "Democrat", label: "Democrat" },
  { value: "Independent", label: "Independent" },
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
    default: return "bg-muted text-muted-foreground";
  }
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

export function LegistormDirectory() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [lsQuery, setLsQuery] = useState("");
  const [lsChamber, setLsChamber] = useState("all");
  const [lsParty, setLsParty] = useState("all");
  const [lsState, setLsState] = useState("all");
  const [lsPage, setLsPage] = useState(0);
  const [lsSelectedId, setLsSelectedId] = useState<number | null>(null);
  const [lsResearchResult, setLsResearchResult] = useState<string | null>(null);
  const [linkedinLookupLoading, setLinkedinLookupLoading] = useState(false);

  const lsSearchParams = new URLSearchParams();
  if (lsQuery) lsSearchParams.set("q", lsQuery);
  if (lsChamber !== "all") lsSearchParams.set("chamber", lsChamber);
  if (lsParty !== "all") lsSearchParams.set("party", lsParty);
  if (lsState !== "all") lsSearchParams.set("state", lsState);
  lsSearchParams.set("limit", "50");
  lsSearchParams.set("offset", (lsPage * 50).toString());

  const lsSearchUrl = `/api/legistorm/staffers?${lsSearchParams.toString()}`;

  const { data: lsResult, isLoading: lsLoading } = useQuery<{
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
        toast({ title: "Research Complete", description: "Career research done and LinkedIn profile found." });
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
      toast({ title: "LinkedIn lookup failed", description: error.message, variant: "destructive" });
      setLinkedinLookupLoading(false);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Badge variant="outline" className="text-sm" data-testid="badge-total-staffers">
            {lsStatus?.totalStaffers?.toLocaleString() || 0} total staffers
          </Badge>
          <Badge variant="outline" className="text-sm" data-testid="badge-current-staffers">
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
            data-testid="button-ls-incremental-sync"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Incremental Sync
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate("full")}
            disabled={syncMutation.isPending || lsStatus?.syncHistory?.[0]?.status === "running"}
            data-testid="button-ls-full-sync"
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
                {CHAMBERS.map((c) => (
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
              <Button onClick={() => syncMutation.mutate("full")} disabled={syncMutation.isPending} data-testid="button-ls-start-sync">
                <Database className="h-4 w-4 mr-2" />
                Start Full Sync
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground" data-testid="text-ls-showing">
              Showing {(lsResult?.offset || 0) + 1}-{Math.min((lsResult?.offset || 0) + (lsResult?.limit || 50), lsResult?.total || 0)} of {lsResult?.total?.toLocaleString()} staffers
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setLsPage(p => Math.max(0, p - 1))}
                disabled={lsPage === 0}
                data-testid="button-ls-prev-page"
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
                data-testid="button-ls-next-page"
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
                    <Button variant="ghost" size="icon" data-testid="button-ls-staffer-actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        const firstName = lsStafferDetail.firstName || lsStafferDetail.fullName.split(" ")[0] || "";
                        const lastName = lsStafferDetail.lastName || lsStafferDetail.fullName.split(" ").slice(1).join(" ") || "";
                        navigate(`/contacts?add=true&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&email=${encodeURIComponent(lsStafferDetail.email || "")}&title=${encodeURIComponent(lsStafferDetail.currentTitle || "")}&organization=${encodeURIComponent(lsStafferDetail.currentOffice || "")}`);
                      }}
                      data-testid="menu-ls-add-to-contacts"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add to Client Contacts
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const stafferContent = `Staffer: ${lsStafferDetail.fullName}\nTitle: ${lsStafferDetail.currentTitle || ""}\nOffice: ${lsStafferDetail.currentOffice || ""}\nMember: ${lsStafferDetail.currentMemberName || ""}\nEmail: ${lsStafferDetail.email || ""}\nPhone: ${lsStafferDetail.phone || ""}\n${(lsStafferDetail as any).linkedinUrl ? "LinkedIn: " + (lsStafferDetail as any).linkedinUrl : ""}`;
                        navigate(`/admin/kb?addArticle=true&title=${encodeURIComponent(lsStafferDetail.fullName + " - Staffer Profile")}&content=${encodeURIComponent(stafferContent)}`);
                      }}
                      data-testid="menu-ls-add-to-kb"
                    >
                      <Book className="h-4 w-4 mr-2" />
                      Knowledge Base
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        navigate(`/matters?addDoc=true&title=${encodeURIComponent(lsStafferDetail.fullName + " - Staffer Profile")}&content=${encodeURIComponent(`Staffer: ${lsStafferDetail.fullName}\nTitle: ${lsStafferDetail.currentTitle || ""}\nOffice: ${lsStafferDetail.currentOffice || ""}\nMember: ${lsStafferDetail.currentMemberName || ""}\nEmail: ${lsStafferDetail.email || ""}\nPhone: ${lsStafferDetail.phone || ""}\n${(lsStafferDetail as any).linkedinUrl ? "LinkedIn: " + (lsStafferDetail as any).linkedinUrl : ""}`)}`);
                      }}
                      data-testid="menu-ls-add-to-research"
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
                      data-testid="menu-ls-add-as-client"
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
                      data-testid="menu-ls-copy-info"
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
                      <a href={(lsStafferDetail as any).linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid="link-ls-linkedin-profile">
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
                  data-testid="button-ls-research-career"
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
                    data-testid="button-ls-find-linkedin"
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
                      const isList = lines.every(l => /^\s*[-*]\s/.test(l) || !l.trim());
                      if (isList) {
                        return (
                          <ul key={bIdx} className="space-y-1 pl-1">
                            {lines.filter(l => l.trim()).map((line, lIdx) => {
                              const content = line.replace(/^\s*[-*]\s*/, "")
                                .replace(/\[\d+\]/g, "")
                                .replace(/\*\*([^*]+)\*\*/g, "$1");
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
                                <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
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
                                <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover/pos:opacity-100 focus:opacity-100 transition-opacity" data-testid={`button-ls-position-actions-${i}`}>
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
                                  data-testid={`menu-ls-position-add-contact-${i}`}
                                >
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Add to Contacts
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    const positionInfo = `${pos.title}${pos.memberName ? ` - ${pos.memberName}` : ""}${pos.officeName ? ` - ${pos.officeName}` : ""} (${pos.startDate || "?"} - ${pos.isCurrent ? "Present" : pos.endDate || "?"})`;
                                    navigator.clipboard.writeText(positionInfo);
                                    toast({ title: "Copied", description: "Position info copied to clipboard" });
                                  }}
                                  data-testid={`menu-ls-position-copy-${i}`}
                                >
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy Info
                                </DropdownMenuItem>
                                {pos.memberName && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      navigate(`/congress?search=${encodeURIComponent(pos.memberName)}`);
                                    }}
                                    data-testid={`menu-ls-position-view-member-${i}`}
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
                                  <Badge key={bill.id} variant="outline" className="text-[10px] py-0 px-1.5" data-testid={`badge-ls-bill-${bill.id}`}>
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
    </div>
  );
}

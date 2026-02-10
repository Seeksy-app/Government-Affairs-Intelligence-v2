import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { StafferBillAssociation, TrackedBill, Contact, LegistormStaffer } from "@shared/schema";
import {
  FileText, Users, Search, Plus, Trash2, Loader2, Bot,
  ArrowRight, Briefcase, Calendar, Building2, MapPin, ChevronRight,
  Link2, Sparkles, ExternalLink, X
} from "lucide-react";

const ROLE_OPTIONS = [
  { value: "drafted", label: "Drafted" },
  { value: "co-sponsored", label: "Co-sponsored" },
  { value: "negotiated", label: "Negotiated" },
  { value: "staffed_committee", label: "Staffed Committee" },
  { value: "floor_managed", label: "Floor Managed" },
  { value: "authored", label: "Authored" },
  { value: "advised", label: "Advised" },
  { value: "lobbied", label: "Lobbied" },
  { value: "other", label: "Other" },
];

const CONFIDENCE_OPTIONS = [
  { value: "confirmed", label: "Confirmed", color: "bg-green-600" },
  { value: "high", label: "High", color: "bg-blue-600" },
  { value: "medium", label: "Medium", color: "bg-yellow-600" },
  { value: "low", label: "Low", color: "bg-orange-600" },
];

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return null;
  const label = ROLE_OPTIONS.find(r => r.value === role)?.label || role;
  return <Badge variant="secondary" className="text-xs">{label}</Badge>;
}

function ConfidenceDot({ confidence }: { confidence: string | null }) {
  const conf = CONFIDENCE_OPTIONS.find(c => c.value === (confidence || "confirmed"));
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${conf?.color || "bg-gray-400"}`} title={conf?.label || "Unknown"} />
  );
}

function formatBillId(billType: string | null, billNumber: number | null, congress: number | null) {
  if (!billType || !billNumber) return "Unknown Bill";
  const typeMap: Record<string, string> = { hr: "H.R.", s: "S.", hjres: "H.J.Res.", sjres: "S.J.Res.", hres: "H.Res.", sres: "S.Res." };
  return `${typeMap[billType] || billType.toUpperCase()} ${billNumber}${congress ? ` (${congress}th)` : ""}`;
}

export default function BillMappingPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("by-staffer");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [selectedAssociation, setSelectedAssociation] = useState<StafferBillAssociation | null>(null);

  const { data: associations = [], isLoading } = useQuery<StafferBillAssociation[]>({
    queryKey: ["/api/staffer-bills"],
  });

  const { data: trackedBills = [] } = useQuery<TrackedBill[]>({
    queryKey: ["/api/tracked-bills"],
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/staffer-bills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staffer-bills"] });
      toast({ title: "Association removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    },
  });

  const filteredAssociations = useMemo(() => {
    if (!searchQuery.trim()) return associations;
    const q = searchQuery.toLowerCase();
    return associations.filter(a =>
      a.stafferName?.toLowerCase().includes(q) ||
      a.billTitle?.toLowerCase().includes(q) ||
      a.positionTitle?.toLowerCase().includes(q) ||
      a.positionOrganization?.toLowerCase().includes(q) ||
      a.role?.toLowerCase().includes(q)
    );
  }, [associations, searchQuery]);

  const groupedByStaffer = useMemo(() => {
    const groups: Record<string, { name: string; type: string; id: string; bills: StafferBillAssociation[] }> = {};
    filteredAssociations.forEach(a => {
      const key = `${a.stafferType}-${a.stafferId}`;
      if (!groups[key]) {
        groups[key] = { name: a.stafferName, type: a.stafferType, id: a.stafferId, bills: [] };
      }
      groups[key].bills.push(a);
    });
    Object.values(groups).forEach(g => g.bills.sort((a, b) => (b.yearStart || 0) - (a.yearStart || 0)));
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredAssociations]);

  const groupedByBill = useMemo(() => {
    const groups: Record<string, { title: string; billType: string | null; billNumber: number | null; congress: number | null; staffers: StafferBillAssociation[] }> = {};
    filteredAssociations.forEach(a => {
      const key = a.trackedBillId || `${a.billType}-${a.billNumber}-${a.congress}`;
      if (!groups[key]) {
        groups[key] = { title: a.billTitle || "Unknown", billType: a.billType, billNumber: a.billNumber, congress: a.congress, staffers: [] };
      }
      groups[key].staffers.push(a);
    });
    return Object.values(groups).sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [filteredAssociations]);

  const stats = useMemo(() => {
    const uniqueStaffers = new Set(associations.map(a => `${a.stafferType}-${a.stafferId}`));
    const uniqueBills = new Set(associations.map(a => a.trackedBillId || `${a.billType}-${a.billNumber}`));
    const aiDiscovered = associations.filter(a => a.source === "ai_discovered").length;
    return { staffers: uniqueStaffers.size, bills: uniqueBills.size, total: associations.length, aiDiscovered };
  }, [associations]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Bill Mapping</h1>
          <p className="text-sm text-muted-foreground">Track staffers and the legislation they shaped throughout their careers</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setShowAiDialog(true)} variant="outline" data-testid="button-ai-discover">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Discover
          </Button>
          <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-association">
            <Plus className="w-4 h-4 mr-2" />
            Link Staffer to Bill
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 p-4 flex-wrap">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-3 flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-lg font-bold" data-testid="text-stat-staffers">{stats.staffers}</div>
              <div className="text-xs text-muted-foreground">Staffers Mapped</div>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-3 flex items-center gap-3">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-lg font-bold" data-testid="text-stat-bills">{stats.bills}</div>
              <div className="text-xs text-muted-foreground">Bills Linked</div>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-3 flex items-center gap-3">
            <Link2 className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-lg font-bold" data-testid="text-stat-total">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Links</div>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-3 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-lg font-bold" data-testid="text-stat-ai">{stats.aiDiscovered}</div>
              <div className="text-xs text-muted-foreground">AI Discovered</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search staffers, bills, roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-view-mode">
            <TabsTrigger value="by-staffer" data-testid="tab-by-staffer">
              <Users className="w-4 h-4 mr-2" />
              By Staffer
            </TabsTrigger>
            <TabsTrigger value="by-bill" data-testid="tab-by-bill">
              <FileText className="w-4 h-4 mr-2" />
              By Bill
            </TabsTrigger>
            <TabsTrigger value="timeline" data-testid="tab-timeline">
              <Calendar className="w-4 h-4 mr-2" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="by-staffer" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
              </div>
            ) : groupedByStaffer.length === 0 ? (
              <EmptyState onAdd={() => setShowAddDialog(true)} onAiDiscover={() => setShowAiDialog(true)} />
            ) : (
              <ScrollArea className="h-[calc(100vh-380px)]">
                <div className="space-y-4 pr-4">
                  {groupedByStaffer.map(group => (
                    <StafferCard
                      key={`${group.type}-${group.id}`}
                      group={group}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      onSelect={setSelectedAssociation}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="by-bill" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
              </div>
            ) : groupedByBill.length === 0 ? (
              <EmptyState onAdd={() => setShowAddDialog(true)} onAiDiscover={() => setShowAiDialog(true)} />
            ) : (
              <ScrollArea className="h-[calc(100vh-380px)]">
                <div className="space-y-4 pr-4">
                  {groupedByBill.map((group, i) => (
                    <BillCard
                      key={i}
                      group={group}
                      onDelete={(id) => deleteMutation.mutate(id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : filteredAssociations.length === 0 ? (
              <EmptyState onAdd={() => setShowAddDialog(true)} onAiDiscover={() => setShowAiDialog(true)} />
            ) : (
              <ScrollArea className="h-[calc(100vh-380px)]">
                <TimelineView associations={filteredAssociations} />
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AddAssociationDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        trackedBills={trackedBills}
        contacts={contacts}
      />

      <AiDiscoverDialog
        open={showAiDialog}
        onOpenChange={setShowAiDialog}
        trackedBills={trackedBills}
      />
    </div>
  );
}

function EmptyState({ onAdd, onAiDiscover }: { onAdd: () => void; onAiDiscover: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <Link2 className="w-8 h-8 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold">No Staffer-Bill Connections Yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Start mapping staffers to the bills they worked on. You can add connections manually or let AI discover them.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onAiDiscover} data-testid="button-empty-ai">
          <Sparkles className="w-4 h-4 mr-2" />
          AI Discover
        </Button>
        <Button onClick={onAdd} data-testid="button-empty-add">
          <Plus className="w-4 h-4 mr-2" />
          Link Staffer to Bill
        </Button>
      </div>
    </div>
  );
}

function StafferCard({ group, onDelete, onSelect }: {
  group: { name: string; type: string; id: string; bills: StafferBillAssociation[] };
  onDelete: (id: string) => void;
  onSelect: (a: StafferBillAssociation) => void;
}) {
  const positions = useMemo(() => {
    const posMap: Record<string, StafferBillAssociation[]> = {};
    group.bills.forEach(b => {
      const posKey = `${b.positionTitle || "Unknown Role"} - ${b.positionOrganization || "Unknown Office"}${b.positionMemberName ? ` (${b.positionMemberName})` : ""}`;
      if (!posMap[posKey]) posMap[posKey] = [];
      posMap[posKey].push(b);
    });
    return Object.entries(posMap);
  }, [group.bills]);

  return (
    <Card data-testid={`card-staffer-${group.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{group.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{group.bills.length} bill{group.bills.length !== 1 ? "s" : ""} linked</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">{group.type === "legistorm" ? "LegiStorm" : "Contact"}</Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {positions.map(([posLabel, bills], pi) => (
            <div key={pi}>
              <div className="flex items-center gap-2 mb-1.5">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{posLabel}</span>
              </div>
              <div className="ml-6 space-y-1">
                {bills.map(bill => (
                  <div key={bill.id} className="flex items-center justify-between gap-2 group py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <ConfidenceDot confidence={bill.confidence} />
                      <span className="text-sm truncate">{formatBillId(bill.billType, bill.billNumber, bill.congress)}</span>
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">{bill.billTitle}</span>
                      <RoleBadge role={bill.role} />
                    </div>
                    <div className="flex items-center gap-1">
                      {bill.yearStart && (
                        <span className="text-xs text-muted-foreground">{bill.yearStart}{bill.yearEnd && bill.yearEnd !== bill.yearStart ? `-${bill.yearEnd}` : ""}</span>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDelete(bill.id)}
                        data-testid={`button-delete-${bill.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BillCard({ group, onDelete }: {
  group: { title: string; billType: string | null; billNumber: number | null; congress: number | null; staffers: StafferBillAssociation[] };
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{formatBillId(group.billType, group.billNumber, group.congress)}</CardTitle>
            <p className="text-xs text-muted-foreground truncate max-w-md">{group.title}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">{group.staffers.length} staffer{group.staffers.length !== 1 ? "s" : ""}</Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1.5">
          {group.staffers.map(s => (
            <div key={s.id} className="flex items-center justify-between gap-2 group py-1">
              <div className="flex items-center gap-2 min-w-0">
                <ConfidenceDot confidence={s.confidence} />
                <span className="text-sm font-medium">{s.stafferName}</span>
                <RoleBadge role={s.role} />
                {s.positionTitle && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">as {s.positionTitle}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {s.yearStart && (
                  <span className="text-xs text-muted-foreground">{s.yearStart}</span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(s.id)}
                  data-testid={`button-delete-bill-${s.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineView({ associations }: { associations: StafferBillAssociation[] }) {
  const sorted = useMemo(() => {
    return [...associations].sort((a, b) => (b.yearStart || 9999) - (a.yearStart || 9999));
  }, [associations]);

  const yearGroups = useMemo(() => {
    const groups: Record<string, StafferBillAssociation[]> = {};
    sorted.forEach(a => {
      const year = a.yearStart?.toString() || "Unknown";
      if (!groups[year]) groups[year] = [];
      groups[year].push(a);
    });
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === "Unknown") return 1;
      if (b[0] === "Unknown") return -1;
      return parseInt(b[0]) - parseInt(a[0]);
    });
  }, [sorted]);

  return (
    <div className="relative pl-8 pr-4">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-6">
        {yearGroups.map(([year, items]) => (
          <div key={year}>
            <div className="relative flex items-center gap-3 mb-3">
              <div className="absolute -left-4 w-3 h-3 rounded-full bg-primary border-2 border-background" style={{ transform: "translateX(-50%)" }} />
              <h3 className="text-lg font-bold">{year}</h3>
              <Badge variant="secondary" className="text-xs">{items.length}</Badge>
            </div>
            <div className="space-y-2 ml-2">
              {items.map(a => (
                <div key={a.id} className="flex items-start gap-3 p-2 rounded-md hover-elevate">
                  <div className="mt-1">
                    <ConfidenceDot confidence={a.confidence} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{a.stafferName}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm">{formatBillId(a.billType, a.billNumber, a.congress)}</span>
                      <RoleBadge role={a.role} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {a.positionTitle && <span>{a.positionTitle}</span>}
                      {a.positionOrganization && (
                        <>
                          <span>at</span>
                          <span>{a.positionOrganization}</span>
                        </>
                      )}
                      {a.positionMemberName && (
                        <>
                          <span>for</span>
                          <span>{a.positionMemberName}</span>
                        </>
                      )}
                    </div>
                    {a.billTitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.billTitle}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddAssociationDialog({ open, onOpenChange, trackedBills, contacts }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackedBills: TrackedBill[];
  contacts: Contact[];
}) {
  const { toast } = useToast();
  const [stafferSource, setStafferSource] = useState<"manual" | "contact" | "legistorm">("manual");
  const [stafferName, setStafferName] = useState("");
  const [stafferId, setStafferId] = useState("");
  const [billSource, setBillSource] = useState<"tracked" | "manual">("tracked");
  const [selectedBillId, setSelectedBillId] = useState("");
  const [manualBillTitle, setManualBillTitle] = useState("");
  const [manualBillType, setManualBillType] = useState("");
  const [manualBillNumber, setManualBillNumber] = useState("");
  const [manualCongress, setManualCongress] = useState("119");
  const [role, setRole] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [positionOrg, setPositionOrg] = useState("");
  const [positionMember, setPositionMember] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [lsSearch, setLsSearch] = useState("");

  const { data: lsResults } = useQuery<{ staffers: LegistormStaffer[]; total: number }>({
    queryKey: [`/api/legistorm/staffers?q=${encodeURIComponent(lsSearch)}&limit=10`],
    enabled: stafferSource === "legistorm" && lsSearch.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/staffer-bills", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staffer-bills"] });
      toast({ title: "Connection created" });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create", description: error.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setStafferName(""); setStafferId(""); setSelectedBillId("");
    setManualBillTitle(""); setManualBillType(""); setManualBillNumber("");
    setRole(""); setPositionTitle(""); setPositionOrg(""); setPositionMember("");
    setYearStart(""); setYearEnd(""); setNotes(""); setLsSearch("");
    setStafferSource("manual"); setBillSource("tracked");
  }

  function handleSubmit() {
    const selectedBill = trackedBills.find(b => b.id === selectedBillId);
    const data: any = {
      stafferType: stafferSource === "legistorm" ? "legistorm" : "contact",
      stafferId: stafferId || "manual",
      stafferName: stafferName,
      role: role || null,
      positionTitle: positionTitle || null,
      positionOrganization: positionOrg || null,
      positionMemberName: positionMember || null,
      yearStart: yearStart ? parseInt(yearStart) : null,
      yearEnd: yearEnd ? parseInt(yearEnd) : null,
      notes: notes || null,
      source: "manual",
      confidence: "confirmed",
    };

    if (billSource === "tracked" && selectedBill) {
      data.trackedBillId = selectedBill.id;
      data.billTitle = selectedBill.title;
      data.billType = selectedBill.billType;
      data.billNumber = selectedBill.billNumber;
      data.congress = selectedBill.congress;
    } else {
      data.billTitle = manualBillTitle;
      data.billType = manualBillType || null;
      data.billNumber = manualBillNumber ? parseInt(manualBillNumber) : null;
      data.congress = manualCongress ? parseInt(manualCongress) : null;
    }

    if (!data.stafferName) {
      toast({ title: "Staffer name required", variant: "destructive" });
      return;
    }
    if (!data.billTitle && !data.trackedBillId) {
      toast({ title: "Bill information required", variant: "destructive" });
      return;
    }

    createMutation.mutate(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Staffer to Bill</DialogTitle>
          <DialogDescription>Create a connection between a political staffer and legislation they worked on.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Staffer Source</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={stafferSource === "manual" ? "default" : "outline"} onClick={() => setStafferSource("manual")} data-testid="button-source-manual">Manual</Button>
              <Button size="sm" variant={stafferSource === "contact" ? "default" : "outline"} onClick={() => setStafferSource("contact")} data-testid="button-source-contact">From Contacts</Button>
              <Button size="sm" variant={stafferSource === "legistorm" ? "default" : "outline"} onClick={() => setStafferSource("legistorm")} data-testid="button-source-legistorm">LegiStorm</Button>
            </div>
          </div>

          {stafferSource === "manual" && (
            <div>
              <Label>Staffer Name</Label>
              <Input value={stafferName} onChange={e => setStafferName(e.target.value)} placeholder="e.g., Jane Smith" data-testid="input-staffer-name" />
            </div>
          )}

          {stafferSource === "contact" && (
            <div>
              <Label>Select Contact</Label>
              <Select value={stafferId} onValueChange={(v) => {
                setStafferId(v);
                const c = contacts.find(c => c.id === v);
                if (c) setStafferName(`${c.firstName} ${c.lastName}`);
              }}>
                <SelectTrigger data-testid="select-contact">
                  <SelectValue placeholder="Choose a contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.title ? ` - ${c.title}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {stafferSource === "legistorm" && (
            <div>
              <Label>Search LegiStorm</Label>
              <Input value={lsSearch} onChange={e => setLsSearch(e.target.value)} placeholder="Search by name..." data-testid="input-ls-search" />
              {lsResults?.staffers && lsResults.staffers.length > 0 && (
                <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                  {lsResults.staffers.map(s => (
                    <button
                      key={s.id}
                      className="w-full text-left px-3 py-2 text-sm hover-elevate"
                      onClick={() => {
                        setStafferId(s.id);
                        setStafferName(s.fullName);
                        if (s.currentTitle) setPositionTitle(s.currentTitle);
                        if (s.currentOffice) setPositionOrg(s.currentOffice);
                        if (s.currentMemberName) setPositionMember(s.currentMemberName);
                        setLsSearch("");
                      }}
                    >
                      <div className="font-medium">{s.fullName}</div>
                      <div className="text-xs text-muted-foreground">{s.currentTitle} - {s.currentMemberName || s.currentOffice}</div>
                    </button>
                  ))}
                </div>
              )}
              {stafferName && stafferSource === "legistorm" && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary">{stafferName}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => { setStafferName(""); setStafferId(""); }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <Separator />

          <div>
            <Label className="text-sm font-medium mb-2 block">Bill Source</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={billSource === "tracked" ? "default" : "outline"} onClick={() => setBillSource("tracked")}>Tracked Bills</Button>
              <Button size="sm" variant={billSource === "manual" ? "default" : "outline"} onClick={() => setBillSource("manual")}>Manual Entry</Button>
            </div>
          </div>

          {billSource === "tracked" ? (
            <div>
              <Label>Select Tracked Bill</Label>
              <Select value={selectedBillId} onValueChange={setSelectedBillId}>
                <SelectTrigger data-testid="select-bill">
                  <SelectValue placeholder="Choose a bill" />
                </SelectTrigger>
                <SelectContent>
                  {trackedBills.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {formatBillId(b.billType, b.billNumber, b.congress)} - {b.title?.substring(0, 60)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <Label>Bill Title</Label>
                <Input value={manualBillTitle} onChange={e => setManualBillTitle(e.target.value)} placeholder="e.g., National Defense Authorization Act" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Type</Label>
                  <Select value={manualBillType} onValueChange={setManualBillType}>
                    <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hr">H.R.</SelectItem>
                      <SelectItem value="s">S.</SelectItem>
                      <SelectItem value="hjres">H.J.Res.</SelectItem>
                      <SelectItem value="sjres">S.J.Res.</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label>Number</Label>
                  <Input value={manualBillNumber} onChange={e => setManualBillNumber(e.target.value)} placeholder="e.g., 2670" />
                </div>
                <div className="flex-1">
                  <Label>Congress</Label>
                  <Input value={manualCongress} onChange={e => setManualCongress(e.target.value)} placeholder="119" />
                </div>
              </div>
            </div>
          )}

          <Separator />

          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger data-testid="select-role"><SelectValue placeholder="What role did they play?" /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Position Title</Label>
              <Input value={positionTitle} onChange={e => setPositionTitle(e.target.value)} placeholder="e.g., Legislative Director" />
            </div>
            <div>
              <Label>Office/Organization</Label>
              <Input value={positionOrg} onChange={e => setPositionOrg(e.target.value)} placeholder="e.g., Senate Armed Services" />
            </div>
          </div>

          <div>
            <Label>Member Worked For</Label>
            <Input value={positionMember} onChange={e => setPositionMember(e.target.value)} placeholder="e.g., Sen. John Smith" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Year Start</Label>
              <Input value={yearStart} onChange={e => setYearStart(e.target.value)} placeholder="e.g., 2023" />
            </div>
            <div>
              <Label>Year End</Label>
              <Input value={yearEnd} onChange={e => setYearEnd(e.target.value)} placeholder="e.g., 2024" />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional context..." className="resize-none" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-submit-association">
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiDiscoverDialog({ open, onOpenChange, trackedBills }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackedBills: TrackedBill[];
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"staffer" | "bill">("staffer");
  const [stafferName, setStafferName] = useState("");
  const [selectedBillId, setSelectedBillId] = useState("");
  const [customBillTitle, setCustomBillTitle] = useState("");
  const [result, setResult] = useState<{ research: string; citations: string[] } | null>(null);

  const discoverMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/staffer-bills/ai-discover", data);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error: Error) => {
      toast({ title: "AI Discovery failed", description: error.message, variant: "destructive" });
    },
  });

  function handleDiscover() {
    const selectedBill = trackedBills.find(b => b.id === selectedBillId);
    const data: any = {};

    if (stafferName) data.stafferName = stafferName;
    if (selectedBill) {
      data.billTitle = selectedBill.title;
      data.billType = selectedBill.billType;
      data.billNumber = selectedBill.billNumber;
      data.congress = selectedBill.congress;
    } else if (customBillTitle) {
      data.billTitle = customBillTitle;
    }

    if (!data.stafferName && !data.billTitle) {
      toast({ title: "Provide a staffer name or bill to research", variant: "destructive" });
      return;
    }

    discoverMutation.mutate(data);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setResult(null); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI Bill Discovery
          </DialogTitle>
          <DialogDescription>
            Use AI to research connections between staffers and legislation. Results can be saved as associations.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Research Focus</Label>
              <div className="flex gap-2">
                <Button size="sm" variant={mode === "staffer" ? "default" : "outline"} onClick={() => setMode("staffer")}>
                  Research a Staffer
                </Button>
                <Button size="sm" variant={mode === "bill" ? "default" : "outline"} onClick={() => setMode("bill")}>
                  Research a Bill
                </Button>
              </div>
            </div>

            {(mode === "staffer" || mode === "bill") && (
              <div>
                <Label>Staffer Name {mode === "bill" ? "(optional)" : ""}</Label>
                <Input
                  value={stafferName}
                  onChange={e => setStafferName(e.target.value)}
                  placeholder="e.g., Sarah Johnson"
                  data-testid="input-ai-staffer"
                />
              </div>
            )}

            <div>
              <Label>Bill {mode === "staffer" ? "(optional - narrows research)" : ""}</Label>
              <Select value={selectedBillId} onValueChange={setSelectedBillId}>
                <SelectTrigger data-testid="select-ai-bill">
                  <SelectValue placeholder="Select a tracked bill (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- No specific bill --</SelectItem>
                  {trackedBills.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {formatBillId(b.billType, b.billNumber, b.congress)} - {b.title?.substring(0, 50)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedBillId && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">Or type a bill name</Label>
                  <Input
                    value={customBillTitle}
                    onChange={e => setCustomBillTitle(e.target.value)}
                    placeholder="e.g., Infrastructure Investment and Jobs Act"
                  />
                </div>
              )}
            </div>

            <Button onClick={handleDiscover} disabled={discoverMutation.isPending} className="w-full" data-testid="button-run-discover">
              {discoverMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 mr-2" />
                  Discover Connections
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-md p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Research Results
              </h4>
              <div className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-ai-results">
                {result.research}
              </div>
            </div>

            {result.citations && result.citations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1">Sources</h4>
                <div className="space-y-1">
                  {result.citations.map((cite, i) => (
                    <a
                      key={i}
                      href={cite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {cite}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setResult(null)} className="flex-1">
                New Research
              </Button>
              <Button variant="outline" onClick={() => { onOpenChange(false); setResult(null); }}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

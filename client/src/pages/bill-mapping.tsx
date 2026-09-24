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
  FileText, Users, Search, Plus, Trash2, Loader2,
  ArrowRight, Briefcase, Calendar, Building2, MapPin, ChevronRight,
  Link2, ExternalLink, X
} from "lucide-react";
import { PageHeader, PageShell } from "@/components/page-header";

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
  { value: "confirmed", label: "Confirmed", color: "bg-primary" },
  { value: "high", label: "High", color: "bg-primary/70" },
  { value: "medium", label: "Medium", color: "bg-primary/40" },
  { value: "low", label: "Low", color: "bg-muted-foreground/40" },
];

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return null;
  const label = ROLE_OPTIONS.find(r => r.value === role)?.label || role;
  return <Badge variant="secondary" className="shrink-0 text-xs font-normal">{label}</Badge>;
}

function ConfidenceDot({ confidence }: { confidence: string | null }) {
  const conf = CONFIDENCE_OPTIONS.find(c => c.value === (confidence || "confirmed"));
  return (
    <span className={`inline-block w-2 h-2 shrink-0 rounded-full ${conf?.color || "bg-muted-foreground/40"}`} title={`${conf?.label || "Unknown"} confidence`} />
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

  const { data: legistormData } = useQuery<{ staffers: LegistormStaffer[] }>({
    queryKey: ["/api/legistorm/staffers?limit=500"],
  });
  const legistormStaffers = legistormData?.staffers || [];

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
    <PageShell className="space-y-6">
      <PageHeader
        eyebrow="Monitor"
        title="Bill Mapping"
        description="Map staffers to the legislation they shaped across their careers."
        className="mb-0"
        actions={
          <>
            <Button onClick={() => setShowAiDialog(true)} variant="outline" data-testid="button-ai-discover">
              <Search className="w-4 h-4 mr-2" />
              Discover connections
            </Button>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-association">
              <Plus className="w-4 h-4 mr-2" />
              Link Staffer to Bill
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Staffers mapped
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums" data-testid="text-stat-staffers">{stats.staffers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Bills linked
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums" data-testid="text-stat-bills">{stats.bills}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />
              Total links
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums" data-testid="text-stat-total">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              Auto-discovered
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums" data-testid="text-stat-ai">{stats.aiDiscovered}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList data-testid="tabs-view-mode" className="self-start">
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
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search staffers, bills, roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
        </div>

        <TabsContent value="by-staffer" className="mt-4">
          {isLoading ? (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/5" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
          ) : groupedByStaffer.length === 0 ? (
            <EmptyState onAdd={() => setShowAddDialog(true)} onAiDiscover={() => setShowAiDialog(true)} />
          ) : (
            <ScrollArea className="h-[calc(100vh-380px)] min-h-[360px]">
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
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/5" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
          ) : groupedByBill.length === 0 ? (
            <EmptyState onAdd={() => setShowAddDialog(true)} onAiDiscover={() => setShowAiDialog(true)} />
          ) : (
            <ScrollArea className="h-[calc(100vh-380px)] min-h-[360px]">
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
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-start gap-3 p-2">
                  <Skeleton className="mt-1 h-2 w-2 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAssociations.length === 0 ? (
            <EmptyState onAdd={() => setShowAddDialog(true)} onAiDiscover={() => setShowAiDialog(true)} />
          ) : (
            <ScrollArea className="h-[calc(100vh-380px)] min-h-[360px]">
              <TimelineView associations={filteredAssociations} />
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

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
        contacts={contacts}
        legistormStaffers={legistormStaffers}
      />
    </PageShell>
  );
}

function EmptyState({ onAdd, onAiDiscover }: { onAdd: () => void; onAiDiscover: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-card px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Link2 className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-sm font-semibold">No staffer–bill connections yet</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Map staffers to the bills they worked on — link them by hand, or discover connections from LegiStorm and Congress.gov.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" onClick={onAiDiscover} data-testid="button-empty-ai">
          <Search className="w-4 h-4 mr-2" />
          Discover connections
        </Button>
        <Button size="sm" onClick={onAdd} data-testid="button-empty-add">
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
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-5 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-8 h-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">{group.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{group.bills.length} bill{group.bills.length !== 1 ? "s" : ""} linked</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 text-xs font-normal text-muted-foreground">{group.type === "legistorm" ? "LegiStorm" : "Contact"}</Badge>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="space-y-3">
          {positions.map(([posLabel, bills], pi) => (
            <div key={pi}>
              <div className="flex items-start gap-2 mb-1">
                <Briefcase className="w-3.5 h-3.5 shrink-0 text-muted-foreground mt-0.5" />
                <span className="text-sm font-medium min-w-0">{posLabel}</span>
              </div>
              <div className="ml-5 divide-y divide-border/60">
                {bills.map(bill => (
                  <div key={bill.id} className="flex items-center justify-between gap-2 group py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <ConfidenceDot confidence={bill.confidence} />
                      <span className="text-sm font-medium whitespace-nowrap">{formatBillId(bill.billType, bill.billNumber, bill.congress)}</span>
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">{bill.billTitle}</span>
                      <RoleBadge role={bill.role} />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {bill.yearStart && (
                        <span className="text-xs tabular-nums text-muted-foreground">{bill.yearStart}{bill.yearEnd && bill.yearEnd !== bill.yearStart ? `–${bill.yearEnd}` : ""}</span>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(bill.id)}
                        aria-label="Remove link"
                        data-testid={`button-delete-${bill.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-5 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-8 h-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">{formatBillId(group.billType, group.billNumber, group.congress)}</CardTitle>
            <p className="text-sm text-muted-foreground truncate max-w-xl">{group.title}</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 text-xs font-normal text-muted-foreground">{group.staffers.length} staffer{group.staffers.length !== 1 ? "s" : ""}</Badge>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="divide-y divide-border/60">
          {group.staffers.map(s => (
            <div key={s.id} className="flex items-center justify-between gap-2 group py-1">
              <div className="flex items-center gap-2 min-w-0">
                <ConfidenceDot confidence={s.confidence} />
                <span className="text-sm font-medium truncate">{s.stafferName}</span>
                <RoleBadge role={s.role} />
                {s.positionTitle && (
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">as {s.positionTitle}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {s.yearStart && (
                  <span className="text-xs tabular-nums text-muted-foreground">{s.yearStart}</span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(s.id)}
                  aria-label="Remove link"
                  data-testid={`button-delete-bill-${s.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
              <h3 className="text-base font-semibold tabular-nums">{year}</h3>
              <Badge variant="secondary" className="text-xs font-normal">{items.length}</Badge>
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
  const [selectedStaffers, setSelectedStaffers] = useState<Array<{ id: string; name: string; title?: string; org?: string; member?: string }>>([]);
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
  const [contactSearch, setContactSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: lsResults } = useQuery<{ staffers: LegistormStaffer[]; total: number }>({
    queryKey: [`/api/legistorm/staffers?q=${encodeURIComponent(lsSearch)}&limit=10`],
    enabled: stafferSource === "legistorm" && lsSearch.length >= 2,
  });

  const filteredContacts = useMemo(() => {
    if (!contactSearch || contactSearch.length < 2) return [];
    const q = contactSearch.toLowerCase();
    return contacts.filter(c => {
      const name = `${c.firstName} ${c.lastName}`.toLowerCase();
      return name.includes(q) || (c.title && c.title.toLowerCase().includes(q));
    }).slice(0, 10);
  }, [contacts, contactSearch]);

  function addStaffer(staffer: { id: string; name: string; title?: string; org?: string; member?: string }) {
    if (selectedStaffers.some(s => s.id === staffer.id && s.name === staffer.name)) return;
    setSelectedStaffers(prev => [...prev, staffer]);
  }

  function removeStaffer(index: number) {
    setSelectedStaffers(prev => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setStafferName(""); setStafferId(""); setSelectedStaffers([]); setSelectedBillId("");
    setManualBillTitle(""); setManualBillType(""); setManualBillNumber("");
    setRole(""); setPositionTitle(""); setPositionOrg(""); setPositionMember("");
    setYearStart(""); setYearEnd(""); setNotes(""); setLsSearch(""); setContactSearch("");
    setStafferSource("manual"); setBillSource("tracked");
  }

  async function handleSubmit() {
    const selectedBill = trackedBills.find(b => b.id === selectedBillId);

    const staffersToLink = stafferSource === "manual"
      ? (stafferName ? [{ id: "manual", name: stafferName, title: positionTitle, org: positionOrg, member: positionMember }] : [])
      : selectedStaffers;

    if (staffersToLink.length === 0) {
      toast({ title: "At least one staffer is required", variant: "destructive" });
      return;
    }

    const billData: any = {};
    if (billSource === "tracked" && selectedBill) {
      billData.trackedBillId = selectedBill.id;
      billData.billTitle = selectedBill.title;
      billData.billType = selectedBill.billType;
      billData.billNumber = selectedBill.billNumber;
      billData.congress = selectedBill.congress;
    } else {
      billData.billTitle = manualBillTitle;
      billData.billType = manualBillType || null;
      billData.billNumber = manualBillNumber ? parseInt(manualBillNumber) : null;
      billData.congress = manualCongress ? parseInt(manualCongress) : null;
    }

    if (!billData.billTitle && !billData.trackedBillId) {
      toast({ title: "Bill information required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    for (const staffer of staffersToLink) {
      const data: any = {
        stafferType: stafferSource === "legistorm" ? "legistorm" : "contact",
        stafferId: staffer.id || "manual",
        stafferName: staffer.name,
        role: role || null,
        positionTitle: staffer.title || positionTitle || null,
        positionOrganization: staffer.org || positionOrg || null,
        positionMemberName: staffer.member || positionMember || null,
        yearStart: yearStart ? parseInt(yearStart) : null,
        yearEnd: yearEnd ? parseInt(yearEnd) : null,
        notes: notes || null,
        source: "manual",
        confidence: "confirmed",
        ...billData,
      };
      try {
        await apiRequest("POST", "/api/staffer-bills", data);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setSubmitting(false);
    queryClient.invalidateQueries({ queryKey: ["/api/staffer-bills"] });

    if (successCount > 0) {
      toast({ title: `${successCount} connection${successCount > 1 ? "s" : ""} created${failCount > 0 ? ` (${failCount} failed)` : ""}` });
    } else {
      toast({ title: "Failed to create connections", variant: "destructive" });
    }

    onOpenChange(false);
    resetForm();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Staffers to Bill</DialogTitle>
          <DialogDescription>Create connections between political staffers and legislation they worked on. Select multiple staffers from LegiStorm or Contacts.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Staffer Source</Label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={stafferSource === "manual" ? "default" : "outline"} onClick={() => { setStafferSource("manual"); setSelectedStaffers([]); }} data-testid="button-source-manual">Manual</Button>
              <Button size="sm" variant={stafferSource === "contact" ? "default" : "outline"} onClick={() => { setStafferSource("contact"); setSelectedStaffers([]); setStafferName(""); }} data-testid="button-source-contact">From Contacts</Button>
              <Button size="sm" variant={stafferSource === "legistorm" ? "default" : "outline"} onClick={() => { setStafferSource("legistorm"); setSelectedStaffers([]); setStafferName(""); }} data-testid="button-source-legistorm">LegiStorm</Button>
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
              <Label>Search Contacts</Label>
              <Input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Search by name..." data-testid="input-contact-search" />
              {filteredContacts.length > 0 && (
                <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                  {filteredContacts.map(c => {
                    const name = `${c.firstName} ${c.lastName}`;
                    const alreadySelected = selectedStaffers.some(s => s.id === c.id);
                    return (
                      <button
                        key={c.id}
                        className={`w-full text-left px-3 py-2 text-sm hover-elevate ${alreadySelected ? "opacity-50" : ""}`}
                        disabled={alreadySelected}
                        onClick={() => {
                          addStaffer({ id: c.id, name, title: c.title || undefined });
                          setContactSearch("");
                        }}
                      >
                        <div className="font-medium">{name}</div>
                        {c.title && <div className="text-xs text-muted-foreground">{c.title}</div>}
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedStaffers.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {selectedStaffers.map((s, i) => (
                    <Badge key={`${s.id}-${i}`} variant="secondary" className="gap-1">
                      {s.name}
                      <button onClick={() => removeStaffer(i)} className="ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {stafferSource === "legistorm" && (
            <div>
              <Label>Search LegiStorm</Label>
              <Input value={lsSearch} onChange={e => setLsSearch(e.target.value)} placeholder="Search by name..." data-testid="input-ls-search" />
              {lsResults?.staffers && lsResults.staffers.length > 0 && (
                <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                  {lsResults.staffers.map(s => {
                    const alreadySelected = selectedStaffers.some(sel => sel.id === s.id);
                    return (
                      <button
                        key={s.id}
                        className={`w-full text-left px-3 py-2 text-sm hover-elevate ${alreadySelected ? "opacity-50" : ""}`}
                        disabled={alreadySelected}
                        onClick={() => {
                          addStaffer({
                            id: s.id,
                            name: s.fullName,
                            title: s.currentTitle || undefined,
                            org: s.currentOffice || undefined,
                            member: s.currentMemberName || undefined,
                          });
                          setLsSearch("");
                        }}
                      >
                        <div className="font-medium">{s.fullName}</div>
                        <div className="text-xs text-muted-foreground">{s.currentTitle} - {s.currentMemberName || s.currentOffice}</div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedStaffers.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {selectedStaffers.map((s, i) => (
                    <Badge key={`${s.id}-${i}`} variant="secondary" className="gap-1">
                      {s.name}
                      <button onClick={() => removeStaffer(i)} className="ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <Separator />

          <div>
            <Label className="text-sm font-medium mb-2 block">Bill Source</Label>
            <div className="flex flex-wrap gap-2">
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
          <Button onClick={handleSubmit} disabled={submitting} data-testid="button-submit-association">
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {stafferSource !== "manual" && selectedStaffers.length > 1
              ? `Link ${selectedStaffers.length} Staffers`
              : "Create Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiDiscoverDialog({ open, onOpenChange, trackedBills, contacts, legistormStaffers }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackedBills: TrackedBill[];
  contacts: Contact[];
  legistormStaffers: LegistormStaffer[];
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"staffer" | "bill">("staffer");
  const [stafferSource, setStafferSource] = useState<"legistorm" | "contact" | "custom">("legistorm");
  const [selectedStafferId, setSelectedStafferId] = useState("");
  const [stafferName, setStafferName] = useState("");
  const [stafferSearch, setStafferSearch] = useState("");
  const [selectedBillId, setSelectedBillId] = useState("");
  const [customBillTitle, setCustomBillTitle] = useState("");
  const [result, setResult] = useState<{ research: string; citations: string[]; enrichedData?: { positionsFound: boolean; memberBillsCount: number; memberBills: any[] } } | null>(null);

  const filteredLegistorm = useMemo(() => {
    if (!stafferSearch.trim()) return legistormStaffers.slice(0, 20);
    const q = stafferSearch.toLowerCase();
    return legistormStaffers.filter(s =>
      s.fullName?.toLowerCase().includes(q) ||
      s.currentTitle?.toLowerCase().includes(q) ||
      s.currentMemberName?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [legistormStaffers, stafferSearch]);

  const filteredContacts = useMemo(() => {
    if (!stafferSearch.trim()) return contacts.slice(0, 20);
    const q = stafferSearch.toLowerCase();
    return contacts.filter(c => {
      const fullName = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
      return fullName.includes(q) || c.title?.toLowerCase().includes(q);
    }).slice(0, 20);
  }, [contacts, stafferSearch]);

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

    if (stafferSource === "legistorm" && selectedStafferId) {
      const staffer = legistormStaffers.find(s => s.legistormId?.toString() === selectedStafferId);
      if (staffer) {
        data.stafferName = staffer.fullName;
        data.stafferType = "legistorm";
        data.stafferId = staffer.legistormId?.toString();
      }
    } else if (stafferSource === "contact" && selectedStafferId) {
      const contact = contacts.find(c => c.id === selectedStafferId);
      if (contact) {
        data.stafferName = `${contact.firstName} ${contact.lastName}`.trim();
        data.stafferType = "contact";
        data.stafferId = contact.id;
      }
    } else if (stafferName) {
      data.stafferName = stafferName;
    }

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

  function handleSelectStaffer(source: "legistorm" | "contact", id: string, name: string) {
    setStafferSource(source);
    setSelectedStafferId(id);
    setStafferName(name);
    setStafferSearch(name);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setResult(null); setStafferSearch(""); setSelectedStafferId(""); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Discover connections
          </DialogTitle>
          <DialogDescription>
            Cross-references LegiStorm employment history with Congress.gov bill data to find the bills a staffer likely worked on.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Research Focus</Label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={mode === "staffer" ? "default" : "outline"} onClick={() => setMode("staffer")} data-testid="button-mode-staffer">
                  Research a Staffer
                </Button>
                <Button size="sm" variant={mode === "bill" ? "default" : "outline"} onClick={() => setMode("bill")} data-testid="button-mode-bill">
                  Research a Bill
                </Button>
              </div>
            </div>

            {(mode === "staffer" || mode === "bill") && (
              <div className="space-y-2">
                <Label>Staffer {mode === "bill" ? "(optional)" : ""}</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={stafferSource === "legistorm" ? "default" : "outline"}
                    onClick={() => { setStafferSource("legistorm"); setSelectedStafferId(""); setStafferSearch(""); }}
                    data-testid="button-source-legistorm"
                  >
                    LegiStorm Directory
                  </Button>
                  <Button
                    size="sm"
                    variant={stafferSource === "contact" ? "default" : "outline"}
                    onClick={() => { setStafferSource("contact"); setSelectedStafferId(""); setStafferSearch(""); }}
                    data-testid="button-source-contact"
                  >
                    Contacts
                  </Button>
                  <Button
                    size="sm"
                    variant={stafferSource === "custom" ? "default" : "outline"}
                    onClick={() => { setStafferSource("custom"); setSelectedStafferId(""); setStafferSearch(""); }}
                    data-testid="button-source-custom"
                  >
                    Type Name
                  </Button>
                </div>

                {stafferSource === "custom" ? (
                  <Input
                    value={stafferName}
                    onChange={e => setStafferName(e.target.value)}
                    placeholder="e.g., Sarah Johnson"
                    data-testid="input-ai-staffer"
                  />
                ) : (
                  <div className="space-y-2">
                    <Input
                      value={stafferSearch}
                      onChange={e => { setStafferSearch(e.target.value); setSelectedStafferId(""); }}
                      placeholder={stafferSource === "legistorm" ? "Search LegiStorm staffers..." : "Search contacts..."}
                      data-testid="input-ai-staffer-search"
                    />
                    {selectedStafferId && (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium flex-1">{stafferName}</span>
                        {stafferSource === "legistorm" && (
                          <Badge variant="secondary" className="text-xs">LegiStorm</Badge>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => { setSelectedStafferId(""); setStafferName(""); setStafferSearch(""); }} data-testid="button-clear-staffer">
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {!selectedStafferId && stafferSearch.length >= 2 && (
                      <ScrollArea className="max-h-40 border rounded-md">
                        <div className="p-1">
                          {stafferSource === "legistorm" ? (
                            filteredLegistorm.length > 0 ? filteredLegistorm.map(s => (
                              <button
                                key={s.legistormId}
                                className="w-full text-left px-3 py-2 text-sm hover-elevate rounded-md flex items-center gap-2"
                                onClick={() => handleSelectStaffer("legistorm", s.legistormId?.toString() || "", s.fullName || "")}
                                data-testid={`option-staffer-${s.legistormId}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{s.fullName}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {s.currentTitle}{s.currentMemberName ? ` - ${s.currentMemberName}` : ""}{s.chamber ? ` (${s.chamber})` : ""}
                                  </div>
                                </div>
                              </button>
                            )) : <div className="px-3 py-2 text-sm text-muted-foreground">No staffers found</div>
                          ) : (
                            filteredContacts.length > 0 ? filteredContacts.map(c => (
                              <button
                                key={c.id}
                                className="w-full text-left px-3 py-2 text-sm hover-elevate rounded-md flex items-center gap-2"
                                onClick={() => handleSelectStaffer("contact", c.id, `${c.firstName} ${c.lastName}`.trim())}
                                data-testid={`option-contact-${c.id}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{c.firstName} {c.lastName}</div>
                                  <div className="text-xs text-muted-foreground truncate">{c.title}{c.organization ? ` at ${c.organization}` : ""}</div>
                                </div>
                              </button>
                            )) : <div className="px-3 py-2 text-sm text-muted-foreground">No contacts found</div>
                          )}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}

                {stafferSource === "legistorm" && selectedStafferId && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Will cross-reference employment history with Congress.gov bill data for richer results
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Bill {mode === "staffer" ? "(optional - narrows research)" : ""}</Label>
              <Select value={selectedBillId} onValueChange={(v) => setSelectedBillId(v === "none" ? "" : v)}>
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
                    data-testid="input-custom-bill"
                  />
                </div>
              )}
            </div>

            <Button onClick={handleDiscover} disabled={discoverMutation.isPending} className="w-full" data-testid="button-run-discover">
              {discoverMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cross-referencing sources…
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Discover Connections
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {result.enrichedData?.positionsFound && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Data sources used</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="flex items-center gap-1">
                    <span>LegiStorm employment history</span>
                  </div>
                  {result.enrichedData.memberBillsCount > 0 && (
                    <div className="flex items-center gap-1">
                      <span>Congress.gov: {result.enrichedData.memberBillsCount} bills from member(s) during tenure</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span>Perplexity AI analysis</span>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-md border bg-muted/30 p-4">
              <h4 className="text-sm font-semibold mb-2">
                Research results
              </h4>
              <div className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-ai-results">
                {result.research}
              </div>
            </div>

            {result.enrichedData?.memberBills && result.enrichedData.memberBills.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">
                  Member bills found ({result.enrichedData.memberBills.length})
                </h4>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {result.enrichedData.memberBills.map((b: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded hover-elevate">
                        <Badge variant="outline" className="text-xs shrink-0">
                          {(b.type || "").toUpperCase()} {b.number}
                        </Badge>
                        <span className="truncate flex-1">{b.title}</span>
                        <span className="text-muted-foreground shrink-0">{b.introducedDate?.substring(0, 4)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {result.citations && result.citations.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-1">Sources</h4>
                <div className="space-y-1">
                  {result.citations.map((cite, i) => (
                    <a
                      key={i}
                      href={cite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary min-w-0"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{cite}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setResult(null)} className="flex-1" data-testid="button-new-research">
                New Research
              </Button>
              <Button variant="outline" onClick={() => { onOpenChange(false); setResult(null); }} data-testid="button-close-results">
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/api-errors";
import { BillDetailSheet, formatBillDate, statusBadgeClass } from "@/components/bills/bill-detail-sheet";
import { BillOrganizeMenu } from "@/components/bills/bill-organize-menu";
import { BillAlertsDialog } from "@/components/bills/bill-alerts-dialog";
import { Search, Plus, Bell, RefreshCw, AlertCircle, Clock, FolderOpen, Check, ChevronRight, X } from "lucide-react";

// Congress sessions with their year ranges (most recent first)
const CONGRESS_SESSIONS = [
  { congress: 119, years: "2025-2027", label: "119th Congress (2025-2027)" },
  { congress: 118, years: "2023-2025", label: "118th Congress (2023-2025)" },
  { congress: 117, years: "2021-2023", label: "117th Congress (2021-2023)" },
  { congress: 116, years: "2019-2021", label: "116th Congress (2019-2021)" },
  { congress: 115, years: "2017-2019", label: "115th Congress (2017-2019)" },
  { congress: 114, years: "2015-2017", label: "114th Congress (2015-2017)" },
  { congress: 113, years: "2013-2015", label: "113th Congress (2013-2015)" },
  { congress: 112, years: "2011-2013", label: "112th Congress (2011-2013)" },
  { congress: 111, years: "2009-2011", label: "111th Congress (2009-2011)" },
  { congress: 110, years: "2007-2009", label: "110th Congress (2007-2009)" },
];
import type { TrackedBill, BillChangeHistory, Matter } from "@shared/schema";
import { US_STATES, isStateBill, trackedBillLabel, jurisdictionName } from "@shared/bill-label";
import { LegiScanAttribution } from "@/components/legiscan-attribution";

const STATE_OPTIONS = Object.entries(US_STATES).sort((a, b) => a[1].localeCompare(b[1]));

interface StateBillSearchResult {
  legiscanBillId: number;
  state: string;
  billLabel: string;
  title: string;
  lastAction: string | null;
  lastActionDate: string | null;
}

interface BillSearchResult {
  congress: number;
  type: string;
  number: number;
  title: string;
  latestAction?: { text: string; actionDate: string };
  sponsors?: Array<{ bioguideId?: string; fullName: string; firstName?: string; lastName?: string; party: string; state: string }>;
  policyArea?: { name: string };
  introducedDate?: string;
}

export default function BillTrackingPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCongress, setSelectedCongress] = useState(119);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BillSearchResult[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  // Detail panel: keep only the id so the panel always shows fresh data.
  const [openBillId, setOpenBillId] = useState<string | null>(null);
  const [focusTags, setFocusTags] = useState(false);
  const [alertsBill, setAlertsBill] = useState<TrackedBill | null>(null);
  const [filterText, setFilterText] = useState("");
  const [filterScope, setFilterScope] = useState<"all" | "federal" | "state">("all");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [searchSource, setSearchSource] = useState<"federal" | "state">("federal");
  const [selectedState, setSelectedState] = useState("");
  const [stateResults, setStateResults] = useState<StateBillSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const { data: trackedBills, isLoading } = useQuery<TrackedBill[]>({
    queryKey: ["/api/tracked-bills"],
  });

  const { data: unreadChanges } = useQuery<(BillChangeHistory & { bill: TrackedBill })[]>({
    queryKey: ["/api/tracked-bills/changes/unread"],
  });

  const { data: matters } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
  });

  const openBill = trackedBills?.find((b) => b.id === openBillId) ?? null;
  const openBillPanel = (bill: TrackedBill, options: { focusTags?: boolean } = {}) => {
    setFocusTags(!!options.focusTags);
    setOpenBillId(bill.id);
  };

  const allTags = useMemo(
    () => Array.from(new Set((trackedBills ?? []).flatMap((b) => b.tags ?? []))).sort(),
    [trackedBills],
  );

  const visibleBills = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return (trackedBills ?? []).filter((bill) => {
      if (filterScope === "federal" && isStateBill(bill)) return false;
      if (filterScope === "state" && !isStateBill(bill)) return false;
      if (filterTag && !(bill.tags ?? []).includes(filterTag)) return false;
      if (!q) return true;
      return [trackedBillLabel(bill), bill.title, bill.sponsor, bill.latestAction, bill.policyArea, jurisdictionName(bill), ...(bill.tags ?? [])]
        .some((field) => field?.toLowerCase().includes(q));
    });
  }, [trackedBills, filterText, filterScope, filterTag]);

  const isFiltering = !!filterText.trim() || filterScope !== "all" || !!filterTag;

  // Already-tracked checks for search results, so they show "Tracking" instead of "Track".
  const isFederalTracked = (r: BillSearchResult) =>
    !!trackedBills?.some((b) => !isStateBill(b) && b.congress === r.congress && b.billType === r.type.toLowerCase() && b.billNumber === Number(r.number));
  const isStateTracked = (r: StateBillSearchResult) =>
    !!trackedBills?.some((b) => b.legiscanBillId === r.legiscanBillId);

  const searchBillsMutation = useMutation({
    mutationFn: async ({ query, congress }: { query: string; congress: number }) => {
      const res = await apiRequest("GET", `/api/bills/search?q=${encodeURIComponent(query)}&congress=${congress}`);
      return res.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.bills || []);
      setIsSearching(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Search Failed",
        description: friendlyError(error),
        variant: "destructive",
      });
      setIsSearching(false);
      setHasSearched(false);
    },
  });

  const trackBillMutation = useMutation({
    mutationFn: async (bill: BillSearchResult) => {
      // Get sponsor name - handle both fullName format and firstName/lastName format
      const sponsor = bill.sponsors?.[0];
      const sponsorName = sponsor 
        ? (sponsor.fullName || `${sponsor.firstName || ''} ${sponsor.lastName || ''}`.trim())
        : null;
      
      const res = await apiRequest("POST", "/api/tracked-bills", {
        congress: bill.congress,
        billType: bill.type,
        billNumber: bill.number,
        title: bill.title,
        sponsor: sponsorName,
        sponsorParty: sponsor?.party,
        sponsorState: sponsor?.state,
        introducedDate: bill.introducedDate,
        latestAction: bill.latestAction?.text,
        latestActionDate: bill.latestAction?.actionDate,
        policyArea: bill.policyArea?.name,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Bill Added", description: "Bill is now being tracked for changes." });
      queryClient.invalidateQueries({ queryKey: ["/api/tracked-bills"] });
      setShowAddDialog(false);
      setSearchResults([]);
      setSearchQuery("");
      setHasSearched(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Track Bill",
        description: friendlyError(error),
        variant: "destructive",
      });
    },
  });

  const searchStateBillsMutation = useMutation({
    mutationFn: async ({ query, state }: { query: string; state: string }) => {
      const res = await apiRequest("GET", `/api/state-bills/search?state=${state}&q=${encodeURIComponent(query)}`);
      return res.json();
    },
    onSuccess: (data) => {
      setStateResults(data.bills || []);
      setIsSearching(false);
    },
    onError: (error: Error) => {
      toast({ title: "Search Failed", description: friendlyError(error), variant: "destructive" });
      setIsSearching(false);
      setHasSearched(false); // the search didn't run, so don't claim "No bills found"
    },
  });

  const trackStateBillMutation = useMutation({
    mutationFn: async (bill: StateBillSearchResult) => {
      const res = await apiRequest("POST", "/api/tracked-bills/state", { legiscanBillId: bill.legiscanBillId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Bill Added", description: "State bill is now being tracked for changes." });
      queryClient.invalidateQueries({ queryKey: ["/api/tracked-bills"] });
      setShowAddDialog(false);
      setStateResults([]);
      setSearchQuery("");
      setHasSearched(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Track Bill", description: friendlyError(error), variant: "destructive" });
    },
  });

  const untrackBillMutation = useMutation({
    mutationFn: async (billId: string) => {
      await apiRequest("DELETE", `/api/tracked-bills/${billId}`);
    },
    onSuccess: () => {
      toast({ title: "Bill Removed", description: "Bill is no longer being tracked." });
      setOpenBillId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/tracked-bills"] });
    },
    onError: (error: Error) => {
      toast({ title: "Couldn't stop tracking", description: friendlyError(error), variant: "destructive" });
    },
  });

  const refreshBillMutation = useMutation({
    mutationFn: async (billId: string) => {
      const res = await apiRequest("POST", `/api/tracked-bills/${billId}/sync`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.changed) {
        toast({ title: "Bill Updated", description: "New changes detected!" });
      } else {
        toast({ title: "No Changes", description: "Bill is up to date." });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tracked-bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracked-bills/changes/unread"] });
    },
    onError: (error: Error) => {
      toast({ title: "Couldn't check for updates", description: friendlyError(error), variant: "destructive" });
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    if (searchSource === "state") {
      if (!selectedState) {
        toast({ title: "Choose a state", description: "Pick which state legislature to search." });
        return;
      }
      setStateResults([]);
      setIsSearching(true);
      setHasSearched(true);
      searchStateBillsMutation.mutate({ query: searchQuery, state: selectedState });
      return;
    }
    setSearchResults([]); // Clear old results before new search
    setIsSearching(true);
    setHasSearched(true);
    searchBillsMutation.mutate({ query: searchQuery, congress: selectedCongress });
  };

  const switchSource = (source: "federal" | "state") => {
    setSearchSource(source);
    setSearchResults([]);
    setStateResults([]);
    setHasSearched(false);
  };

  const hasStateBills = !!trackedBills?.some((b) => isStateBill(b));

  const getBillTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      hr: "H.R.",
      s: "S.",
      hjres: "H.J.Res.",
      sjres: "S.J.Res.",
      hconres: "H.Con.Res.",
      sconres: "S.Con.Res.",
      hres: "H.Res.",
      sres: "S.Res.",
    };
    return labels[type.toLowerCase()] || type.toUpperCase();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bill Tracking</h1>
          <p className="text-muted-foreground">Track federal and state bills and get notified of changes</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadChanges && unreadChanges.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="w-3 h-3" />
              {unreadChanges.length} new updates
            </Badge>
          )}
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-bill">
                <Plus className="w-4 h-4 mr-2" />
                Track Bill
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Search and Track a Bill</DialogTitle>
                <DialogDescription>
                  {searchSource === "federal"
                    ? 'Search congressional bills by keyword or bill number (e.g., "HR 1234" or "climate")'
                    : 'Search current-session state bills by keyword or bill number (e.g., "HB 1234" or "veterans")'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="inline-flex rounded-md border p-0.5" role="tablist" aria-label="Bill source">
                  <Button
                    type="button"
                    size="sm"
                    variant={searchSource === "federal" ? "default" : "ghost"}
                    onClick={() => switchSource("federal")}
                    role="tab"
                    aria-selected={searchSource === "federal"}
                    data-testid="toggle-source-federal"
                  >
                    Federal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={searchSource === "state" ? "default" : "ghost"}
                    onClick={() => switchSource("state")}
                    role="tab"
                    aria-selected={searchSource === "state"}
                    data-testid="toggle-source-state"
                  >
                    State
                  </Button>
                </div>
                <div className="flex gap-2">
                  {searchSource === "federal" ? (
                    <Select
                      value={selectedCongress.toString()}
                      onValueChange={(value) => setSelectedCongress(parseInt(value))}
                    >
                      <SelectTrigger className="w-[240px]" data-testid="select-congress">
                        <SelectValue placeholder="Select Congress" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONGRESS_SESSIONS.map((session) => (
                          <SelectItem key={session.congress} value={session.congress.toString()}>
                            {session.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={selectedState} onValueChange={setSelectedState}>
                      <SelectTrigger className="w-[240px]" data-testid="select-state">
                        <SelectValue placeholder="Select a state" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATE_OPTIONS.map(([code, name]) => (
                          <SelectItem key={code} value={code}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={searchSource === "federal"
                      ? "Search bills by keyword or number (e.g., HR 1234, climate)..."
                      : "Search state bills by keyword or number (e.g., HB 1234, veterans)..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    data-testid="input-bill-search"
                  />
                  <Button onClick={handleSearch} disabled={isSearching} data-testid="button-search-bills">
                    {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                
                {searchSource === "state" && (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {stateResults.map((bill) => {
                      const tracked = isStateTracked(bill);
                      return (
                        <div key={bill.legiscanBillId} className="flex items-start gap-3 rounded-lg border p-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <Badge variant="outline" className="font-semibold">{bill.billLabel}</Badge>
                              {bill.lastActionDate && (
                                <span className="text-xs text-muted-foreground">Last action {formatBillDate(bill.lastActionDate)}</span>
                              )}
                            </div>
                            <p className="text-sm font-medium leading-snug line-clamp-2">{bill.title}</p>
                            {bill.lastAction && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{bill.lastAction}</p>
                            )}
                          </div>
                          {tracked ? (
                            <Badge variant="secondary" className="shrink-0 gap-1 py-1"><Check className="w-3 h-3" /> Tracking</Badge>
                          ) : (
                            <Button
                              size="sm"
                              className="shrink-0"
                              onClick={() => trackStateBillMutation.mutate(bill)}
                              disabled={trackStateBillMutation.isPending}
                              data-testid={`button-track-state-bill-${bill.legiscanBillId}`}
                            >
                              <Plus className="w-4 h-4 mr-1" /> Track
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {stateResults.length === 0 && hasSearched && !isSearching && (
                      <p className="text-center text-muted-foreground py-4">No bills found. Try a different search.</p>
                    )}
                    {stateResults.length > 0 && (
                      <LegiScanAttribution className="text-center pt-1" />
                    )}
                  </div>
                )}

                {searchSource === "federal" && (
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {searchResults.map((bill, index) => {
                    const tracked = isFederalTracked(bill);
                    return (
                      <div key={index} className="flex items-start gap-3 rounded-lg border p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-semibold">
                              {getBillTypeLabel(bill.type)} {bill.number}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{bill.congress}th Congress</span>
                          </div>
                          <p className="text-sm font-medium leading-snug line-clamp-2">{bill.title}</p>
                          {bill.sponsors?.[0] && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Sponsor: {bill.sponsors[0].firstName} {bill.sponsors[0].lastName} ({bill.sponsors[0].party}-{bill.sponsors[0].state})
                            </p>
                          )}
                        </div>
                        {tracked ? (
                          <Badge variant="secondary" className="shrink-0 gap-1 py-1"><Check className="w-3 h-3" /> Tracking</Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="shrink-0"
                            onClick={() => trackBillMutation.mutate(bill)}
                            disabled={trackBillMutation.isPending}
                            data-testid={`button-track-bill-${bill.number}`}
                          >
                            <Plus className="w-4 h-4 mr-1" /> Track
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {searchResults.length === 0 && hasSearched && !isSearching && (
                    <p className="text-center text-muted-foreground py-4">No bills found. Try a different search.</p>
                  )}
                </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Unread Changes Alert */}
      {unreadChanges && unreadChanges.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Recent Bill Updates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unreadChanges.slice(0, 5).map((change) => (
              <button
                key={change.id}
                type="button"
                onClick={() => openBillPanel(change.bill)}
                className="flex w-full items-center justify-between gap-3 rounded-md bg-background p-2 text-left hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <span className="font-medium">{trackedBillLabel(change.bill)}</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-sm">{change.description}</span>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filter bar */}
      {trackedBills && trackedBills.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter tracked bills by number, title, sponsor, or tag…"
                className="pl-9"
                data-testid="input-filter-bills"
              />
            </div>
            <div className="inline-flex rounded-md border p-0.5 self-start" role="tablist" aria-label="Jurisdiction">
              {(["all", "federal", "state"] as const).map((scope) => (
                <Button
                  key={scope}
                  type="button"
                  size="sm"
                  variant={filterScope === scope ? "default" : "ghost"}
                  onClick={() => setFilterScope(scope)}
                  role="tab"
                  aria-selected={filterScope === scope}
                >
                  {scope === "all" ? "All" : scope === "federal" ? "Federal" : "State"}
                </Button>
              ))}
            </div>
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Tags:</span>
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={filterTag === tag ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                  data-testid={`filter-tag-${tag}`}
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tracked Bills */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : trackedBills && trackedBills.length > 0 ? (
        visibleBills.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleBills.map((bill) => {
              const matterName = bill.matterId ? matters?.find((m) => m.id === bill.matterId)?.name : null;
              return (
                <Card
                  key={bill.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openBillPanel(bill)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openBillPanel(bill);
                    }
                  }}
                  className="hover-elevate cursor-pointer flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid={`card-bill-${bill.id}`}
                >
                  <CardHeader className="pb-2 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="font-semibold">{trackedBillLabel(bill)}</Badge>
                        <Badge variant="secondary" className="text-xs">
                          {isStateBill(bill) ? jurisdictionName(bill) : "Federal"}
                        </Badge>
                        {bill.status && (
                          <Badge variant="outline" className={`text-xs ${statusBadgeClass(bill.status)}`}>{bill.status}</Badge>
                        )}
                      </div>
                      <div className="flex items-center -mr-2 -mt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <BillOrganizeMenu bill={bill} onAddTags={() => openBillPanel(bill, { focusTags: true })} />
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Alert settings"
                          title="Alert settings"
                          onClick={() => setAlertsBill(bill)}
                          data-testid={`button-alerts-${bill.id}`}
                        >
                          <Bell className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-base leading-snug line-clamp-2">{bill.title}</CardTitle>
                    {bill.sponsor && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {bill.sponsor}
                        {bill.sponsorParty && ` (${bill.sponsorParty}${bill.sponsorState ? `-${bill.sponsorState}` : ""})`}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="mt-auto space-y-3">
                    {bill.latestAction && (
                      <div className="rounded-md bg-muted/60 p-2">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Latest action{bill.latestActionDate ? ` · ${formatBillDate(bill.latestActionDate)}` : ""}
                        </p>
                        <p className="text-sm line-clamp-2">{bill.latestAction}</p>
                      </div>
                    )}
                    {(matterName || (bill.tags?.length ?? 0) > 0) && (
                      <div className="flex flex-wrap gap-1.5">
                        {matterName && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <FolderOpen className="w-3 h-3" /> {matterName}
                          </Badge>
                        )}
                        {bill.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-primary flex items-center gap-0.5">
                      View details <ChevronRight className="w-3 h-3" />
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <p className="text-muted-foreground">No tracked bills match your filters.</p>
              {isFiltering && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilterText("");
                    setFilterScope("all");
                    setFilterTag(null);
                  }}
                >
                  <X className="w-4 h-4 mr-1" /> Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-2">No Bills Being Tracked</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Search federal or state bills to track and get notified when they change.
            </p>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-start-tracking">
              <Plus className="w-4 h-4 mr-2" />
              Track Your First Bill
            </Button>
          </CardContent>
        </Card>
      )}

      {hasStateBills && (
        <LegiScanAttribution className="text-center" />
      )}

      <BillDetailSheet
        bill={openBill}
        focusTags={focusTags}
        onClose={() => setOpenBillId(null)}
        onRefresh={(bill) => refreshBillMutation.mutate(bill.id)}
        refreshing={refreshBillMutation.isPending}
        onUntrack={(bill) => untrackBillMutation.mutate(bill.id)}
        onOpenAlerts={(bill) => setAlertsBill(bill)}
      />

      <BillAlertsDialog bill={alertsBill} onClose={() => setAlertsBill(null)} />
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Bell, ExternalLink, RefreshCw, Trash2, AlertCircle, Clock, Briefcase, FolderOpen } from "lucide-react";

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
import type { TrackedBill, BillChangeHistory, BillTrackingAlert, Matter, ClientPortal, PortalTrackedBill } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Share2, Users } from "lucide-react";

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
  const [selectedBill, setSelectedBill] = useState<TrackedBill | null>(null);

  const { data: trackedBills, isLoading } = useQuery<TrackedBill[]>({
    queryKey: ["/api/tracked-bills"],
  });

  const { data: unreadChanges } = useQuery<(BillChangeHistory & { bill: TrackedBill })[]>({
    queryKey: ["/api/tracked-bills/changes/unread"],
  });

  const { data: matters } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
  });

  const { data: portals } = useQuery<ClientPortal[]>({
    queryKey: ["/api/portals"],
  });

  const { data: selectedBillPortals } = useQuery<PortalTrackedBill[]>({
    queryKey: ["/api/tracked-bills", selectedBill?.id, "portals"],
    queryFn: async () => {
      if (!selectedBill) return [];
      const res = await apiRequest("GET", `/api/tracked-bills/${selectedBill.id}/portals`);
      return res.json();
    },
    enabled: !!selectedBill,
  });

  const shareBillMutation = useMutation({
    mutationFn: async ({ billId, portalId }: { billId: string; portalId: string }) => {
      const res = await apiRequest("POST", `/api/tracked-bills/${billId}/portals`, { portalId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Bill Shared", description: "Bill is now visible in the client portal." });
      queryClient.invalidateQueries({ queryKey: ["/api/tracked-bills", selectedBill?.id, "portals"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Share", description: error.message, variant: "destructive" });
    },
  });

  const unshareBillMutation = useMutation({
    mutationFn: async ({ billId, assignmentId }: { billId: string; assignmentId: string }) => {
      await apiRequest("DELETE", `/api/tracked-bills/${billId}/portals/${assignmentId}`);
    },
    onSuccess: () => {
      toast({ title: "Bill Unshared", description: "Bill removed from client portal." });
      queryClient.invalidateQueries({ queryKey: ["/api/tracked-bills", selectedBill?.id, "portals"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Unshare", description: error.message, variant: "destructive" });
    },
  });

  const assignMatterMutation = useMutation({
    mutationFn: async ({ billId, matterId }: { billId: string; matterId: string | null }) => {
      const res = await apiRequest("PATCH", `/api/tracked-bills/${billId}`, { matterId });
      return res.json();
    },
    onSuccess: (updatedBill: TrackedBill) => {
      toast({ title: "Matter Assigned", description: "Bill has been assigned to the matter." });
      queryClient.invalidateQueries({ queryKey: ["/api/tracked-bills"] });
      // Update selectedBill state to reflect the change immediately
      setSelectedBill(updatedBill);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Assign", description: error.message, variant: "destructive" });
    },
  });

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
        description: error.message,
        variant: "destructive",
      });
      setIsSearching(false);
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
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Track Bill",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const untrackBillMutation = useMutation({
    mutationFn: async (billId: string) => {
      await apiRequest("DELETE", `/api/tracked-bills/${billId}`);
    },
    onSuccess: () => {
      toast({ title: "Bill Removed", description: "Bill is no longer being tracked." });
      queryClient.invalidateQueries({ queryKey: ["/api/tracked-bills"] });
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
  });

  const updateAlertsMutation = useMutation({
    mutationFn: async ({ billId, alerts }: { billId: string; alerts: Partial<BillTrackingAlert> }) => {
      const res = await apiRequest("PATCH", `/api/tracked-bills/${billId}/alerts`, alerts);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Alert Settings Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/tracked-bills"] });
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSearchResults([]); // Clear old results before new search
    setIsSearching(true);
    searchBillsMutation.mutate({ query: searchQuery, congress: selectedCongress });
  };

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
          <p className="text-muted-foreground">Track congressional bills and get notified of changes</p>
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
                  Search for congressional bills by keyword or bill number (e.g., "HR 1234" or "climate")
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
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
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search bills by keyword or number (e.g., HR 1234, climate)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    data-testid="input-bill-search"
                  />
                  <Button onClick={handleSearch} disabled={isSearching} data-testid="button-search-bills">
                    {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {searchResults.map((bill, index) => (
                    <Card key={index} className="hover-elevate cursor-pointer" onClick={() => trackBillMutation.mutate(bill)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">
                                {getBillTypeLabel(bill.type)} {bill.number}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {bill.congress}th Congress
                              </span>
                            </div>
                            <p className="text-sm font-medium line-clamp-2">{bill.title}</p>
                            {bill.sponsors?.[0] && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Sponsor: {bill.sponsors[0].firstName} {bill.sponsors[0].lastName} ({bill.sponsors[0].party}-{bill.sponsors[0].state})
                              </p>
                            )}
                          </div>
                          <Button size="sm" variant="outline" data-testid={`button-track-bill-${bill.number}`}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {searchResults.length === 0 && searchQuery && !isSearching && (
                    <p className="text-center text-muted-foreground py-4">No bills found. Try a different search.</p>
                  )}
                </div>
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
              <div key={change.id} className="flex items-center justify-between p-2 bg-background rounded-md">
                <div>
                  <span className="font-medium">{getBillTypeLabel(change.bill.billType)} {change.bill.billNumber}</span>
                  <span className="text-muted-foreground"> - </span>
                  <span className="text-sm">{change.description}</span>
                </div>
                <Badge variant="secondary">{change.changeType.replace("_", " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trackedBills.map((bill) => (
            <Card key={bill.id} className="hover-elevate">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-sm">
                    {getBillTypeLabel(bill.billType)} {bill.billNumber}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => refreshBillMutation.mutate(bill.id)}
                      disabled={refreshBillMutation.isPending}
                      data-testid={`button-refresh-${bill.id}`}
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshBillMutation.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setSelectedBill(bill)}
                      data-testid={`button-settings-${bill.id}`}
                    >
                      <Bell className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-base line-clamp-2">{bill.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  {bill.sponsor && (
                    <p className="text-muted-foreground">
                      Sponsor: {bill.sponsor} {bill.sponsorParty && `(${bill.sponsorParty}${bill.sponsorState ? `-${bill.sponsorState}` : ""})`}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {bill.policyArea && (
                      <Badge variant="secondary" className="text-xs">{bill.policyArea}</Badge>
                    )}
                    {bill.matterId && matters && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <FolderOpen className="w-3 h-3" />
                        {matters.find(m => m.id === bill.matterId)?.name || "Assigned"}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {bill.latestAction && (
                  <div className="p-2 bg-muted rounded-md">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Latest Action {bill.latestActionDate && `(${bill.latestActionDate})`}
                    </p>
                    <p className="text-sm line-clamp-2">{bill.latestAction}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <a
                    href={`https://www.congress.gov/bill/${bill.congress}th-congress/${bill.billType === "hr" ? "house-bill" : bill.billType === "s" ? "senate-bill" : bill.billType}/${bill.billNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    View on Congress.gov <ExternalLink className="w-3 h-3" />
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => untrackBillMutation.mutate(bill.id)}
                    data-testid={`button-untrack-${bill.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-2">No Bills Being Tracked</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Search for bills to track and get notified when they change.
            </p>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-start-tracking">
              <Plus className="w-4 h-4 mr-2" />
              Track Your First Bill
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bill Settings Dialog */}
      <Dialog open={!!selectedBill} onOpenChange={(open) => !open && setSelectedBill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bill Settings</DialogTitle>
            <DialogDescription>
              Configure {selectedBill && `${getBillTypeLabel(selectedBill.billType)} ${selectedBill.billNumber}`}
            </DialogDescription>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="matter-select" className="flex flex-col gap-1">
                  <span className="flex items-center gap-1">
                    <FolderOpen className="w-4 h-4" />
                    Assign to Research Project
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">Link this bill to a research project for organization</span>
                </Label>
                <Select
                  value={selectedBill.matterId || "none"}
                  onValueChange={(value) => {
                    assignMatterMutation.mutate({
                      billId: selectedBill.id,
                      matterId: value === "none" ? null : value
                    });
                  }}
                >
                  <SelectTrigger data-testid="select-matter">
                    <SelectValue placeholder="Select a matter..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No matter assigned</SelectItem>
                    {matters?.map((matter) => (
                      <SelectItem key={matter.id} value={matter.id}>
                        {matter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="border-t pt-4">
                <Label className="flex flex-col gap-1 mb-3">
                  <span className="flex items-center gap-1">
                    <Share2 className="w-4 h-4" />
                    Share with Client Portals
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">Make this bill visible to selected client portals</span>
                </Label>
                {portals && portals.length > 0 ? (
                  <div className="space-y-2">
                    {portals.map((portal) => {
                      const assignment = selectedBillPortals?.find(a => a.portalId === portal.id);
                      const isShared = !!assignment;
                      return (
                        <div key={portal.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                          <Checkbox
                            id={`portal-${portal.id}`}
                            checked={isShared}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                shareBillMutation.mutate({ billId: selectedBill.id, portalId: portal.id });
                              } else if (assignment) {
                                unshareBillMutation.mutate({ billId: selectedBill.id, assignmentId: assignment.id });
                              }
                            }}
                            data-testid={`checkbox-portal-${portal.id}`}
                          />
                          <Label htmlFor={`portal-${portal.id}`} className="flex-1 cursor-pointer">
                            <span className="text-sm">{portal.name}</span>
                            {portal.description && (
                              <span className="text-xs text-muted-foreground block">{portal.description}</span>
                            )}
                          </Label>
                          {isShared && <Badge variant="secondary" className="text-xs">Shared</Badge>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No client portals configured yet.</p>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Alert Settings</h4>
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="status-change" className="flex flex-col gap-1">
                  <span>Status Changes</span>
                  <span className="text-xs text-muted-foreground font-normal">When the bill moves to a new stage</span>
                </Label>
                <Switch
                  id="status-change"
                  defaultChecked={true}
                  onCheckedChange={(checked) => updateAlertsMutation.mutate({ billId: selectedBill.id, alerts: { alertOnStatusChange: checked } })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="new-action" className="flex flex-col gap-1">
                  <span>New Actions</span>
                  <span className="text-xs text-muted-foreground font-normal">Any new legislative action on the bill</span>
                </Label>
                <Switch
                  id="new-action"
                  defaultChecked={true}
                  onCheckedChange={(checked) => updateAlertsMutation.mutate({ billId: selectedBill.id, alerts: { alertOnNewAction: checked } })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="amendments" className="flex flex-col gap-1">
                  <span>Amendments</span>
                  <span className="text-xs text-muted-foreground font-normal">When new amendments are proposed</span>
                </Label>
                <Switch
                  id="amendments"
                  defaultChecked={true}
                  onCheckedChange={(checked) => updateAlertsMutation.mutate({ billId: selectedBill.id, alerts: { alertOnAmendment: checked } })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="email-notify" className="flex flex-col gap-1">
                  <span>Email Notifications</span>
                  <span className="text-xs text-muted-foreground font-normal">Receive alerts via email</span>
                </Label>
                <Switch
                  id="email-notify"
                  defaultChecked={true}
                  onCheckedChange={(checked) => updateAlertsMutation.mutate({ billId: selectedBill.id, alerts: { emailNotification: checked } })}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

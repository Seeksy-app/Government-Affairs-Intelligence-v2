import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, Plus, Trash2, RefreshCw, Globe, Monitor, Smartphone, Tablet, ExternalLink, Target, Clock, TrendingUp } from "lucide-react";
import type { RankTrackedQuery, RankTrackingResult } from "@shared/schema";

export default function RankTrackingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [newQuery, setNewQuery] = useState("");
  const [newTargetDomain, setNewTargetDomain] = useState("");
  const [newDevice, setNewDevice] = useState("desktop");
  const [newLocation, setNewLocation] = useState("");

  const { data: trackedQueries, isLoading } = useQuery<RankTrackedQuery[]>({
    queryKey: ["/api/rank-tracking/queries"],
  });

  const { data: results, isLoading: resultsLoading } = useQuery<RankTrackingResult[]>({
    queryKey: ["/api/rank-tracking/results", selectedQueryId],
    enabled: !!selectedQueryId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { query: string; targetDomain?: string; device?: string; location?: string }) =>
      apiRequest("POST", "/api/rank-tracking/queries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rank-tracking/queries"] });
      setAddOpen(false);
      setNewQuery("");
      setNewTargetDomain("");
      setNewDevice("desktop");
      setNewLocation("");
      toast({ title: "Query added", description: "Search query is now being tracked." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add query.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/rank-tracking/queries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rank-tracking/queries"] });
      if (selectedQueryId) setSelectedQueryId(null);
      toast({ title: "Deleted", description: "Query removed from tracking." });
    },
  });

  const checkMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/rank-tracking/check/${id}`);
      return res.json();
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rank-tracking/results", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/rank-tracking/queries"] });
      const targetPos = data.targetPosition;
      toast({
        title: "Rank check complete",
        description: targetPos
          ? `Target domain found at position ${targetPos} (${data.total} results)`
          : `${data.total} results found`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rank check failed",
        description: error?.message || "Could not check rankings. Verify your API key.",
        variant: "destructive",
      });
    },
  });

  const selectedQuery = trackedQueries?.find((q) => q.id === selectedQueryId);

  const getDeviceIcon = (device: string | null) => {
    switch (device) {
      case "mobile": return Smartphone;
      case "tablet": return Tablet;
      default: return Monitor;
    }
  };

  const getPositionBadge = (position: number | null) => {
    if (!position) return <Badge variant="secondary">N/A</Badge>;
    if (position <= 3) return <Badge variant="default">{position}</Badge>;
    if (position <= 10) return <Badge variant="outline">{position}</Badge>;
    if (position <= 20) return <Badge variant="secondary">{position}</Badge>;
    return <Badge variant="secondary">{position}</Badge>;
  };

  const latestResults = results ? (() => {
    if (results.length === 0) return [];
    const latestDate = results[0]?.checkedAt;
    if (!latestDate) return [];
    const latestTime = new Date(latestDate).getTime();
    return results.filter((r) => {
      const rTime = new Date(r.checkedAt!).getTime();
      return Math.abs(rTime - latestTime) < 60000;
    });
  })() : [];

  const targetResult = selectedQuery?.targetDomain
    ? latestResults.find((r) => r.domain?.includes(selectedQuery.targetDomain!))
    : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif" data-testid="text-rank-tracking-title">
            Google Rank Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-rank-tracking-subtitle">
            Monitor your search rankings powered by SearchAPI.io
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-query">
              <Plus className="h-4 w-4 mr-2" />
              Track New Query
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Search Query to Track</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="query">Search Query</Label>
                <Input
                  id="query"
                  placeholder='e.g., "defense lobbying firm" or "government affairs consultant"'
                  value={newQuery}
                  onChange={(e) => setNewQuery(e.target.value)}
                  data-testid="input-query"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetDomain">Target Domain (optional)</Label>
                <Input
                  id="targetDomain"
                  placeholder="e.g., yourfirm.com"
                  value={newTargetDomain}
                  onChange={(e) => setNewTargetDomain(e.target.value)}
                  data-testid="input-target-domain"
                />
                <p className="text-xs text-muted-foreground">Track where this domain appears in results</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Device</Label>
                  <Select value={newDevice} onValueChange={setNewDevice}>
                    <SelectTrigger data-testid="select-device">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desktop">Desktop</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                      <SelectItem value="tablet">Tablet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location (optional)</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Washington, DC"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    data-testid="input-location"
                  />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({
                  query: newQuery,
                  targetDomain: newTargetDomain || undefined,
                  device: newDevice,
                  location: newLocation || undefined,
                })}
                disabled={!newQuery.trim() || createMutation.isPending}
                data-testid="button-submit-query"
              >
                {createMutation.isPending ? "Adding..." : "Add Query"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                Tracked Queries
              </CardTitle>
              <Badge variant="secondary">{trackedQueries?.length ?? 0}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : trackedQueries && trackedQueries.length > 0 ? (
                trackedQueries.map((tq) => {
                  const DeviceIcon = getDeviceIcon(tq.device);
                  const isSelected = selectedQueryId === tq.id;
                  return (
                    <div
                      key={tq.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "hover-elevate"
                      }`}
                      onClick={() => setSelectedQueryId(tq.id)}
                      data-testid={`card-query-${tq.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" data-testid={`text-query-${tq.id}`}>
                            {tq.query}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <DeviceIcon className="h-3 w-3" />
                            {tq.location && (
                              <>
                                <Globe className="h-3 w-3" />
                                <span className="truncate">{tq.location}</span>
                              </>
                            )}
                          </div>
                          {tq.targetDomain && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Target className="h-3 w-3" />
                              <span className="truncate">{tq.targetDomain}</span>
                            </div>
                          )}
                          {tq.lastCheckedAt && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(tq.lastCheckedAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              checkMutation.mutate(tq.id);
                            }}
                            disabled={checkMutation.isPending}
                            data-testid={`button-check-${tq.id}`}
                          >
                            <RefreshCw className={`h-4 w-4 ${checkMutation.isPending ? "animate-spin" : ""}`} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(tq.id);
                            }}
                            data-testid={`button-delete-${tq.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No tracked queries yet</p>
                  <p className="text-xs mt-1">Add a search query to start tracking rankings</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selectedQueryId && selectedQuery ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Results for: "{selectedQuery.query}"
                    </CardTitle>
                    {selectedQuery.targetDomain && targetResult && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        {selectedQuery.targetDomain} ranks at position {getPositionBadge(targetResult.position)}
                      </p>
                    )}
                    {selectedQuery.targetDomain && !targetResult && latestResults.length > 0 && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        {selectedQuery.targetDomain} not found in top {latestResults.length} results
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => checkMutation.mutate(selectedQueryId)}
                    disabled={checkMutation.isPending}
                    data-testid="button-check-rankings"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${checkMutation.isPending ? "animate-spin" : ""}`} />
                    {checkMutation.isPending ? "Checking..." : "Check Now"}
                  </Button>
                </CardHeader>
                <CardContent>
                  {resultsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : latestResults.length > 0 ? (
                    <div className="rounded-lg border overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Rank</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead className="w-48">Domain</TableHead>
                            <TableHead className="w-16">Link</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {latestResults.map((result) => {
                            const isTarget = selectedQuery.targetDomain && result.domain?.includes(selectedQuery.targetDomain);
                            return (
                              <TableRow
                                key={result.id}
                                className={isTarget ? "bg-primary/5" : ""}
                                data-testid={`row-result-${result.id}`}
                              >
                                <TableCell>{getPositionBadge(result.position)}</TableCell>
                                <TableCell>
                                  <div>
                                    <p className="text-sm font-medium line-clamp-1" data-testid={`text-result-title-${result.id}`}>
                                      {result.title}
                                      {isTarget && (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          <Target className="h-3 w-3 mr-1" />
                                          Target
                                        </Badge>
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                      {result.snippet}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs text-muted-foreground truncate block max-w-[180px]">
                                    {result.domain}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {result.link && (
                                    <a
                                      href={result.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      data-testid={`link-result-${result.id}`}
                                    >
                                      <Button size="icon" variant="ghost">
                                        <ExternalLink className="h-4 w-4" />
                                      </Button>
                                    </a>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No ranking data yet</p>
                      <p className="text-sm mt-1">Click "Check Now" to fetch current rankings</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Search className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Select a query to view rankings</p>
                <p className="text-sm mt-1">
                  Choose a tracked query from the left panel, or add a new one to get started
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

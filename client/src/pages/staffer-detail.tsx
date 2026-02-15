import { useState, useEffect, useRef } from "react";
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
import { useRoute, useLocation } from "wouter";
import { 
  ArrowLeft,
  Building2,
  Briefcase,
  MapPin,
  GraduationCap,
  Link as LinkIcon,
  Mail,
  Calendar,
  Network,
  FileDown,
  Plus,
  Trash2,
  Clock,
  Users,
  ExternalLink
} from "lucide-react";
import { getAvatarUrl } from "@/lib/avatar-utils";
import type { Staffer, StafferCareerPosition, StafferConnection } from "@shared/schema";

const ORG_TYPE_COLORS: Record<string, string> = {
  "Congressional Office": "bg-blue-500",
  "Committee": "bg-purple-500",
  "Campaign": "bg-orange-500",
  "Think Tank": "bg-green-500",
  "Lobbying Firm": "bg-gray-500",
  "White House": "bg-yellow-500",
  "Administration": "bg-red-500",
};

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

interface StafferDetailData {
  staffer: Staffer;
  careerPositions: StafferCareerPosition[];
  connections: StafferConnection[];
}

interface TimelineData {
  staffer: { id: string; name: string };
  timeline: (StafferCareerPosition & { durationYears: number })[];
  stats: {
    totalYears: number;
    totalPositions: number;
    organizations: number;
    longestPosition: { position: string; years: number } | null;
  };
}

interface NetworkData {
  nodes: { id: string; label: string; group: string; level: number }[];
  edges: { from: string; to: string; label: string; years?: number }[];
}

export default function StafferDetailPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/staffers/:id");
  const stafferId = params?.id;
  
  const [activeTab, setActiveTab] = useState("timeline");
  const [addPositionOpen, setAddPositionOpen] = useState(false);
  const [addConnectionOpen, setAddConnectionOpen] = useState(false);
  const [exportingMiro, setExportingMiro] = useState(false);
  
  const networkRef = useRef<HTMLDivElement>(null);

  const [newPosition, setNewPosition] = useState({
    position: "",
    organization: "",
    bossName: "",
    startYear: new Date().getFullYear(),
    endYear: null as number | null,
    isCurrent: false,
    orgType: "",
    chamber: "",
    state: "",
    description: "",
  });

  const [newConnection, setNewConnection] = useState({
    connectedToName: "",
    connectionType: "",
    organization: "",
    yearsTogether: null as number | null,
    strength: "Medium",
    notes: "",
  });

  const { data: stafferData, isLoading } = useQuery<StafferDetailData>({
    queryKey: ["/api/staffers", stafferId],
    enabled: !!stafferId,
  });

  const { data: timelineData } = useQuery<TimelineData>({
    queryKey: ["/api/staffers", stafferId, "timeline"],
    queryFn: async () => {
      const res = await fetch(`/api/staffers/${stafferId}/timeline`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch timeline");
      return res.json();
    },
    enabled: !!stafferId,
  });

  const { data: networkData } = useQuery<NetworkData>({
    queryKey: ["/api/staffers", stafferId, "network"],
    queryFn: async () => {
      const res = await fetch(`/api/staffers/${stafferId}/network`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch network");
      return res.json();
    },
    enabled: !!stafferId && activeTab === "network",
  });

  const addPositionMutation = useMutation({
    mutationFn: async (data: typeof newPosition) => {
      return apiRequest(`/api/staffers/${stafferId}/positions`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staffers", stafferId] });
      queryClient.invalidateQueries({ queryKey: ["/api/staffers", stafferId, "timeline"] });
      toast({ title: "Position added successfully" });
      setAddPositionOpen(false);
      setNewPosition({
        position: "",
        organization: "",
        bossName: "",
        startYear: new Date().getFullYear(),
        endYear: null,
        isCurrent: false,
        orgType: "",
        chamber: "",
        state: "",
        description: "",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add position", description: error.message, variant: "destructive" });
    },
  });

  const addConnectionMutation = useMutation({
    mutationFn: async (data: typeof newConnection) => {
      return apiRequest(`/api/staffers/${stafferId}/connections`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staffers", stafferId] });
      queryClient.invalidateQueries({ queryKey: ["/api/staffers", stafferId, "network"] });
      toast({ title: "Connection added successfully" });
      setAddConnectionOpen(false);
      setNewConnection({
        connectedToName: "",
        connectionType: "",
        organization: "",
        yearsTogether: null,
        strength: "Medium",
        notes: "",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add connection", description: error.message, variant: "destructive" });
    },
  });

  const deletePositionMutation = useMutation({
    mutationFn: async (positionId: string) => {
      return apiRequest(`/api/staffers/${stafferId}/positions/${positionId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staffers", stafferId] });
      queryClient.invalidateQueries({ queryKey: ["/api/staffers", stafferId, "timeline"] });
      toast({ title: "Position removed" });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return apiRequest(`/api/staffers/${stafferId}/connections/${connectionId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staffers", stafferId] });
      queryClient.invalidateQueries({ queryKey: ["/api/staffers", stafferId, "network"] });
      toast({ title: "Connection removed" });
    },
  });

  const handleExportMiro = async () => {
    setExportingMiro(true);
    try {
      const res = await apiRequest(`/api/staffers/${stafferId}/export-miro`, {
        method: "POST",
      });
      toast({ 
        title: "Exported to Miro",
        description: "Opening your new Miro board...",
      });
      window.open(res.miroBoardUrl, "_blank");
    } catch (error) {
      toast({ 
        title: "Export failed", 
        description: error instanceof Error ? error.message : "Could not export to Miro",
        variant: "destructive",
      });
    } finally {
      setExportingMiro(false);
    }
  };

  const handleExportJson = async () => {
    try {
      const res = await fetch(`/api/staffers/${stafferId}/export?format=json`, { credentials: "include" });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${stafferData?.staffer.name.replace(/\s+/g, "_")}_profile.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported successfully" });
    } catch (error) {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (activeTab === "network" && networkData && networkRef.current) {
      import("vis-network").then(({ Network, DataSet }) => {
        const nodes = new DataSet(
          networkData.nodes.map((n) => ({
            id: n.id,
            label: n.label,
            group: n.group,
            shape: n.group === "person" ? "dot" : "box",
            size: n.level === 0 ? 30 : 20,
            color: n.group === "person" 
              ? { background: "#3B82F6", border: "#1E3A8A" }
              : { background: "#10B981", border: "#047857" },
          }))
        );
        const edges = new DataSet(
          networkData.edges.map((e, i) => ({
            id: i,
            from: e.from,
            to: e.to,
            label: e.label,
            arrows: "to",
            font: { size: 10 },
          }))
        );

        const network = new Network(
          networkRef.current!,
          { nodes, edges },
          {
            physics: {
              enabled: true,
              stabilization: { iterations: 100 },
            },
            interaction: {
              hover: true,
              tooltipDelay: 200,
            },
            nodes: {
              font: { size: 12 },
            },
            edges: {
              font: { size: 10, align: "middle" },
              smooth: { type: "continuous" },
            },
          }
        );

        return () => network.destroy();
      });
    }
  }, [activeTab, networkData]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!stafferData?.staffer) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Staffer not found</h3>
            <Button onClick={() => navigate("/staffers")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Staffers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { staffer, careerPositions, connections } = stafferData;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate("/staffers")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Staffers
      </Button>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={getAvatarUrl(staffer.name, staffer.photoUrl)} alt={staffer.name} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {staffer.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold mb-1">{staffer.name}</h1>
              <p className="text-lg text-muted-foreground mb-2">
                {staffer.currentPosition} {staffer.currentOrganization && `at ${staffer.currentOrganization}`}
              </p>
              {staffer.currentMember && (
                <p className="text-muted-foreground mb-3">
                  Works for {staffer.currentMember}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mb-4">
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
                    <MapPin className="h-3 w-3 mr-1" />
                    {staffer.state}
                  </Badge>
                )}
                {staffer.specialty && (
                  <Badge variant="secondary">{staffer.specialty}</Badge>
                )}
                {staffer.pathwayType && (
                  <Badge variant="secondary">{staffer.pathwayType}</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {staffer.contactEmail && (
                  <a href={`mailto:${staffer.contactEmail}`} className="flex items-center gap-1 hover:text-foreground">
                    <Mail className="h-4 w-4" />
                    {staffer.contactEmail}
                  </a>
                )}
                {staffer.linkedinUrl && (
                  <a href={staffer.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground">
                    <LinkIcon className="h-4 w-4" />
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={handleExportJson}>
                <FileDown className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportMiro}
                disabled={exportingMiro}
                data-testid="button-export-miro"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {exportingMiro ? "Exporting..." : "Export to Miro"}
              </Button>
            </div>
          </div>

          {staffer.bio && (
            <p className="mt-4 text-muted-foreground">{staffer.bio}</p>
          )}

          {timelineData?.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
              <div>
                <p className="text-2xl font-bold">{timelineData.stats.totalYears}</p>
                <p className="text-sm text-muted-foreground">Years in Politics</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{timelineData.stats.totalPositions}</p>
                <p className="text-sm text-muted-foreground">Positions Held</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{timelineData.stats.organizations}</p>
                <p className="text-sm text-muted-foreground">Organizations</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{connections.length}</p>
                <p className="text-sm text-muted-foreground">Connections</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            <Clock className="h-4 w-4 mr-2" />
            Career Timeline
          </TabsTrigger>
          <TabsTrigger value="connections" data-testid="tab-connections">
            <Users className="h-4 w-4 mr-2" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="network" data-testid="tab-network">
            <Network className="h-4 w-4 mr-2" />
            Network Graph
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Career Timeline</h2>
            <Dialog open={addPositionOpen} onOpenChange={setAddPositionOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-position">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Position
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Career Position</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Position *</Label>
                      <Input
                        value={newPosition.position}
                        onChange={(e) => setNewPosition({ ...newPosition, position: e.target.value })}
                        placeholder="e.g., Chief of Staff"
                        data-testid="input-position-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Organization *</Label>
                      <Input
                        value={newPosition.organization}
                        onChange={(e) => setNewPosition({ ...newPosition, organization: e.target.value })}
                        placeholder="e.g., Office of the Speaker"
                        data-testid="input-position-org"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Boss Name</Label>
                      <Input
                        value={newPosition.bossName}
                        onChange={(e) => setNewPosition({ ...newPosition, bossName: e.target.value })}
                        placeholder="e.g., Mike Johnson"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Org Type</Label>
                      <Select
                        value={newPosition.orgType}
                        onValueChange={(v) => setNewPosition({ ...newPosition, orgType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(ORG_TYPE_COLORS).map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Start Year *</Label>
                      <Input
                        type="number"
                        value={newPosition.startYear}
                        onChange={(e) => setNewPosition({ ...newPosition, startYear: parseInt(e.target.value) })}
                        data-testid="input-position-start"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Year</Label>
                      <Input
                        type="number"
                        value={newPosition.endYear || ""}
                        onChange={(e) => setNewPosition({ ...newPosition, endYear: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Current"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Chamber</Label>
                      <Select
                        value={newPosition.chamber}
                        onValueChange={(v) => setNewPosition({ ...newPosition, chamber: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="House">House</SelectItem>
                          <SelectItem value="Senate">Senate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newPosition.description}
                      onChange={(e) => setNewPosition({ ...newPosition, description: e.target.value })}
                      placeholder="Brief description of responsibilities..."
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddPositionOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => addPositionMutation.mutate(newPosition)}
                    disabled={!newPosition.position || !newPosition.organization || addPositionMutation.isPending}
                    data-testid="button-submit-position"
                  >
                    {addPositionMutation.isPending ? "Adding..." : "Add Position"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />
            <div className="space-y-6">
              {timelineData?.timeline.map((pos) => (
                <div key={pos.id} className="relative flex gap-4 pl-4">
                  <div className={`w-4 h-4 rounded-full border-2 border-background z-10 ${
                    pos.orgType && ORG_TYPE_COLORS[pos.orgType] ? ORG_TYPE_COLORS[pos.orgType] : "bg-gray-400"
                  }`} />
                  <Card className="flex-1">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{pos.position}</h3>
                          <p className="text-muted-foreground">{pos.organization}</p>
                          {pos.bossName && (
                            <p className="text-sm text-muted-foreground">Reported to: {pos.bossName}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={pos.isCurrent ? "default" : "secondary"}>
                            {pos.endYear ? `${pos.startYear} - ${pos.endYear}` : `${pos.startYear} - Present`}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePositionMutation.mutate(pos.id)}
                            data-testid={`button-delete-position-${pos.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {pos.orgType && (
                          <Badge variant="outline">{pos.orgType}</Badge>
                        )}
                        {pos.chamber && (
                          <Badge variant="outline" className={getChamberColor(pos.chamber)}>
                            {pos.chamber}
                          </Badge>
                        )}
                        <Badge variant="secondary">{pos.durationYears} year(s)</Badge>
                      </div>
                      {pos.description && (
                        <p className="text-sm text-muted-foreground mt-2">{pos.description}</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}
              {(!timelineData?.timeline || timelineData.timeline.length === 0) && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <Clock className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No career positions added yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Professional Connections</h2>
            <Dialog open={addConnectionOpen} onOpenChange={setAddConnectionOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-connection">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Connection
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Connection</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Connected To *</Label>
                    <Input
                      value={newConnection.connectedToName}
                      onChange={(e) => setNewConnection({ ...newConnection, connectedToName: e.target.value })}
                      placeholder="Name of connection"
                      data-testid="input-connection-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Connection Type</Label>
                      <Select
                        value={newConnection.connectionType}
                        onValueChange={(v) => setNewConnection({ ...newConnection, connectionType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="worked_with">Worked With</SelectItem>
                          <SelectItem value="reported_to">Reported To</SelectItem>
                          <SelectItem value="managed">Managed</SelectItem>
                          <SelectItem value="colleague">Colleague</SelectItem>
                          <SelectItem value="mentor">Mentor</SelectItem>
                          <SelectItem value="mentee">Mentee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Organization</Label>
                      <Input
                        value={newConnection.organization}
                        onChange={(e) => setNewConnection({ ...newConnection, organization: e.target.value })}
                        placeholder="Where they connected"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Years Together</Label>
                      <Input
                        type="number"
                        value={newConnection.yearsTogether || ""}
                        onChange={(e) => setNewConnection({ ...newConnection, yearsTogether: e.target.value ? parseInt(e.target.value) : null })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Strength</Label>
                      <Select
                        value={newConnection.strength}
                        onValueChange={(v) => setNewConnection({ ...newConnection, strength: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Strong">Strong</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Weak">Weak</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={newConnection.notes}
                      onChange={(e) => setNewConnection({ ...newConnection, notes: e.target.value })}
                      placeholder="Additional context..."
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddConnectionOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => addConnectionMutation.mutate(newConnection)}
                    disabled={!newConnection.connectedToName || addConnectionMutation.isPending}
                    data-testid="button-submit-connection"
                  >
                    {addConnectionMutation.isPending ? "Adding..." : "Add Connection"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connections.map((conn) => (
              <Card key={conn.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{conn.connectedToName}</h3>
                      {conn.organization && (
                        <p className="text-sm text-muted-foreground">{conn.organization}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteConnectionMutation.mutate(conn.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {conn.connectionType && (
                      <Badge variant="outline">{conn.connectionType.replace("_", " ")}</Badge>
                    )}
                    {conn.yearsTogether && (
                      <Badge variant="secondary">{conn.yearsTogether}y together</Badge>
                    )}
                    <Badge 
                      variant="outline"
                      className={
                        conn.strength === "Strong" ? "border-green-500 text-green-500" :
                        conn.strength === "Weak" ? "border-yellow-500 text-yellow-500" :
                        ""
                      }
                    >
                      {conn.strength}
                    </Badge>
                  </div>
                  {conn.notes && (
                    <p className="text-sm text-muted-foreground mt-2">{conn.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
            {connections.length === 0 && (
              <Card className="col-span-2">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Users className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No connections added yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Visualization</CardTitle>
              <CardDescription>
                Interactive graph showing career connections and organizations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                ref={networkRef} 
                className="w-full h-[500px] border rounded-lg bg-background"
                data-testid="network-graph"
              />
              {(!networkData || (networkData.nodes.length === 0 && networkData.edges.length === 0)) && (
                <div className="flex items-center justify-center h-[500px]">
                  <div className="text-center">
                    <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Add career positions and connections to visualize the network
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

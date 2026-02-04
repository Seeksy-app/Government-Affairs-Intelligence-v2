import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, X, ChevronRight, Building2, Calendar, Briefcase, Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface CareerPosition {
  title: string;
  organization: string;
  startYear?: number;
  endYear?: number;
  memberServed?: string;
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
}

interface StaffNetworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  memberTitle?: string;
  memberParty?: string;
  memberState?: string;
  staffers: Staffer[];
}

const pathwayColors: Record<string, string> = {
  "Johnson Loyalist": "#ef4444",
  "Trump World": "#f97316",
  "Movement Conservative": "#22c55e",
  "Hill Veteran": "#8b5cf6",
  "Think Tank": "#06b6d4",
  "Campaign Veteran": "#eab308",
  "default": "#3b82f6",
};

const roleCategories: Record<string, string[]> = {
  "Senior Leadership": ["Chief of Staff", "Deputy Chief of Staff", "Senior Advisor", "District Director"],
  "Legislative": ["Legislative Director", "Legislative Assistant", "Legislative Correspondent", "Legislative Aide"],
  "Communications": ["Communications Director", "Press Secretary", "Digital Director", "Deputy Press Secretary"],
  "Operations": ["Scheduler", "Staff Assistant", "Office Manager", "Executive Assistant"],
  "Other": [],
};

function categorizeRole(title: string): string {
  for (const [category, roles] of Object.entries(roleCategories)) {
    if (category === "Other") continue;
    if (roles.some(r => title.toLowerCase().includes(r.toLowerCase()))) {
      return category;
    }
  }
  return "Other";
}

function StafferNode({ data }: { data: { label: string; title: string; email?: string; pathwayType?: string; years?: number; onClick?: () => void } }) {
  const bgColor = data.pathwayType ? (pathwayColors[data.pathwayType] || pathwayColors.default) : pathwayColors.default;
  
  return (
    <div 
      className="px-4 py-3 rounded-lg shadow-lg border-2 min-w-[180px] max-w-[220px] cursor-pointer transition-transform hover:scale-105"
      style={{ 
        backgroundColor: bgColor + "15",
        borderColor: bgColor,
      }}
      onClick={data.onClick}
    >
      <div className="font-semibold text-sm" style={{ color: bgColor }}>{data.label}</div>
      <div className="text-xs text-muted-foreground mt-1">{data.title}</div>
      {data.years && (
        <div className="text-xs text-muted-foreground">{data.years}y in role</div>
      )}
      {data.pathwayType && (
        <div 
          className="text-xs mt-2 px-2 py-0.5 rounded-full inline-block"
          style={{ backgroundColor: bgColor + "30", color: bgColor }}
        >
          {data.pathwayType}
        </div>
      )}
      <div className="text-xs text-primary mt-2 flex items-center gap-1">
        <ChevronRight className="h-3 w-3" /> View Details
      </div>
    </div>
  );
}

function MemberNode({ data }: { data: { label: string; title: string; party?: string; state?: string } }) {
  return (
    <div className="px-6 py-4 rounded-xl shadow-xl bg-primary text-primary-foreground min-w-[200px] text-center border-4 border-primary-foreground/20">
      <div className="font-bold text-lg">{data.label}</div>
      <div className="text-sm opacity-90 mt-1">{data.title}</div>
      {(data.party || data.state) && (
        <div className="text-xs opacity-75 mt-1">
          {[data.party, data.state].filter(Boolean).join(" • ")}
        </div>
      )}
    </div>
  );
}

function CategoryNode({ data }: { data: { label: string; count: number } }) {
  return (
    <div className="px-4 py-2 rounded-lg bg-muted border border-border text-center min-w-[150px]">
      <div className="font-semibold text-sm">{data.label}</div>
      <div className="text-xs text-muted-foreground">{data.count} staff</div>
    </div>
  );
}

const nodeTypes = {
  staffer: StafferNode,
  member: MemberNode,
  category: CategoryNode,
};

export function StaffNetworkDialog({
  open,
  onOpenChange,
  memberName,
  memberTitle,
  memberParty,
  memberState,
  staffers,
}: StaffNetworkDialogProps) {
  const [selectedStaffer, setSelectedStaffer] = useState<Staffer | null>(null);

  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];

    nodeList.push({
      id: "member",
      type: "member",
      position: { x: 500, y: 30 },
      data: { 
        label: memberName, 
        title: memberTitle || "Member of Congress",
        party: memberParty,
        state: memberState,
      },
      sourcePosition: Position.Bottom,
    });

    // Group staffers by category
    const categorized = new Map<string, Staffer[]>();
    staffers.forEach(staffer => {
      const category = categorizeRole(staffer.title);
      if (!categorized.has(category)) {
        categorized.set(category, []);
      }
      categorized.get(category)!.push(staffer);
    });

    // Create organizational layout
    const categoryOrder = ["Senior Leadership", "Legislative", "Communications", "Operations", "Other"];
    let categoryX = 100;
    const categoryY = 150;
    const stafferY = 280;
    const categorySpacing = 280;

    categoryOrder.forEach((categoryName) => {
      const categoryStaffers = categorized.get(categoryName);
      if (!categoryStaffers || categoryStaffers.length === 0) return;

      const categoryId = `category-${categoryName.replace(/\s+/g, '-')}`;
      const categoryWidth = Math.max(categoryStaffers.length * 200, 200);
      const categoryCenterX = categoryX + categoryWidth / 2;

      // Add category node
      nodeList.push({
        id: categoryId,
        type: "category",
        position: { x: categoryCenterX - 75, y: categoryY },
        data: { label: categoryName, count: categoryStaffers.length },
        targetPosition: Position.Top,
        sourcePosition: Position.Bottom,
      });

      // Connect category to member
      edgeList.push({
        id: `edge-member-${categoryId}`,
        source: "member",
        target: categoryId,
        type: "smoothstep",
        style: { stroke: "#94a3b8", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
      });

      // Add staffers under category
      const stafferSpacing = 210;
      const startX = categoryCenterX - ((categoryStaffers.length - 1) * stafferSpacing) / 2;

      categoryStaffers.forEach((staffer, index) => {
        const nodeId = `staffer-${staffer.id}`;
        const stafferInstance = staffer;

        nodeList.push({
          id: nodeId,
          type: "staffer",
          position: { x: startX + index * stafferSpacing - 90, y: stafferY },
          data: {
            label: staffer.name,
            title: staffer.title,
            email: staffer.email,
            pathwayType: staffer.pathwayType,
            years: staffer.yearsInCurrentRole,
            onClick: () => setSelectedStaffer(stafferInstance),
          },
          targetPosition: Position.Top,
        });

        edgeList.push({
          id: `edge-${categoryId}-${nodeId}`,
          source: categoryId,
          target: nodeId,
          type: "smoothstep",
          style: { stroke: "#cbd5e1", strokeWidth: 1.5 },
        });
      });

      categoryX += categoryWidth + 50;
    });

    return { nodes: nodeList, edges: edgeList };
  }, [memberName, memberTitle, memberParty, memberState, staffers]);

  const [flowNodes, , onNodesChange] = useNodesState(nodes);
  const [flowEdges, , onEdgesChange] = useEdgesState(edges);

  const handleExport = useCallback(() => {
    const svgElement = document.querySelector(".react-flow__viewport");
    if (svgElement) {
      const svg = svgElement.innerHTML;
      const blob = new Blob([`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${memberName.replace(/\s+/g, "_")}_staff_network.svg`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [memberName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[85vh] p-0">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between gap-4">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {memberName} Office Organization ({staffers.length} staff)
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-network">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex flex-1 h-[calc(85vh-120px)]">
          {/* Network visualization */}
          <div className={`flex-1 ${selectedStaffer ? 'w-2/3' : 'w-full'} transition-all`}>
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.2}
              maxZoom={2}
              defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
            >
              <Background color="#e2e8f0" gap={20} />
              <Controls />
              <MiniMap 
                nodeColor={(node) => {
                  if (node.type === "member") return "hsl(var(--primary))";
                  if (node.type === "category") return "#94a3b8";
                  const pathway = (node.data as any)?.pathwayType;
                  return pathway ? (pathwayColors[pathway] || pathwayColors.default) : pathwayColors.default;
                }}
              />
            </ReactFlow>
          </div>

          {/* Staffer detail panel */}
          {selectedStaffer && (
            <div className="w-1/3 border-l bg-background">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold">{selectedStaffer.name}</h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedStaffer(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-[calc(85vh-200px)]">
                <div className="p-4 space-y-4">
                  {/* Current Role */}
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Current Role</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{selectedStaffer.title}</Badge>
                      {selectedStaffer.yearsInCurrentRole && (
                        <span className="text-xs text-muted-foreground">{selectedStaffer.yearsInCurrentRole}y in role</span>
                      )}
                    </div>
                    {selectedStaffer.email && (
                      <a href={`mailto:${selectedStaffer.email}`} className="text-sm text-primary hover:underline mt-1 block">
                        {selectedStaffer.email}
                      </a>
                    )}
                  </div>

                  {/* Pathway Type */}
                  {selectedStaffer.pathwayType && (
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Career Pathway</div>
                      <Badge 
                        style={{ 
                          backgroundColor: (pathwayColors[selectedStaffer.pathwayType] || pathwayColors.default) + "20",
                          color: pathwayColors[selectedStaffer.pathwayType] || pathwayColors.default,
                          borderColor: pathwayColors[selectedStaffer.pathwayType] || pathwayColors.default,
                        }}
                        className="border"
                      >
                        {selectedStaffer.pathwayType}
                      </Badge>
                    </div>
                  )}

                  {/* Policy Areas */}
                  {selectedStaffer.policyAreas && selectedStaffer.policyAreas.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Policy Areas</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedStaffer.policyAreas.map((area, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{area}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Career History */}
                  {selectedStaffer.careerHistory && selectedStaffer.careerHistory.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        Career History
                      </div>
                      <div className="space-y-3">
                        {selectedStaffer.careerHistory.map((position, idx) => (
                          <div key={idx} className="border-l-2 border-muted pl-3 py-1">
                            <div className="font-medium text-sm">{position.title}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {position.organization}
                            </div>
                            {position.memberServed && (
                              <div className="text-xs text-muted-foreground">
                                Served under: {position.memberServed}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Calendar className="h-3 w-3" />
                              {position.startYear}{position.endYear ? ` - ${position.endYear}` : " - Present"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Previous Members Served */}
                  {selectedStaffer.previousMembers && selectedStaffer.previousMembers.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Previous Members Served
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedStaffer.previousMembers.map((member, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">{member}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No additional data message */}
                  {!selectedStaffer.careerHistory?.length && !selectedStaffer.previousMembers?.length && !selectedStaffer.policyAreas?.length && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No additional career data available for this staffer.
                      <br />
                      <span className="text-xs">Career history can be enriched through research.</span>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t bg-muted/30">
          <div className="text-xs text-muted-foreground mb-2">Click on any staffer to view detailed career information</div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(pathwayColors).filter(([key]) => key !== "default").map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

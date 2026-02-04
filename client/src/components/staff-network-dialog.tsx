import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useCallback, useMemo } from "react";
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

interface Staffer {
  id: number;
  name: string;
  title: string;
  email?: string;
  pathwayType?: string;
  yearsInCurrentRole?: number;
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

function StafferNode({ data }: { data: { label: string; title: string; email?: string; pathwayType?: string; years?: number } }) {
  const bgColor = data.pathwayType ? (pathwayColors[data.pathwayType] || pathwayColors.default) : pathwayColors.default;
  
  return (
    <div 
      className="px-4 py-3 rounded-lg shadow-lg border-2 min-w-[180px] max-w-[220px]"
      style={{ 
        backgroundColor: bgColor + "15",
        borderColor: bgColor,
      }}
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

const nodeTypes = {
  staffer: StafferNode,
  member: MemberNode,
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
  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];

    nodeList.push({
      id: "member",
      type: "member",
      position: { x: 400, y: 50 },
      data: { 
        label: memberName, 
        title: memberTitle || "Member of Congress",
        party: memberParty,
        state: memberState,
      },
      sourcePosition: Position.Bottom,
    });

    const stafferCount = staffers.length;
    const spacing = 220;
    const startX = 400 - ((stafferCount - 1) * spacing) / 2;

    staffers.forEach((staffer, index) => {
      const nodeId = `staffer-${staffer.id}`;
      
      nodeList.push({
        id: nodeId,
        type: "staffer",
        position: { x: startX + index * spacing, y: 200 },
        data: {
          label: staffer.name,
          title: staffer.title,
          email: staffer.email,
          pathwayType: staffer.pathwayType,
          years: staffer.yearsInCurrentRole,
        },
        targetPosition: Position.Top,
      });

      edgeList.push({
        id: `edge-member-${nodeId}`,
        source: "member",
        target: nodeId,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#94a3b8", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#94a3b8",
        },
      });
    });

    return { nodes: nodeList, edges: edgeList };
  }, [memberName, memberTitle, memberParty, memberState, staffers]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

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
      <DialogContent className="max-w-[90vw] w-[1200px] h-[80vh] p-0">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between">
          <DialogTitle>{memberName} Staff Network</DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 h-[calc(80vh-80px)]">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.3}
            maxZoom={2}
            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          >
            <Background color="#e2e8f0" gap={20} />
            <Controls />
            <MiniMap 
              nodeColor={(node) => {
                if (node.type === "member") return "hsl(var(--primary))";
                const pathway = (node.data as any)?.pathwayType;
                return pathway ? (pathwayColors[pathway] || pathwayColors.default) : pathwayColors.default;
              }}
            />
          </ReactFlow>
        </div>

        <div className="px-6 py-3 border-t bg-muted/30">
          <div className="text-xs text-muted-foreground mb-2">Pathway Types Legend:</div>
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

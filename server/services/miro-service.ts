import { MiroApi } from "@mirohq/miro-api";
import type { Staffer, StafferCareerPosition, StafferConnection } from "@shared/schema";

const ORG_TYPE_COLORS: Record<string, string> = {
  "Congressional Office": "blue",
  "Committee": "violet",
  "Campaign": "orange",
  "Think Tank": "green",
  "Lobbying Firm": "gray",
  "White House": "yellow",
  "Administration": "red",
  "default": "dark_blue",
};

const PARTY_COLORS: Record<string, string> = {
  "Republican": "red",
  "Democrat": "blue",
  "Independent": "green",
};

interface ExportMiroParams {
  staffer: Staffer;
  careerPositions: StafferCareerPosition[];
  connections: StafferConnection[];
}

export async function exportStafferToMiro(params: ExportMiroParams): Promise<{ miroBoardUrl: string; miroBoardId: string }> {
  const apiKey = process.env.MIRO_API_KEY;
  if (!apiKey) {
    throw new Error("MIRO_API_KEY is not configured");
  }

  const api = new MiroApi(apiKey);
  const { staffer, careerPositions, connections } = params;

  // Create a new board
  const board = await api.createBoard({
    name: `${staffer.name} - Career Network`,
    description: `Career timeline and network visualization for ${staffer.name}`,
  });
  
  const boardId = board.id;

  if (!boardId) {
    throw new Error("Failed to create Miro board");
  }

  // Calculate layout positions
  const centerX = 0;
  const centerY = 0;
  const horizontalSpacing = 500;
  const verticalSpacing = 180;

  // Create central staffer sticky note
  await board.createStickyNoteItem({
    data: {
      content: `<strong>${staffer.name}</strong>\n${staffer.currentPosition || ""}\n${staffer.currentOrganization || ""}`,
      shape: "rectangle",
    },
    style: {
      fillColor: staffer.party ? (PARTY_COLORS[staffer.party] as any) || "blue" : "blue",
      textAlign: "center",
      textAlignVertical: "middle",
    },
    position: {
      x: centerX,
      y: centerY,
    },
    geometry: {
      width: 300,
    },
  });

  // Sort career positions by start year (most recent first)
  const sortedPositions = [...careerPositions].sort((a, b) => (b.startYear || 0) - (a.startYear || 0));

  // Create timeline - positions arranged vertically on the left
  const timelineX = centerX - horizontalSpacing;
  
  for (let i = 0; i < sortedPositions.length; i++) {
    const pos = sortedPositions[i];
    const posY = centerY + (i - sortedPositions.length / 2) * verticalSpacing;
    
    const orgColor = pos.orgType && ORG_TYPE_COLORS[pos.orgType] ? ORG_TYPE_COLORS[pos.orgType] : ORG_TYPE_COLORS.default;
    const duration = pos.endYear ? `${pos.startYear} - ${pos.endYear}` : `${pos.startYear} - Present`;

    // Position card
    await board.createCardItem({
      data: {
        title: pos.position,
        description: `${pos.organization}${pos.bossName ? `\nBoss: ${pos.bossName}` : ""}\n${duration}`,
      },
      style: {
        cardTheme: orgColor as any,
      },
      position: {
        x: timelineX,
        y: posY,
      },
      geometry: {
        width: 280,
      },
    });

    // Add sticky note with tenure
    await board.createStickyNoteItem({
      data: {
        content: duration,
        shape: "square",
      },
      style: {
        fillColor: "light_yellow",
        textAlign: "center",
        textAlignVertical: "middle",
      },
      position: {
        x: timelineX - 200,
        y: posY,
      },
      geometry: {
        width: 120,
      },
    });
  }

  // Create connections on the right side
  const connectionsX = centerX + horizontalSpacing;
  
  for (let i = 0; i < connections.length; i++) {
    const conn = connections[i];
    const connY = centerY + (i - connections.length / 2) * (verticalSpacing * 0.8);

    const strengthColor = conn.strength === "Strong" ? "green" : conn.strength === "Weak" ? "yellow" : "blue";

    await board.createCardItem({
      data: {
        title: conn.connectedToName,
        description: `${conn.connectionType || "Connection"}${conn.organization ? `\nat ${conn.organization}` : ""}${conn.yearsTogether ? `\n${conn.yearsTogether} years together` : ""}`,
      },
      style: {
        cardTheme: strengthColor as any,
      },
      position: {
        x: connectionsX,
        y: connY,
      },
      geometry: {
        width: 280,
      },
    });
  }

  // Create frames for organization
  // Timeline frame
  if (sortedPositions.length > 0) {
    await board.createFrameItem({
      data: {
        title: "Career Timeline",
        format: "custom",
      },
      position: {
        x: timelineX - 50,
        y: centerY,
      },
      geometry: {
        width: 500,
        height: Math.max(sortedPositions.length * verticalSpacing + 200, 400),
      },
    });
  }

  // Connections frame
  if (connections.length > 0) {
    await board.createFrameItem({
      data: {
        title: "Professional Network",
        format: "custom",
      },
      position: {
        x: connectionsX,
        y: centerY,
      },
      geometry: {
        width: 380,
        height: Math.max(connections.length * (verticalSpacing * 0.8) + 200, 400),
      },
    });
  }

  // Add legend
  const legendY = centerY + Math.max(sortedPositions.length, connections.length) * verticalSpacing / 2 + 300;

  await board.createFrameItem({
    data: {
      title: "Legend - Organization Types",
      format: "custom",
    },
    position: {
      x: centerX,
      y: legendY,
    },
    geometry: {
      width: 900,
      height: 180,
    },
  });

  // Add legend items
  const legendItems = Object.entries(ORG_TYPE_COLORS).filter(([key]) => key !== "default");
  const legendItemWidth = 180;
  
  for (let i = 0; i < legendItems.length; i++) {
    const [label, color] = legendItems[i];
    await board.createStickyNoteItem({
      data: {
        content: label,
        shape: "square",
      },
      style: {
        fillColor: color as any,
        textAlign: "center",
        textAlignVertical: "middle",
      },
      position: {
        x: centerX - 350 + (i % 4) * legendItemWidth,
        y: legendY + Math.floor(i / 4) * 60 - 30,
      },
      geometry: {
        width: legendItemWidth - 20,
      },
    });
  }

  const boardUrl = `https://miro.com/app/board/${boardId}/`;

  return {
    miroBoardUrl: boardUrl,
    miroBoardId: boardId,
  };
}

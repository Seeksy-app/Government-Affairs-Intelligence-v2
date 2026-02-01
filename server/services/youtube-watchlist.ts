import { YoutubeTranscript } from "youtube-transcript";
import { storage } from "../storage";

interface VideoInfo {
  videoId: string;
  title?: string;
  channelName?: string;
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/live\/([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export async function checkTranscriptAvailable(videoId: string): Promise<boolean> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript && transcript.length > 0;
  } catch {
    return false;
  }
}

export async function getTranscript(videoId: string): Promise<string | null> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (!transcript || transcript.length === 0) return null;
    
    return transcript.map(item => item.text).join(" ");
  } catch {
    return null;
  }
}

export async function processWatchListItem(watchItem: {
  id: string;
  videoId: string;
  clientId: string;
  matterId?: string | null;
}): Promise<{ success: boolean; transcript?: string; error?: string }> {
  try {
    const transcriptAvailable = await checkTranscriptAvailable(watchItem.videoId);
    
    if (!transcriptAvailable) {
      return { success: false, error: "Transcript not yet available" };
    }

    const transcript = await getTranscript(watchItem.videoId);
    
    if (!transcript) {
      return { success: false, error: "Failed to fetch transcript" };
    }

    await storage.updateYoutubeWatchListItem(watchItem.id, {
      status: "completed",
      transcriptAvailable: true,
    });

    if (watchItem.matterId) {
      await storage.createResearchDocument({
        matterId: watchItem.matterId,
        clientId: watchItem.clientId,
        title: `YouTube: ${watchItem.videoId}`,
        type: "youtube",
        sourceUrl: `https://youtube.com/watch?v=${watchItem.videoId}`,
        extractedContent: transcript,
      });
    }

    return { success: true, transcript };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

export async function checkPendingWatchList(clientId: string): Promise<{
  processed: number;
  stillPending: number;
}> {
  const pendingItems = await storage.getYoutubeWatchListByStatus(clientId, "pending");
  let processed = 0;
  let stillPending = 0;

  for (const item of pendingItems) {
    const transcriptAvailable = await checkTranscriptAvailable(item.videoId);
    
    if (transcriptAvailable) {
      const result = await processWatchListItem(item);
      if (result.success) {
        processed++;
      } else {
        stillPending++;
      }
    } else {
      await storage.updateYoutubeWatchListItem(item.id, {
        lastCheckedAt: new Date(),
      });
      stillPending++;
    }
  }

  return { processed, stillPending };
}

export const TRANSCRIPT_SOURCES = [
  {
    name: "C-SPAN Video Library",
    url: "https://www.c-span.org/video/",
    description: "Congressional proceedings, hearings, and speeches with searchable transcripts"
  },
  {
    name: "Congress.gov",
    url: "https://www.congress.gov/",
    description: "Official Congressional Record and hearing transcripts"
  },
  {
    name: "Senate Hearing Webcasts",
    url: "https://www.senate.gov/committees/hearing_video.htm",
    description: "Live and archived Senate committee hearings"
  },
  {
    name: "House Clerk - Floor Proceedings",
    url: "https://clerk.house.gov/",
    description: "Official House floor proceedings and records"
  },
  {
    name: "GPO govinfo",
    url: "https://www.govinfo.gov/",
    description: "Official publications including Congressional Record transcripts"
  },
  {
    name: "Committee Repository (House)",
    url: "https://docs.house.gov/",
    description: "House committee documents and hearing materials"
  }
];

import FirecrawlApp from "@mendable/firecrawl-js";
import { YoutubeTranscript } from "youtube-transcript";
import OpenAI from "openai";

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type ContentType = "url" | "youtube" | "pdf" | "docx" | "article" | "extract" | "agent";

export interface AgentQueryResult {
  success: boolean;
  data: Record<string, unknown>;
  sources?: string[];
}

export interface ExtractSchema {
  type: "object";
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
}

export interface ExtractedContent {
  title: string;
  type: ContentType;
  content: string;
  summary?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

function detectContentType(input: string): ContentType {
  if (input.includes("youtube.com") || input.includes("youtu.be")) {
    return "youtube";
  }
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return "url";
  }
  return "article";
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function extractContentFromUrl(url: string): Promise<ExtractedContent> {
  const type = detectContentType(url);

  if (type === "youtube") {
    return extractYouTubeContent(url);
  }

  try {
    const result = await firecrawl.scrapeUrl(url, {
      formats: ["markdown"],
    });

    if (!result.success) {
      throw new Error("Failed to scrape URL");
    }

    const content = result.markdown || "";
    const title = result.metadata?.title || url;

    return {
      title: title as string,
      type: "url",
      content,
      sourceUrl: url,
      metadata: result.metadata as Record<string, unknown>,
    };
  } catch (error) {
    console.error("Firecrawl error:", error);
    throw new Error(`Failed to extract content from URL: ${error}`);
  }
}

export async function extractYouTubeContent(url: string): Promise<ExtractedContent> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    const fullText = transcript.map((item) => item.text).join(" ");

    return {
      title: `YouTube Video: ${videoId}`,
      type: "youtube",
      content: fullText,
      sourceUrl: url,
      metadata: { videoId, segments: transcript.length },
    };
  } catch (error) {
    console.error("YouTube transcript error:", error);
    throw new Error(`Failed to extract YouTube transcript: ${error}`);
  }
}

export async function extractPdfContent(buffer: Buffer, filename: string): Promise<ExtractedContent> {
  const pdfParse = await import("pdf-parse");
  const data = await pdfParse.default(buffer);

  return {
    title: filename,
    type: "pdf",
    content: data.text,
    metadata: { pages: data.numpages },
  };
}

export async function extractDocxContent(buffer: Buffer, filename: string): Promise<ExtractedContent> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });

  return {
    title: filename,
    type: "docx",
    content: result.value,
  };
}

export async function extractStructuredData(
  urls: string[],
  prompt: string,
  schema?: ExtractSchema
): Promise<ExtractedContent> {
  try {
    const extractParams: Record<string, unknown> = {
      prompt,
    };
    if (schema) {
      extractParams.schema = schema;
    }

    const result = await firecrawl.extract(urls, extractParams);

    if (!result.success) {
      throw new Error("Extraction failed");
    }

    const dataStr = JSON.stringify(result.data, null, 2);

    return {
      title: `Extracted: ${prompt.slice(0, 50)}...`,
      type: "extract",
      content: dataStr,
      metadata: { urls, schema },
    };
  } catch (error) {
    console.error("Firecrawl extract error:", error);
    throw new Error(`Failed to extract structured data: ${error}`);
  }
}

export async function runAgentQuery(
  prompt: string,
  schema?: ExtractSchema
): Promise<AgentQueryResult> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/agent", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        schema,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Agent request failed: ${error}`);
    }

    const result = await response.json();

    return {
      success: true,
      data: result.data || result,
      sources: result.sources || [],
    };
  } catch (error) {
    console.error("Firecrawl agent error:", error);
    throw new Error(`Agent query failed: ${error}`);
  }
}

export async function researchPoliticalEntity(
  entityName: string,
  entityType: "person" | "organization" | "company"
): Promise<ExtractedContent> {
  const schemas: Record<string, ExtractSchema> = {
    person: {
      type: "object",
      properties: {
        fullName: { type: "string", description: "Full name of the person" },
        currentTitle: { type: "string", description: "Current job title" },
        currentOrganization: { type: "string", description: "Current employer or organization" },
        bio: { type: "string", description: "Brief biography" },
        education: { type: "string", description: "Educational background" },
        previousRoles: { type: "string", description: "Previous positions held" },
        policyAreas: { type: "string", description: "Policy areas of expertise or focus" },
        contactInfo: { type: "string", description: "Any available contact information" },
        linkedinUrl: { type: "string", description: "LinkedIn profile URL if available" },
        politicalAffiliation: { type: "string", description: "Political party or affiliation" },
      },
    },
    organization: {
      type: "object",
      properties: {
        name: { type: "string", description: "Organization name" },
        type: { type: "string", description: "Type of organization (PAC, lobbying firm, advocacy group, etc.)" },
        mission: { type: "string", description: "Mission or purpose" },
        leadership: { type: "string", description: "Key leadership and executives" },
        lobbyingActivity: { type: "string", description: "Known lobbying activities" },
        policyFocus: { type: "string", description: "Policy areas of focus" },
        clients: { type: "string", description: "Notable clients if applicable" },
        politicalContributions: { type: "string", description: "Political contribution history" },
      },
    },
    company: {
      type: "object",
      properties: {
        name: { type: "string", description: "Company name" },
        industry: { type: "string", description: "Industry sector" },
        headquarters: { type: "string", description: "Headquarters location" },
        executives: { type: "string", description: "Key executives" },
        lobbyingActivity: { type: "string", description: "Government relations and lobbying" },
        politicalContributions: { type: "string", description: "PAC and political contributions" },
        regulatoryIssues: { type: "string", description: "Regulatory issues and government interactions" },
        policyPositions: { type: "string", description: "Known policy positions" },
      },
    },
  };

  const prompt = entityType === "person"
    ? `Research ${entityName} and find their professional background, current role, career history, policy expertise, and any political connections or lobbying work.`
    : entityType === "organization"
    ? `Research the organization "${entityName}" and find their mission, leadership, lobbying activities, policy focus, and political involvement.`
    : `Research the company "${entityName}" and find their government relations, lobbying activities, political contributions, and regulatory interactions.`;

  try {
    const result = await runAgentQuery(prompt, schemas[entityType]);

    return {
      title: `Research: ${entityName}`,
      type: "agent",
      content: JSON.stringify(result.data, null, 2),
      summary: `AI research on ${entityType}: ${entityName}`,
      metadata: { entityType, sources: result.sources },
    };
  } catch (error) {
    console.error("Political entity research error:", error);
    throw new Error(`Failed to research ${entityType}: ${error}`);
  }
}

export async function generateSummary(content: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content: "You are a research assistant. Provide a concise 2-3 sentence summary of the following content.",
      },
      { role: "user", content: content.slice(0, 15000) },
    ],
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content || "";
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function* chatWithContext(
  question: string,
  documents: { title: string; content: string }[],
  conversationHistory: ChatMessage[] = []
): AsyncGenerator<string> {
  const contextText = documents
    .map((doc, i) => `[Document ${i + 1}: ${doc.title}]\n${doc.content.slice(0, 10000)}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are a research assistant for a political consulting firm. You have access to the following research documents:

${contextText}

Answer questions based on these documents. If the answer is not in the documents, say so clearly. Be thorough but concise. When referencing information, mention which document it comes from.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: question },
  ];

  const stream = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages,
    stream: true,
    max_tokens: 2048,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

export async function analyzeStafferCareer(careerHistory: {
  title: string;
  organization: string;
  organizationType?: string;
  startYear?: number;
  endYear?: number;
  policyAreas?: string[];
  supervisor?: string;
}[]): Promise<{
  summary: string;
  patterns: string[];
  policyFocus: string[];
  connections: string[];
}> {
  const careerText = careerHistory
    .map((h) => `${h.title} at ${h.organization} (${h.startYear || "?"}-${h.endYear || "present"}) - ${h.policyAreas?.join(", ") || "N/A"}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content: `You are a political intelligence analyst. Analyze this staffer's career history and provide insights.`,
      },
      {
        role: "user",
        content: `Analyze this career history and provide:
1. A brief career summary
2. Career patterns (e.g., revolving door, policy specialist, political operative)
3. Key policy focus areas
4. Notable connections or relationships based on the roles

Career History:
${careerText}

Respond in JSON format: { "summary": "...", "patterns": ["..."], "policyFocus": ["..."], "connections": ["..."] }`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(response.choices[0]?.message?.content || "{}");
  return {
    summary: result.summary || "",
    patterns: result.patterns || [],
    policyFocus: result.policyFocus || [],
    connections: result.connections || [],
  };
}

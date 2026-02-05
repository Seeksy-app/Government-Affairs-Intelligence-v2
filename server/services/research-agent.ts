import FirecrawlApp from "@mendable/firecrawl-js";
import { YoutubeTranscript } from "youtube-transcript";
import OpenAI from "openai";
import { CongressAPI } from "./congress-api";

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const congressApi = process.env.CONGRESS_API_KEY 
  ? new CongressAPI(process.env.CONGRESS_API_KEY)
  : null;

// Perplexity API for research
export async function researchWithPerplexity(prompt: string): Promise<{
  content: string;
  citations: string[];
}> {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error("Perplexity API key not configured");
  }

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content: "You are a research assistant specializing in political staffers, government officials, and congressional careers. Provide factual, well-sourced information about the person being researched. Focus on their career history, education, policy expertise, and professional connections."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Perplexity API error:", error);
    throw new Error(`Perplexity request failed: ${error}`);
  }

  const result = await response.json();
  
  return {
    content: result.choices?.[0]?.message?.content || "",
    citations: result.citations || [],
  };
}

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
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = pdfParseModule.default || pdfParseModule;
  const data = await pdfParse(buffer);

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
  // Use Perplexity for all agent queries for better results with citations
  try {
    const result = await researchWithPerplexity(prompt);
    
    // Parse the response into structured data if a schema was provided
    let parsedData: Record<string, unknown> = { rawContent: result.content };
    
    if (schema && schema.properties) {
      // Try to extract structured data from the response
      for (const key of Object.keys(schema.properties)) {
        const regex = new RegExp(`${key}[:\\s]+([^\\n]+)`, 'i');
        const match = result.content.match(regex);
        if (match) {
          parsedData[key] = match[1].trim();
        }
      }
    }
    
    return {
      success: true,
      data: parsedData,
      sources: result.citations || [],
    };
  } catch (error) {
    console.error("Agent query error:", error);
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
    model: "gpt-5.1",
    messages: [
      {
        role: "system",
        content: "You are a research assistant. Provide a concise 2-3 sentence summary of the following content.",
      },
      { role: "user", content: content.slice(0, 15000) },
    ],
    max_completion_tokens: 200,
  });

  return response.choices[0]?.message?.content || "";
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ParsedBill {
  original: string;
  type: string;
  number: number;
}

function extractBillReferences(text: string): ParsedBill[] {
  const billPatterns = [
    { pattern: /H\.?R\.?\s*(\d+)/gi, type: 'hr' },
    { pattern: /H\.?B\.?\s*(\d+)/gi, type: 'hr' },
    { pattern: /S\.?B\.?\s*(\d+)/gi, type: 's' },
    { pattern: /S\.?\s*(\d+)(?!\d)/gi, type: 's' },
    { pattern: /H\.?J\.?\s*RES\.?\s*(\d+)/gi, type: 'hjres' },
    { pattern: /S\.?J\.?\s*RES\.?\s*(\d+)/gi, type: 'sjres' },
    { pattern: /H\.?\s*CON\.?\s*RES\.?\s*(\d+)/gi, type: 'hconres' },
    { pattern: /S\.?\s*CON\.?\s*RES\.?\s*(\d+)/gi, type: 'sconres' },
    { pattern: /H\.?\s*RES\.?\s*(\d+)/gi, type: 'hres' },
    { pattern: /S\.?\s*RES\.?\s*(\d+)/gi, type: 'sres' },
  ];
  
  const refs: ParsedBill[] = [];
  const seen = new Set<string>();
  
  for (const { pattern, type } of billPatterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const number = parseInt(match[1]);
      const key = `${type}-${number}`;
      if (!seen.has(key) && number > 0) {
        seen.add(key);
        refs.push({
          original: match[0].replace(/\s+/g, ' ').trim(),
          type,
          number
        });
      }
    }
  }
  return refs;
}

async function fetchBillContext(parsedBills: ParsedBill[]): Promise<string> {
  if (!congressApi || parsedBills.length === 0) {
    return parsedBills.length > 0 && !congressApi 
      ? "\n\n⚠️ Congress.gov API key not configured - unable to fetch live bill data."
      : "";
  }
  
  const billInfos: string[] = [];
  const timeout = 8000; // 8 second timeout per bill
  
  for (const { original, type, number } of parsedBills.slice(0, 3)) {
    try {
      console.log(`[AI Agent] Fetching bill: ${type} ${number}`);
      
      // Create a timeout promise
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeout)
      );
      
      // Race between the fetch and timeout
      const bills = await Promise.race([
        congressApi.searchByKeyword(`${type.toUpperCase()}${number}`, 119, 1),
        timeoutPromise
      ]) as any;
      
      if (bills && bills.length > 0) {
        const bill = bills[0];
        let info = `**${original}**: ${bill.title}\n`;
        info += `- Introduced: ${bill.introducedDate || 'Unknown'}\n`;
        info += `- Chamber: ${bill.originChamber || 'Unknown'}\n`;
        
        if (bill.latestAction) {
          info += `- Latest Action (${bill.latestAction.actionDate}): ${bill.latestAction.text}\n`;
        }
        
        // Skip slower API calls for summaries/cosponsors to improve speed
        billInfos.push(info);
      } else {
        billInfos.push(`**${original}**: Bill not found in 119th Congress data`);
      }
    } catch (error: any) {
      console.error(`Error fetching bill ${original}:`, error?.message || error);
      billInfos.push(`**${original}**: Unable to retrieve bill data`);
    }
  }
  
  return billInfos.length > 0 
    ? `\n\n=== CONGRESSIONAL BILL DATA (from Congress.gov API) ===\n\n${billInfos.join('\n---\n')}`
    : "";
}

async function fetchWebResearch(question: string): Promise<string> {
  if (!process.env.PERPLEXITY_API_KEY) return "";
  
  const politicalKeywords = ['bill', 'legislation', 'congress', 'senator', 'representative', 'policy', 'vote', 'committee', 'hearing'];
  const hasPoliticalContext = politicalKeywords.some(kw => question.toLowerCase().includes(kw));
  
  if (!hasPoliticalContext) return "";
  
  try {
    const researchPrompt = `Research the following political/legislative topic and provide key findings: ${question}`;
    const result = await runAgentQuery(researchPrompt);
    if (result.success && result.data) {
      const sources = result.sources?.join(', ') || 'Web research';
      return `\n\n=== WEB RESEARCH (from Perplexity AI) ===\nSources: ${sources}\n\n${JSON.stringify(result.data, null, 2).slice(0, 3000)}`;
    }
  } catch (error) {
    console.error("Web research error:", error);
  }
  
  return "";
}

function detectMeetingIntent(question: string): boolean {
  const meetingKeywords = [
    'meet', 'meeting', 'schedule', 'appointment', 'visit', 'when can', 
    'when should', 'best time', 'available', 'in dc', 'in district',
    'office hours', 'book', 'arrange', 'set up', 'connect with'
  ];
  const lowerQuestion = question.toLowerCase();
  return meetingKeywords.some(kw => lowerQuestion.includes(kw));
}

function getCongressionalScheduleContext(): string {
  // 2026 Congressional Calendar - 119th Congress, 2nd Session
  const periods = [
    { start: "2026-01-06", end: "2026-01-16", type: "session", description: "Session begins" },
    { start: "2026-01-19", end: "2026-01-23", type: "recess", description: "Martin Luther King Jr. Day District Work Period" },
    { start: "2026-01-26", end: "2026-02-13", type: "session", description: "Legislative session" },
    { start: "2026-02-16", end: "2026-02-20", type: "recess", description: "Presidents' Day District Work Period" },
    { start: "2026-02-23", end: "2026-03-27", type: "session", description: "Legislative session" },
    { start: "2026-03-30", end: "2026-04-10", type: "recess", description: "Spring District Work Period" },
    { start: "2026-04-13", end: "2026-05-22", type: "session", description: "Legislative session" },
    { start: "2026-05-25", end: "2026-05-29", type: "recess", description: "Memorial Day District Work Period" },
    { start: "2026-06-01", end: "2026-07-03", type: "session", description: "Legislative session" },
    { start: "2026-07-06", end: "2026-07-10", type: "recess", description: "Independence Day District Work Period" },
    { start: "2026-07-13", end: "2026-07-31", type: "session", description: "Legislative session" },
    { start: "2026-08-03", end: "2026-09-04", type: "recess", description: "August District Work Period" },
    { start: "2026-09-08", end: "2026-10-02", type: "session", description: "Legislative session" },
    { start: "2026-10-05", end: "2026-11-13", type: "recess", description: "Pre-Election District Work Period" },
    { start: "2026-11-16", end: "2026-11-20", type: "session", description: "Lame Duck Session" },
    { start: "2026-11-23", end: "2026-11-27", type: "recess", description: "Thanksgiving District Work Period" },
    { start: "2026-11-30", end: "2026-12-18", type: "session", description: "Year-End Session" },
    { start: "2026-12-21", end: "2026-12-31", type: "recess", description: "Holiday District Work Period" },
  ];

  const today = new Date().toISOString().split('T')[0];
  const currentPeriod = periods.find(p => today >= p.start && today <= p.end);
  const upcomingPeriods = periods.filter(p => p.start > today).slice(0, 4);

  let context = `\n=== CONGRESSIONAL SCHEDULE (2026 - 119th Congress, 2nd Session) ===\n`;
  context += `Today's Date: ${today}\n\n`;
  
  if (currentPeriod) {
    context += `CURRENT STATUS: Congress is ${currentPeriod.type === 'session' ? 'IN SESSION' : 'IN RECESS'}\n`;
    context += `Period: ${currentPeriod.description} (${currentPeriod.start} to ${currentPeriod.end})\n`;
    context += currentPeriod.type === 'session' 
      ? `Members are typically in Washington, D.C. - best time for Capitol Hill meetings.\n`
      : `Members are typically in their home districts - best time for local/district meetings.\n`;
  }
  
  context += `\nUPCOMING SCHEDULE:\n`;
  for (const period of upcomingPeriods) {
    const location = period.type === 'session' ? '(DC)' : '(District)';
    context += `- ${period.start} to ${period.end}: ${period.description} ${location}\n`;
  }
  
  context += `\nMEETING PLANNING GUIDANCE:\n`;
  context += `- DC Meetings: Schedule during SESSION periods, preferably Tuesday-Thursday when floor votes occur.\n`;
  context += `- District Meetings: Schedule during RECESS/District Work Periods when members are home.\n`;
  context += `- Committee Hearings: Members on specific committees will be occupied during scheduled hearings.\n`;
  context += `- Mondays/Fridays during session: Members often travel to/from DC, less ideal for meetings.\n\n`;

  return context;
}

export async function* chatWithContext(
  question: string,
  documents: { title: string; content: string }[],
  conversationHistory: ChatMessage[] = [],
  enableApiEnrichment: boolean = true
): AsyncGenerator<string> {
  let enrichedContext = "";
  
  if (enableApiEnrichment) {
    const billRefs = extractBillReferences(question);
    console.log("Detected bill references:", billRefs);
    
    if (billRefs.length > 0) {
      yield "[Searching Congress.gov for bill information...]\n\n";
      enrichedContext += await fetchBillContext(billRefs);
    }
    
    // Check if user is asking about meetings or scheduling
    if (detectMeetingIntent(question)) {
      yield "[Checking congressional schedule...]\n\n";
      enrichedContext += getCongressionalScheduleContext();
    }
    
    if (documents.length === 0 && billRefs.length === 0 && question.length > 20) {
      yield "[Searching the web for relevant information...]\n\n";
      enrichedContext += await fetchWebResearch(question);
    }
  }
  
  const documentContext = documents
    .map((doc, i) => `[Document ${i + 1}: ${doc.title}]\n${doc.content.slice(0, 10000)}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are an expert research assistant for a political consulting firm specializing in government affairs, legislation, policy analysis, and congressional engagement strategy.

You have access to the following information:

=== UPLOADED RESEARCH DOCUMENTS ===
${documentContext || "(No documents uploaded to this matter yet)"}
${enrichedContext}

INSTRUCTIONS:
- Synthesize information from ALL available sources (documents, Congress.gov data, web research, congressional schedule)
- When discussing bills, include their status, sponsors, and key provisions
- Cite your sources (e.g., "According to Congress.gov..." or "From the uploaded document...")
- If asked about something not in your context, explain what information would be helpful
- Be thorough, accurate, and actionable in your responses

MEETING & SCHEDULING GUIDANCE:
- If asked about meeting with Congress members, use the congressional schedule to suggest optimal timing
- DC meetings are best during SESSION periods (Tuesday-Thursday are ideal voting days)
- District meetings are best during RECESS/District Work Periods
- Consider committee assignments when suggesting meeting windows (members are busy during their hearings)
- Provide specific date ranges and explain why those times are favorable`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: question },
  ];

  const stream = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages,
    stream: true,
    max_completion_tokens: 2048,
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
    model: "gpt-5.1",
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

// Portal-specific AI chat - only accesses documents, news, and bills assigned to the client
export async function* chatWithPortalContext(
  question: string,
  documentContext: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  portalName: string
): AsyncGenerator<string> {
  const systemPrompt = `You are a helpful AI research assistant for the "${portalName}" client portal. You help answer questions about the research documents, news articles, and legislation that have been shared with you by your consulting firm.

You have access to the following information that has been assigned to you:
${documentContext || "No information has been shared yet."}

Guidelines:
- ONLY answer questions based on the documents, news, and legislation shared above
- If asked about something not covered in the shared information, politely explain that you can only help with materials your consulting firm has shared with you
- Be helpful, accurate, and professional
- Cite specific documents, news articles, or bills when referencing information
- For news-related questions, reference the specific articles and their sources
- For legislation questions, provide bill numbers and current status information
- If no information is available in a category, acknowledge that and suggest contacting your consulting firm for updates`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: question },
  ];

  const stream = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages,
    stream: true,
    max_completion_tokens: 2048,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

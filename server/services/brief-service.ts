import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { briefs, briefSources, type BriefContent, type Brief, type BriefSource } from "@shared/schema";
import { eq } from "drizzle-orm";
import { extractUrls, searchTopic, domainTier, extractDomain } from "./parallel-service";

const MODEL = "claude-sonnet-4-6";

// ─── Domain → readable publication name ───────────────────────────────────────

const PUBLICATION_NAMES: Record<string, string> = {
  "reuters.com": "Reuters",
  "apnews.com": "Associated Press",
  "wsj.com": "The Wall Street Journal",
  "nytimes.com": "The New York Times",
  "bloomberg.com": "Bloomberg",
  "politico.com": "Politico",
  "thehill.com": "The Hill",
  "defensenews.com": "Defense News",
  "rollcall.com": "Roll Call",
  "axios.com": "Axios",
};

function publicationName(url: string): string {
  const domain = extractDomain(url);
  return (
    PUBLICATION_NAMES[domain] ??
    domain
      .split(".")
      .slice(0, -1)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ")
  );
}

// ─── Claude prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(brief: Brief, sensitivity: string): string {
  const tone =
    sensitivity === "shareable"
      ? "polished and on-message — suitable for external audiences"
      : "frank and hedged — written for internal strategy use";

  return `You are a professional government affairs analyst writing decision briefs for senior lobbyists.

TONE: ${tone}

RULES (enforce strictly):
- Every factual claim must have an inline citation in the form [n] where n matches a source number.
- Only state facts that are directly supported by the provided source material.
- Use phrases like "according to [source]" and "as reported by [source]" throughout.
- Do not speculate or introduce facts not present in the sources.
- If client context is provided, tailor "Why It Matters" to that context specifically.

OUTPUT FORMAT: Return a single valid JSON object with exactly this shape:
{
  "situation": "<2-3 sentence factual summary with [n] citations>",
  "whyItMatters": "<3-4 sentences specific to client context with citations>",
  "stakes": {
    "business": "<1-2 sentences on business stakes with citations>",
    "reputational": "<1-2 sentences on reputational stakes with citations>",
    "values": "<1-2 sentences on values/principle stakes with citations>"
  },
  "questions": ["<sharp question>", "<sharp question>", "<sharp question>"],
  "responses": {
    "cautious": "<one concrete cautious option>",
    "moderate": "<one concrete moderate option>",
    "aggressive": "<one concrete aggressive option>"
  }
}

Output ONLY the JSON. No markdown fences, no preamble, no explanation.`;
}

function buildUserPrompt(
  title: string,
  clientContext: string | null,
  sources: Array<{ citationNumber: number; url: string; title: string | null; markdown: string; excerpts: string[] }>,
): string {
  const contextBlock = clientContext
    ? `\nCLIENT CONTEXT:\n${clientContext}\n`
    : "";

  const sourceBlocks = sources
    .map((s) => {
      const heading = `SOURCE [${s.citationNumber}]: ${s.title ?? s.url} (${s.url})`;
      const body =
        s.markdown.trim() ||
        s.excerpts.map((e, i) => `Excerpt ${i + 1}: ${e}`).join("\n\n");
      return `${heading}\n\n${body}`;
    })
    .join("\n\n---\n\n");

  return `TOPIC: ${title}
${contextBlock}
SOURCES:

${sourceBlocks}

Now write the decision brief JSON for this topic.`;
}

// ─── Source ingestion ─────────────────────────────────────────────────────────

interface IngestedSource {
  citationNumber: number;
  url: string;
  title: string | null;
  publication: string;
  publishDate: string | null;
  tier: 1 | 2 | 3;
  markdown: string;
  excerpts: string[];
}

async function ingestSources(
  urls: string[],
  topic: string,
  clientContext: string | null,
): Promise<IngestedSource[]> {
  const sourceDomains = urls.map(extractDomain).filter(Boolean);

  // Extract is the primary source — failures are fatal (no content = no brief).
  const extracted = await extractUrls(urls);

  const usable = extracted.filter((e) => e.markdown.trim().length > 0);
  if (usable.length === 0) {
    throw new Error(
      "All source URL extractions failed — cannot generate brief without content",
    );
  }

  // Search is supplementary context — failures are non-fatal.
  const objective =
    topic + (clientContext ? ` — context: ${clientContext.slice(0, 200)}` : "");

  let searchResults: Awaited<ReturnType<typeof searchTopic>> = [];
  try {
    searchResults = await searchTopic(objective, {
      numResults: 5,
      domains: sourceDomains,
    });
  } catch (err: any) {
    console.warn(
      "parallel-service: search step failed (non-fatal, continuing without search context):",
      err.message,
    );
  }

  const searchExcerptsByUrl: Record<string, string[]> = {};
  for (const r of searchResults) {
    if (!searchExcerptsByUrl[r.url]) searchExcerptsByUrl[r.url] = [];
    searchExcerptsByUrl[r.url].push(...r.excerpts);
  }

  return extracted.map((ext, i) => ({
    citationNumber: i + 1,
    url: ext.url,
    title: ext.title,
    publication: publicationName(ext.url),
    publishDate: ext.publishDate,
    tier: domainTier(ext.url),
    markdown: ext.markdown,
    excerpts: searchExcerptsByUrl[ext.url] ?? [],
  }));
}

// ─── Claude call ──────────────────────────────────────────────────────────────

async function callClaude(systemPrompt: string, userPrompt: string): Promise<BriefContent> {
  // AI_INTEGRATIONS_* is the project-wide prefix for all AI provider credentials.
  const client = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined,
  });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = message.content.find((b) => b.type === "text")?.text ?? "";

  const jsonText = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Claude returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  if (
    typeof parsed.situation !== "string" ||
    typeof parsed.whyItMatters !== "string" ||
    typeof parsed.stakes?.business !== "string" ||
    !Array.isArray(parsed.questions) ||
    typeof parsed.responses?.cautious !== "string"
  ) {
    throw new Error("Claude response missing required brief sections");
  }

  return parsed as BriefContent;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateBrief(briefId: string): Promise<void> {
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
    throw new Error(
      "AI_INTEGRATIONS_ANTHROPIC_API_KEY is not set — brief generation requires this environment variable",
    );
  }

  const [brief] = await db.select().from(briefs).where(eq(briefs.id, briefId)).limit(1);
  if (!brief) throw new Error(`Brief ${briefId} not found`);

  const sources = await db
    .select()
    .from(briefSources)
    .where(eq(briefSources.briefId, briefId))
    .orderBy(briefSources.citationNumber);

  if (sources.length === 0) throw new Error(`Brief ${briefId} has no sources`);

  await db
    .update(briefs)
    .set({ status: "generating" })
    .where(eq(briefs.id, briefId));

  try {
    const sourceUrls = sources.map((s: BriefSource) => s.url);
    const ingested = await ingestSources(sourceUrls, brief.title, brief.clientContext);

    // Persist extract + search data back to brief_sources
    for (const s of ingested) {
      const dbSource = sources.find((r: BriefSource) => r.citationNumber === s.citationNumber);
      if (!dbSource) continue;
      await db
        .update(briefSources)
        .set({
          title: s.title ?? dbSource.title,
          publication: s.publication,
          publishDate: s.publishDate,
          tier: s.tier,
          excerpts: s.excerpts,
          extractedContent: s.markdown || null,
        })
        .where(eq(briefSources.id, dbSource.id));
    }

    const systemPrompt = buildSystemPrompt(brief, brief.sensitivity);
    const userPrompt = buildUserPrompt(brief.title, brief.clientContext, ingested);
    const content = await callClaude(systemPrompt, userPrompt);

    await db
      .update(briefs)
      .set({
        status: "ready",
        content,
        modelUsed: MODEL,
        generatedAt: new Date(),
        generationError: null,
        updatedAt: new Date(),
      })
      .where(eq(briefs.id, briefId));
  } catch (err: any) {
    await db
      .update(briefs)
      .set({
        status: "failed",
        generationError: err.message ?? "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(briefs.id, briefId));
    throw err;
  }
}

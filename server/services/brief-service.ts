import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { briefs, briefSources, type BriefContent, type Brief, type BriefSource, type ConcernLevel } from "@shared/schema";
import { eq } from "drizzle-orm";
import { extractUrls, searchTopic, domainTier, extractDomain, type ExtractResult } from "./parallel-service";

const MODEL = "claude-sonnet-4-6";

// Keeps the prompt (and Claude's latency) bounded when a source is a long page.
const MAX_SOURCE_CHARS = 12_000;

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
  "washingtonpost.com": "The Washington Post",
  "npr.org": "NPR",
  "cnn.com": "CNN",
  "cnbc.com": "CNBC",
  "nbcnews.com": "NBC News",
  "cbsnews.com": "CBS News",
  "abcnews.go.com": "ABC News",
  "foxnews.com": "Fox News",
  "ft.com": "Financial Times",
  "economist.com": "The Economist",
  "news.bloomberglaw.com": "Bloomberg Law",
  "law360.com": "Law360",
  "govexec.com": "Government Executive",
  "federalnewsnetwork.com": "Federal News Network",
  "statnews.com": "STAT",
  "modernhealthcare.com": "Modern Healthcare",
  "kff.org": "KFF",
  "congress.gov": "Congress.gov",
  "crsreports.congress.gov": "Congressional Research Service",
  "house.gov": "U.S. House",
  "senate.gov": "U.S. Senate",
  "whitehouse.gov": "The White House",
  "federalregister.gov": "Federal Register",
  "regulations.gov": "Regulations.gov",
  "gao.gov": "GAO",
  "cbo.gov": "Congressional Budget Office",
  "dol.gov": "U.S. Department of Labor",
  "hhs.gov": "HHS",
  "cms.gov": "CMS",
  "va.gov": "Department of Veterans Affairs",
  "ed.gov": "Department of Education",
  "treasury.gov": "U.S. Treasury",
  "irs.gov": "IRS",
  "commerce.gov": "Department of Commerce",
  "justice.gov": "Department of Justice",
  "defense.gov": "Department of Defense",
  "dhs.gov": "Department of Homeland Security",
  "state.gov": "State Department",
  "energy.gov": "Department of Energy",
  "usda.gov": "USDA",
  "transportation.gov": "Department of Transportation",
  "epa.gov": "EPA",
  "sec.gov": "SEC",
  "ftc.gov": "FTC",
  "fcc.gov": "FCC",
  "ustr.gov": "USTR",
  "supremecourt.gov": "U.S. Supreme Court",
};

// Known outlets and agencies get their real names; anything else shows its
// plain domain ("jacksonlewis.com") rather than a guessed name ("Jacksonlewis").
function publicationName(url: string): string {
  const domain = extractDomain(url);
  if (PUBLICATION_NAMES[domain]) return PUBLICATION_NAMES[domain];
  // Agency subdomains, e.g. "www.whd.dol.gov" → "dol.gov".
  const parent = domain.split(".").slice(-2).join(".");
  return PUBLICATION_NAMES[parent] ?? domain;
}

// ─── Claude prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(brief: Brief, sensitivity: string): string {
  const tone =
    sensitivity === "shareable"
      ? "polished and on-message — suitable for external audiences"
      : "frank and hedged — written for internal strategy use";

  const today = new Date().toISOString().slice(0, 10);

  return `You are a professional government affairs analyst writing decision briefs for senior lobbyists.
The core question behind every brief: "Should my client be worried about this?" Answer it calmly and honestly.

TODAY: ${today}
TONE: ${tone}

RULES (enforce strictly):
- Every factual claim must have an inline citation in the form [n] where n matches a source number.
- Only state facts that are directly supported by the provided source material.
- Use phrases like "according to [source]" and "as reported by [source]" throughout.
- Do not speculate or introduce facts not present in the sources.
- If client context is provided, tailor "Why It Matters" to that context specifically.
- If the client context has a LANGUAGE TO AVOID line, treat it as a hard rule for every field: never use those words, framings or topics, even when a source does — paraphrase around them.
- When the topic itself names a client, industry, or sector, that takes priority over general firm background. Never remark that a topic falls outside the firm's focus areas.
- If the topic is a question, answer it directly. If the sources don't settle it, say plainly what is and isn't known.
- Ignore any source that turns out to be unrelated to the topic; never cite it.

CONCERN LEVEL (bottomLine.level) — calibrate honestly, never inflate:
- "low": early-stage, speculative, unlikely to advance, or little direct exposure. Most introduced bills and many alarming headlines land here.
- "watch": real and moving, but not imminent — name the specific trigger to watch for.
- "act": advancing now (scheduled markup/vote, final rule, signed order) with material exposure — engagement is warranted now.

OUTPUT FORMAT: Return a single valid JSON object with exactly this shape:
{
  "bottomLine": {
    "level": "low" | "watch" | "act",
    "answer": "<1-2 plain, calm sentences that directly answer 'should the client be worried?', with [n] citations>"
  },
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
  // Context added automatically from the firm profile (by the ask flow) is
  // background, not the client's own situation — label it so, or the brief
  // starts commenting on the firm's practice areas.
  const isFirmBackground = !!clientContext && /^(our firm's focus areas|firm background)/i.test(clientContext.trim());
  const contextBlock = !clientContext
    ? ""
    : isFirmBackground
      ? `\nFIRM BACKGROUND (optional; use only if the topic names no client, industry or sector of its own — and never mention it or the firm's practice areas in the brief):\n${clientContext}\n`
      : `\nCLIENT CONTEXT:\n${clientContext}\n`;

  const sourceBlocks = sources
    .map((s) => {
      const heading = `SOURCE [${s.citationNumber}]: ${s.title ?? s.url} (${s.url})`;
      const body =
        s.markdown.trim().slice(0, MAX_SOURCE_CHARS) ||
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

// Sources that already carry content (Congress.gov bill data, stored agency
// press releases, or a previous run's extract) skip the Extract call; sources
// discovered by web search arrive with excerpts as a fallback if Extract fails.
async function ingestSources(
  sources: BriefSource[],
  topic: string,
  clientContext: string | null,
): Promise<IngestedSource[]> {
  const toExtract = sources.filter((s) => !s.extractedContent?.trim());
  const hasFallback = sources.some(
    (s) => s.extractedContent?.trim() || (s.excerpts ?? []).length > 0,
  );

  const extractedByUrl = new Map<string, ExtractResult>();
  if (toExtract.length > 0) {
    try {
      for (const e of await extractUrls(toExtract.map((s) => s.url))) {
        extractedByUrl.set(e.url, e);
      }
    } catch (err: any) {
      // Fatal only when nothing else can ground the brief.
      if (!hasFallback) throw err;
      console.warn("brief-service: extract failed (continuing with stored content/excerpts):", err.message);
    }
  }

  // Supplementary search excerpts — only for sources with nothing else to go on.
  const bare = toExtract.filter((s) => (s.excerpts ?? []).length === 0);
  const searchExcerptsByUrl: Record<string, string[]> = {};
  if (bare.length > 0) {
    const objective =
      topic + (clientContext ? ` — context: ${clientContext.slice(0, 200)}` : "");
    try {
      const searchResults = await searchTopic(objective, {
        numResults: 5,
        domains: bare.map((s) => extractDomain(s.url)).filter(Boolean),
      });
      for (const r of searchResults) {
        if (!searchExcerptsByUrl[r.url]) searchExcerptsByUrl[r.url] = [];
        searchExcerptsByUrl[r.url].push(...r.excerpts);
      }
    } catch (err: any) {
      console.warn(
        "parallel-service: search step failed (non-fatal, continuing without search context):",
        err.message,
      );
    }
  }

  const ingested = sources.map((s) => {
    const ext = extractedByUrl.get(s.url);
    return {
      citationNumber: s.citationNumber,
      url: s.url,
      title: ext?.title ?? s.title,
      // Always recompute: names stored by older runs ("Jacksonlewis", "Dol")
      // get corrected on regenerate. Congress.gov and agency domains map to
      // their proper names in PUBLICATION_NAMES.
      publication: publicationName(s.url),
      publishDate: ext?.publishDate ?? s.publishDate,
      tier: domainTier(s.url),
      markdown: s.extractedContent?.trim() || ext?.markdown || "",
      excerpts: [...(s.excerpts ?? []), ...(searchExcerptsByUrl[s.url] ?? [])],
    };
  });

  if (!ingested.some((s) => s.markdown.trim() || s.excerpts.length > 0)) {
    throw new Error(
      "Couldn't read any of the sources — the sites may block automated reading. Try different links.",
    );
  }
  return ingested;
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
    max_tokens: 2500,
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

  // The bottom line is additive — a malformed one is dropped, not fatal.
  const levels: ConcernLevel[] = ["low", "watch", "act"];
  const bl = parsed.bottomLine;
  if (!bl || !levels.includes(bl.level) || typeof bl.answer !== "string" || !bl.answer.trim()) {
    delete parsed.bottomLine;
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
    .set({ status: "generating", updatedAt: new Date() })
    .where(eq(briefs.id, briefId));

  try {
    const ingested = await ingestSources(sources, brief.title, brief.clientContext);

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

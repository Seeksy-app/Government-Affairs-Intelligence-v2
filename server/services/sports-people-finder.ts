import { researchWithPerplexity } from "./research-agent";
import { searchPeople, type PersonSearchResult } from "./linkedin-service";

export interface SportsPersonResult {
  fullName: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  source: "pdl" | "ai_research" | "web_scrape";
  confidence: "high" | "medium" | "low";
}

interface TeamInfo {
  name: string;
  league?: string | null;
  sport?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
}

const LEAGUE_COMPANY_SUFFIXES: Record<string, string[]> = {
  NFL: ["Football Club", "LLC", "Football"],
  NBA: ["Basketball", "LLC", "Basketball Club"],
  MLB: ["Baseball Club", "LP", "Baseball"],
  NHL: ["Hockey Club", "LLC", "Hockey"],
  MLS: ["Soccer Club", "FC", "Soccer"],
};

function getCompanyNameVariations(team: TeamInfo): string[] {
  const variations: string[] = [team.name];

  if (team.league && LEAGUE_COMPANY_SUFFIXES[team.league]) {
    for (const suffix of LEAGUE_COMPANY_SUFFIXES[team.league]) {
      variations.push(`${team.name} ${suffix}`);
    }
  }

  const cityMatch = team.name.match(/^(.+?)\s+([\w\s]+)$/);
  if (cityMatch) {
    const mascot = cityMatch[2];
    variations.push(mascot);
  }

  return Array.from(new Set(variations));
}

async function searchPDLWithVariations(
  team: TeamInfo,
  jobTitleFilter?: string,
  limit: number = 20
): Promise<SportsPersonResult[]> {
  const companyVariations = getCompanyNameVariations(team);
  const allResults: PersonSearchResult[] = [];
  const seenNames = new Set<string>();

  for (const companyName of companyVariations) {
    try {
      const results = await searchPeople({
        company: companyName,
        jobTitle: jobTitleFilter,
        limit,
      });

      for (const person of results) {
        const key = person.fullName?.toLowerCase().trim();
        if (key && !seenNames.has(key)) {
          seenNames.add(key);
          allResults.push(person);
        }
      }

      if (allResults.length >= limit) break;
    } catch (error) {
      console.log(`[Sports People] PDL search for "${companyName}" failed:`, (error as Error).message);
    }
  }

  return allResults.slice(0, limit).map((p) => ({
    fullName: p.fullName || "",
    title: p.jobTitle || undefined,
    department: p.industry || undefined,
    email: undefined,
    phone: undefined,
    linkedinUrl: p.linkedinUrl || undefined,
    source: "pdl" as const,
    confidence: "high" as const,
  }));
}

async function searchWithPerplexityAI(
  team: TeamInfo,
  searchType: "people" | "leadership"
): Promise<SportsPersonResult[]> {
  const typePrompt =
    searchType === "leadership"
      ? `Find the current executive leadership, front office executives, and senior management of the ${team.name}${team.league ? ` (${team.league})` : ""}. Include the owner, president, CEO, general manager, chief operating officer, chief revenue officer, VP of operations, VP of partnerships, VP of community relations, VP of ticket sales, and other senior executives. For each person, provide their full name, exact title/position, and department if known.`
      : `Find current staff and key personnel at the ${team.name}${team.league ? ` (${team.league})` : ""}. Include people in community relations, partnerships, corporate sales, ticket operations, marketing, communications, and government affairs. For each person, provide their full name, exact title/position, and department if known.`;

  const prompt = `${typePrompt}

IMPORTANT: Format your response as a structured list. For each person, use this exact format:
- NAME: [Full Name] | TITLE: [Job Title] | DEPT: [Department]

Only include people you are confident currently work for the ${team.name}. Do not make up names.`;

  try {
    const result = await researchWithPerplexity(prompt);

    if (!result.content) return [];

    const parsed = await parseAIResponseToPersons(result.content, team.name);
    return parsed;
  } catch (error) {
    console.error(`[Sports People] Perplexity research failed for ${team.name}:`, (error as Error).message);
    return [];
  }
}

function parseAIResponseToPersons(
  aiContent: string,
  _teamName: string
): SportsPersonResult[] {
  const results: SportsPersonResult[] = [];

  const structuredPattern = /[-•*]\s*(?:NAME:\s*)?([^|]+?)(?:\s*\|\s*TITLE:\s*(.+?))?(?:\s*\|\s*DEPT:\s*(.+?))?$/gim;
  let match;
  while ((match = structuredPattern.exec(aiContent)) !== null) {
    const name = match[1]?.trim();
    if (name && name.length > 2 && name.length < 60) {
      results.push({
        fullName: name,
        title: match[2]?.trim() || undefined,
        department: match[3]?.trim() || undefined,
        source: "ai_research",
        confidence: "medium",
      });
    }
  }

  if (results.length > 0) return results;

  const boldNamePattern = /\*\*([A-Z][a-z]+ (?:[A-Z]\.?\s?)?[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\*\*[:\s]*[-–]?\s*(.+?)(?:\n|$)/g;
  while ((match = boldNamePattern.exec(aiContent)) !== null) {
    const name = match[1]?.trim();
    const titleText = match[2]?.trim().replace(/^\*\*|\*\*$/g, '');
    if (name && name.length > 2 && name.length < 60 && !/^(the|a|an|this|that|for|and)\b/i.test(name)) {
      results.push({
        fullName: name,
        title: titleText || undefined,
        source: "ai_research",
        confidence: "medium",
      });
    }
  }

  if (results.length > 0) return results;

  const linePattern = /[-•*]\s+([A-Z][a-z]+ (?:[A-Z]\.?\s?)?[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*[-–:,]\s*(.+?)(?:\n|$)/g;
  while ((match = linePattern.exec(aiContent)) !== null) {
    const name = match[1]?.trim();
    const titleText = match[2]?.trim();
    if (name && name.length > 2 && name.length < 60) {
      results.push({
        fullName: name,
        title: titleText || undefined,
        source: "ai_research",
        confidence: "medium",
      });
    }
  }

  return results;
}

async function searchWithWebScrape(
  team: TeamInfo,
  searchType: "people" | "leadership"
): Promise<SportsPersonResult[]> {
  if (!team.website) return [];
  if (!process.env.FIRECRAWL_API_KEY) return [];

  const staffUrls = [
    `${team.website}/team/front-office`,
    `${team.website}/about/front-office`,
    `${team.website}/team/staff`,
    `${team.website}/about/staff`,
    `${team.website}/team/leadership`,
    `${team.website}/about/leadership`,
    `${team.website}/team/staff-directory`,
    `${team.website}/about`,
  ];

  const { default: FirecrawlApp } = await import("@mendable/firecrawl-js");
  const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });

  for (const url of staffUrls.slice(0, 3)) {
    try {
      console.log(`[Sports People] Trying to scrape: ${url}`);
      const result = await firecrawl.scrapeUrl(url, { formats: ["markdown"] });

      if (!result.success || !result.markdown) continue;

      const content = result.markdown;
      if (content.length < 100) continue;

      const personKeywords = ["president", "vice president", "director", "manager", "coordinator", "officer", "vp"];
      const hasPersonData = personKeywords.some((kw) => content.toLowerCase().includes(kw));
      if (!hasPersonData) continue;

      const parsed = await parseAIResponseToPersons(content, team.name);
      if (parsed.length > 0) {
        return parsed.map((p) => ({ ...p, source: "web_scrape" as const }));
      }
    } catch (error) {
      console.log(`[Sports People] Scrape failed for ${url}:`, (error as Error).message);
    }
  }

  return [];
}

export async function findSportsTeamPeople(
  team: TeamInfo,
  searchType: "people" | "leadership",
  jobTitleFilter?: string
): Promise<{ results: SportsPersonResult[]; sources: string[] }> {
  const allResults: SportsPersonResult[] = [];
  const seenNames = new Set<string>();
  const sourcesUsed: string[] = [];

  const addResults = (results: SportsPersonResult[], source: string) => {
    let added = 0;
    for (const person of results) {
      if (!person.fullName) continue;
      const key = person.fullName.toLowerCase().trim();
      if (key && !seenNames.has(key) && key.length > 2) {
        seenNames.add(key);
        allResults.push(person);
        added++;
      }
    }
    if (added > 0) sourcesUsed.push(source);
    return added;
  };

  const pdlJobTitle =
    searchType === "leadership"
      ? "VP OR Director OR President OR Chief OR General Manager OR Owner"
      : jobTitleFilter || "community relations OR partnerships OR ticket operations OR marketing OR corporate sales OR government affairs";

  console.log(`[Sports People] Starting multi-source search for ${team.name} (${searchType})`);

  try {
    const pdlResults = await searchPDLWithVariations(team, pdlJobTitle, 20);
    const pdlCount = addResults(pdlResults, "People Data Labs");
    console.log(`[Sports People] PDL returned ${pdlCount} people for ${team.name}`);
  } catch (error) {
    console.log(`[Sports People] PDL failed for ${team.name}:`, (error as Error).message);
  }

  if (allResults.length < 5) {
    try {
      const aiResults = await searchWithPerplexityAI(team, searchType);
      const aiCount = addResults(aiResults, "AI Research (Perplexity)");
      console.log(`[Sports People] Perplexity returned ${aiCount} people for ${team.name}`);
    } catch (error) {
      console.log(`[Sports People] Perplexity failed for ${team.name}:`, (error as Error).message);
    }
  }

  if (allResults.length < 3) {
    try {
      const scrapeResults = await searchWithWebScrape(team, searchType);
      const scrapeCount = addResults(scrapeResults, "Web Scrape (Team Website)");
      console.log(`[Sports People] Web scrape returned ${scrapeCount} people for ${team.name}`);
    } catch (error) {
      console.log(`[Sports People] Web scrape failed for ${team.name}:`, (error as Error).message);
    }
  }

  console.log(`[Sports People] Total: ${allResults.length} unique people found for ${team.name} from [${sourcesUsed.join(", ")}]`);

  return { results: allResults, sources: sourcesUsed };
}

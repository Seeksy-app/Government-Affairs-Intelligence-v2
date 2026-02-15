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
  const teamDesc = `${team.name}${team.league ? ` (${team.league})` : ""}`;
  const prompt = searchType === "leadership"
    ? `List ALL current front office executives and senior leadership of the ${teamDesc}. Include: owner, president, CEO, general manager, assistant GM, COO, CFO, CLO, chief people officer, all VPs (operations, partnerships, community relations, ticket sales, marketing, communications, corporate sales, government affairs), directors, and other senior staff.

For each person use EXACTLY this format on its own line:
- NAME: [Full Name] | TITLE: [Job Title] | DEPT: [Department]

Be comprehensive. List every executive and senior leader you can find. Only include people you are confident currently work for the ${team.name}.`
    : `List ALL current staff and personnel of the ${teamDesc}. Include ALL of the following categories:
1. Coaching staff (head coach, coordinators, position coaches, quality control, assistants)
2. Front office (owner, GM, assistant GM, all VPs, directors)
3. Player personnel & scouting (scouts, coordinators, assistants)
4. Football/basketball/baseball operations staff
5. Strength & conditioning staff
6. Analytics & systems staff
7. Marketing, communications, community relations, partnerships, corporate sales, government affairs staff

For each person use EXACTLY this format on its own line:
- NAME: [Full Name] | TITLE: [Job Title] | DEPT: [Department]

Be as comprehensive as possible. List every staff member you can find from the team's official website and public sources. Only include people you are confident currently work for the ${team.name}.`;

  try {
    const result = await researchWithPerplexity(prompt);

    if (!result.content) return [];

    const parsed = parseAIResponseToPersons(result.content, team.name);
    return parsed;
  } catch (error) {
    console.error(`[Sports People] Perplexity research failed for ${team.name}:`, (error as Error).message);
    return [];
  }
}

function isLikelyName(str: string): boolean {
  const trimmed = str.trim();
  if (trimmed.length < 3 || trimmed.length > 60) return false;
  if (/^(the|a|an|this|that|for|and|or|but|in|on|at|to|of|is|are|was|were|head|assistant|director|vice|senior|chief|manager)\b/i.test(trimmed)) return false;
  if (/^\d/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  return words.every(w => /^[A-Z]/.test(w) || /^(de|del|la|le|von|van|mc|o'|d')$/i.test(w) || w === "J." || w === "Jr." || w === "Sr." || w === "III" || w === "II" || /^[A-Z]\.$/.test(w));
}

function addPerson(results: SportsPersonResult[], name: string, title?: string, dept?: string) {
  const cleanName = name.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const cleanTitle = title?.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  if (!isLikelyName(cleanName)) return;
  if (results.some(r => r.fullName.toLowerCase() === cleanName.toLowerCase())) return;
  results.push({
    fullName: cleanName,
    title: cleanTitle || undefined,
    department: dept?.replace(/\*\*/g, '').trim() || undefined,
    source: "ai_research",
    confidence: "medium",
  });
}

function parseAIResponseToPersons(
  aiContent: string,
  _teamName: string
): SportsPersonResult[] {
  const results: SportsPersonResult[] = [];
  let match;

  const structuredPattern = /[-•*]\s*NAME:\s*([^|]+?)\s*\|\s*TITLE:\s*([^|]+?)(?:\s*\|\s*DEPT:\s*(.+?))?$/gim;
  while ((match = structuredPattern.exec(aiContent)) !== null) {
    addPerson(results, match[1], match[2], match[3]);
  }
  if (results.length > 5) return results;

  const dashTitleName = /[-•*]\s*\*?\*?([^:*\n]+?)\*?\*?\s*[-–—:]\s*(.+?)(?:\n|$)/g;
  while ((match = dashTitleName.exec(aiContent)) !== null) {
    const left = match[1]?.trim();
    const right = match[2]?.trim();
    if (isLikelyName(left.replace(/\*\*/g, ''))) {
      addPerson(results, left, right);
    } else if (isLikelyName(right.replace(/\*\*/g, ''))) {
      addPerson(results, right, left);
    }
  }
  if (results.length > 5) return results;

  const boldPattern = /\*\*([^*]+?)\*\*\s*[-–—:,]?\s*([^\n*]+)/g;
  while ((match = boldPattern.exec(aiContent)) !== null) {
    const bold = match[1]?.trim();
    const rest = match[2]?.trim();
    if (isLikelyName(bold)) {
      addPerson(results, bold, rest);
    } else if (isLikelyName(rest?.split(/[-–—:,]/)[0]?.trim() || '')) {
      addPerson(results, rest.split(/[-–—:,]/)[0].trim(), bold);
    }
  }
  if (results.length > 5) return results;

  const titleColonName = /(?:^|\n)\s*([A-Za-z\s&]+?):\s*([A-Z][a-z]+ (?:[A-Z]\.?\s?)?[A-Z][a-z]+(?:\s[A-Z][a-z]+(?:\s(?:Jr\.|Sr\.|III|II))?)?)\s*(?:\n|$)/g;
  while ((match = titleColonName.exec(aiContent)) !== null) {
    const possibleTitle = match[1]?.trim();
    const possibleName = match[2]?.trim();
    if (isLikelyName(possibleName) && possibleTitle.length < 80) {
      addPerson(results, possibleName, possibleTitle);
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

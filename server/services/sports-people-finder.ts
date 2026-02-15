import { researchWithPerplexity } from "./research-agent";
import { searchPeople, type PersonSearchResult } from "./linkedin-service";

export interface SportsPersonResult {
  fullName: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  imageUrl?: string;
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
    email: p.workEmail || p.personalEmail || undefined,
    phone: p.mobilePhone || undefined,
    linkedinUrl: p.linkedinUrl || undefined,
    imageUrl: p.profilePicUrl || undefined,
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

function cleanField(val: string | undefined): string | undefined {
  if (!val) return undefined;
  let cleaned = val
    .replace(/\*\*/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^TITLE:\s*/i.test(cleaned)) {
    const parts = cleaned.split(/\s*\|\s*/);
    const titlePart = parts.find(p => /^TITLE:/i.test(p));
    cleaned = titlePart ? titlePart.replace(/^TITLE:\s*/i, '').trim() : cleaned.replace(/^TITLE:\s*/i, '').trim();
  }
  cleaned = cleaned.replace(/\|\s*DEPT:.*$/i, '').trim();
  cleaned = cleaned.replace(/\|\s*TITLE:.*$/i, '').trim();
  return cleaned || undefined;
}

function extractDeptFromRaw(title: string | undefined, dept: string | undefined): string | undefined {
  if (dept) return cleanField(dept);
  if (!title) return undefined;
  const deptMatch = title.match(/\|\s*DEPT:\s*(.+?)(?:\||$)/i);
  if (deptMatch) return cleanField(deptMatch[1]);
  return undefined;
}

function addPerson(results: SportsPersonResult[], name: string, title?: string, dept?: string) {
  const cleanName = name.replace(/\*\*/g, '').replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
  const extractedDept = extractDeptFromRaw(title, dept);
  const cleanTitle = cleanField(title);
  if (!isLikelyName(cleanName)) return;
  if (results.some(r => r.fullName.toLowerCase() === cleanName.toLowerCase())) return;
  results.push({
    fullName: cleanName,
    title: cleanTitle || undefined,
    department: extractedDept || undefined,
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

async function enrichAIContactsWithPDL(
  contacts: SportsPersonResult[],
  team: TeamInfo,
): Promise<{ enriched: number }> {
  if (!process.env.PDL_API_KEY) return { enriched: 0 };

  const unenriched = contacts.filter(
    (c) => c.source !== "pdl" && !c.email && !c.phone && !c.linkedinUrl,
  );
  if (unenriched.length === 0) return { enriched: 0 };

  const companyVariations = getCompanyNameVariations(team);
  const companyQuery = companyVariations
    .map((c) => `job_company_name='${c.replace(/'/g, "''")}'`)
    .join(" OR ");

  let enriched = 0;
  const batch = unenriched.slice(0, 10);

  for (const contact of batch) {
    try {
      const nameParts = contact.fullName.trim().split(/\s+/);
      if (nameParts.length < 2) continue;

      const firstName = nameParts[0].replace(/'/g, "''");
      const lastName = nameParts[nameParts.length - 1].replace(/'/g, "''");

      const query = `first_name='${firstName}' AND last_name='${lastName}' AND (${companyQuery})`;

      const response = await fetch("https://api.peopledatalabs.com/v5/person/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": process.env.PDL_API_KEY,
        },
        body: JSON.stringify({
          sql: `SELECT * FROM person WHERE ${query}`,
          size: 1,
          dataset: "all",
        }),
      });

      if (!response.ok) continue;

      const result = await response.json();
      const person = result.data?.[0];
      if (!person) continue;

      const workEmail =
        person.work_email ||
        (person.emails || []).find((e: any) => e?.type === "current_professional")?.address;
      const personalEmail =
        (person.emails || []).find((e: any) => e?.type === "personal")?.address;
      const mobilePhone =
        person.mobile_phone ||
        (person.phone_numbers || [])
          .map((p: any) => (typeof p === "string" ? p : p?.number))
          .find(Boolean);

      if (workEmail || personalEmail || mobilePhone || person.linkedin_url || person.profile_pic_url) {
        contact.email = workEmail || personalEmail || contact.email;
        contact.phone = mobilePhone || contact.phone;
        contact.linkedinUrl = person.linkedin_url || contact.linkedinUrl;
        contact.imageUrl = person.profile_pic_url || contact.imageUrl;
        enriched++;
        console.log(`[Sports People] PDL enriched ${contact.fullName}: email=${!!contact.email}, phone=${!!contact.phone}, linkedin=${!!contact.linkedinUrl}, photo=${!!contact.imageUrl}`);
      }
    } catch (error) {
      console.log(`[Sports People] PDL enrich failed for ${contact.fullName}:`, (error as Error).message);
    }
  }

  return { enriched };
}

export async function enrichSingleContact(
  name: string,
  companyName: string,
): Promise<{ email?: string; phone?: string; linkedinUrl?: string; imageUrl?: string } | null> {
  if (!process.env.PDL_API_KEY) return null;

  const nameParts = name.trim().split(/\s+/);
  if (nameParts.length < 2) return null;

  const firstName = nameParts[0].replace(/'/g, "''");
  const lastName = nameParts[nameParts.length - 1].replace(/'/g, "''");
  const escaped = companyName.replace(/'/g, "''");

  const query = `first_name='${firstName}' AND last_name='${lastName}' AND job_company_name LIKE '%${escaped}%'`;

  try {
    const response = await fetch("https://api.peopledatalabs.com/v5/person/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.PDL_API_KEY,
      },
      body: JSON.stringify({
        sql: `SELECT * FROM person WHERE ${query}`,
        size: 1,
        dataset: "all",
      }),
    });

    if (!response.ok) return null;

    const result = await response.json();
    const person = result.data?.[0];
    if (!person) return null;

    const workEmail =
      person.work_email ||
      (person.emails || []).find((e: any) => e?.type === "current_professional")?.address;
    const personalEmail =
      (person.emails || []).find((e: any) => e?.type === "personal")?.address;
    const mobilePhone =
      person.mobile_phone ||
      (person.phone_numbers || [])
        .map((p: any) => (typeof p === "string" ? p : p?.number))
        .find(Boolean);

    if (!workEmail && !personalEmail && !mobilePhone && !person.linkedin_url && !person.profile_pic_url) return null;

    return {
      email: workEmail || personalEmail || undefined,
      phone: mobilePhone || undefined,
      linkedinUrl: person.linkedin_url || undefined,
      imageUrl: person.profile_pic_url || undefined,
    };
  } catch (error) {
    console.error(`[Sports People] Enrich single contact failed for ${name}:`, (error as Error).message);
    return null;
  }
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

  const unenrichedCount = allResults.filter(
    (c) => c.source !== "pdl" && !c.email && !c.phone && !c.linkedinUrl,
  ).length;
  if (unenrichedCount > 0) {
    console.log(`[Sports People] Attempting PDL enrichment for ${unenrichedCount} AI/web contacts...`);
    const { enriched } = await enrichAIContactsWithPDL(allResults, team);
    if (enriched > 0) {
      sourcesUsed.push("PDL Enrichment");
      console.log(`[Sports People] PDL enriched ${enriched}/${unenrichedCount} contacts`);
    }
  }

  console.log(`[Sports People] Total: ${allResults.length} unique people found for ${team.name} from [${sourcesUsed.join(", ")}]`);

  return { results: allResults, sources: sourcesUsed };
}

/**
 * LinkedIn Profile Service using People Data Labs API
 * Provides career mapping and profile enrichment for political staffers
 */

export interface LinkedInExperience {
  starts_at?: { day?: number; month?: number; year?: number };
  ends_at?: { day?: number; month?: number; year?: number } | null;
  company: string;
  company_linkedin_profile_url?: string;
  title: string;
  description?: string;
  location?: string;
  logo_url?: string;
}

export interface LinkedInEducation {
  starts_at?: { day?: number; month?: number; year?: number };
  ends_at?: { day?: number; month?: number; year?: number };
  field_of_study?: string;
  degree_name?: string;
  school: string;
  school_linkedin_profile_url?: string;
  description?: string;
  logo_url?: string;
  activities_and_societies?: string;
}

export interface LinkedInProfile {
  public_identifier?: string;
  profile_pic_url?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  occupation?: string;
  headline?: string;
  summary?: string;
  country?: string;
  city?: string;
  state?: string;
  experiences: LinkedInExperience[];
  education: LinkedInEducation[];
  languages?: string[];
  accomplishment_courses?: { name: string; number?: string }[];
  accomplishment_honors_awards?: { title: string; issuer?: string; issued_on?: { year?: number } }[];
  accomplishment_publications?: { name: string; publisher?: string; published_on?: { year?: number } }[];
  certifications?: { name: string; authority?: string }[];
  volunteer_work?: { title?: string; cause?: string; company?: string; description?: string }[];
  skills?: string[];
  connections?: number;
  follower_count?: number;
  linkedin_url?: string;
}

export interface PersonLookupResult {
  linkedin_profile_url?: string;
  similarity_score?: number;
  last_updated?: string;
}

const PDL_BASE_URL = "https://api.peopledatalabs.com/v5";

interface PDLExperience {
  company?: { name?: string; linkedin_url?: string };
  title?: { name?: string };
  start_date?: string;
  end_date?: string;
  location_names?: string[];
  is_primary?: boolean;
}

interface PDLEducation {
  school?: { name?: string; linkedin_url?: string };
  degrees?: string[];
  majors?: string[];
  start_date?: string;
  end_date?: string;
}

interface PDLResponse {
  status: number;
  likelihood: number;
  data?: {
    id?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    linkedin_url?: string;
    linkedin_username?: string;
    job_title?: string;
    job_company_name?: string;
    job_title_role?: string;
    summary?: string;
    location_name?: string;
    location_locality?: string;
    location_region?: string;
    location_country?: string;
    experience?: PDLExperience[];
    education?: PDLEducation[];
    skills?: string[];
    interests?: string[];
    industry?: string;
  };
}

/**
 * Parse PDL date string (YYYY-MM or YYYY) into our date object format
 */
function parsePDLDate(dateStr?: string): { day?: number; month?: number; year?: number } | undefined {
  if (!dateStr) return undefined;
  
  const parts = dateStr.split("-");
  const year = parts[0] ? parseInt(parts[0]) : undefined;
  const month = parts[1] ? parseInt(parts[1]) : undefined;
  const day = parts[2] ? parseInt(parts[2]) : undefined;
  
  if (!year || isNaN(year)) return undefined;
  
  return { year, month, day };
}

/**
 * Enrich a person's profile using People Data Labs API
 * Cost: ~$0.01 per successful match
 */
export async function enrichLinkedInProfile(
  linkedinUrl: string
): Promise<LinkedInProfile | null> {
  if (!process.env.PDL_API_KEY) {
    throw new Error("People Data Labs API key not configured");
  }

  const params = new URLSearchParams();
  params.append("api_key", process.env.PDL_API_KEY);
  params.append("profile", linkedinUrl);

  try {
    const response = await fetch(
      `${PDL_BASE_URL}/person/enrich?${params.toString()}`,
      { method: "GET" }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Profile not found at ${linkedinUrl}`);
        return null;
      }
      const error = await response.text();
      console.error("PDL enrichment error:", error);
      throw new Error(`Profile enrichment failed: ${error}`);
    }

    const result: PDLResponse = await response.json();
    
    if (!result.data) {
      return null;
    }

    const data = result.data;
    
    // Transform PDL experiences to our format
    const experiences: LinkedInExperience[] = (data.experience || []).map((exp) => ({
      title: exp.title?.name || "Unknown Title",
      company: exp.company?.name || "Unknown Company",
      company_linkedin_profile_url: exp.company?.linkedin_url,
      starts_at: parsePDLDate(exp.start_date),
      ends_at: exp.end_date ? parsePDLDate(exp.end_date) : null,
      location: exp.location_names?.join(", "),
    }));

    // Transform PDL education to our format
    const education: LinkedInEducation[] = (data.education || []).map((edu) => ({
      school: edu.school?.name || "Unknown School",
      school_linkedin_profile_url: edu.school?.linkedin_url,
      degree_name: edu.degrees?.join(", "),
      field_of_study: edu.majors?.join(", "),
      starts_at: parsePDLDate(edu.start_date),
      ends_at: parsePDLDate(edu.end_date),
    }));

    return {
      first_name: data.first_name,
      last_name: data.last_name,
      full_name: data.full_name,
      headline: data.job_title ? `${data.job_title} at ${data.job_company_name}` : undefined,
      summary: data.summary,
      country: data.location_country,
      city: data.location_locality,
      state: data.location_region,
      experiences,
      education,
      skills: data.skills || [],
      linkedin_url: data.linkedin_url,
    };
  } catch (error) {
    console.error("PDL enrichment error:", error);
    throw error;
  }
}

/**
 * Look up and enrich a person by name and organization
 * Cost: ~$0.01 per successful match
 */
export async function researchLinkedInProfile(
  firstName: string,
  lastName: string,
  organization?: string
): Promise<{
  profileUrl: string | null;
  profile: LinkedInProfile | null;
  error?: string;
}> {
  if (!process.env.PDL_API_KEY) {
    throw new Error("People Data Labs API key not configured");
  }

  try {
    const params = new URLSearchParams();
    params.append("api_key", process.env.PDL_API_KEY);
    params.append("first_name", firstName);
    params.append("last_name", lastName);
    
    // Add organization context for better matching
    if (organization) {
      // Clean up organization name for PDL
      let company = organization;
      if (company.toLowerCase().includes("office of")) {
        company = "US Congress";
      }
      params.append("company", company);
    }
    
    // Require LinkedIn profile in results
    params.append("required", "linkedin_url");
    
    const response = await fetch(
      `${PDL_BASE_URL}/person/enrich?${params.toString()}`,
      { method: "GET" }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          profileUrl: null,
          profile: null,
          error: `Could not find profile for ${firstName} ${lastName}`,
        };
      }
      const error = await response.text();
      console.error("PDL lookup error:", error);
      throw new Error(`Profile lookup failed: ${error}`);
    }

    const result: PDLResponse = await response.json();
    
    if (!result.data) {
      return {
        profileUrl: null,
        profile: null,
        error: `No profile data found for ${firstName} ${lastName}`,
      };
    }

    const data = result.data;
    
    // Transform to our format
    const experiences: LinkedInExperience[] = (data.experience || []).map((exp) => ({
      title: exp.title?.name || "Unknown Title",
      company: exp.company?.name || "Unknown Company",
      company_linkedin_profile_url: exp.company?.linkedin_url,
      starts_at: parsePDLDate(exp.start_date),
      ends_at: exp.end_date ? parsePDLDate(exp.end_date) : null,
      location: exp.location_names?.join(", "),
    }));

    const education: LinkedInEducation[] = (data.education || []).map((edu) => ({
      school: edu.school?.name || "Unknown School",
      school_linkedin_profile_url: edu.school?.linkedin_url,
      degree_name: edu.degrees?.join(", "),
      field_of_study: edu.majors?.join(", "),
      starts_at: parsePDLDate(edu.start_date),
      ends_at: parsePDLDate(edu.end_date),
    }));

    const profile: LinkedInProfile = {
      first_name: data.first_name,
      last_name: data.last_name,
      full_name: data.full_name,
      headline: data.job_title ? `${data.job_title} at ${data.job_company_name}` : undefined,
      summary: data.summary,
      country: data.location_country,
      city: data.location_locality,
      state: data.location_region,
      experiences,
      education,
      skills: data.skills || [],
      linkedin_url: data.linkedin_url,
    };

    return {
      profileUrl: data.linkedin_url || null,
      profile,
    };
  } catch (error: any) {
    console.error("PDL research error:", error);
    return {
      profileUrl: null,
      profile: null,
      error: error.message || "Profile research failed",
    };
  }
}

/**
 * Format LinkedIn experiences into a career timeline
 */
export function formatCareerTimeline(experiences: LinkedInExperience[]): string {
  if (!experiences || experiences.length === 0) {
    return "No career history available";
  }

  return experiences.map((exp) => {
    const startYear = exp.starts_at?.year || "?";
    const endYear = exp.ends_at?.year || "Present";
    const dateRange = `${startYear} - ${endYear}`;
    
    let entry = `**${exp.title}** at ${exp.company} (${dateRange})`;
    if (exp.description) {
      entry += `\n  ${exp.description.slice(0, 200)}${exp.description.length > 200 ? "..." : ""}`;
    }
    return entry;
  }).join("\n\n");
}

/**
 * Format education into readable format
 */
export function formatEducation(education: LinkedInEducation[]): string {
  if (!education || education.length === 0) {
    return "No education data available";
  }

  return education.map((edu) => {
    const startYear = edu.starts_at?.year || "?";
    const endYear = edu.ends_at?.year || "";
    const years = endYear ? `${startYear} - ${endYear}` : startYear.toString();
    
    let entry = `**${edu.school}**`;
    if (edu.degree_name || edu.field_of_study) {
      entry += ` - ${[edu.degree_name, edu.field_of_study].filter(Boolean).join(" in ")}`;
    }
    entry += ` (${years})`;
    
    return entry;
  }).join("\n");
}

/**
 * Analyze career patterns from LinkedIn data
 */
export function analyzeCareerPatterns(profile: LinkedInProfile): {
  totalYearsExperience: number;
  sectors: string[];
  careerTrajectory: string;
  keyTransitions: string[];
  politicalExperience: boolean;
  governmentExperience: boolean;
  campaignExperience: boolean;
  lobbyingExperience: boolean;
  thinkTankExperience: boolean;
} {
  const experiences = profile.experiences || [];
  
  // Calculate years of experience
  let earliestYear = new Date().getFullYear();
  let latestYear = new Date().getFullYear();
  
  for (const exp of experiences) {
    if (exp.starts_at?.year && exp.starts_at.year < earliestYear) {
      earliestYear = exp.starts_at.year;
    }
  }
  
  const totalYearsExperience = latestYear - earliestYear;
  
  // Analyze sectors
  const sectors = new Set<string>();
  let politicalExperience = false;
  let governmentExperience = false;
  let campaignExperience = false;
  let lobbyingExperience = false;
  let thinkTankExperience = false;
  
  const governmentKeywords = ["congress", "senate", "house", "government", "federal", "state", "agency", "department", "capitol"];
  const campaignKeywords = ["campaign", "election", "political", "dnc", "rnc", "democrat", "republican", "pac"];
  const lobbyingKeywords = ["lobby", "government affairs", "public affairs", "advocacy", "government relations"];
  const thinkTankKeywords = ["institute", "foundation", "policy", "research", "center for", "council on", "brookings", "heritage"];
  
  for (const exp of experiences) {
    const companyLower = exp.company.toLowerCase();
    const titleLower = exp.title.toLowerCase();
    const combined = `${companyLower} ${titleLower}`;
    
    if (governmentKeywords.some(kw => combined.includes(kw))) {
      sectors.add("Government");
      governmentExperience = true;
      politicalExperience = true;
    }
    
    if (campaignKeywords.some(kw => combined.includes(kw))) {
      sectors.add("Campaigns/Politics");
      campaignExperience = true;
      politicalExperience = true;
    }
    
    if (lobbyingKeywords.some(kw => combined.includes(kw))) {
      sectors.add("Lobbying/Advocacy");
      lobbyingExperience = true;
    }
    
    if (thinkTankKeywords.some(kw => combined.includes(kw))) {
      sectors.add("Think Tank/Policy");
      thinkTankExperience = true;
    }
  }
  
  // Determine career trajectory
  let careerTrajectory = "General";
  if (governmentExperience && lobbyingExperience) {
    careerTrajectory = "Revolving Door (Government → Private Sector)";
  } else if (campaignExperience && governmentExperience) {
    careerTrajectory = "Political Career (Campaigns → Government)";
  } else if (governmentExperience) {
    careerTrajectory = "Public Service";
  } else if (lobbyingExperience) {
    careerTrajectory = "Government Relations/Lobbying";
  }
  
  // Identify key transitions
  const keyTransitions: string[] = [];
  for (let i = 0; i < experiences.length - 1; i++) {
    const current = experiences[i];
    const previous = experiences[i + 1];
    
    const currentSector = getSector(current.company, current.title);
    const previousSector = getSector(previous.company, previous.title);
    
    if (currentSector !== previousSector && currentSector && previousSector) {
      keyTransitions.push(`${previousSector} → ${currentSector}`);
    }
  }
  
  // Convert Set to Array without spreading
  const sectorArray: string[] = [];
  sectors.forEach(s => sectorArray.push(s));
  
  // Deduplicate keyTransitions
  const uniqueTransitions: string[] = [];
  const seenTransitions = new Set<string>();
  for (const t of keyTransitions) {
    if (!seenTransitions.has(t)) {
      seenTransitions.add(t);
      uniqueTransitions.push(t);
    }
  }
  
  return {
    totalYearsExperience,
    sectors: sectorArray,
    careerTrajectory,
    keyTransitions: uniqueTransitions,
    politicalExperience,
    governmentExperience,
    campaignExperience,
    lobbyingExperience,
    thinkTankExperience,
  };
}

function getSector(company: string, title: string): string | null {
  const combined = `${company} ${title}`.toLowerCase();
  
  if (combined.includes("congress") || combined.includes("senate") || combined.includes("house") || combined.includes("capitol")) {
    return "Government";
  }
  if (combined.includes("campaign") || combined.includes("election")) {
    return "Campaigns";
  }
  if (combined.includes("lobby") || combined.includes("government affairs")) {
    return "Lobbying";
  }
  if (combined.includes("institute") || combined.includes("foundation") || combined.includes("policy")) {
    return "Think Tank";
  }
  
  return null;
}

// ==================== COMPANY ENRICHMENT ====================

export interface CompanyProfile {
  id?: string;
  name: string;
  displayName?: string;
  website?: string;
  linkedinUrl?: string;
  industry?: string;
  size?: string;
  founded?: number;
  type?: string;
  description?: string;
  headquarters?: {
    city?: string;
    state?: string;
    country?: string;
    address?: string;
  };
  employeeCount?: number;
  employeeCountRange?: string;
  tags?: string[];
  naicsCode?: string;
  sicCode?: string;
  ticker?: string;
  specialties?: string[];
  politicalClassification?: {
    isLobbyingFirm: boolean;
    isPAC: boolean;
    isThinkTank: boolean;
    isGovernmentAgency: boolean;
    isPoliticalOrg: boolean;
    isCampaign: boolean;
  };
}

interface PDLCompanyResponse {
  status: number;
  name?: string;
  display_name?: string;
  website?: string;
  linkedin_url?: string;
  industry?: string;
  size?: string;
  founded?: number;
  type?: string;
  summary?: string;
  location?: {
    name?: string;
    locality?: string;
    region?: string;
    country?: string;
    street_address?: string;
  };
  employee_count?: number;
  tags?: string[];
  naics?: Array<{ naics_code?: string }>;
  sic?: Array<{ sic_code?: string }>;
  ticker?: string;
}

/**
 * Enrich a company profile using People Data Labs Company API
 * Cost: ~$0.01 per successful match
 */
export async function enrichCompany(
  companyIdentifier: string,
  identifierType: "name" | "website" | "linkedin" = "name"
): Promise<CompanyProfile | null> {
  if (!process.env.PDL_API_KEY) {
    throw new Error("People Data Labs API key not configured");
  }

  const params = new URLSearchParams();
  params.append("api_key", process.env.PDL_API_KEY);
  
  if (identifierType === "name") {
    params.append("name", companyIdentifier);
  } else if (identifierType === "website") {
    params.append("website", companyIdentifier);
  } else if (identifierType === "linkedin") {
    params.append("profile", companyIdentifier);
  }

  try {
    const response = await fetch(
      `${PDL_BASE_URL}/company/enrich?${params.toString()}`,
      { method: "GET" }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Company not found: ${companyIdentifier}`);
        return null;
      }
      const error = await response.text();
      console.error("PDL company enrichment error:", error);
      throw new Error(`Company enrichment failed: ${error}`);
    }

    const result: PDLCompanyResponse = await response.json();
    
    // Classify the organization type for political intelligence
    const politicalClassification = classifyPoliticalOrganization(
      result.name || companyIdentifier,
      result.industry,
      result.tags,
      result.summary
    );

    return {
      id: undefined,
      name: result.name || companyIdentifier,
      displayName: result.display_name,
      website: result.website,
      linkedinUrl: result.linkedin_url,
      industry: result.industry,
      size: result.size,
      founded: result.founded,
      type: result.type,
      description: result.summary,
      headquarters: result.location ? {
        city: result.location.locality,
        state: result.location.region,
        country: result.location.country,
        address: result.location.street_address,
      } : undefined,
      employeeCount: result.employee_count,
      employeeCountRange: result.size,
      tags: result.tags,
      naicsCode: result.naics?.[0]?.naics_code,
      sicCode: result.sic?.[0]?.sic_code,
      ticker: result.ticker,
      politicalClassification,
    };
  } catch (error) {
    console.error("PDL company enrichment error:", error);
    throw error;
  }
}

/**
 * Classify if an organization is politically relevant
 */
function classifyPoliticalOrganization(
  name: string,
  industry?: string,
  tags?: string[],
  description?: string
): CompanyProfile["politicalClassification"] {
  const combined = [
    name,
    industry || "",
    (tags || []).join(" "),
    description || ""
  ].join(" ").toLowerCase();

  const lobbyingKeywords = ["lobbying", "government affairs", "public affairs", "government relations", "advocacy firm"];
  const pacKeywords = ["pac", "political action committee", "super pac", "political fund"];
  const thinkTankKeywords = ["institute", "foundation", "think tank", "policy research", "brookings", "heritage", "cato", "aei", "cfr"];
  const govKeywords = ["department", "agency", "federal", "government", "congress", "senate", "house of representatives"];
  const politicalKeywords = ["democratic", "republican", "political party", "dnc", "rnc", "political organization"];
  const campaignKeywords = ["campaign", "for president", "for congress", "for senate", "election committee"];

  return {
    isLobbyingFirm: lobbyingKeywords.some(kw => combined.includes(kw)),
    isPAC: pacKeywords.some(kw => combined.includes(kw)),
    isThinkTank: thinkTankKeywords.some(kw => combined.includes(kw)),
    isGovernmentAgency: govKeywords.some(kw => combined.includes(kw)),
    isPoliticalOrg: politicalKeywords.some(kw => combined.includes(kw)),
    isCampaign: campaignKeywords.some(kw => combined.includes(kw)),
  };
}

// ==================== PERSON SEARCH ====================

export interface PersonSearchResult {
  id?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  linkedinUrl?: string;
  profilePicUrl?: string;
  jobTitle?: string;
  jobCompany?: string;
  location?: string;
  industry?: string;
  skills?: string[];
  matchScore?: number;
}

export interface PersonSearchParams {
  company?: string;
  jobTitle?: string;
  location?: string;
  industry?: string;
  school?: string;
  skills?: string[];
  limit?: number;
}

/**
 * Search for people who match criteria (e.g., worked at a specific company)
 * Cost: ~$0.01 per successful result
 */
export async function searchPeople(
  params: PersonSearchParams
): Promise<PersonSearchResult[]> {
  if (!process.env.PDL_API_KEY) {
    throw new Error("People Data Labs API key not configured");
  }

  // Build SQL-like query for PDL
  const conditions: string[] = [];
  
  if (params.company) {
    // Match current or past company
    conditions.push(`job_company_name='${params.company.replace(/'/g, "''")}'`);
  }
  
  if (params.jobTitle) {
    conditions.push(`job_title LIKE '%${params.jobTitle.replace(/'/g, "''")}%'`);
  }
  
  if (params.location) {
    conditions.push(`location_name LIKE '%${params.location.replace(/'/g, "''")}%'`);
  }
  
  if (params.industry) {
    conditions.push(`industry='${params.industry.replace(/'/g, "''")}'`);
  }
  
  if (params.school) {
    conditions.push(`education.school.name='${params.school.replace(/'/g, "''")}'`);
  }
  
  if (params.skills && params.skills.length > 0) {
    const skillConditions = params.skills.map(s => `skills LIKE '%${s.replace(/'/g, "''")}%'`);
    conditions.push(`(${skillConditions.join(" OR ")})`);
  }

  if (conditions.length === 0) {
    throw new Error("At least one search parameter is required");
  }

  const query = conditions.join(" AND ");
  const limit = Math.min(params.limit || 10, 100);

  try {
    const response = await fetch(`${PDL_BASE_URL}/person/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.PDL_API_KEY,
      },
      body: JSON.stringify({
        sql: `SELECT * FROM person WHERE ${query}`,
        size: limit,
        dataset: "all",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("PDL person search error:", errorText);
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Person search failed: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.data || !Array.isArray(result.data)) {
      return [];
    }

    const titleCase = (str: string | null | undefined): string | undefined => {
      if (!str) return undefined;
      return str.replace(/\b\w/g, (c) => c.toUpperCase());
    };

    return result.data.map((person: any) => ({
      id: person.id,
      fullName: titleCase(person.full_name || `${person.first_name || ""} ${person.last_name || ""}`.trim()) || "",
      firstName: titleCase(person.first_name),
      lastName: titleCase(person.last_name),
      linkedinUrl: person.linkedin_url,
      profilePicUrl: person.profile_pic_url || null,
      jobTitle: titleCase(person.job_title),
      jobCompany: titleCase(person.job_company_name),
      location: titleCase(person.location_name),
      industry: titleCase(person.industry),
      skills: (person.skills || []).map((s: string) => titleCase(s) || s),
      matchScore: person.match_score,
    }));
  } catch (error) {
    console.error("PDL person search error:", error);
    throw error;
  }
}

/**
 * Find former colleagues who worked at the same organization
 * Cost: ~$0.01 per result found
 */
export async function findFormerColleagues(
  companyName: string,
  limit: number = 20
): Promise<PersonSearchResult[]> {
  return searchPeople({
    company: companyName,
    limit,
  });
}

/**
 * Search for people with specific political experience
 */
export async function searchPoliticalProfessionals(
  params: {
    type: "lobbyist" | "government" | "campaign" | "think_tank";
    location?: string;
    limit?: number;
  }
): Promise<PersonSearchResult[]> {
  const typeQueries: Record<string, PersonSearchParams> = {
    lobbyist: {
      jobTitle: "government affairs",
      limit: params.limit,
      location: params.location,
    },
    government: {
      company: "US Congress",
      limit: params.limit,
      location: params.location,
    },
    campaign: {
      jobTitle: "campaign",
      limit: params.limit,
      location: params.location,
    },
    think_tank: {
      industry: "think tanks",
      limit: params.limit,
      location: params.location,
    },
  };

  return searchPeople(typeQueries[params.type] || { limit: params.limit });
}

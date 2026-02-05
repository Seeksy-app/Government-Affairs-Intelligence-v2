/**
 * LinkedIn Profile Service using Proxycurl API
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
}

export interface PersonLookupResult {
  linkedin_profile_url?: string;
  similarity_score?: number;
  last_updated?: string;
}

const PROXYCURL_BASE_URL = "https://nubela.co/proxycurl";

/**
 * Look up a LinkedIn profile URL by person's name and company
 * Cost: 2 credits per successful request
 */
export async function lookupLinkedInProfile(
  firstName: string,
  lastName: string,
  companyDomain?: string,
  currentCompany?: string
): Promise<PersonLookupResult | null> {
  if (!process.env.PROXYCURL_API_KEY) {
    throw new Error("Proxycurl API key not configured");
  }

  const params = new URLSearchParams();
  params.append("first_name", firstName);
  params.append("last_name", lastName);
  
  if (companyDomain) {
    params.append("company_domain", companyDomain);
  }
  if (currentCompany) {
    params.append("enrich_profile", "skip");
    params.append("current_company", currentCompany);
  }

  try {
    const response = await fetch(
      `${PROXYCURL_BASE_URL}/api/linkedin/profile/resolve?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${process.env.PROXYCURL_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`LinkedIn profile not found for ${firstName} ${lastName}`);
        return null;
      }
      const error = await response.text();
      console.error("Proxycurl lookup error:", error);
      throw new Error(`LinkedIn lookup failed: ${error}`);
    }

    const result = await response.json();
    return {
      linkedin_profile_url: result.url || result.linkedin_profile_url,
      similarity_score: result.similarity_score,
      last_updated: result.last_updated,
    };
  } catch (error) {
    console.error("LinkedIn lookup error:", error);
    throw error;
  }
}

/**
 * Enrich a LinkedIn profile with full career data
 * Cost: 1 credit per successful request
 */
export async function enrichLinkedInProfile(
  linkedinUrl: string
): Promise<LinkedInProfile | null> {
  if (!process.env.PROXYCURL_API_KEY) {
    throw new Error("Proxycurl API key not configured");
  }

  const params = new URLSearchParams();
  params.append("url", linkedinUrl);
  params.append("fallback_to_cache", "on-error");
  params.append("use_cache", "if-recent");
  params.append("skills", "include");
  params.append("inferred_salary", "skip");
  params.append("personal_email", "skip");
  params.append("personal_contact_number", "skip");
  params.append("twitter_profile_id", "skip");
  params.append("facebook_profile_id", "skip");
  params.append("github_profile_id", "skip");
  params.append("extra", "skip");

  try {
    const response = await fetch(
      `${PROXYCURL_BASE_URL}/api/v2/linkedin?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${process.env.PROXYCURL_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`LinkedIn profile not found at ${linkedinUrl}`);
        return null;
      }
      const error = await response.text();
      console.error("Proxycurl enrichment error:", error);
      throw new Error(`LinkedIn enrichment failed: ${error}`);
    }

    const result = await response.json();
    return {
      public_identifier: result.public_identifier,
      profile_pic_url: result.profile_pic_url,
      first_name: result.first_name,
      last_name: result.last_name,
      full_name: result.full_name,
      occupation: result.occupation,
      headline: result.headline,
      summary: result.summary,
      country: result.country_full_name,
      city: result.city,
      state: result.state,
      experiences: result.experiences || [],
      education: result.education || [],
      languages: result.languages || [],
      accomplishment_courses: result.accomplishment_courses || [],
      accomplishment_honors_awards: result.accomplishment_honors_awards || [],
      accomplishment_publications: result.accomplishment_publications || [],
      certifications: result.certifications || [],
      volunteer_work: result.volunteer_work || [],
      skills: result.skills || [],
      connections: result.connections,
      follower_count: result.follower_count,
    };
  } catch (error) {
    console.error("LinkedIn enrichment error:", error);
    throw error;
  }
}

/**
 * Full LinkedIn research - lookup by name then enrich
 * Cost: 3 credits (2 for lookup + 1 for enrichment)
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
  try {
    // Step 1: Look up the LinkedIn profile URL
    const companyDomain = getCompanyDomain(organization);
    const lookup = await lookupLinkedInProfile(firstName, lastName, companyDomain, organization);
    
    if (!lookup?.linkedin_profile_url) {
      return {
        profileUrl: null,
        profile: null,
        error: `Could not find LinkedIn profile for ${firstName} ${lastName}`,
      };
    }

    // Step 2: Enrich the profile with full career data
    const profile = await enrichLinkedInProfile(lookup.linkedin_profile_url);
    
    return {
      profileUrl: lookup.linkedin_profile_url,
      profile,
    };
  } catch (error: any) {
    console.error("LinkedIn research error:", error);
    return {
      profileUrl: null,
      profile: null,
      error: error.message || "LinkedIn research failed",
    };
  }
}

/**
 * Helper to convert organization names to company domains for better lookup
 */
function getCompanyDomain(organization?: string): string | undefined {
  if (!organization) return undefined;
  
  const lowerOrg = organization.toLowerCase();
  
  // Government domain mappings
  if (lowerOrg.includes("house") || lowerOrg.includes("representative")) {
    return "house.gov";
  }
  if (lowerOrg.includes("senate") || lowerOrg.includes("senator")) {
    return "senate.gov";
  }
  if (lowerOrg.includes("white house") || lowerOrg.includes("executive office")) {
    return "whitehouse.gov";
  }
  
  // Congressional offices
  if (lowerOrg.includes("office of")) {
    // Try to identify if it's House or Senate
    if (lowerOrg.includes("speaker") || lowerOrg.includes("minority leader")) {
      return "house.gov";
    }
    return undefined; // Let Proxycurl figure it out
  }
  
  return undefined;
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
  
  const governmentKeywords = ["congress", "senate", "house", "government", "federal", "state", "agency", "department", ".gov"];
  const campaignKeywords = ["campaign", "election", "political", "dnc", "rnc", "democrat", "republican"];
  const lobbyingKeywords = ["lobby", "government affairs", "public affairs", "advocacy", "government relations"];
  const thinkTankKeywords = ["institute", "foundation", "policy", "research", "center for", "council on"];
  
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
  
  return {
    totalYearsExperience,
    sectors: Array.from(sectors),
    careerTrajectory,
    keyTransitions: [...new Set(keyTransitions)],
    politicalExperience,
    governmentExperience,
    campaignExperience,
    lobbyingExperience,
    thinkTankExperience,
  };
}

function getSector(company: string, title: string): string | null {
  const combined = `${company} ${title}`.toLowerCase();
  
  if (combined.includes("congress") || combined.includes("senate") || combined.includes("house") || combined.includes(".gov")) {
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

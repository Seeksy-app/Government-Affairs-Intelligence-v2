const CONGRESS_API_BASE = "https://api.congress.gov/v3";

interface CongressBill {
  congress: number;
  type: string;
  number: number;
  title: string;
  originChamber: string;
  originChamberCode: string;
  updateDate: string;
  introducedDate: string;
  latestAction?: {
    actionDate: string;
    text: string;
  };
  sponsors?: Array<{
    bioguideId: string;
    fullName: string;
    party: string;
    state: string;
  }>;
  policyArea?: {
    name: string;
  };
  url: string;
}

interface CongressSearchResponse {
  bills: CongressBill[];
  pagination: {
    count: number;
    next?: string;
  };
}

interface BillDetails {
  bill: CongressBill & {
    cosponsors?: Array<{
      bioguideId: string;
      fullName: string;
      party: string;
      state: string;
    }>;
    committees?: Array<{
      name: string;
      chamber: string;
    }>;
    subjects?: {
      legislativeSubjects: Array<{ name: string }>;
    };
    summaries?: Array<{
      text: string;
      actionDate: string;
      updateDate: string;
    }>;
  };
}

export class CongressAPI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${CONGRESS_API_BASE}${endpoint}`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("format", "json");
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Congress API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async searchBills(options: {
    congress?: number;
    billType?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<CongressSearchResponse> {
    const { congress = 119, billType, limit = 20, offset = 0 } = options;
    
    let endpoint = `/bill/${congress}`;
    if (billType) {
      endpoint += `/${billType}`;
    }

    return this.fetch<CongressSearchResponse>(endpoint, { limit, offset });
  }

  async getBillDetails(congress: number, billType: string, billNumber: number): Promise<BillDetails> {
    return this.fetch<BillDetails>(`/bill/${congress}/${billType}/${billNumber}`);
  }

  async getBillActions(congress: number, billType: string, billNumber: number, limit = 50) {
    return this.fetch<{
      actions: Array<{
        actionCode: string;
        actionDate: string;
        text: string;
        type: string;
        chamber: string;
      }>;
    }>(`/bill/${congress}/${billType}/${billNumber}/actions`, { limit });
  }

  async getBillCosponsors(congress: number, billType: string, billNumber: number, limit = 100) {
    return this.fetch<{
      cosponsors: Array<{
        bioguideId: string;
        fullName: string;
        party: string;
        state: string;
        sponsorshipDate: string;
      }>;
    }>(`/bill/${congress}/${billType}/${billNumber}/cosponsors`, { limit });
  }

  async getBillSummaries(congress: number, billType: string, billNumber: number) {
    return this.fetch<{
      summaries: Array<{
        text: string;
        actionDate: string;
        updateDate: string;
        versionCode: string;
      }>;
    }>(`/bill/${congress}/${billType}/${billNumber}/summaries`);
  }

  async getBillSubjects(congress: number, billType: string, billNumber: number) {
    return this.fetch<{
      subjects: {
        legislativeSubjects: Array<{ name: string }>;
        policyArea: { name: string };
      };
    }>(`/bill/${congress}/${billType}/${billNumber}/subjects`);
  }

  async getMemberBills(bioguideId: string, limit = 20) {
    return this.fetch<{
      sponsoredLegislation: Array<{
        congress: number;
        type: string;
        number: number;
        title: string;
        introducedDate: string;
        latestAction: {
          actionDate: string;
          text: string;
        };
      }>;
    }>(`/member/${bioguideId}/sponsored-legislation`, { limit });
  }

  async searchByKeyword(keyword: string, congress = 119, limit = 50): Promise<CongressBill[]> {
    const allBills = await this.searchBills({ congress, limit: 250 });
    
    const searchLower = keyword.toLowerCase();
    return allBills.bills.filter(bill => 
      bill.title?.toLowerCase().includes(searchLower)
    ).slice(0, limit);
  }

  // Get all current members of Congress
  async getCurrentMembers(options: {
    chamber?: 'house' | 'senate';
    limit?: number;
  } = {}): Promise<SimpleMember[]> {
    const { chamber, limit = 500 } = options;
    
    const response = await this.fetch<{
      members: CongressMember[];
    }>('/member', { 
      currentMember: 'true',
      limit 
    });

    let members = response.members.map(m => {
      const currentTerm = m.terms?.item?.[m.terms.item.length - 1];
      return {
        bioguideId: m.bioguideId,
        name: m.name,
        firstName: m.name.split(',')[1]?.trim().split(' ')[0] || m.name.split(' ')[0],
        lastName: m.name.split(',')[0]?.trim() || m.name,
        state: m.state,
        district: m.district,
        party: m.party,
        chamber: currentTerm?.chamber || 'Unknown',
        imageUrl: m.depiction?.imageUrl,
      } as SimpleMember;
    });

    // Filter by chamber if specified
    if (chamber === 'house') {
      members = members.filter(m => m.chamber === 'House of Representatives');
    } else if (chamber === 'senate') {
      members = members.filter(m => m.chamber === 'Senate');
    }

    return members;
  }

  // Get member details by bioguide ID
  async getMemberDetails(bioguideId: string): Promise<SimpleMember | null> {
    try {
      const response = await this.fetch<MemberDetails>(`/member/${bioguideId}`);
      const m = response.member;
      const currentTerm = m.terms?.item?.[m.terms.item.length - 1];
      
      return {
        bioguideId: m.bioguideId,
        name: m.name,
        firstName: m.firstName,
        lastName: m.lastName,
        state: m.state,
        district: m.district,
        party: m.party,
        chamber: currentTerm?.chamber || 'Unknown',
        imageUrl: m.depiction?.imageUrl,
        phone: m.addressInformation?.phoneNumber,
        officeAddress: m.addressInformation?.officeAddress,
        website: m.officialWebsiteUrl,
        leadership: m.leadership?.map(l => l.type),
      };
    } catch (error) {
      console.error('Error fetching member details:', error);
      return null;
    }
  }

  // Search members by name
  async searchMembers(query: string, options: {
    chamber?: 'house' | 'senate';
    party?: 'D' | 'R' | 'I';
    state?: string;
  } = {}): Promise<SimpleMember[]> {
    const members = await this.getCurrentMembers({ 
      chamber: options.chamber,
      limit: 600 
    });
    
    const queryLower = query.toLowerCase();
    
    return members.filter(m => {
      // Name match
      const nameMatch = !query || 
        m.name.toLowerCase().includes(queryLower) ||
        m.firstName.toLowerCase().includes(queryLower) ||
        m.lastName.toLowerCase().includes(queryLower);
      
      // Party filter
      const partyMatch = !options.party || m.party === options.party;
      
      // State filter
      const stateMatch = !options.state || m.state === options.state;
      
      return nameMatch && partyMatch && stateMatch;
    });
  }

  // Get leadership members
  async getLeadership(): Promise<SimpleMember[]> {
    const members = await this.getCurrentMembers({ limit: 600 });
    
    // Get details for all members to find leadership
    const leadershipMembers: SimpleMember[] = [];
    
    // Known leadership bioguide IDs (we'll fetch a sample to get leadership info)
    // For efficiency, we'll return members with known leadership titles in their details
    for (const member of members.slice(0, 50)) {
      const details = await this.getMemberDetails(member.bioguideId);
      if (details?.leadership && details.leadership.length > 0) {
        leadershipMembers.push(details);
      }
    }
    
    return leadershipMembers;
  }
}

// Member interfaces
interface CongressMember {
  bioguideId: string;
  name: string;
  state: string;
  district?: number;
  party: string;
  url: string;
  depiction?: {
    imageUrl: string;
    attribution: string;
  };
  terms?: {
    item: Array<{
      chamber: string;
      startYear: number;
      endYear?: number;
    }>;
  };
}

interface MemberDetails {
  member: CongressMember & {
    firstName: string;
    lastName: string;
    directOrderName: string;
    honorificName: string;
    officialWebsiteUrl?: string;
    addressInformation?: {
      officeAddress: string;
      city: string;
      district: string;
      zipCode: string;
      phoneNumber: string;
    };
    currentMember: boolean;
    leadership?: Array<{
      type: string;
      congress: number;
    }>;
    partyHistory?: Array<{
      partyName: string;
      partyAbbreviation: string;
      startYear: number;
      endYear?: number;
    }>;
  };
}

export interface SimpleMember {
  bioguideId: string;
  name: string;
  firstName: string;
  lastName: string;
  state: string;
  district?: number;
  party: string;
  chamber: string;
  imageUrl?: string;
  phone?: string;
  officeAddress?: string;
  website?: string;
  leadership?: string[];
}

export function formatBillId(congress: number, billType: string, billNumber: number): string {
  const typeLabels: Record<string, string> = {
    hr: "H.R.",
    s: "S.",
    hjres: "H.J.Res.",
    sjres: "S.J.Res.",
    hconres: "H.Con.Res.",
    sconres: "S.Con.Res.",
    hres: "H.Res.",
    sres: "S.Res.",
  };
  
  return `${typeLabels[billType] || billType.toUpperCase()} ${billNumber}`;
}

export function parseBillId(billId: string): { billType: string; billNumber: number } | null {
  const patterns = [
    { regex: /^H\.?R\.?\s*(\d+)$/i, type: "hr" },
    { regex: /^S\.?\s*(\d+)$/i, type: "s" },
    { regex: /^H\.?J\.?Res\.?\s*(\d+)$/i, type: "hjres" },
    { regex: /^S\.?J\.?Res\.?\s*(\d+)$/i, type: "sjres" },
    { regex: /^H\.?Con\.?Res\.?\s*(\d+)$/i, type: "hconres" },
    { regex: /^S\.?Con\.?Res\.?\s*(\d+)$/i, type: "sconres" },
    { regex: /^H\.?Res\.?\s*(\d+)$/i, type: "hres" },
    { regex: /^S\.?Res\.?\s*(\d+)$/i, type: "sres" },
  ];

  for (const { regex, type } of patterns) {
    const match = billId.match(regex);
    if (match) {
      return { billType: type, billNumber: parseInt(match[1], 10) };
    }
  }

  return null;
}

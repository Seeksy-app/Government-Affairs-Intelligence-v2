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
    console.log(`[Congress API] Searching for keyword: "${keyword}", congress: ${congress}`);
    
    // Check if the search looks like a bill number (e.g., "H.R. 3854", "HR3854", "S. 123", "S123", "SB3726", "HB1234")
    const billNumberMatch = keyword.match(/^(H\.?R\.?|S\.?B?|H\.?B\.?|H\.?J\.?RES\.?|S\.?J\.?RES\.?|H\.?CON\.?RES\.?|S\.?CON\.?RES\.?|H\.?RES\.?|S\.?RES\.?)\s*(\d+)$/i);
    
    console.log(`[Congress API] Bill number match result:`, billNumberMatch);
    
    if (billNumberMatch) {
      // Parse the bill type and number
      let typeStr = billNumberMatch[1].toUpperCase().replace(/\./g, '');
      const number = parseInt(billNumberMatch[2]);
      
      console.log(`[Congress API] Parsed - typeStr: "${typeStr}", number: ${number}`);
      
      // Map to API bill types (including LegiScan format SB/HB)
      const typeMap: { [key: string]: string } = {
        'HR': 'hr',
        'HB': 'hr',     // LegiScan House Bill format
        'S': 's',
        'SB': 's',      // LegiScan Senate Bill format
        'HJRES': 'hjres',
        'SJRES': 'sjres',
        'HCONRES': 'hconres',
        'SCONRES': 'sconres',
        'HRES': 'hres',
        'SRES': 'sres',
      };
      
      const billType = typeMap[typeStr];
      console.log(`[Congress API] Mapped billType: "${billType}"`);
      
      if (billType) {
        try {
          console.log(`[Congress API] Fetching bill details for ${congress}/${billType}/${number}`);
          // Try to get the specific bill directly
          const billDetails = await this.getBillDetails(congress, billType, number);
          if (billDetails.bill) {
            const bill = billDetails.bill;
            return [{
              congress: bill.congress,
              type: bill.type,
              number: bill.number,
              title: bill.title,
              latestAction: bill.latestAction,
              introducedDate: bill.introducedDate,
              originChamber: bill.originChamber,
              originChamberCode: bill.originChamberCode || (bill.originChamber === 'House' ? 'H' : 'S'),
              updateDate: bill.updateDate || new Date().toISOString(),
              url: bill.url || `https://api.congress.gov/v3/bill/${congress}/${billType}/${number}`,
              policyArea: bill.policyArea,
              sponsors: bill.sponsors,
            }];
          }
        } catch (e: any) {
          // Bill not found, fall through to text search
          console.log(`[Congress API] Bill lookup failed:`, e?.message || e);
        }
      }
    }
    
    // Fall back to text search: fetch bills and filter by title
    const allBills = await this.searchBills({ congress, limit: 250 });
    
    const searchLower = keyword.toLowerCase();
    return allBills.bills.filter(bill => 
      bill.title?.toLowerCase().includes(searchLower) ||
      `${bill.type}.${bill.number}`.toLowerCase().includes(searchLower.replace(/\s+/g, '').replace(/\./g, ''))
    ).slice(0, limit);
  }

  // Get all current members of Congress with pagination
  async getCurrentMembers(options: {
    chamber?: 'house' | 'senate';
    limit?: number;
  } = {}): Promise<SimpleMember[]> {
    const { chamber } = options;
    const allMembers: CongressMember[] = [];
    let offset = 0;
    const pageSize = 250;
    
    // Paginate through all results (Congress has ~535 members)
    while (offset < 600) {
      try {
        const response = await this.fetch<{
          members: CongressMember[];
        }>('/member', { 
          currentMember: 'true',
          limit: pageSize,
          offset
        });
        
        if (!response.members || response.members.length === 0) break;
        allMembers.push(...response.members);
        
        if (response.members.length < pageSize) break;
        offset += pageSize;
      } catch (e) {
        console.error(`Error fetching members at offset ${offset}:`, e);
        break;
      }
    }
    
    console.log(`[Congress API] Fetched ${allMembers.length} total current members`);

    let members = allMembers.map(m => {
      const currentTerm = m.terms?.item?.[m.terms.item.length - 1];
      // Normalize chamber to simple values
      const rawChamber = currentTerm?.chamber || 'Unknown';
      const normalizedChamber = rawChamber.toLowerCase().includes('senate') ? 'Senate' 
        : rawChamber.toLowerCase().includes('house') ? 'House' 
        : rawChamber;
      // Normalize party to abbreviation - API returns partyName like "Democratic", "Republican"
      const rawParty = m.partyName || m.party || '';
      const party = rawParty.toLowerCase().includes('republican') ? 'R'
        : rawParty.toLowerCase().includes('democrat') ? 'D'
        : rawParty === 'R' || rawParty === 'D' || rawParty === 'I' ? rawParty
        : rawParty.toLowerCase().includes('independent') ? 'I'
        : 'I';
      return {
        bioguideId: m.bioguideId,
        name: m.name,
        firstName: m.name.split(',')[1]?.trim().split(' ')[0] || m.name.split(' ')[0],
        lastName: m.name.split(',')[0]?.trim() || m.name,
        state: m.state,
        district: m.district,
        party,
        chamber: normalizedChamber,
        imageUrl: m.depiction?.imageUrl,
      } as SimpleMember;
    });

    // Filter by chamber if specified
    if (chamber === 'house') {
      members = members.filter(m => m.chamber === 'House');
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
      // Normalize chamber
      const rawChamber = currentTerm?.chamber || 'Unknown';
      const chamber = rawChamber.toLowerCase().includes('senate') ? 'Senate' 
        : rawChamber.toLowerCase().includes('house') ? 'House' 
        : rawChamber;
      // Normalize party to abbreviation - API may return partyName or party
      const rawParty = m.partyName || m.party || '';
      const party = rawParty.toLowerCase().includes('republican') ? 'R'
        : rawParty.toLowerCase().includes('democrat') ? 'D'
        : rawParty === 'R' || rawParty === 'D' || rawParty === 'I' ? rawParty
        : rawParty.toLowerCase().includes('independent') ? 'I'
        : 'I';
      
      return {
        bioguideId: m.bioguideId,
        name: m.name,
        firstName: m.firstName,
        lastName: m.lastName,
        state: m.state,
        district: m.district,
        party,
        chamber,
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
    
    // Split query into words for more flexible matching
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const stopWords = ['the', 'of', 'and', 'for', 'house', 'senate', 'speaker', 'leader', 'rep', 'sen', 'congressman', 'congresswoman', 'senator', 'representative'];
    const meaningfulWords = queryWords.filter(w => !stopWords.includes(w));
    
    return members.filter(m => {
      // Name match - check if any meaningful word matches name parts
      const nameLower = m.name.toLowerCase();
      const firstNameLower = m.firstName.toLowerCase();
      const lastNameLower = m.lastName.toLowerCase();
      
      const nameMatch = meaningfulWords.length === 0 || meaningfulWords.some(word => 
        nameLower.includes(word) ||
        firstNameLower.includes(word) ||
        lastNameLower.includes(word)
      );
      
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
  party?: string;
  partyName?: string;  // API returns partyName like "Democratic", "Republican"
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

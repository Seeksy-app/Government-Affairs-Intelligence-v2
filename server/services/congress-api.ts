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

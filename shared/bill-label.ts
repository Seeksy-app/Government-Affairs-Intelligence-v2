// Display helpers for tracked bills, shared by server (alerts, portal API) and
// client (Bills page) so federal and state bills are labeled the same way
// everywhere.

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "Washington D.C.",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export const LEGISCAN_ATTRIBUTION = "State legislative data provided by LegiScan, licensed under CC BY 4.0.";

const FEDERAL_TYPE_LABELS: Record<string, string> = {
  hr: "H.R.",
  s: "S.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
  hconres: "H.Con.Res.",
  sconres: "S.Con.Res.",
  hres: "H.Res.",
  sres: "S.Res.",
};

interface LabelableBill {
  jurisdiction?: string | null;
  billLabel?: string | null;
  congress: number;
  billType: string;
  billNumber: number;
}

// Tags are lowercase, hyphenated, no leading "#": " Q3 Priority " → "q3-priority".
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#+/, "").replace(/\s+/g, "-").slice(0, 40);
}

export function isStateBill(bill: { jurisdiction?: string | null }): boolean {
  return !!bill.jurisdiction && bill.jurisdiction !== "US";
}

// "TX HB1234" → "TX HB 1234"; leaves unusual formats untouched.
export function formatStateBillLabel(state: string, billNumber: string): string {
  return `${state} ${billNumber.replace(/^([A-Za-z]+)(\d)/, "$1 $2")}`;
}

export function trackedBillLabel(bill: LabelableBill): string {
  if (isStateBill(bill)) return bill.billLabel || `${bill.jurisdiction} bill`;
  const type = FEDERAL_TYPE_LABELS[bill.billType.toLowerCase()] || bill.billType.toUpperCase();
  return `${type} ${bill.billNumber}`;
}

export function jurisdictionName(bill: { jurisdiction?: string | null }): string {
  if (!isStateBill(bill)) return "Congress";
  return US_STATES[bill.jurisdiction!] || bill.jurisdiction!;
}

const CONGRESS_GOV_PATHS: Record<string, string> = {
  hr: "house-bill",
  s: "senate-bill",
  hjres: "house-joint-resolution",
  sjres: "senate-joint-resolution",
  hconres: "house-concurrent-resolution",
  sconres: "senate-concurrent-resolution",
  hres: "house-resolution",
  sres: "senate-resolution",
};

export function trackedBillUrl(bill: LabelableBill & { sourceUrl?: string | null }): string {
  if (isStateBill(bill)) return bill.sourceUrl || "https://legiscan.com";
  const path = CONGRESS_GOV_PATHS[bill.billType.toLowerCase()] || bill.billType;
  return `https://www.congress.gov/bill/${bill.congress}th-congress/${path}/${bill.billNumber}`;
}

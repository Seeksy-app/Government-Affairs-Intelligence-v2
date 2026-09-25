// Onboarding questions shared by the /onboarding page and the server.
// Firm-level answers live in client_profiles.onboarding (jsonb); each of the
// firm's own clients is a firm_clients row.

export type Opt<T extends string = string> = { value: T; label: string; hint?: string };

export const ROLES: Opt[] = [
  { value: "lobbyist", label: "Lobbyist" },
  { value: "lawyer", label: "Government affairs lawyer" },
  { value: "consultant", label: "Public affairs or policy consultant" },
  { value: "in_house", label: "In-house government affairs" },
  { value: "association", label: "Trade association or coalition" },
  { value: "other", label: "Something else" },
];

// Labels double as industry/topic terms for news scoring, so keep them plain.
export const POLICY_AREAS = [
  "Health care", "Medicare & Medicaid", "Veterans", "Defense", "Labor & workforce", "Tax",
  "Trade & tariffs", "Energy", "Environment", "Agriculture", "Transportation", "Technology & AI",
  "Telecommunications", "Financial services", "Housing", "Education", "Immigration",
  "Hospitality & travel", "Retail", "Manufacturing", "Pharmaceuticals", "Cannabis", "Gaming",
  "Appropriations",
];

// `value` is what's stored in client_profiles.relevantAgencies: it must resolve
// through agencySlugsFor() (press releases) and AGENCY_ALIASES (news scoring).
// `feed` marks agencies whose press releases we collect today.
export const AGENCIES: Array<{ value: string; label: string; feed: boolean }> = [
  { value: "VA", label: "Veterans Affairs", feed: true },
  { value: "DOD", label: "Defense", feed: true },
  { value: "HHS", label: "Health and Human Services", feed: true },
  { value: "CMS", label: "Medicare & Medicaid (CMS)", feed: true },
  { value: "FDA", label: "Food and Drug Administration", feed: true },
  { value: "DOL", label: "Labor", feed: true },
  { value: "Treasury", label: "Treasury and IRS", feed: true },
  { value: "DHS", label: "Homeland Security and FEMA", feed: true },
  { value: "NIST", label: "NIST", feed: true },
  { value: "White House", label: "The White House", feed: true },
  { value: "Commerce", label: "Commerce", feed: false },
  { value: "DOE", label: "Energy", feed: false },
  { value: "DOT", label: "Transportation and FAA", feed: false },
  { value: "DOJ", label: "Justice", feed: false },
  { value: "EPA", label: "EPA", feed: false },
];

export const COMMITTEES = [
  "House Ways and Means", "Senate Finance", "House Energy and Commerce", "Senate HELP",
  "House Appropriations", "Senate Appropriations", "House Armed Services", "Senate Armed Services",
  "House Veterans' Affairs", "Senate Veterans' Affairs", "House Education and the Workforce",
  "House Financial Services", "Senate Banking", "House Judiciary", "Senate Judiciary",
  "House Transportation and Infrastructure", "Senate Commerce", "House Agriculture", "Senate Agriculture",
  "House Homeland Security", "Senate Homeland Security",
];

export const STATES: Array<[string, string]> = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
  ["PR", "Puerto Rico"],
];

// "What usually makes a client pick up the phone?"
export const TRIGGERS: Opt[] = [
  { value: "headline", label: "A scary headline" },
  { value: "bill_moves", label: "A bill moves: markup, floor vote" },
  { value: "hearing", label: "A hearing is announced" },
  { value: "proposed_rule", label: "A proposed rule or comment deadline" },
  { value: "exec_order", label: "An executive order" },
  { value: "appropriations", label: "Appropriations or a funding rider" },
  { value: "enforcement", label: "Agency enforcement or guidance" },
  { value: "state_action", label: "State legislature action" },
  { value: "election", label: "An election or leadership change" },
];

export const WEATHER_IMPACT: Opt<"often" | "sometimes" | "rarely">[] = [
  { value: "often", label: "Often", hint: "Fly-ins, hearings and votes move with the weather, or storms hit our clients' operations." },
  { value: "sometimes", label: "Sometimes", hint: "Worth a glance — mostly when something big is coming." },
  { value: "rarely", label: "Rarely", hint: "Keep weather off my dashboard." },
];

export const MARKETS_INTEREST: Opt<"yes" | "sometimes" | "no">[] = [
  { value: "yes", label: "Yes, show them", hint: "Election and policy odds from Kalshi, on your Today page." },
  { value: "sometimes", label: "Keep them handy", hint: "Available under Markets, not on Today." },
  { value: "no", label: "Not for us" },
];

export type AiComfort = "daily" | "apis" | "never" | "dislikes" | "unsure";

export const AI_COMFORT: Opt<AiComfort>[] = [
  { value: "daily", label: "I use it daily", hint: "ChatGPT, Claude or similar for questions and drafts." },
  { value: "apis", label: "We build with it", hint: "Our team uses AI tools or APIs in our own work." },
  { value: "never", label: "We never use it", hint: "We haven't brought it into our work yet." },
  { value: "dislikes", label: "I'd rather not use it", hint: "I'm skeptical of it, and I want to see the sources." },
];

export const CLIENT_AI_COMFORT: Opt<AiComfort>[] = [...AI_COMFORT, { value: "unsure", label: "Not sure" }];

export type Proactive = "yes" | "ask" | "no";
export const PROACTIVE: Opt<Proactive>[] = [
  { value: "yes", label: "Yes, get ahead of it", hint: "Today suggests a question about this client, so you can have the answer before they call." },
  { value: "ask", label: "I'll decide case by case", hint: "They're one tap away when you ask a question, but nothing is suggested." },
  { value: "no", label: "Only when they ask", hint: "This client prefers not to hear from us unprompted." },
];

export type Sharing = "portal" | "direct" | "mix";
export const SHARING: Opt<Sharing>[] = [
  { value: "portal", label: "A secure client portal", hint: "A page for this client with only the briefs and updates you choose to share. We set it up switched off until you're ready." },
  { value: "direct", label: "I'll communicate directly", hint: "Email, calls and meetings. Nothing is shared from here." },
  { value: "mix", label: "A mix — I decide what they see", hint: "A portal for some things, direct contact for the rest. Nothing reaches them without your say." },
];

export interface FirmOnboarding {
  role?: string;
  triggers?: string[];
  weather?: "often" | "sometimes" | "rarely";
  markets?: "yes" | "sometimes" | "no";
  aiComfort?: AiComfort;
  /** Last chapter the user reached, so a return visit resumes there. */
  step?: number;
}

export const AVOID_EXAMPLES = [
  "Don't call it a \"loophole\" — it's a \"provision\"",
  "Never mention the pending lawsuit",
  "No vote-count predictions",
  "Don't name their competitors",
];

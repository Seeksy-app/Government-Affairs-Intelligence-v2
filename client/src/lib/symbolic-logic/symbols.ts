export type SymbolImpact = "positive" | "negative" | "neutral";

export type LogicSymbol = {
  id: string;
  label: string;
  description: string;
  impact: SymbolImpact;
  examplePhrases: string[];
};

export const LOGIC_SYMBOLS: LogicSymbol[] = [
  {
    id: "POLICY_MENTIONED",
    label: "Policy Mentioned",
    description: "The article discusses a policy, rule, law, or program.",
    impact: "neutral",
    examplePhrases: ["policy", "rule", "program", "initiative", "law", "act"],
  },
  {
    id: "FUNDING_INCREASE",
    label: "Funding Increase",
    description: "The article suggests new or increased funding.",
    impact: "positive",
    examplePhrases: ["funding", "grant", "investment", "appropriation", "awarded"],
  },
  {
    id: "FUNDING_DECREASE",
    label: "Funding Decrease",
    description: "The article suggests reduced funding or cuts.",
    impact: "negative",
    examplePhrases: ["cut", "reduction", "reduced funding", "budget decrease"],
  },
  {
    id: "REGULATORY_RISK",
    label: "Regulatory Risk",
    description: "The article suggests compliance burden, restrictions, penalties, or oversight.",
    impact: "negative",
    examplePhrases: ["regulation", "compliance", "penalty", "oversight", "enforcement"],
  },
  {
    id: "CLIENT_OPPORTUNITY",
    label: "Client Opportunity",
    description: "The article may create a business, policy, funding, or advocacy opportunity.",
    impact: "positive",
    examplePhrases: ["opportunity", "eligible", "expansion", "new program", "available"],
  },
  {
    id: "CLIENT_THREAT",
    label: "Client Threat",
    description: "The article may create risk, opposition, cost, or reputational concern.",
    impact: "negative",
    examplePhrases: ["threat", "risk", "challenge", "concern", "opposition"],
  },
  {
    id: "MEDIA_ATTENTION",
    label: "Media Attention",
    description: "The article indicates public or media visibility.",
    impact: "neutral",
    examplePhrases: ["reported", "media", "headline", "public attention"],
  },
  {
    id: "AGENCY_ACTION",
    label: "Agency Action",
    description: "A government agency is acting, announcing, enforcing, or funding.",
    impact: "neutral",
    examplePhrases: ["department", "agency", "announced", "secretary", "administration"],
  },
  {
    id: "LEGISLATIVE_ACTION",
    label: "Legislative Action",
    description: "Congress or a legislature is acting on a bill, hearing, or vote.",
    impact: "neutral",
    examplePhrases: ["bill", "congress", "senate", "house", "committee", "hearing", "vote"],
  },
  {
    id: "URGENCY_HIGH",
    label: "High Urgency",
    description: "The article suggests immediate timing or near-term decision impact.",
    impact: "negative",
    examplePhrases: ["immediately", "deadline", "today", "urgent", "effective", "within 30 days"],
  },
];

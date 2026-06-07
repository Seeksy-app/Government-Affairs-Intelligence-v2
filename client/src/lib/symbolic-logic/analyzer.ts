import { LOGIC_SYMBOLS } from "./symbols";

export type SymbolicAnalysisInput = {
  clientObjective: string;
  clientProfile?: string;
  articleTitle: string;
  articleSource?: string;
  articleText: string;
};

export type DetectedSymbol = {
  id: string;
  label: string;
  impact: string;
  description?: string;
  evidence: string[];
};

export type LogicFinding = {
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
};

export type SymbolicAnalysisResult = {
  summary: string;
  extractedClaims: string[];
  detectedSymbols: DetectedSymbol[];
  symbolicExpression: string;
  assumptions: LogicFinding[];
  gapsOrContradictions: LogicFinding[];
  recommendedActions: string[];
  conclusion: string;
  conclusionType: "opportunity" | "threat" | "monitor";
  confidence: number;
};

function getSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function findEvidence(text: string, phrases: string[]) {
  const sentences = getSentences(text);

  return sentences
    .filter((sentence) =>
      phrases.some((phrase) =>
        sentence.toLowerCase().includes(phrase.toLowerCase())
      )
    )
    .slice(0, 3);
}

function includesAny(text: string, phrases: string[]) {
  const lowered = text.toLowerCase();
  return phrases.some((phrase) => lowered.includes(phrase.toLowerCase()));
}

function extractClaims(articleText: string) {
  const sentences = getSentences(articleText);

  const claimSignals = [
    "announced",
    "will",
    "would",
    "could",
    "must",
    "requires",
    "expands",
    "reduces",
    "funding",
    "grant",
    "program",
    "deadline",
    "effective",
    "eligible",
    "compliance",
    "oversight",
  ];

  const scored = sentences
    .map((sentence) => ({
      sentence,
      score: claimSignals.reduce(
        (count, signal) =>
          sentence.toLowerCase().includes(signal) ? count + 1 : count,
        0
      ),
    }))
    .sort((a, b) => b.score - a.score);

  return scored
    .filter((item) => item.score > 0)
    .map((item) => item.sentence)
    .slice(0, 7);
}

function buildAssumptions(input: SymbolicAnalysisInput, ids: string[]): LogicFinding[] {
  const assumptions: LogicFinding[] = [];

  if (ids.includes("FUNDING_INCREASE")) {
    assumptions.push({
      title: "Funding relevance",
      detail: "The analysis assumes the client can benefit from, influence, or respond to the funding mentioned in the source.",
      severity: "medium",
    });
  }

  if (ids.includes("REGULATORY_RISK")) {
    assumptions.push({
      title: "Regulatory exposure",
      detail: "The analysis assumes the client or its stakeholders may be affected by the compliance or oversight language.",
      severity: "high",
    });
  }

  if (input.clientProfile && input.clientProfile.trim().length > 20) {
    assumptions.push({
      title: "Client profile alignment",
      detail: "The client profile is used to interpret relevance, but source evidence still comes only from the article text.",
      severity: "low",
    });
  }

  if (!assumptions.length) {
    assumptions.push({
      title: "Limited signal",
      detail: "The source has limited policy, funding, regulatory, or timing signals, so the safest assumption is to monitor.",
      severity: "low",
    });
  }

  return assumptions;
}

function buildGapsOrContradictions(input: SymbolicAnalysisInput, ids: string[]): LogicFinding[] {
  const fullText = `${input.articleTitle} ${input.articleText}`;
  const gaps: LogicFinding[] = [];

  if (ids.includes("FUNDING_INCREASE") && !includesAny(fullText, ["amount", "$", "million", "billion", "appropriation"])) {
    gaps.push({
      title: "Funding amount unclear",
      detail: "The source suggests funding, but does not clearly show the dollar amount or size of the opportunity.",
      severity: "medium",
    });
  }

  if ((ids.includes("AGENCY_ACTION") || ids.includes("LEGISLATIVE_ACTION")) && !ids.includes("URGENCY_HIGH")) {
    gaps.push({
      title: "Timeline unclear",
      detail: "The source shows government action, but the timing or decision window is not clearly urgent.",
      severity: "medium",
    });
  }

  if (ids.includes("CLIENT_OPPORTUNITY") && ids.includes("CLIENT_THREAT")) {
    gaps.push({
      title: "Mixed opportunity and risk",
      detail: "The source contains both positive and negative client signals, so the recommendation should be reviewed before outreach.",
      severity: "high",
    });
  }

  if (!includesAny(fullText, ["who", "eligible", "applicant", "contractor", "provider", "veteran", "small business", "state", "local"])) {
    gaps.push({
      title: "Affected parties unclear",
      detail: "The source does not clearly identify who is eligible, affected, or responsible for action.",
      severity: "medium",
    });
  }

  return gaps;
}

function buildRecommendedActions(ids: string[], conclusionType: "opportunity" | "threat" | "monitor") {
  if (conclusionType === "opportunity") {
    return [
      "Prepare a short client brief explaining the opportunity, source evidence, and likely next step.",
      "Identify the agency, program office, committee, or funding source connected to the action.",
      "Create an outreach list for relevant staff, stakeholders, or coalition partners.",
    ];
  }

  if (conclusionType === "threat") {
    return [
      "Prepare a risk memo summarizing the rule, enforcement action, or compliance burden.",
      "Check whether the client or its stakeholders are directly covered by the action.",
      "Recommend monitoring, comment submission, coalition response, or direct outreach.",
    ];
  }

  if (ids.includes("URGENCY_HIGH")) {
    return [
      "Flag for near-term review because the source contains timing or deadline language.",
      "Confirm whether the client needs to respond, brief leadership, or monitor follow-up action.",
    ];
  }

  return [
    "Monitor for follow-up articles, agency notices, bill movement, or funding announcements.",
    "Do not escalate yet unless new evidence connects the item directly to the client objective.",
  ];
}

export function analyzeSymbolicLogic(input: SymbolicAnalysisInput): SymbolicAnalysisResult {
  const fullText = `${input.articleTitle} ${input.articleText}`;

  const detectedSymbols = LOGIC_SYMBOLS.map((symbol) => {
    const evidence = findEvidence(fullText, symbol.examplePhrases);
    if (!evidence.length) return null;

    return {
      id: symbol.id,
      label: symbol.label,
      impact: symbol.impact,
      description: symbol.description,
      evidence,
    };
  }).filter(Boolean) as DetectedSymbol[];

  const ids = detectedSymbols.map((s) => s.id);

  let conclusionType: "opportunity" | "threat" | "monitor" = "monitor";
  let conclusionSymbol = "MONITOR";
  let conclusion = "This item should be monitored. The current evidence does not yet prove a clear client opportunity or threat.";

  const hasGovernmentAction = ids.includes("AGENCY_ACTION") || ids.includes("LEGISLATIVE_ACTION");
  const hasPolicySignal = ids.includes("POLICY_MENTIONED");
  const hasFundingSignal = ids.includes("FUNDING_INCREASE");
  const hasRiskSignal = ids.includes("REGULATORY_RISK") || ids.includes("FUNDING_DECREASE") || ids.includes("CLIENT_THREAT");

  if (hasPolicySignal && hasGovernmentAction && hasFundingSignal) {
    conclusionType = "opportunity";
    conclusionSymbol = "CLIENT_OPPORTUNITY";
    conclusion = "This is a likely client opportunity because the source connects policy activity, government action, and funding.";
  }

  if (hasRiskSignal && hasGovernmentAction) {
    conclusionType = "threat";
    conclusionSymbol = "CLIENT_THREAT";
    conclusion = "This is a likely client threat because the source connects government action with risk, restriction, funding loss, or compliance burden.";
  }

  if (ids.includes("URGENCY_HIGH")) {
    conclusion += " Timing appears important, so this should be reviewed quickly.";
  }

  const symbolicExpression = ids.length
    ? `IF ${ids.join(" AND ")} THEN ${conclusionSymbol}`
    : "IF NO_RELEVANT_SYMBOLS_DETECTED THEN MONITOR";

  const extractedClaims = extractClaims(input.articleText);
  const assumptions = buildAssumptions(input, ids);
  const gapsOrContradictions = buildGapsOrContradictions(input, ids);
  const recommendedActions = buildRecommendedActions(ids, conclusionType);

  const positiveCount = detectedSymbols.filter((s) => s.impact === "positive").length;
  const negativeCount = detectedSymbols.filter((s) => s.impact === "negative").length;
  const evidenceCount = detectedSymbols.reduce((total, symbol) => total + symbol.evidence.length, 0);
  const gapPenalty = gapsOrContradictions.length * 5;

  const confidence = Math.max(
    35,
    Math.min(95, 45 + detectedSymbols.length * 6 + evidenceCount * 2 + Math.max(positiveCount, negativeCount) * 3 - gapPenalty)
  );

  return {
    summary: `Analyzed "${input.articleTitle}" against objective: "${input.clientObjective}".`,
    extractedClaims: extractedClaims.length ? extractedClaims : getSentences(input.articleText).slice(0, 5),
    detectedSymbols,
    symbolicExpression,
    assumptions,
    gapsOrContradictions,
    recommendedActions,
    conclusion,
    conclusionType,
    confidence,
  };
}

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
  evidence: string[];
};

export type SymbolicAnalysisResult = {
  summary: string;
  extractedClaims: string[];
  detectedSymbols: DetectedSymbol[];
  symbolicExpression: string;
  conclusion: string;
  confidence: number;
};

function findEvidence(text: string, phrases: string[]) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return sentences.filter((sentence) =>
    phrases.some((phrase) =>
      sentence.toLowerCase().includes(phrase.toLowerCase())
    )
  ).slice(0, 3);
}

export function analyzeSymbolicLogic(input: SymbolicAnalysisInput): SymbolicAnalysisResult {
  // Detect symbols from the source content only.
  // Client objective/profile should guide interpretation later, but should not create false evidence.
  const fullText = `${input.articleTitle} ${input.articleText}`;

  const detectedSymbols = LOGIC_SYMBOLS.map((symbol) => {
    const evidence = findEvidence(fullText, symbol.examplePhrases);
    if (!evidence.length) return null;

    return {
      id: symbol.id,
      label: symbol.label,
      impact: symbol.impact,
      evidence,
    };
  }).filter(Boolean) as DetectedSymbol[];

  const ids = detectedSymbols.map((s) => s.id);

  let conclusionSymbol = "MONITOR";
  let conclusion = "This item should be monitored, but the demo rules do not yet show a clear opportunity or threat.";

  if (ids.includes("POLICY_MENTIONED") && ids.includes("AGENCY_ACTION") && ids.includes("FUNDING_INCREASE")) {
    conclusionSymbol = "CLIENT_OPPORTUNITY";
    conclusion = "This may be an opportunity because the article connects policy activity, agency action, and funding.";
  }

  if (ids.includes("REGULATORY_RISK") && (ids.includes("AGENCY_ACTION") || ids.includes("LEGISLATIVE_ACTION"))) {
    conclusionSymbol = "CLIENT_THREAT";
    conclusion = "This may be a client threat because the article connects government action with regulatory or compliance risk.";
  }

  if (ids.includes("URGENCY_HIGH")) {
    conclusion += " Timing appears important, so this should be reviewed quickly.";
  }

  const expression = ids.length
    ? `IF ${ids.join(" AND ")} THEN ${conclusionSymbol}`
    : "IF NO_RELEVANT_SYMBOLS_DETECTED THEN MONITOR";

  const extractedClaims = input.articleText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    summary: `Analyzed "${input.articleTitle}" against objective: "${input.clientObjective}".`,
    extractedClaims,
    detectedSymbols,
    symbolicExpression: expression,
    conclusion,
    confidence: Math.min(95, 45 + detectedSymbols.length * 8),
  };
}

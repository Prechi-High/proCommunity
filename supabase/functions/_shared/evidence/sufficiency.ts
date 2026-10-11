export type ScoreDisplay = "numeric" | "limited" | "unavailable";

export const SUFFICIENCY_THRESHOLDS = {
  minEvidenceItems: 3,
  minUniqueSources: 2,
  minAvgRelevanceConfidence: 0.65,
  minAvgProductMatchConfidence: 0.72,
  maxConfidenceWhenInsufficient: 0.35,
  /** Minimum count of numeric dimensions before overall score is allowed. */
  minNumericDimensionsForOverall: 3,
  /** Alternatively, this fraction of primary blueprint dimensions must be numeric. */
  minNumericDimensionShareForOverall: 0.5,
} as const;

/** Whether an overall numeric product score may be shown in dynamic mode. */
export function evaluateOverallScoreEligibility(
  numericDimensionCount: number,
  primaryDimensionCount: number,
): boolean {
  if (numericDimensionCount >= SUFFICIENCY_THRESHOLDS.minNumericDimensionsForOverall) return true;
  if (primaryDimensionCount <= 0) return false;
  return numericDimensionCount / primaryDimensionCount >= SUFFICIENCY_THRESHOLDS.minNumericDimensionShareForOverall;
}

export type ScoringEvidenceItem = {
  evidenceId: string;
  platform: string;
  author?: string;
  url?: string;
  conversationId?: string;
  relevanceConfidence: number;
  productMatchConfidence: number;
  affectsScore: boolean;
  provenanceWeight?: number;
};

export function uniqueEvidenceSourceKey(item: ScoringEvidenceItem): string {
  const platform = (item.platform || "unknown").toLowerCase();
  const author = item.author?.trim();
  if (author) return `${platform}|author:${author.toLowerCase()}`;
  const url = item.url?.trim();
  if (url) return `${platform}|url:${url.toLowerCase()}`;
  return `${platform}|id:${item.evidenceId}`;
}

export function countUniqueSources(items: ScoringEvidenceItem[]): number {
  return new Set(items.map(uniqueEvidenceSourceKey)).size;
}

export type SufficiencyResult = {
  scoreDisplay: ScoreDisplay;
  sufficientForNumericScore: boolean;
  uniqueSources: number;
  avgRelevance: number;
  avgProductMatch: number;
  validatedReportCount: number;
};

export type SufficiencyDiagnostics = SufficiencyResult & {
  scoringItemsCount: number;
  uniqueAuthors: number;
  uniqueVideos: number;
  uniqueConversations: number;
  failedConditions: string[];
  /** Human-readable reason the UI shows Limited / numeric / unavailable. */
  displayReason: string;
  agreement?: number;
};

function uniqueAuthors(items: ScoringEvidenceItem[]): number {
  return new Set(items.map((i) => (i.author ?? "").trim().toLowerCase()).filter(Boolean)).size;
}

function uniqueVideos(items: ScoringEvidenceItem[]): number {
  return new Set(items.map((i) => i.conversationId).filter(Boolean)).size;
}

function uniqueConversations(items: ScoringEvidenceItem[]): number {
  return new Set(items.map((i) => i.conversationId ?? i.evidenceId).filter(Boolean)).size;
}

export function evaluateDimensionSufficiencyWithDiagnostics(
  scoringItems: ScoringEvidenceItem[],
): SufficiencyDiagnostics {
  const validated = scoringItems.filter((i) => i.affectsScore);
  const base = evaluateDimensionSufficiency(scoringItems);
  const failed: string[] = [];
  if (validated.length < SUFFICIENCY_THRESHOLDS.minEvidenceItems) {
    failed.push(`minEvidenceItems:${validated.length}<${SUFFICIENCY_THRESHOLDS.minEvidenceItems}`);
  }
  if (base.uniqueSources < SUFFICIENCY_THRESHOLDS.minUniqueSources) {
    failed.push(`minUniqueSources:${base.uniqueSources}<${SUFFICIENCY_THRESHOLDS.minUniqueSources}`);
  }
  if (base.avgRelevance < SUFFICIENCY_THRESHOLDS.minAvgRelevanceConfidence) {
    failed.push(
      `minAvgRelevanceConfidence:${base.avgRelevance.toFixed(3)}<${SUFFICIENCY_THRESHOLDS.minAvgRelevanceConfidence}`,
    );
  }
  if (base.avgProductMatch < SUFFICIENCY_THRESHOLDS.minAvgProductMatchConfidence) {
    failed.push(
      `minAvgProductMatchConfidence:${base.avgProductMatch.toFixed(3)}<${SUFFICIENCY_THRESHOLDS.minAvgProductMatchConfidence}`,
    );
  }

  let displayReason = "No validated score-affecting evidence.";
  if (base.scoreDisplay === "unavailable") {
    displayReason = "No validated score-affecting dimension links.";
  } else if (base.scoreDisplay === "limited") {
    displayReason =
      failed.length > 0
        ? `Limited evidence — sufficiency gate: ${failed.join("; ")}`
        : "Limited evidence — insufficient validated diversity or match quality.";
  } else {
    displayReason = "Numeric score — all sufficiency thresholds met.";
  }

  return {
    ...base,
    scoringItemsCount: validated.length,
    uniqueAuthors: uniqueAuthors(validated),
    uniqueVideos: uniqueVideos(validated),
    uniqueConversations: uniqueConversations(validated),
    failedConditions: failed,
    displayReason,
  };
}

export function evaluateDimensionSufficiency(scoringItems: ScoringEvidenceItem[]): SufficiencyResult {
  const validated = scoringItems.filter((i) => i.affectsScore);
  const n = validated.length;
  if (n === 0) {
    return {
      scoreDisplay: "unavailable",
      sufficientForNumericScore: false,
      uniqueSources: 0,
      avgRelevance: 0,
      avgProductMatch: 0,
      validatedReportCount: 0,
    };
  }

  const uniqueSources = countUniqueSources(validated);
  const avgRelevance = validated.reduce((a, i) => a + i.relevanceConfidence, 0) / n;
  const avgProductMatch = validated.reduce((a, i) => a + i.productMatchConfidence, 0) / n;

  const meets =
    n >= SUFFICIENCY_THRESHOLDS.minEvidenceItems &&
    uniqueSources >= SUFFICIENCY_THRESHOLDS.minUniqueSources &&
    avgRelevance >= SUFFICIENCY_THRESHOLDS.minAvgRelevanceConfidence &&
    avgProductMatch >= SUFFICIENCY_THRESHOLDS.minAvgProductMatchConfidence;

  return {
    scoreDisplay: meets ? "numeric" : "limited",
    sufficientForNumericScore: meets,
    uniqueSources,
    avgRelevance,
    avgProductMatch,
    validatedReportCount: n,
  };
}

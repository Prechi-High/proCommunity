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
  relevanceConfidence: number;
  productMatchConfidence: number;
  affectsScore: boolean;
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

/** Calibrated relevance / match confidence tiers (system-wide). */

export const RELEVANCE_REJECT_BELOW = 0.5;
export const RELEVANCE_CANDIDATE_MIN = 0.6;
export const RELEVANCE_PLAUSIBLE_MIN = 0.7;
export const RELEVANCE_STRONG_MIN = 0.8;
export const RELEVANCE_EXPLICIT_MIN = 0.9;

export const MATCH_EXPLICIT_EXACT = 0.92;
export const MATCH_CONTEXTUAL_EXACT = 0.84;
export const MATCH_BRAND_LINE = 0.78;
export const MATCH_SIBLING_VARIANT = 0.58;
export const MATCH_RELATED_GENERATION = 0.52;
export const MATCH_COMPARISON_ISOLATED = 0.8;
export const MATCH_AMBIGUOUS = 0.48;
export const MATCH_REJECT = 0.15;

export function clampConfidence(n: number): number {
  return Math.min(0.99, Math.max(0.05, Math.round(n * 1000) / 1000));
}

export function tierLabel(confidence: number): "explicit" | "strong" | "clear" | "plausible" | "candidate" | "reject" {
  if (confidence >= RELEVANCE_EXPLICIT_MIN) return "explicit";
  if (confidence >= RELEVANCE_STRONG_MIN) return "strong";
  if (confidence >= RELEVANCE_PLAUSIBLE_MIN) return "clear";
  if (confidence >= RELEVANCE_CANDIDATE_MIN) return "plausible";
  if (confidence >= RELEVANCE_REJECT_BELOW) return "candidate";
  return "reject";
}

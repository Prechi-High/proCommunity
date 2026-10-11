import type { EnrichedDimensionDef } from "../../blueprint/dimensionSemantics.ts";
import type { ProductClassification } from "../../blueprint/types.ts";
import {
  clampConfidence,
  RELEVANCE_CANDIDATE_MIN,
  RELEVANCE_EXPLICIT_MIN,
  RELEVANCE_PLAUSIBLE_MIN,
  RELEVANCE_REJECT_BELOW,
  RELEVANCE_STRONG_MIN,
} from "../confidence/tiers.ts";
import type { EvidenceSourceContext } from "../identity/sourceContext.ts";
import { lexiconCandidateScore } from "./lexiconCandidates.ts";

export type SemanticRelevanceResult = {
  ok: boolean;
  confidence: number;
  reason: string;
  extractedStatement: string;
};

function tokenHits(text: string, phrases: string[]): number {
  const low = text.toLowerCase();
  let hits = 0;
  for (const p of phrases) {
    if (p.length < 3) continue;
    if (low.includes(p.toLowerCase())) hits++;
  }
  return hits;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
}

export function scoreStatementForDimension(
  fullText: string,
  dim: EnrichedDimensionDef,
  classification?: ProductClassification,
  context?: EvidenceSourceContext,
): SemanticRelevanceResult {
  const sentences = splitSentences(fullText);
  const pool = sentences.length ? sentences : [fullText.trim()];

  let bestSentence = pool[0] ?? fullText;
  let bestScore = 0;
  let bestReason = "no_semantic_support";

  for (const sentence of pool) {
    const low = sentence.toLowerCase();
    const excluded = tokenHits(sentence, dim.excludedConcepts);
    if (excluded >= 2) continue;

    const dimHay = `${dim.key} ${dim.label}`.toLowerCase();
    if (/purity|certification/.test(dimHay) && /\b(best value|good value|worth the (money|price)|bang for)\b/i.test(sentence)) {
      continue;
    }
    if (/purity|certification/.test(dimHay) && /\b(versatile|versatility|multi[- ]?use)\b/i.test(sentence) && !/\b(organic|pure|virgin|unrefined|certif)\b/i.test(sentence)) {
      continue;
    }
    if (dim.key === "absorption" && /\b(least moistur|not moistur|dry skin|hydrat)\b/i.test(sentence) && !/\b(absorb|greasy|sticky|film|soak)\b/i.test(sentence)) {
      continue;
    }
    if (dim.key === "hydration" && /\b(absorb|soak in|sinks in)\b/i.test(sentence) && !/\b(moistur|hydrat|dry)\b/i.test(sentence)) {
      continue;
    }

    const relatedHits = tokenHits(sentence, dim.relatedConcepts);
    const posHits = tokenHits(sentence, dim.positiveSignals);
    const negHits = tokenHits(sentence, dim.negativeSignals);
    const kwHits = dim.keywords.filter((k) => k.length > 2 && low.includes(k.toLowerCase())).length;

    const lex = lexiconCandidateScore(dim.key, sentence);

    let score = 0;
    let reason = "no_semantic_support";

    if (lex >= RELEVANCE_STRONG_MIN) {
      score = lex;
      reason = "lexicon_strong";
    } else if (relatedHits >= 2 || (relatedHits >= 1 && kwHits >= 1)) {
      score = clampConfidence(RELEVANCE_STRONG_MIN + Math.min(0.08, relatedHits * 0.03));
      reason = "related_concepts";
    } else if (relatedHits === 1 || kwHits >= 2) {
      score = clampConfidence(RELEVANCE_PLAUSIBLE_MIN + kwHits * 0.02);
      reason = "concept_keyword_blend";
    } else if (kwHits === 1) {
      score = clampConfidence(RELEVANCE_CANDIDATE_MIN);
      reason = "keyword_candidate";
    } else if (lex >= RELEVANCE_CANDIDATE_MIN) {
      score = lex;
      reason = "lexicon_candidate";
    }

    if (excluded === 1) score = Math.max(RELEVANCE_REJECT_BELOW, score - 0.12);

    if (/irritat|sensitiv|rash|breakout/.test(`${dim.key} ${dim.label}`)) {
      if (/\b(broke out|broke me out|break out|rash|burn|sting|irritat|redness)\b/i.test(sentence)) {
        score = Math.max(score, RELEVANCE_EXPLICIT_MIN);
        reason = "risk_factor_signal";
      }
    }

    if (context?.contextKind === "exact_product_review" && score > 0 && score < RELEVANCE_PLAUSIBLE_MIN) {
      score = clampConfidence(score + 0.06);
    }

    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
      bestReason = reason;
    }
  }

  const genericOnly = /^(mine is amazing|it's amazing|love it|great product)\.?$/i.test(bestSentence.trim());
  if (genericOnly) {
    return {
      ok: false,
      confidence: clampConfidence(RELEVANCE_REJECT_BELOW),
      reason: "generic_praise_no_dimension_signal",
      extractedStatement: bestSentence.slice(0, 420),
    };
  }

  const ok = bestScore >= RELEVANCE_REJECT_BELOW;
  return {
    ok,
    confidence: clampConfidence(bestScore),
    reason: bestReason,
    extractedStatement: bestSentence.slice(0, 420),
  };
}

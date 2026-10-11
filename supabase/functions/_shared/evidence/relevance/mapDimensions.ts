import { enrichDimensionSemantics, type EnrichedDimensionDef } from "../../blueprint/dimensionSemantics.ts";
import type { BlueprintDimensionDef, ProductClassification } from "../../blueprint/types.ts";
import { RELEVANCE_REJECT_BELOW } from "../confidence/tiers.ts";
import type { EvidenceSourceContext } from "../identity/sourceContext.ts";
import type { DimensionRelevanceResult, EvidenceStance } from "../types.ts";
import { lexiconMightMatch } from "./lexiconCandidates.ts";
import { scoreStatementForDimension } from "./semanticScore.ts";

function stanceFromText(text: string): EvidenceStance {
  const pos = /\b(love|great|excellent|amazing|recommend|perfect|best|quick|fast|smooth|still|decent)\b/i.test(text);
  const neg = /\b(bad|terrible|hate|worst|awful|disappoint|regret|avoid|poor|slow|broke out|irritat)\b/i.test(text);
  if (pos && neg) return "mixed";
  if (neg) return "negative";
  if (pos) return "positive";
  return "neutral";
}

export type DimensionMappingContext = {
  classification?: ProductClassification;
  sourceContext?: EvidenceSourceContext;
};

/** Blueprint-driven semantic mapper (keywords → candidates, semantics → final). */
export function mapTextToDimensions(
  text: string,
  dimensions: BlueprintDimensionDef[],
  productAffectsScore: boolean,
  ctx?: DimensionMappingContext,
): DimensionRelevanceResult[] {
  if (!productAffectsScore || !text.trim()) return [];

  const enriched = dimensions.map((d) => enrichDimensionSemantics(d, ctx?.classification));

  const candidates = enriched.filter((d) => {
    const low = text.toLowerCase();
    const kw = d.keywords.some((k) => k.length > 2 && low.includes(k.toLowerCase()));
    const concept = d.relatedConcepts.some((c) => c.length > 3 && low.includes(c.toLowerCase()));
    const lex = lexiconMightMatch(d.key, text);
    const dimHint = low.includes(d.key.replace(/_/g, " ")) || low.includes(d.label.toLowerCase());
    return kw || concept || lex || dimHint;
  });

  const out: DimensionRelevanceResult[] = [];
  for (const dim of candidates) {
    const sem = scoreStatementForDimension(text, dim, ctx?.classification, ctx?.sourceContext);
    if (!sem.ok || sem.confidence < RELEVANCE_REJECT_BELOW) continue;
    const stance = stanceFromText(sem.extractedStatement);
    const strength = Math.min(0.95, sem.confidence * (stance === "mixed" ? 0.78 : 0.92));
    out.push({
      dimensionKey: dim.key,
      relevanceConfidence: sem.confidence,
      stance,
      strength,
      affectsScore: true,
      reason: sem.reason,
      extractedStatement: sem.extractedStatement,
    });
  }
  return out;
}

export function extractDimensionStatement(
  text: string,
  dim: BlueprintDimensionDef,
  ctx?: DimensionMappingContext,
): string {
  const enriched = enrichDimensionSemantics(dim, ctx?.classification);
  return scoreStatementForDimension(text, enriched, ctx?.classification, ctx?.sourceContext).extractedStatement;
}

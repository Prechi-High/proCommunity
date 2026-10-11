import type { BlueprintDimensionDef } from "../blueprint/types.ts";
import { collectRawEvidenceFromProfile } from "./collect.ts";
import { mapStatementToDimensions } from "./dimensionRelevance.ts";
import { assessProductEvidenceMatch, type TargetProduct } from "./identityGate.ts";
import {
  evaluateDimensionSufficiency,
  SUFFICIENCY_THRESHOLDS,
  type ScoreDisplay,
  type ScoringEvidenceItem,
} from "./sufficiency.ts";
import type { DimensionExperiencePackage, DimensionScoreBundle, NormalizedEvidenceRow } from "./types.ts";

export const DIMENSION_EVIDENCE_ALGO = "dim-evidence-v1";
export { evaluateDimensionSufficiency, SUFFICIENCY_THRESHOLDS } from "./sufficiency.ts";

function hashId(productId: string, text: string): string {
  let h = 0;
  const s = `${productId}:${text}`.toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `evi_${h.toString(36)}`;
}

function buildFinding(
  label: string,
  pos: number,
  mix: number,
  neg: number,
  scoreDisplay: ScoreDisplay,
  validatedCount: number,
  sample?: string,
): string {
  if (scoreDisplay === "unavailable") {
    return "Not enough validated owner reports yet for a clear read on this area.";
  }
  if (scoreDisplay === "limited") {
    const prefix =
      validatedCount <= 2
        ? `Early signal — based on ${validatedCount} validated owner report${validatedCount === 1 ? "" : "s"}.`
        : `Limited evidence — based on ${validatedCount} validated reports.`;
    return prefix;
  }
  const parts: string[] = [];
  if (pos > neg && pos >= mix) parts.push(`Most validated owner reports lean positive on ${label.toLowerCase()}.`);
  else if (neg > pos) parts.push(`Several owners report concerns about ${label.toLowerCase()}.`);
  else parts.push(`Owners are mixed on ${label.toLowerCase()}.`);
  if (sample) parts.push(`Example: “${sample.slice(0, 120)}…”`);
  return parts.join(" ");
}

type StanceBuckets = { pos: number; neg: number; mix: number };

function stanceBuckets(scoringItems: ScoringEvidenceItem & { stance: string; strength: number }[]): StanceBuckets {
  let pos = 0;
  let neg = 0;
  let mix = 0;
  for (const i of scoringItems) {
    if (i.stance === "positive") pos += i.strength;
    else if (i.stance === "negative") neg += i.strength;
    else if (i.stance === "mixed") mix += i.strength * 0.5;
    else mix += 0.2;
  }
  return { pos, neg, mix };
}

function computeNumericScore(buckets: StanceBuckets): number | null {
  const { pos, neg, mix } = buckets;
  const total = pos + neg + mix;
  if (total < 0.5) return null;
  const ratio = (pos + 1) / (pos + neg + 2);
  return Math.round(35 + ratio * 60);
}

export function computeDimensionConfidence(
  scoringItems: Array<ScoringEvidenceItem & { stance: string; strength: number }>,
  buckets: StanceBuckets,
  sufficient: boolean,
  uniqueSources: number,
  avgRelevance: number,
  avgProductMatch: number,
): number {
  const n = scoringItems.length;
  if (!n) return 0.15;
  const total = buckets.pos + buckets.neg + buckets.mix;
  const polar = buckets.pos + buckets.neg;
  const agreement = polar > 0 ? Math.abs(buckets.pos - buckets.neg) / polar : 0;
  const stanceClarity = total > 0 ? polar / total : 0;
  const mixedShare = total > 0 ? buckets.mix / total : 0;
  const sourceDiversity = n > 0 ? Math.min(1, uniqueSources / Math.min(n, 8)) : 0;

  let confidence =
    0.12 +
    Math.min(n, 12) * 0.022 +
    agreement * 0.22 +
    Math.min(uniqueSources, 5) * 0.035 +
    avgRelevance * 0.14 +
    avgProductMatch * 0.14 +
    sourceDiversity * 0.1;

  confidence *= 0.5 + stanceClarity * 0.5;
  confidence -= mixedShare * 0.38;

  confidence = Math.min(0.95, Math.max(0.12, confidence));
  if (!sufficient) {
    confidence = Math.min(confidence, SUFFICIENCY_THRESHOLDS.maxConfidenceWhenInsufficient);
  }
  return confidence;
}

export function buildDimensionExperiencePackage(input: {
  productId: string;
  blueprintId: string;
  query: string;
  profile: Record<string, unknown>;
  dimensions: BlueprintDimensionDef[];
}): { package: DimensionExperiencePackage; rows: NormalizedEvidenceRow[] } {
  const identity = (input.profile.identity ?? {}) as Record<string, string>;
  const target: TargetProduct = {
    name: identity.name ?? "",
    brand: identity.brand ?? "",
    model: identity.model ?? "",
    query: input.query,
  };

  const raw = collectRawEvidenceFromProfile(input.profile);
  const normalized: NormalizedEvidenceRow[] = [];

  for (const r of raw) {
    if (r.experienceAffectsScoring === false) continue;
    const combined = [r.contextText, r.text].filter(Boolean).join(" ").trim();
    const match = assessProductEvidenceMatch(combined, target);
    const statement = match.isolatedStatement ?? r.text;
    const productAffectsScore = match.affectsScore && r.experienceAffectsScoring !== false;
    const links = mapStatementToDimensions(statement, input.dimensions, productAffectsScore);
    if (match.level === "unrelated" && !links.length) continue;

    normalized.push({
      evidenceId: hashId(input.productId, statement),
      text: r.text,
      extractedStatement: statement,
      platform: r.platform,
      author: r.author ?? "",
      url: r.url ?? "",
      sourceTitle: r.sourceTitle ?? "",
      provider: r.provider,
      sourceId: r.sourceId ?? r.id,
      conversationId: r.conversationId,
      parentId: r.parentId,
      productMatch: match,
      dimensionLinks: links,
    });
  }

  const byKey: Record<string, DimensionScoreBundle> = {};
  for (const d of input.dimensions) {
    const dimensionId = `${input.blueprintId}_dim_${d.key}`;
    const items = normalized
      .flatMap((row) =>
        row.dimensionLinks
          .filter((l) => l.dimensionKey === d.key)
          .map((l) => ({
            evidenceId: row.evidenceId,
            statement: row.extractedStatement,
            platform: row.platform,
            author: row.author ?? "",
            url: row.url,
            stance: l.stance,
            strength: l.strength,
            relevanceConfidence: l.relevanceConfidence,
            productMatchConfidence: row.productMatch.confidence,
            affectsScore: l.affectsScore && row.productMatch.affectsScore,
          })),
      )
      .filter((i) => i.relevanceConfidence >= 0.5);

    const scoringItems = items.filter((i) => i.affectsScore) as Array<
      ScoringEvidenceItem & { stance: string; strength: number; statement: string }
    >;

    const sufficiency = evaluateDimensionSufficiency(scoringItems);
    const buckets = stanceBuckets(scoringItems);
    const rawScore = computeNumericScore(buckets);
    const confidence = computeDimensionConfidence(
      scoringItems,
      buckets,
      sufficiency.sufficientForNumericScore,
      sufficiency.uniqueSources,
      sufficiency.avgRelevance,
      sufficiency.avgProductMatch,
    );

    const scoreDisplay = sufficiency.scoreDisplay;
    const score = scoreDisplay === "numeric" && rawScore != null ? rawScore : null;

    const positiveCount = scoringItems.filter((i) => i.stance === "positive").length;
    const negativeCount = scoringItems.filter((i) => i.stance === "negative").length;
    const mixedCount = scoringItems.filter((i) => i.stance === "mixed" || i.stance === "neutral").length;
    const excludedCount = items.filter((i) => !i.affectsScore).length;
    const sample = scoringItems[0]?.statement;

    byKey[d.key] = {
      dimensionId,
      dimensionKey: d.key,
      label: d.label,
      score,
      scoreDisplay,
      confidence,
      finding: buildFinding(
        d.label,
        positiveCount,
        mixedCount,
        negativeCount,
        scoreDisplay,
        sufficiency.validatedReportCount,
        scoreDisplay === "numeric" ? sample : undefined,
      ),
      positiveCount,
      mixedCount,
      negativeCount,
      excludedCount,
      evidenceCount: items.length,
      validatedReportCount: sufficiency.validatedReportCount,
      uniqueSourceCount: sufficiency.uniqueSources,
      items,
    };
  }

  const package_: DimensionExperiencePackage = {
    algorithmVersion: DIMENSION_EVIDENCE_ALGO,
    byKey,
    normalizedRows: normalized,
  };
  return { package: package_, rows: normalized };
}

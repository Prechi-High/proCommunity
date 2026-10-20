import type { BlueprintDimensionDef, ProductClassification } from "../blueprint/types.ts";
import { collectRawEvidenceFromProfile } from "./collect.ts";
import { extractDimensionStatement, mapTextToDimensions } from "./relevance/mapDimensions.ts";
import { buildEvidenceSourceContext } from "./identity/sourceContext.ts";
import { parseTargetProduct } from "./identity/productTokens.ts";
import { resolveEvidenceIdentity } from "./identity/resolver.ts";
import type { TargetProduct } from "./identityGate.ts";
import { applyProvenanceToStrength, resolveProvenanceFromCollectRow } from "./sourceEvidenceQuality.ts";
import {
  evaluateDimensionSufficiencyWithDiagnostics,
  SUFFICIENCY_THRESHOLDS,
  type ScoreDisplay,
  type ScoringEvidenceItem,
} from "./sufficiency.ts";
import { DIMENSION_EVIDENCE_ALGO, currentEvidenceFingerprint } from "./versions.ts";
import type { DimensionExperiencePackage, DimensionScoreBundle, NormalizedEvidenceRow } from "./types.ts";

export { DIMENSION_EVIDENCE_ALGO, currentEvidenceFingerprint } from "./versions.ts";
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
        : `Limited evidence — based on ${validatedCount} validated dimension links.`;
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

function stanceBuckets(scoringItems: Array<ScoringEvidenceItem & { stance: string; strength: number }>): StanceBuckets {
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
  const avgProvenance = scoringItems.reduce((a, i) => a + (i.provenanceWeight ?? 0.5), 0) / n;

  let confidence =
    0.12 +
    Math.min(n, 12) * 0.022 +
    agreement * 0.22 +
    Math.min(uniqueSources, 5) * 0.035 +
    avgRelevance * 0.14 +
    avgProductMatch * 0.14 +
    sourceDiversity * 0.1 +
    avgProvenance * 0.1;

  confidence *= 0.72 + avgProvenance * 0.28;
  confidence *= 0.5 + stanceClarity * 0.5;
  confidence -= mixedShare * 0.38;

  confidence = Math.min(0.95, Math.max(0.12, confidence));
  if (!sufficient) {
    confidence = Math.min(confidence, SUFFICIENCY_THRESHOLDS.maxConfidenceWhenInsufficient);
  }
  return confidence;
}

function agreementFromItems(scoringItems: Array<{ stance: string }>): number {
  const pos = scoringItems.filter((i) => i.stance === "positive").length;
  const neg = scoringItems.filter((i) => i.stance === "negative").length;
  const polar = pos + neg;
  return polar ? Math.abs(pos - neg) / polar : 0;
}

export function buildDimensionExperiencePackage(input: {
  productId: string;
  blueprintId: string;
  query: string;
  profile: Record<string, unknown>;
  dimensions: BlueprintDimensionDef[];
  classification?: ProductClassification;
}): { package: DimensionExperiencePackage; rows: NormalizedEvidenceRow[] } {
  const identity = (input.profile.identity ?? {}) as Record<string, string>;
  const target: TargetProduct = {
    name: identity.name ?? "",
    brand: identity.brand ?? "",
    model: identity.model ?? "",
    query: input.query,
  };
  const classification =
    input.classification ??
    (input.profile.presentation as { product?: ProductClassification } | undefined)?.product as ProductClassification | undefined;

  const parsed = parseTargetProduct(target);
  const raw = collectRawEvidenceFromProfile(input.profile);
  const semantic = input.profile.semanticReview as { version?: string; rows?: NormalizedEvidenceRow[] } | undefined;
  const semanticMode = Boolean(input.profile.semanticReviewRequired || semantic?.version);
  const normalized: NormalizedEvidenceRow[] = semanticMode && semantic?.version === "semantic-review-v1"
    ? (semantic.rows ?? []).map(row => ({ ...row, evidenceId: hashId(input.productId, row.evidenceId),
        parentId: row.parentId ? hashId(input.productId, row.parentId) : undefined })) : [];

  for (const r of semanticMode ? [] : raw) {
    if (r.experienceAffectsScoring === false) continue;
    const sourceContext = buildEvidenceSourceContext(r, parsed, input.query);
    const match = resolveEvidenceIdentity({
      commentText: r.text,
      target,
      context: sourceContext,
      aliases: [input.query, identity.name ?? ""].filter(Boolean),
    });
    const productAffectsScore = match.affectsScore;
    const provenance = resolveProvenanceFromCollectRow(r);
    const links = mapTextToDimensions(r.text, input.dimensions, productAffectsScore, {
      classification,
      sourceContext,
    }).map((l) => ({
      ...l,
      strength: applyProvenanceToStrength(l.strength, provenance.weight),
    }));
    if (match.level === "unrelated" && !links.length) continue;

    const rawText = r.text;
    normalized.push({
      evidenceId: hashId(input.productId, `${rawText}:${r.id}`),
      text: rawText,
      extractedStatement: match.isolatedStatement ?? rawText,
      platform: r.platform,
      author: r.author ?? "",
      url: r.url ?? "",
      sourceTitle: r.sourceTitle ?? "",
      provider: r.provider,
      sourceId: r.sourceId ?? r.id,
      conversationId: r.conversationId,
      parentId: r.parentId,
      parentAuthor: r.parentAuthor,
      contextText: r.contextText,
      createdAt: r.createdAt,
      provenanceWeight: r.provenanceWeight ?? provenance.weight,
      productMatch: match,
      dimensionLinks: links,
    });
  }

  const byKey: Record<string, DimensionScoreBundle> = {};
  for (const d of input.dimensions) {
    const dimensionId = `${input.blueprintId}_dim_${d.key}`;
    const mappingCtx = { classification, sourceContext: undefined };
    const items = normalized
      .flatMap((row) =>
        row.dimensionLinks
          .filter((l) => l.dimensionKey === d.key)
          .map((l) => {
            const statement =
              l.extractedStatement ??
              extractDimensionStatement(row.text, d, {
                ...mappingCtx,
                sourceContext: buildEvidenceSourceContext(
                  {
                    id: row.evidenceId,
                    text: row.text,
                    platform: row.platform,
                    sourceTitle: row.sourceTitle,
                    contextText: row.contextText,
                  },
                  parsed,
                  input.query,
                ),
              });
            return {
              evidenceId: `${row.evidenceId}:${d.key}`,
              statement,
              fullText: row.text,
              highlightSpans: l.highlightSpans,
              skinType: row.skinType,
              skinTypeSource: row.skinTypeSource,
              reportKey: row.reportKey,
              platform: row.platform,
              author: row.author ?? "",
              url: row.url,
              stance: l.stance,
              strength: l.strength,
              relevanceConfidence: l.relevanceConfidence,
              productMatchConfidence: row.productMatch.confidence,
              productMatchLevel: row.productMatch.level,
              affectsScore: l.affectsScore && row.productMatch.affectsScore,
              provenanceWeight: row.provenanceWeight ?? 0.5,
              parentId: row.parentId,
              parentText: row.parentId ? row.contextText : undefined,
              parentAuthor: row.parentId ? row.parentAuthor : undefined,
              isReply: Boolean(row.parentId),
              conversationId: row.conversationId,
              videoTitle: row.sourceTitle,
              sourceContext: row.sourceTitle,
              createdAt: row.createdAt,
              provider: row.provider,
            };
          }),
      )
      .filter((i) => i.relevanceConfidence >= 0.5);

    // One person/author per category; repeated updates do not inflate the sample.
    const seenReports = new Set<string>();
    for (const item of items) {
      const key = item.reportKey || `${item.platform}:${item.author || item.evidenceId}`;
      if (seenReports.has(key)) item.affectsScore = false;
      else if (item.affectsScore) seenReports.add(key);
    }
    const scoringItems = items.filter((i) => i.affectsScore && (!semanticMode || i.stance !== "neutral")) as Array<
      ScoringEvidenceItem & { stance: string; strength: number; statement: string }
    >;

    const sufficiency = evaluateDimensionSufficiencyWithDiagnostics(scoringItems);
    if (semanticMode && (scoringItems.length < 20 || sufficiency.uniqueConversations < 2)) {
      sufficiency.sufficientForNumericScore = false;
      sufficiency.scoreDisplay = scoringItems.length ? "limited" : "unavailable";
      sufficiency.failedConditions.push("semantic minimum: 20 distinct reports across 2 conversations");
    }
    const buckets = stanceBuckets(scoringItems);
    const rawScore = semanticMode
      ? (scoringItems.length ? Math.round(100 * scoringItems.filter(i => i.stance === "positive").length / scoringItems.length) : null)
      : computeNumericScore(buckets);
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
      uniqueVideoCount: sufficiency.uniqueVideos,
      uniqueAuthorCount: sufficiency.uniqueAuthors,
      sufficiencyGate: {
        sufficientForNumericScore: sufficiency.sufficientForNumericScore,
        failedConditions: sufficiency.failedConditions,
        displayReason: sufficiency.displayReason,
        avgRelevance: sufficiency.avgRelevance,
        avgProductMatch: sufficiency.avgProductMatch,
        evidenceCount: sufficiency.validatedReportCount,
        uniqueAuthors: sufficiency.uniqueAuthors,
        uniqueSources: sufficiency.uniqueSources,
        uniqueConversations: sufficiency.uniqueConversations,
        uniqueVideos: sufficiency.uniqueVideos,
        agreement: agreementFromItems(scoringItems),
      },
      items,
    };
  }

  return {
    package: {
      algorithmVersion: DIMENSION_EVIDENCE_ALGO,
      byKey,
      normalizedRows: normalized,
    },
    rows: normalized,
  };
}

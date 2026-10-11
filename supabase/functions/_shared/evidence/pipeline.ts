import type { BlueprintDimensionDef } from "../blueprint/types.ts";
import { collectRawEvidenceFromProfile } from "./collect.ts";
import { mapStatementToDimensions } from "./dimensionRelevance.ts";
import { assessProductEvidenceMatch, type TargetProduct } from "./identityGate.ts";
import type { DimensionExperiencePackage, DimensionScoreBundle, NormalizedEvidenceRow } from "./types.ts";

export const DIMENSION_EVIDENCE_ALGO = "dim-evidence-v1";

function hashId(productId: string, text: string): string {
  let h = 0;
  const s = `${productId}:${text}`.toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `evi_${h.toString(36)}`;
}

function buildFinding(label: string, pos: number, mix: number, neg: number, sample?: string): string {
  if (pos + mix + neg === 0) return "Not enough validated owner reports yet for a clear read on this area.";
  const parts: string[] = [];
  if (pos > neg && pos >= mix) parts.push(`Most validated owner reports lean positive on ${label.toLowerCase()}.`);
  else if (neg > pos) parts.push(`Several owners report concerns about ${label.toLowerCase()}.`);
  else parts.push(`Owners are mixed on ${label.toLowerCase()}.`);
  if (sample) parts.push(`Example: “${sample.slice(0, 120)}…”`);
  return parts.join(" ");
}

function scoreFromStances(items: { stance: string; strength: number; affectsScore: boolean }[]): {
  score: number | null;
  confidence: number;
} {
  const scored = items.filter((i) => i.affectsScore);
  if (!scored.length) return { score: null, confidence: 0.15 };
  let pos = 0;
  let neg = 0;
  let mix = 0;
  for (const i of scored) {
    if (i.stance === "positive") pos += i.strength;
    else if (i.stance === "negative") neg += i.strength;
    else if (i.stance === "mixed") mix += i.strength * 0.5;
    else mix += 0.2;
  }
  const total = pos + neg + mix;
  if (total < 0.5) return { score: null, confidence: 0.2 };
  const ratio = (pos + 1) / (pos + neg + 2);
  const score = Math.round(35 + ratio * 60);
  const agreement = Math.abs(pos - neg) / total;
  const confidence = Math.min(0.95, 0.3 + Math.min(scored.length, 12) * 0.04 + agreement * 0.35);
  return { score, confidence };
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
    const match = assessProductEvidenceMatch(r.text, target);
    const statement = match.isolatedStatement ?? r.text;
    const links = mapStatementToDimensions(statement, input.dimensions, match.affectsScore);
    if (match.level === "unrelated" && !links.length) continue;

    normalized.push({
      evidenceId: hashId(input.productId, statement),
      text: r.text,
      extractedStatement: statement,
      platform: r.platform,
      author: r.author ?? "",
      url: r.url ?? "",
      sourceTitle: r.sourceTitle ?? "",
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
            url: row.url,
            stance: l.stance,
            strength: l.strength,
            relevanceConfidence: l.relevanceConfidence,
            productMatchConfidence: row.productMatch.confidence,
            affectsScore: l.affectsScore && row.productMatch.affectsScore,
          })),
      )
      .filter((i) => i.relevanceConfidence >= 0.5);

    const scoringItems = items.filter((i) => i.affectsScore);
    const positiveCount = scoringItems.filter((i) => i.stance === "positive").length;
    const negativeCount = scoringItems.filter((i) => i.stance === "negative").length;
    const mixedCount = scoringItems.filter((i) => i.stance === "mixed" || i.stance === "neutral").length;
    const excludedCount = items.filter((i) => !i.affectsScore).length;
    const { score, confidence } = scoreFromStances(scoringItems);
    const limited = scoringItems.length < 2 && scoringItems.length < 1;
    const sample = scoringItems[0]?.statement;

    byKey[d.key] = {
      dimensionId,
      dimensionKey: d.key,
      label: d.label,
      score: limited && scoringItems.length === 0 ? null : score,
      confidence: scoringItems.length ? confidence : 0.15,
      finding: buildFinding(d.label, positiveCount, mixedCount, negativeCount, sample),
      positiveCount,
      mixedCount,
      negativeCount,
      excludedCount,
      evidenceCount: items.length,
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

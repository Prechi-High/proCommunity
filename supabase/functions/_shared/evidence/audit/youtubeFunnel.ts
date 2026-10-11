import { assessExperienceQuality } from "../experienceQuality.ts";
import { dedupeRawEvidence } from "../dedupeEvidence.ts";
import { assessProductEvidenceMatch, type TargetProduct } from "../identityGate.ts";
import { mapStatementToDimensions } from "../dimensionRelevance.ts";
import { buildDimensionExperiencePackage } from "../pipeline.ts";
import type { BlueprintDimensionDef } from "../../blueprint/types.ts";
import type { RawEvidence } from "../providers/types.ts";

export type RejectionBucket =
  | "rejected_noise"
  | "rejected_too_short"
  | "rejected_no_firsthand_signal"
  | "rejected_low_specificity"
  | "rejected_wrong_product"
  | "rejected_competitor_only"
  | "rejected_contextual_only"
  | "rejected_no_dimension_match"
  | "rejected_low_relevance"
  | "rejected_duplicate"
  | "rejected_provider_cap"
  | "rejected_video_cap"
  | "rejected_comment_cap"
  | "rejected_pagination_cap"
  | "rejected_provider_normalize"
  | "rejected_provider_no_first_person"
  | "rejected_provider_spam"
  | "accepted_score_evidence";

export type FunnelStage = {
  stage: string;
  count: number;
};

export type SampleRejection = { bucket: RejectionBucket; text: string; detail?: string };

function inc(map: Record<string, number>, key: string, n = 1) {
  map[key] = (map[key] ?? 0) + n;
}

export function traceIntelligenceFunnel(input: {
  rawProviderItems: RawEvidence[];
  productId: string;
  blueprintId: string;
  query: string;
  target: TargetProduct;
  dimensions: BlueprintDimensionDef[];
  profileForPipeline: Record<string, unknown>;
}): {
  stages: FunnelStage[];
  rejections: Record<RejectionBucket, number>;
  samples: SampleRejection[];
  dimensionDistribution: Array<{
    dimensionKey: string;
    label: string;
    rawCandidates: number;
    validScoreEvidence: number;
  }>;
  rawConversationCount: number;
  validScoreEvidenceCount: number;
} {
  const rejections: Record<string, number> = {};
  const samples: SampleRejection[] = [];
  const maxSamples = 5;

  const pushSample = (bucket: RejectionBucket, text: string, detail?: string) => {
    const n = samples.filter((s) => s.bucket === bucket).length;
    if (n < maxSamples) samples.push({ bucket, text: text.slice(0, 280), detail });
  };

  const rawCount = input.rawProviderItems.length;
  const deduped = dedupeRawEvidence(input.rawProviderItems);
  inc(rejections, "rejected_duplicate", rawCount - deduped.length);

  let afterExperience = 0;
  let afterIdentity = 0;
  let afterDimCandidate = 0;
  let afterRelevance = 0;
  let affectsScore = 0;

  const dimCandidates: Record<string, number> = {};
  const dimValid: Record<string, number> = {};

  for (const item of deduped) {
    const eq = assessExperienceQuality(item.text, item.platform);
    if (!eq.affectsScoring) {
      if (eq.reason === "too_short" || eq.experienceQuality === "weak" && eq.reason === "too_short") {
        inc(rejections, "rejected_too_short");
        pushSample("rejected_too_short", item.text, eq.reason);
      } else if (eq.experienceQuality === "noise") {
        inc(rejections, "rejected_noise");
        pushSample("rejected_noise", item.text, eq.reason);
      } else {
        inc(rejections, "rejected_no_firsthand_signal");
        pushSample("rejected_no_firsthand_signal", item.text, eq.reason);
      }
      continue;
    }
    afterExperience += 1;

    const match = assessProductEvidenceMatch(item.text, input.target);
    if (!match.affectsScore) {
      if (match.reason.startsWith("competitor_only")) {
        inc(rejections, "rejected_competitor_only");
        pushSample("rejected_competitor_only", item.text, match.reason);
      } else if (match.reason === "contextual_only") {
        inc(rejections, "rejected_contextual_only");
        pushSample("rejected_contextual_only", item.text, match.reason);
      } else {
        inc(rejections, "rejected_wrong_product");
        pushSample("rejected_wrong_product", item.text, match.reason);
      }
      continue;
    }
    afterIdentity += 1;

    const statement = match.isolatedStatement ?? item.text;
    const linksPrefilter = input.dimensions.filter((d) =>
      d.keywords.some((k) => k.length > 2 && statement.toLowerCase().includes(k.toLowerCase())),
    );
    if (!linksPrefilter.length) {
      const mapped = mapStatementToDimensions(statement, input.dimensions, true);
      if (!mapped.length) {
        inc(rejections, "rejected_no_dimension_match");
        pushSample("rejected_no_dimension_match", statement);
        continue;
      }
    }
    afterDimCandidate += 1;

    const links = mapStatementToDimensions(statement, input.dimensions, true);
    const passing = links.filter((l) => l.relevanceConfidence >= 0.5);
    if (!passing.length) {
      inc(rejections, "rejected_low_relevance");
      pushSample("rejected_low_relevance", statement);
      continue;
    }
    afterRelevance += 1;

    const scoring = passing.filter((l) => l.affectsScore);
    if (!scoring.length) continue;
    affectsScore += 1;
    pushSample("accepted_score_evidence", statement);

    for (const l of passing) {
      dimCandidates[l.dimensionKey] = (dimCandidates[l.dimensionKey] ?? 0) + 1;
    }
    for (const l of scoring) {
      dimValid[l.dimensionKey] = (dimValid[l.dimensionKey] ?? 0) + 1;
    }
  }

  const { package: pkg } = buildDimensionExperiencePackage({
    productId: input.productId,
    blueprintId: input.blueprintId,
    query: input.query,
    profile: input.profileForPipeline,
    dimensions: input.dimensions,
  });

  let persistedLinks = 0;
  for (const d of input.dimensions) {
    const b = pkg.byKey[d.key];
    if (b) persistedLinks += b.items.filter((i) => i.affectsScore).length;
  }

  const dimensionDistribution = input.dimensions.map((d) => ({
    dimensionKey: d.key,
    label: d.label,
    rawCandidates: dimCandidates[d.key] ?? 0,
    validScoreEvidence: dimValid[d.key] ?? 0,
    pipelineItems: pkg.byKey[d.key]?.items.length ?? 0,
    pipelineScoring: pkg.byKey[d.key]?.items.filter((i) => i.affectsScore).length ?? 0,
  }));

  const stages: FunnelStage[] = [
    { stage: "RAW_YOUTUBE_PROVIDER_ITEMS", count: rawCount },
    { stage: "after_deduplication", count: deduped.length },
    { stage: "after_experience_quality", count: afterExperience },
    { stage: "after_product_identity", count: afterIdentity },
    { stage: "after_dimension_candidate_mapping", count: afterDimCandidate },
    { stage: "after_semantic_relevance_gate", count: afterRelevance },
    { stage: "affects_score_true", count: affectsScore },
    { stage: "pipeline_dimension_evidence_links", count: persistedLinks },
  ];

  return {
    stages,
    rejections: rejections as Record<RejectionBucket, number>,
    samples,
    dimensionDistribution,
    rawConversationCount: rawCount,
    validScoreEvidenceCount: affectsScore,
  };
}

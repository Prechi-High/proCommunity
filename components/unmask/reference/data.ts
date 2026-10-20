import type { ProductProfile } from "@/lib/types";
import {
  getDimensionExperience,
  resolveDimensionKey,
  type DimensionEvidenceItem,
} from "@/lib/unmask/dimensionEvidence";
import { getUIContract } from "@/lib/product-result/contract";
export function dimensions(profile: ProductProfile) {
  const reports =
    profile.dimensionExperience?.byKey ||
    (
      profile.presentation as
        | {
            dimensionExperience?: {
              byKey: Record<
                string,
                import("@/lib/unmask/dimensionEvidence").DimensionExperienceBundle
              >;
            };
          }
        | undefined
    )?.dimensionExperience?.byKey ||
    {};
  const contract = getUIContract(profile);
  const defined = contract?.overview.dimensions.length
    ? contract.overview.dimensions.map((d) => ({
        id: d.key,
        label: d.label,
        takeaway: d.finding || "",
      }))
    : Object.values(reports).map((d) => ({
        id: d.dimensionKey,
        label: d.label,
        takeaway: d.finding,
      }));
  const actual = defined.length
    ? defined
    : ((profile as ProductProfile & { semanticReviewRequired?: boolean }).semanticReviewRequired ? [] : profile.findings?.claims || []).map((c) => ({
        id: c.id,
        label: c.topic,
        takeaway: c.buyingImplication || c.findingLabel,
      }));
  return actual.map((d) => ({
    ...d,
    reports:
      getDimensionExperience(profile, resolveDimensionKey(profile, d.id)) ||
      getDimensionExperience(profile, d.label.toLowerCase()),
  }));
}
export function evidenceRows(
  profile: ProductProfile,
  topic?: string,
): DimensionEvidenceItem[] {
  const dims = dimensions(profile);
  const selected = dims.find((d) => d.id === topic || d.label === topic);
  const records =
    selected?.reports?.items ||
    (topic && topic !== "All"
      ? []
      : dims.flatMap((d) => d.reports?.items || []));
  const voices = (profile.voices || [])
    .filter(
      (v) =>
        !topic ||
        topic === "All" ||
        v.topic.toLowerCase() === topic.toLowerCase() ||
        selected?.label.toLowerCase() === v.topic.toLowerCase(),
    )
    .map(
      (v) =>
        ({
          evidenceId: v.id,
          statement: v.text,
          platform: v.platform,
          url: v.url,
          stance:
            v.stance === "love"
              ? "positive"
              : v.stance === "warn"
                ? "negative"
                : "mixed",
          strength: 0,
          relevanceConfidence: 0,
          productMatchConfidence: 0,
          affectsScore: false,
          author: v.author,
          videoTitle: v.where,
          createdAt: v.date,
        }) as DimensionEvidenceItem,
    );
  return [
    ...new Map(
      (records.length ? records : ((profile as ProductProfile & { semanticReviewRequired?: boolean }).semanticReviewRequired ? [] : voices)).map((x) => [x.evidenceId, x]),
    ).values(),
  ];
}
export function dateLabel(value?: string | null) {
  if (!value) return "Date not supplied";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}
export function claimFor(profile: ProductProfile, id: string, label: string) {
  return profile.findings?.claims.find(
    (c) => c.id === id || c.topic.toLowerCase() === label.toLowerCase(),
  );
}

export function researchNotice(profile: ProductProfile): string | null {
  const parallel = parallelResearchState(profile);
  if (parallel) {
    if (parallel.phase === "batch2") return "First-batch results are available. We’re checking another batch for categories with fewer than five reports.";
    if (parallel.phase === "interrupted") return "Research was interrupted. Reviewed evidence is shown below; retry to finish.";
    if (parallel.phase === "complete") return "Research finished. Percentages describe the available reports; small samples have limited confidence.";
    return "Collecting and reviewing product-specific evidence.";
  }
  const p = profile as ProductProfile & {
    semanticReviewRequired?: boolean;
    conversationEvidence?: unknown[];
    semanticReview?: { pending?: number; decisions?: Record<string, unknown>; rows?: unknown[] };
    blueprintAttachError?: string;
    evidenceCollectionError?: string;
  };
  if (!p.semanticReviewRequired) return null;
  const collected = Array.isArray(p.conversationEvidence) ? p.conversationEvidence.length : 0;
  const assessed = Object.keys(p.semanticReview?.decisions ?? {}).length;
  const accepted = p.semanticReview?.rows?.length ?? 0;
  if (p.blueprintAttachError) return collected
    ? `${collected} YouTube comments were retrieved, but assessment could not finish. Please retry.`
    : "Product research could not finish. Please retry.";
  if ((p.semanticReview?.pending ?? 0) > 0) return `${collected} YouTube comments retrieved. ${accepted} relevant reports available; more comments are awaiting review.`;
  if (assessed && !accepted) return `${assessed} distinct source comments assessed. None could be confidently attributed to this exact product and its assessment categories.`;
  if (accepted) return `${accepted} relevant reports from assessed source comments. Percentages appear only when enough reports support them.`;
  return p.evidenceCollectionError || (collected ? `${collected} YouTube comments retrieved; assessment is still pending.` : "No matching product experiences have been found yet.");
}

export function parallelResearchState(profile: ProductProfile): {
  phase: string; batch: number; loadingCategories?: string[]; failedTasks?: number;
} | undefined {
  return (profile as ProductProfile & { parallelResearch?: {
    phase: string; batch: number; loadingCategories?: string[]; failedTasks?: number;
  } }).parallelResearch;
}

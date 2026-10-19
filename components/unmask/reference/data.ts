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
    : (profile.findings?.claims || []).map((c) => ({
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
      (records.length ? records : voices).map((x) => [x.evidenceId, x]),
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

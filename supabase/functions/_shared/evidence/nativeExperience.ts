import { assessExperienceQuality } from "./experienceQuality.ts";
type Json = Record<string, unknown>;
export function nativeExperiencePolicy(
  row: Json,
  verified: boolean,
  historyCount: number,
  coordinated: boolean,
) {
  const quality = assessExperienceQuality(String(row.changed || ""), "unmask");
  const mature = Number(row.documented_days) >= 30 && historyCount >= 2;
  const independent = row.acquisition === "purchased";
  const eligible =
    quality.affectsScoring && mature && verified && independent && !coordinated;
  return {
    ...quality,
    affectsScoring: eligible,
    ownershipSignal: verified ? 0.9 : 0.25,
    reason: coordinated
      ? "similarity_cluster_influence_limited"
      : !mature
        ? "documented_history_still_developing"
        : !verified
          ? "possession_not_verified"
          : !independent
            ? "disclosed_acquisition_influence_limited"
            : quality.reason,
    documentedDays: Number(row.documented_days) || 0,
    reportedDays: Number(row.claimed_days) || 0,
    maturity: row.maturity,
    acquisition: row.acquisition,
    coordinationRisk: coordinated ? "some_signals" : "unassessed",
    policyVersion: "native-v1-conservative",
  };
}
/** Only explicitly public, non-demo, published native evidence enters public intelligence.
 * Privacy-sensitive data is loaded only for the final response, after cache/database writes. */
export async function attachNativeExperience(
  store: { rows: (path: string) => Promise<Json[]> } | null,
  productId: string,
  profile: Json,
): Promise<Json> {
  if (!store) return profile;
  const rows = await store.rows(
    `unmask_experience_feed?select=*&product_id=eq.${encodeURIComponent(productId)}&visibility=eq.public&journey_visibility=eq.public&is_demo=eq.false&moderation_status=eq.published&order=created_at.desc&limit=100`,
  );
  const verifications = rows.length
    ? await store.rows(
        `owner_verifications?select=user_id,status&product_id=eq.${encodeURIComponent(productId)}&status=eq.verified&limit=100`,
      )
    : [];
  const latest = new Map<string, Json>();
  const counts = new Map<string, number>();
  const texts = new Map<string, number>();
  for (const row of rows) {
    const u = String(row.user_id);
    counts.set(u, (counts.get(u) || 0) + 1);
    if (!latest.has(u)) latest.set(u, row);
  }
  const fingerprint = (r: Json) =>
    String(r.changed || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 180);
  for (const row of latest.values())
    texts.set(fingerprint(row), (texts.get(fingerprint(row)) || 0) + 1);
  const native = [...latest.values()].slice(0, 30).map((row) => ({
    id: `unmask:${row.id}`,
    provider: "unmask",
    platform: "unmask",
    sourceId: row.id,
    conversationId: `journey:${row.journey_id}`,
    parentId: null,
    author: row.author_name,
    text: row.changed,
    contextText: [row.unchanged, row.reaction, row.uncertainty, row.context]
      .filter(Boolean)
      .join("\n"),
    url: `https://dunmasker.vercel.app/watch/${encodeURIComponent(productId)}`,
    title: row.product_name,
    createdAt: row.created_at,
    engagement: { likes: 0 },
    experienceQuality: nativeExperiencePolicy(
      row,
      verifications.some((v) => v.user_id === row.user_id),
      counts.get(String(row.user_id)) || 0,
      (texts.get(fingerprint(row)) || 0) >= 3,
    ),
  }));
  const existing = Array.isArray(profile.conversationEvidence)
    ? (profile.conversationEvidence as Json[]).filter(
        (e) => e.provider !== "unmask",
      )
    : [];
  return {
    ...profile,
    conversationEvidence: [...existing, ...native],
    nativeEvidenceSummary: {
      contributors: native.length,
      eligibleContributors: native.filter(
        (n) => n.experienceQuality.affectsScoring,
      ).length,
      policy: "native-v1-conservative",
      explanation:
        "Native observations are provisional until documented history, possession and independence support their influence. One contributor is one source, regardless of update count.",
    },
  };
}

import { buildPresentationFromProfile } from "../blueprint/build.ts";
import { buildProductUIContractV1 } from "../ui-contract/index.ts";
import type {
  ProductPresentationContract,
  ProductClassification,
  BlueprintDimensionDef,
} from "../blueprint/types.ts";
/** Response-only overlay: public intelligence snapshots and caches never retain native histories.
 * On privacy changes/deletion, the next response immediately loses the contribution. */
export async function attachNativePublicResponse(
  store: { rows: (path: string) => Promise<Json[]> } | null,
  productId: string,
  profile: Json,
): Promise<Json> {
  const combined = await attachNativeExperience(store, productId, profile);
  const pres = profile.presentation as ProductPresentationContract | undefined;
  const native =
    (combined.conversationEvidence as Json[] | undefined)?.filter(
      (x) => x.provider === "unmask",
    ) || [];
  if (!native.length || !pres) return combined;
  const identity = (profile.identity || {}) as Json;
  const classification: ProductClassification = {
    domain:
      pres.product.category === "tech"
        ? "tech"
        : pres.product.category === "home-appliances"
          ? "home-appliances"
          : "beauty",
    categoryId: String(identity.category || ""),
    templateId: "",
    productType: pres.product.productType,
    productSubtype: pres.product.productSubtype,
    classificationConfidence: 0.5,
    primaryUses: [],
    buyerExpectations: [],
    riskFactors: [],
  };
  const dimensions: BlueprintDimensionDef[] = pres.overview.dimensions.map(
    (d) => ({
      key: d.key,
      label: d.label,
      importance: 1,
      keywords: [d.label, ...d.key.split("_")],
    }),
  );
  const responsePres = buildPresentationFromProfile(
    productId,
    String(profile.query || identity.name || productId),
    combined,
    pres.blueprintId,
    pres.blueprintVersion,
    undefined,
    {
      classification,
      dimensions,
      factSections: pres.factSections.map((s) => ({
        key: s.key,
        label: s.title,
        renderer: s.renderer,
        fieldKeys: s.fields.map((f) => f.key),
      })),
      cacheSource: "fresh",
    },
  );
  // Preserve facts and domain metadata; recompute only experience-derived results in memory.
  responsePres.factSections = pres.factSections;
  responsePres.product = pres.product;
  responsePres.navigation = pres.navigation;
  responsePres.domainNotice = pres.domainNotice;
  const out = {
    ...combined,
    presentation: responsePres,
    dimensionExperience: responsePres.dimensionExperience,
  };
  return {
    ...out,
    uiContract: buildProductUIContractV1(productId, out, responsePres),
  };
}

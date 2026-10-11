import type { Store } from "./resolve.ts";

type Json = Record<string, unknown>;

const INFERRED_TEMPLATE_DEFAULTS: Record<string, Json> = {
  "sports-outdoors": {
    common_fact_families: ["Specs", "Materials", "Sizing", "Safety"],
    common_buyer_expectations: ["Comfort", "Durability", "Performance in real conditions"],
    common_risk_families: ["Poor fit", "Premature wear", "Safety concerns"],
    common_experience_families: ["Comfort", "Durability", "Performance", "Ease of use", "Weather suitability"],
    preferred_source_types: ["reviews", "community", "video", "retail"],
    research_guidance: {
      what_to_prioritize: ["long-term owner use", "conditions of use"],
      common_evidence_patterns: ["enthusiast vs casual split"],
      common_failure_modes: ["over-marketed durability claims"],
    },
  },
  automotive: {
    common_fact_families: ["Specs", "Compatibility", "Installation", "Power"],
    common_buyer_expectations: ["Reliable in vehicle conditions", "Clear install guidance"],
    common_risk_families: ["Heat failure", "Poor night recording", "Compatibility issues"],
    common_experience_families: ["Recording quality", "Reliability", "Ease of install", "App experience", "Value"],
    preferred_source_types: ["reviews", "video", "forum", "retail"],
    research_guidance: {
      what_to_prioritize: ["real driving conditions", "night/low-light performance"],
      common_evidence_patterns: ["feature checklist vs real-world"],
      common_failure_modes: ["SD card failures", "overheating"],
    },
  },
};

export async function ensureInferredDomainTemplate(
  store: Store,
  domainId: string,
  slug: string,
): Promise<number> {
  const existing = await store.rows(
    `domain_intelligence_templates?domain_id=eq.${encodeURIComponent(domainId)}&status=eq.active&order=version.desc&limit=1`,
  );
  if (existing[0]?.version) return Number(existing[0].version);

  const body = INFERRED_TEMPLATE_DEFAULTS[slug] ?? INFERRED_TEMPLATE_DEFAULTS["sports-outdoors"];
  await store.insert("domain_intelligence_templates", {
    domain_id: domainId,
    version: 1,
    status: "active",
    common_fact_families: body.common_fact_families,
    common_buyer_expectations: body.common_buyer_expectations,
    common_risk_families: body.common_risk_families,
    common_experience_families: body.common_experience_families,
    preferred_source_types: body.preferred_source_types,
    research_guidance: body.research_guidance,
    generated_by_model: "domain-template-heuristic-v1",
    generation_confidence: 0.75,
  });
  await store.patch("domain_registry", `id=eq.${encodeURIComponent(domainId)}`, { template_status: "ready" });
  return 1;
}

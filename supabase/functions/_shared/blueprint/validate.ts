import type { IntelligenceDomain } from "./types.ts";

const DOMAIN_LEAK_BLOCK: Record<IntelligenceDomain, string[]> = {
  tech: [],
  beauty: ["camera_quality", "charging_speed", "display_experience", "gps_accuracy", "heat_management"],
  "home-appliances": ["camera_quality", "pigmentation", "oxidation", "shade_match"],
};

export function blockedDimensionKeys(domain: IntelligenceDomain): Set<string> {
  return new Set(DOMAIN_LEAK_BLOCK[domain]);
}

/** Reject cross-domain dimension leakage (spec §16). */
export function validateBlueprintDimensions(
  domain: IntelligenceDomain,
  dimensionKeys: string[],
): { ok: boolean; rejected: string[] } {
  const blocked = blockedDimensionKeys(domain);
  const rejected = dimensionKeys.filter((k) => blocked.has(k));
  return { ok: rejected.length === 0, rejected };
}

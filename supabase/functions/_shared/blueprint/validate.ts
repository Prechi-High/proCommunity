import { blockedDimensionKeys } from "./presets.ts";
import type { IntelligenceDomain } from "./types.ts";

/** Reject cross-domain dimension leakage (spec §16). */
export function validateBlueprintDimensions(
  domain: IntelligenceDomain,
  dimensionKeys: string[],
): { ok: boolean; rejected: string[] } {
  const blocked = blockedDimensionKeys(domain);
  const rejected = dimensionKeys.filter((k) => blocked.has(k));
  return { ok: rejected.length === 0, rejected };
}

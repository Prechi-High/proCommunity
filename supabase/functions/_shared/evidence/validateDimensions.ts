import type { IntelligenceDomain } from "../blueprint/types.ts";
import { blockedDimensionKeys } from "../blueprint/validate.ts";

const LABEL_BLOCK: Record<IntelligenceDomain, RegExp[]> = {
  tech: [],
  beauty: [
    /\bcamera\b/i,
    /\bbattery\b/i,
    /\bcharg(e|ing)\b/i,
    /\bdisplay\b/i,
    /\bgps\b/i,
    /\bheat management\b/i,
  ],
  "home-appliances": [/\bcamera\b/i, /\bpigmentation\b/i, /\bshade match\b/i, /\boxidation\b/i],
};

const TYPE_HINTS: Record<string, IntelligenceDomain> = {
  smartphone: "tech",
  smartwatch: "tech",
  power_bank: "tech",
  foundation: "beauty",
  lipstick: "beauty",
  moisturizer: "beauty",
  air_fryer: "home-appliances",
  washing_machine: "home-appliances",
};

export function inferDomainFromProductType(productType: string, domainResolutionName?: string): IntelligenceDomain {
  const t = productType.toLowerCase().replace(/\s+/g, "_");
  if (TYPE_HINTS[t]) return TYPE_HINTS[t];
  const d = (domainResolutionName ?? "").toLowerCase();
  if (d.includes("beauty")) return "beauty";
  if (d.includes("home") || d.includes("appliance")) return "home-appliances";
  if (d.includes("sport") || d.includes("automotive") || d.includes("outdoor")) return "tech";
  return "tech";
}

export function validateDimensionSemantics(
  domain: IntelligenceDomain,
  productType: string,
  dimensions: Array<{ key: string; label: string }>,
): { ok: boolean; rejected: string[] } {
  const blocked = blockedDimensionKeys(domain);
  const labelRules = LABEL_BLOCK[domain] ?? [];
  const rejected: string[] = [];

  const hasDisplayProduct = /\b(display|screen|monitor)\b/i.test(productType);

  for (const d of dimensions) {
    if (blocked.has(d.key)) rejected.push(d.key);
    if (labelRules.some((re) => re.test(d.label))) rejected.push(d.key);
    if (productType.includes("power_bank") && ["display_experience", "camera_quality"].includes(d.key) && !hasDisplayProduct) {
      rejected.push(d.key);
    }
    if (/\bcamera\b/i.test(d.label) && productType.includes("power_bank")) {
      rejected.push(d.key);
    }
  }

  return { ok: rejected.length === 0, rejected: Array.from(new Set(rejected)) };
}

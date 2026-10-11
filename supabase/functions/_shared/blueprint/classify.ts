import { validateBlueprintDimensions } from "./validate.ts";
import { blockedDimensionKeys, domainDefaults, presetsForDomain, type TypePreset } from "./presets.ts";
import type { BlueprintDimensionDef, BlueprintFactSectionDef, IntelligenceDomain, ProductClassification } from "./types.ts";

type Identity = {
  name?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
};

const DOMAIN_MAP: Record<IntelligenceDomain, { categoryId: string; templateId: string }> = {
  tech: { categoryId: "domain_tech", templateId: "tpl_domain_tech" },
  beauty: { categoryId: "domain_beauty", templateId: "tpl_domain_beauty" },
  "home-appliances": { categoryId: "domain_home_appliances", templateId: "tpl_domain_home" },
};

function inferDomain(identity: Identity, query: string): { domain: IntelligenceDomain; confidence: number } {
  const hay = `${identity.category ?? ""} ${identity.subcategory ?? ""} ${identity.name ?? ""} ${query}`.toLowerCase();
  const beauty = /\b(beauty|cosmetic|makeup|skincare|skin care|foundation|lipstick|serum|moistur|fragrance|shampoo|lotion)\b/;
  const home = /\b(appliance|air fryer|washing machine|washer|refrigerator|fridge|microwave|oven|vacuum|blender|kettle)\b/;
  const tech = /\b(phone|laptop|tablet|watch|charger|headphone|earbud|camera|tv|monitor|console|gadget|electronic)\b/;

  if (beauty.test(hay)) return { domain: "beauty", confidence: 0.82 };
  if (home.test(hay)) return { domain: "home-appliances", confidence: 0.8 };
  if (tech.test(hay)) return { domain: "tech", confidence: 0.78 };
  if (/tech|electronic|mobile/i.test(identity.category ?? "")) return { domain: "tech", confidence: 0.65 };
  if (/beauty|care|cosmetic/i.test(identity.category ?? "")) return { domain: "beauty", confidence: 0.65 };
  if (/home|kitchen|appliance/i.test(identity.category ?? "")) return { domain: "home-appliances", confidence: 0.62 };
  return { domain: "tech", confidence: 0.45 };
}

function pickPreset(domain: IntelligenceDomain, identity: Identity, query: string): TypePreset | null {
  const hay = `${identity.name ?? ""} ${identity.subcategory ?? ""} ${query}`;
  for (const p of presetsForDomain(domain)) {
    if (p.match.test(hay)) return p;
  }
  return null;
}

export function classifyProduct(identity: Identity, query: string): ProductClassification {
  const { domain, confidence: domainConf } = inferDomain(identity, query);
  const preset = pickPreset(domain, identity, query);
  const meta = DOMAIN_MAP[domain];
  const productType = preset?.productType ?? "general";
  const productSubtype = identity.subcategory?.trim() || null;

  const primaryUses: string[] = [];
  if (productType === "smartphone") primaryUses.push("communication", "photography", "daily productivity");
  else if (productType === "foundation") primaryUses.push("even complexion", "coverage");
  else if (productType === "air_fryer") primaryUses.push("healthier frying", "quick meals");

  return {
    domain,
    categoryId: meta.categoryId,
    templateId: meta.templateId,
    productType,
    productSubtype,
    classificationConfidence: Math.min(0.98, domainConf + (preset ? 0.12 : 0)),
    primaryUses,
    buyerExpectations: ["matches advertised claims", "reliable day-to-day use"],
    riskFactors: ["returns due to unmet expectations", "hidden long-term issues"],
  };
}

export function resolveBlueprintSchema(
  classification: ProductClassification,
  identity: Identity,
  query: string,
): { factSections: BlueprintFactSectionDef[]; dimensions: BlueprintDimensionDef[] } {
  const preset = pickPreset(classification.domain, identity, query);
  const defaults = domainDefaults(classification.domain);
  const factSections = preset?.factSections ?? defaults.factSections;
  let dimensions = (preset?.dimensions ?? defaults.dimensions).slice(0, 7);
  const blocked = blockedDimensionKeys(classification.domain);
  if (preset?.excludedDimensionKeys) {
    for (const k of preset.excludedDimensionKeys) blocked.add(k);
  }
  dimensions = dimensions.filter((d) => !blocked.has(d.key));
  const validation = validateBlueprintDimensions(classification.domain, dimensions.map((d) => d.key));
  if (!validation.ok) {
    dimensions = dimensions.filter((d) => !validation.rejected.includes(d.key));
  }
  return { factSections, dimensions };
}

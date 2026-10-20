import { presetsForDomain, domainDefaults } from "./presets.ts";
import type { BuiltBlueprintPackage } from "./build.ts";
import type { BlueprintDimensionDef, IntelligenceDomain } from "./types.ts";

/** Category templates only define what to assess. They never classify comments or manufacture evidence. */
export function fallbackBlueprint(productId: string, identity: Record<string, unknown>, query: string): BuiltBlueprintPackage {
  const name = [identity.name, identity.subcategory, identity.category, query].filter(Boolean).join(" ");
  const beauty = /\b(body cream|face cream|facial cream|moisturiz\w*|moisturis\w*|lotion|cleanser|talc\w*|skincare|cosmetic\w*|body wash|shampoo|sunscreen|perfume|deodorant)\b/i.test(name);
  const home = /\b(appliance|kitchen|vacuum|air fryer|refrigerator|washing machine)\b/i.test(name);
  const domain: IntelligenceDomain = beauty ? "beauty" : home ? "home-appliances" : "tech";
  const exactPreset = presetsForDomain(domain).find(p => p.match.test(name));
  const dim = (key: string, label: string): BlueprintDimensionDef => ({ key, label, importance: 0.8, keywords: [], whyItMatters: label });
  let productType = exactPreset?.productType ?? "general";
  let dimensions = exactPreset?.dimensions ?? [
    dim("primary_performance", "Performance"), dim("ease_of_use", "Ease of use"),
    dim("reliability", "Reliability"), dim("value", "Value for money"),
  ];
  if (/\b(body cream|face cream|facial cream|moisturiz\w*|moisturis\w*|lotion)\b/i.test(name)) {
    productType = "moisturizer";
    dimensions = [dim("hydration", "Hydration"), dim("absorption", "Absorption"),
      dim("skin_comfort", "Skin comfort"), dim("texture", "Texture & feel"), dim("fragrance", "Fragrance")];
  } else if (/\b(talc\w*|body powder)\b/i.test(name)) {
    productType = "body_powder";
    dimensions = [dim("moisture_absorption", "Moisture absorption"), dim("skin_comfort", "Skin comfort"),
      dim("fragrance", "Fragrance"), dim("texture", "Texture & residue")];
  } else if (/\b(cleanser|face wash)\b/i.test(name)) {
    productType = "cleanser";
    dimensions = [dim("cleansing", "Cleansing"), dim("hydration", "Hydration"),
      dim("skin_comfort", "Skin comfort"), dim("rinsing", "Rinsing & residue")];
  }
  const defaults = domainDefaults(domain);
  return {
    blueprintId: `bp_${productId}_v3`, version: 3, generatedByModel: "product-type-template-v1",
    classification: { domain, categoryId: `domain_${domain.replace(/-/g, "_")}`,
      templateId: domain === "home-appliances" ? "tpl_domain_home" : `tpl_domain_${domain}`,
      productType, productSubtype: null, classificationConfidence: beauty || home || exactPreset ? 0.7 : 0.35,
      primaryUses: [], buyerExpectations: [], riskFactors: [] },
    factSections: beauty ? defaults.factSections : exactPreset?.factSections ?? [{ key: "product_details", label: "Product Details", renderer: "fact_groups", fieldKeys: [] }],
    dimensions,
  };
}

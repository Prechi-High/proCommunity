import { presetsForDomain, domainDefaults } from "./presets.ts";
import type { BuiltBlueprintPackage } from "./build.ts";
import type { BlueprintDimensionDef, IntelligenceDomain } from "./types.ts";

/** Category templates only define what to assess. They never classify comments or manufacture evidence. */
export function fallbackBlueprint(productId: string, identity: Record<string, unknown>, query: string): BuiltBlueprintPackage {
  const name = [identity.name, identity.subcategory, identity.category, query].filter(Boolean).join(" ");
  const beauty = /\b(brightening oil|body oil|face oil|facial oil|brightening cream|body cream|face cream|facial cream|moisturiz\w*|moisturis\w*|lotion|cleanser|talc\w*|skincare|cosmetic\w*|body wash|shampoo|sunscreen|perfume|deodorant)\b/i.test(name);
  const home = /\b(appliance|kitchen|vacuum|air fryer|refrigerator|washing machine)\b/i.test(name);
  const domain: IntelligenceDomain = beauty ? "beauty" : home ? "home-appliances" : "tech";
  const exactPreset = presetsForDomain(domain).find(p => p.match.test(name));
  const meanings: Record<string, string> = {
    hydration: "Observed moisturising or drying effect on skin, including dryness, softness or retained moisture.",
    absorption: "How readily the product sinks into skin and whether it leaves surface oil or residue. Usage frequency and where it can be applied are not absorption.",
    skin_comfort: "Observed itching, stinging, burning, redness or comfort during use. No irritation is favourable; do not infer medical safety.",
    texture: "Physical consistency and feel when applied, such as thickness, greasiness, stickiness or residue.",
    brightening: "User-observed changes in uneven tone or dark spots over time. Questions and marketing promises are not observed results.",
    fragrance: "User experience of the product's scent, intensity or persistence.",
  };
  const dim = (key: string, label: string): BlueprintDimensionDef => ({ key, label, importance: 0.8, keywords: [],
    whyItMatters: meanings[key] || label, description: meanings[key] || label });
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
  if (/\b(brightening|lightening|dark spot)\b/i.test(name) && /\b(oil|cream|lotion|serum)\b/i.test(name)) {
    productType = /\boil\b/i.test(name) ? "body_oil" : "brightening_treatment";
    dimensions = [dim("brightening", "Brightening results"), dim("absorption", "Absorption"),
      dim("skin_comfort", "Skin comfort"), dim("hydration", "Hydration"), dim("texture", "Texture & feel")];
  } else if (/\b(body oil|face oil|facial oil)\b/i.test(name)) {
    productType = "body_oil";
    dimensions = [dim("hydration", "Hydration"), dim("absorption", "Absorption"), dim("skin_comfort", "Skin comfort"),
      dim("texture", "Texture & feel"), dim("fragrance", "Fragrance")];
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

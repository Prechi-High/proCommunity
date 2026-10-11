import type { DomainResolution } from "./types.ts";

type Identity = { name?: string; brand?: string; category?: string; subcategory?: string };

const OFFICIAL_TECH = "a1000001-0000-4000-8000-000000000001";
const OFFICIAL_BEAUTY = "a1000001-0000-4000-8000-000000000002";
const OFFICIAL_HOME = "a1000001-0000-4000-8000-000000000003";

type Rule = {
  re: RegExp;
  domainId: string;
  domain: string;
  slug: string;
  status: "official" | "inferred";
  family: string;
  type: string;
  subtype?: string;
  confidence: number;
};

const RULES: Rule[] = [
  { re: /\b(iphone|galaxy|pixel|smartphone|android phone)\b/i, domainId: OFFICIAL_TECH, domain: "Tech", slug: "tech", status: "official", family: "Mobile", type: "Smartphone", confidence: 0.92 },
  { re: /\b(apple watch|galaxy watch|fitbit|smartwatch)\b/i, domainId: OFFICIAL_TECH, domain: "Tech", slug: "tech", status: "official", family: "Wearables", type: "Smartwatch", confidence: 0.9 },
  { re: /\b(lipstick|lip gloss)\b/i, domainId: OFFICIAL_BEAUTY, domain: "Beauty", slug: "beauty", status: "official", family: "Makeup", type: "Lipstick", confidence: 0.9 },
  { re: /\b(foundation|bb cream|cc cream)\b/i, domainId: OFFICIAL_BEAUTY, domain: "Beauty", slug: "beauty", status: "official", family: "Makeup", type: "Foundation", confidence: 0.88 },
  { re: /\b(moisturizer|moisturiser|face cream|hydrating cream)\b/i, domainId: OFFICIAL_BEAUTY, domain: "Beauty", slug: "beauty", status: "official", family: "Skincare", type: "Moisturizer", confidence: 0.86 },
  { re: /\b(air fryer|airfryer|washing machine|washer|refrigerator|microwave)\b/i, domainId: OFFICIAL_HOME, domain: "Home Appliances", slug: "home-appliances", status: "official", family: "Kitchen", type: "Air fryer", confidence: 0.88 },
  { re: /\b(mountain bike|bicycle|bike|cycling)\b/i, domainId: "", domain: "Sports & Outdoors", slug: "sports-outdoors", status: "inferred", family: "Cycling", type: "Bicycle", subtype: "Mountain bike", confidence: 0.86 },
  { re: /\b(running shoes|trainers|sneakers)\b/i, domainId: "", domain: "Sports & Outdoors", slug: "sports-outdoors", status: "inferred", family: "Footwear", type: "Running shoes", confidence: 0.85 },
  { re: /\b(dash cam|dashcam|car camera|vehicle camera)\b/i, domainId: "", domain: "Automotive", slug: "automotive", status: "inferred", family: "Car electronics", type: "Dash camera", confidence: 0.87 },
];

export function heuristicResolve(identity: Identity, query: string, registryBySlug: Map<string, { id: string; status: string }>): DomainResolution | null {
  const hay = `${identity.name ?? ""} ${identity.subcategory ?? ""} ${identity.category ?? ""} ${query}`;
  for (const rule of RULES) {
    if (!rule.re.test(hay)) continue;
    const reg = registryBySlug.get(rule.slug);
    const id = rule.domainId || reg?.id || "";
    const status = (reg?.status === "official" || rule.status === "official" ? "official" : "inferred") as DomainResolution["domainStatus"];
    return {
      matchedDomainId: id,
      domain: rule.domain,
      domainSlug: rule.slug,
      domainStatus: status,
      productFamily: rule.family,
      productType: rule.type,
      productSubtype: rule.subtype,
      classificationConfidence: rule.confidence,
      reason: `Matched product pattern for ${rule.type}`,
    };
  }
  if (/\b(beauty|cosmetic|skincare|makeup)\b/i.test(hay)) {
    return mkOfficial(OFFICIAL_BEAUTY, "Beauty", "tech", identity, 0.7);
  }
  if (/\b(appliance|kitchen|home)\b/i.test(hay)) {
    return mkOfficial(OFFICIAL_HOME, "Home Appliances", "home-appliances", identity, 0.65);
  }
  if (/\b(tech|electronic|phone|laptop|gadget)\b/i.test(hay)) {
    return mkOfficial(OFFICIAL_TECH, "Tech", "tech", identity, 0.65);
  }
  return null;
}

function mkOfficial(id: string, domain: string, slug: string, identity: Identity, confidence: number): DomainResolution {
  return {
    matchedDomainId: id,
    domain,
    domainSlug: slug,
    domainStatus: "official",
    productFamily: identity.category || "General",
    productType: identity.subcategory || "Product",
    classificationConfidence: confidence,
    reason: "Category keyword fallback",
  };
}

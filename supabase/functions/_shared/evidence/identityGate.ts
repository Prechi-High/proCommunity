import type { ProductMatchLevel, ProductMatchResult } from "./types.ts";

const COMPETITOR_BRANDS = [
  "aveeno",
  "e45",
  "e 45",
  "palmer's",
  "palmers",
  "bio-oil",
  "bio oil",
  "neutrogena",
  "olay",
  "dove",
  "nivea",
  "la roche-posay",
  "the ordinary",
];

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export type TargetProduct = {
  name: string;
  brand: string;
  model?: string;
  query: string;
};

function competitorMentioned(text: string, targetBrand: string): string | null {
  const low = text.toLowerCase();
  const tb = targetBrand.toLowerCase().trim();
  for (const c of COMPETITOR_BRANDS) {
    if (c === tb) continue;
    if (low.includes(c)) return c;
  }
  return null;
}

function targetBrandInText(text: string, brand: string): boolean {
  if (!brand.trim()) return false;
  const b = brand.toLowerCase().trim();
  return text.toLowerCase().includes(b);
}

function targetNameOverlap(text: string, name: string, query: string): number {
  const hay = tokens(text);
  const named = unique([...tokens(name), ...tokens(query)].filter((t) => t.length > 2));
  if (!named.length) return 0;
  let hits = 0;
  for (const t of named) {
    if (hay.includes(t)) hits++;
  }
  return hits / named.length;
}

function extractComparisonTargetStatement(text: string, target: TargetProduct): string | null {
  const low = text.toLowerCase();
  const brand = target.brand.toLowerCase().trim();
  if (!brand || !low.includes(brand)) return null;
  const vs = /\b(compared to|versus|vs\.?|better than|worse than|instead of)\b/i;
  if (!vs.test(text)) return null;
  const parts = text.split(/[.!?]/).filter((p) => p.toLowerCase().includes(brand));
  const best = parts.sort((a, b) => b.length - a.length)[0];
  return best?.trim().slice(0, 420) ?? null;
}

/** Mandatory product identity gate before evidence may affect dimension scores. */
export function assessProductEvidenceMatch(text: string, target: TargetProduct): ProductMatchResult {
  const statement = text.trim().slice(0, 500);
  if (statement.length < 8) {
    return {
      level: "unrelated",
      confidence: 0.1,
      brandMatch: false,
      nameMatch: false,
      affectsScore: false,
      reason: "too_short",
    };
  }

  const brandMatch = targetBrandInText(statement, target.brand);
  const nameOverlap = targetNameOverlap(statement, target.name, target.query);
  const nameMatch = nameOverlap >= 0.34;
  const competitor = competitorMentioned(statement, target.brand);

  if (competitor && !brandMatch) {
    const isolated = extractComparisonTargetStatement(statement, target);
    if (isolated) {
      return {
        level: "probable",
        confidence: 0.62,
        brandMatch: true,
        nameMatch: true,
        affectsScore: true,
        reason: "comparison_with_target_isolated",
        isolatedStatement: isolated,
      };
    }
    return {
      level: "unrelated",
      confidence: 0.15,
      brandMatch: false,
      nameMatch: false,
      affectsScore: false,
      reason: `competitor_only:${competitor}`,
    };
  }

  if (competitor && brandMatch) {
    const isolated = extractComparisonTargetStatement(statement, target) ?? statement;
    const level: ProductMatchLevel = nameMatch ? "exact" : "probable";
    return {
      level,
      confidence: nameMatch ? 0.88 : 0.72,
      brandMatch: true,
      nameMatch,
      affectsScore: true,
      reason: "target_and_competitor_comparison",
      isolatedStatement: isolated,
    };
  }

  if (brandMatch && nameMatch) {
    return {
      level: "exact",
      confidence: 0.9,
      brandMatch: true,
      nameMatch: true,
      affectsScore: true,
      reason: "brand_and_name",
      isolatedStatement: statement,
    };
  }

  if (brandMatch || nameOverlap >= 0.5) {
    return {
      level: "probable",
      confidence: brandMatch ? 0.78 : 0.68,
      brandMatch,
      nameMatch: nameOverlap >= 0.34,
      affectsScore: true,
      reason: brandMatch ? "brand_match" : "name_overlap",
      isolatedStatement: statement,
    };
  }

  if (nameOverlap >= 0.2 || /\b(this|it|these)\b/i.test(statement)) {
    return {
      level: "contextual",
      confidence: 0.42,
      brandMatch: false,
      nameMatch: nameOverlap >= 0.2,
      affectsScore: false,
      reason: "contextual_only",
      isolatedStatement: statement,
    };
  }

  return {
    level: "unrelated",
    confidence: 0.12,
    brandMatch: false,
    nameMatch: false,
    affectsScore: false,
    reason: "no_product_signal",
  };
}

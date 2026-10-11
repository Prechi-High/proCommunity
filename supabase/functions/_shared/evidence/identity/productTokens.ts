import type { TargetProduct } from "../identityGate.ts";

const MODIFIER_TOKENS = new Set([
  "plus",
  "pro",
  "max",
  "ultra",
  "mini",
  "lite",
  "se",
  "absolute",
  "detect",
  "slim",
  "fe",
  "5g",
  "unlocked",
  "renewed",
  "refurbished",
  "cream",
  "lotion",
  "gel",
  "serum",
  "cleanser",
  "foundation",
  "lipstick",
  "detect",
]);

const GENERIC_PRODUCT_WORDS = new Set([
  "phone",
  "smartphone",
  "tablet",
  "laptop",
  "watch",
  "earbuds",
  "headphones",
  "charger",
  "bank",
  "moisturizer",
  "moisturiser",
  "cream",
  "lotion",
  "vacuum",
  "cleaner",
  "fryer",
  "washer",
  "blender",
  "bike",
  "bicycle",
]);

export type ParsedTargetProduct = {
  brand: string;
  brandTokens: string[];
  nameTokens: string[];
  coreTokens: string[];
  modifiers: string[];
  numericTokens: string[];
  aliases: string[];
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['"]|['"]$/g, ""))
    .filter((t) => t.length > 1);
}

export function parseTargetProduct(target: TargetProduct, extraAliases: string[] = []): ParsedTargetProduct {
  const brand = (target.brand ?? "").trim();
  const brandTokens = tokenize(brand);
  const nameTokens = tokenize(`${target.name} ${target.query}`);
  const modifiers = nameTokens.filter((t) => MODIFIER_TOKENS.has(t));
  const numericTokens = nameTokens.filter((t) => /^\d+[a-z]?$/.test(t) || /^v\d+/.test(t));
  const coreTokens = nameTokens.filter(
    (t) => !modifiers.includes(t) && !brandTokens.includes(t) && !GENERIC_PRODUCT_WORDS.has(t),
  );
  const aliases = Array.from(
    new Set([target.query, target.name, brand, ...extraAliases].map((s) => s.trim().toLowerCase()).filter(Boolean)),
  );
  return { brand, brandTokens, nameTokens, coreTokens, modifiers, numericTokens, aliases };
}

export function tokensInText(text: string): string[] {
  return tokenize(text);
}

export function phraseOverlap(hay: string[], needle: string[]): number {
  if (!needle.length) return 0;
  const set = new Set(hay);
  let hits = 0;
  for (const t of needle) if (set.has(t)) hits++;
  return hits / needle.length;
}

export function containsAlias(text: string, aliases: string[]): boolean {
  const low = text.toLowerCase();
  return aliases.some((a) => a.length >= 4 && low.includes(a));
}

import type { ParsedTargetProduct } from "./productTokens.ts";
import { phraseOverlap, tokensInText } from "./productTokens.ts";

export type VariantRelation =
  | "exact"
  | "sibling_variant"
  | "related_generation"
  | "competitor"
  | "generic_category"
  | "comparison_context"
  | "ambiguous"
  | "unrelated";

export type VariantAnalysis = {
  relation: VariantRelation;
  mentionBrand: string | null;
  mentionModifiers: string[];
  mentionCoreOverlap: number;
};

const PRONOUN_CUES = /\b(mine|my|this|these|it|the phone|the cream|the lotion|the washer|the vacuum|this one)\b/i;

export function analyzeMentionRelation(
  text: string,
  parsed: ParsedTargetProduct,
  contextText?: string,
): VariantAnalysis {
  const combined = `${text} ${contextText ?? ""}`;
  const tokens = tokensInText(combined);
  const MODIFIERS = new Set([
    "plus",
    "pro",
    "max",
    "ultra",
    "mini",
    "lite",
    "se",
    "absolute",
    "detect",
    "cream",
    "lotion",
    "pm",
    "am",
  ]);
  const mentionModifiers = tokens.filter((t) => MODIFIERS.has(t));

  const brandHit = parsed.brandTokens.length
    ? parsed.brandTokens.some((b) => tokens.includes(b))
    : false;

  const STOP = new Set([
    "love",
    "like",
    "mine",
    "this",
    "that",
    "with",
    "after",
    "still",
    "very",
    "much",
    "model",
    "phone",
    "cream",
    "lotion",
    "great",
    "good",
    "best",
    "been",
    "have",
    "using",
    "the",
    "handed",
    "thicker",
    "bigger",
    "lasts",
    "all",
    "day",
    "weeks",
    "hand",
    "size",
    "use",
    "for",
  ]);
  let mentionBrand: string | null = brandHit ? parsed.brand : null;

  const mentionCoreOverlap = phraseOverlap(tokens, parsed.coreTokens);
  const targetMods = new Set(parsed.modifiers);
  const extraMods = mentionModifiers.filter((m) => !targetMods.has(m));
  const missingTargetMod = parsed.modifiers.some((m) => !mentionModifiers.includes(m));

  const competitorBrands = ["aveeno", "samsung", "galaxy", "shark", "oneplus", "google", "pixel", "neutrogena", "olay", "dove", "nivea"];
  const competitorHit = competitorBrands.find((b) => tokens.includes(b) && !parsed.brandTokens.includes(b));
  if (competitorHit && !brandHit && mentionCoreOverlap < 0.34) {
    return { relation: "competitor", mentionBrand: competitorHit, mentionModifiers, mentionCoreOverlap };
  }

  if (brandHit || mentionCoreOverlap >= 0.5) {
    if (extraMods.length && !missingTargetMod) {
      return { relation: "sibling_variant", mentionBrand: parsed.brand, mentionModifiers, mentionCoreOverlap };
    }
    if (missingTargetMod && mentionModifiers.length < parsed.modifiers.length) {
      return { relation: "sibling_variant", mentionBrand: parsed.brand, mentionModifiers, mentionCoreOverlap };
    }
    const nums = tokens.filter((t) => /^\d+[a-z]?$/.test(t) || /^v\d+/.test(t));
    const targetNums = parsed.numericTokens;
    if (nums.length && targetNums.length && nums.some((n) => !targetNums.includes(n))) {
      const sharedLine = phraseOverlap(tokens, parsed.coreTokens.filter((c) => !/^\d/.test(c))) >= 0.34;
      if (sharedLine) {
        return { relation: "related_generation", mentionBrand: parsed.brand, mentionModifiers, mentionCoreOverlap };
      }
    }
    if (mentionCoreOverlap >= 0.34 || brandHit) {
      return { relation: "exact", mentionBrand: parsed.brand, mentionModifiers, mentionCoreOverlap };
    }
  }

  if (extraMods.length > 0 && parsed.modifiers.every((m) => mentionModifiers.includes(m))) {
    const ctxHasTarget =
      Boolean(contextText) &&
      parsed.aliases.some((a) => a.length >= 4 && contextText!.toLowerCase().includes(a));
    if (ctxHasTarget || /\b(plus|pro|max|absolute|detect)\b/i.test(text)) {
      return { relation: "sibling_variant", mentionBrand: parsed.brand, mentionModifiers, mentionCoreOverlap };
    }
  }

  if (PRONOUN_CUES.test(text) && !brandHit && mentionCoreOverlap < 0.2) {
    return { relation: "ambiguous", mentionBrand, mentionModifiers, mentionCoreOverlap };
  }

  if (/\b(phone|smartphone|moisturizer|lotion|vacuum|air fryer)\b/i.test(text) && mentionCoreOverlap < 0.2) {
    return { relation: "generic_category", mentionBrand, mentionModifiers, mentionCoreOverlap };
  }

  return { relation: "unrelated", mentionBrand, mentionModifiers, mentionCoreOverlap };
}

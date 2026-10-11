import {
  clampConfidence,
  MATCH_AMBIGUOUS,
  MATCH_COMPARISON_ISOLATED,
  MATCH_CONTEXTUAL_EXACT,
  MATCH_EXPLICIT_EXACT,
  MATCH_REJECT,
  MATCH_RELATED_GENERATION,
  MATCH_SIBLING_VARIANT,
} from "../confidence/tiers.ts";
import type { ProductMatchLevel, ProductMatchResult } from "../types.ts";
import type { TargetProduct } from "../identityGate.ts";
import { parseTargetProduct } from "./productTokens.ts";
import { containsAlias, phraseOverlap, tokensInText } from "./productTokens.ts";
import type { EvidenceSourceContext } from "./sourceContext.ts";
import { analyzeMentionRelation } from "./variantRelation.ts";

export type IdentityResolverInput = {
  commentText: string;
  target: TargetProduct;
  context: EvidenceSourceContext;
  aliases?: string[];
};

function extractComparisonTargetStatement(text: string, target: TargetProduct): string | null {
  const brand = target.brand.toLowerCase().trim();
  if (!brand || !text.toLowerCase().includes(brand)) return null;
  const vs = /\b(compared to|versus|vs\.?|better than|worse than|instead of)\b/i;
  if (!vs.test(text)) return null;
  const parts = text.split(/[.!?]/).filter((p) => p.toLowerCase().includes(brand));
  return parts.sort((a, b) => b.length - a.length)[0]?.trim().slice(0, 420) ?? null;
}

function mapRelationToLevel(relation: string): ProductMatchLevel {
  switch (relation) {
    case "exact":
      return "exact";
    case "sibling_variant":
      return "variant_related";
    case "related_generation":
      return "variant_related";
    case "competitor":
      return "unrelated";
    case "comparison_context":
      return "comparison_context";
    case "ambiguous":
      return "contextual";
    case "generic_category":
      return "contextual";
    default:
      return "unrelated";
  }
}

/** System-wide evidence identity resolution (no product-specific rules). */
export function resolveEvidenceIdentity(input: IdentityResolverInput): ProductMatchResult {
  const statement = input.commentText.trim().slice(0, 500);
  if (statement.length < 4) {
    return {
      level: "unrelated",
      confidence: MATCH_REJECT,
      brandMatch: false,
      nameMatch: false,
      affectsScore: false,
      reason: "too_short",
    };
  }

  const parsed = parseTargetProduct(input.target, input.aliases);
  const ctx = input.context;
  const variant = analyzeMentionRelation(statement, parsed, ctx.threadText);

  const explicitInComment =
    containsAlias(statement, parsed.aliases) ||
    phraseOverlap(tokensInText(statement), parsed.nameTokens) >= 0.5;

  if (variant.relation === "competitor" && !containsAlias(statement, parsed.aliases)) {
    const isolated = extractComparisonTargetStatement(statement, input.target);
    if (isolated) {
      return {
        level: "comparison_context",
        confidence: clampConfidence(MATCH_COMPARISON_ISOLATED),
        brandMatch: true,
        nameMatch: true,
        affectsScore: true,
        reason: "comparison_target_isolated",
        isolatedStatement: isolated,
      };
    }
    if (/\b(prefer|love|hate|better|worse)\b/i.test(statement)) {
      return {
        level: "unrelated",
        confidence: MATCH_REJECT,
        brandMatch: false,
        nameMatch: false,
        affectsScore: false,
        reason: "competitor_preference_only",
      };
    }
    return {
      level: "unrelated",
      confidence: MATCH_REJECT,
      brandMatch: false,
      nameMatch: false,
      affectsScore: false,
      reason: "competitor_only",
    };
  }

  if (variant.relation === "sibling_variant") {
    return {
      level: "variant_related",
      confidence: clampConfidence(MATCH_SIBLING_VARIANT),
      brandMatch: true,
      nameMatch: variant.mentionCoreOverlap >= 0.34,
      affectsScore: false,
      reason: "sibling_variant",
      isolatedStatement: statement,
    };
  }

  if (variant.relation === "related_generation") {
    return {
      level: "variant_related",
      confidence: clampConfidence(MATCH_RELATED_GENERATION),
      brandMatch: true,
      nameMatch: false,
      affectsScore: false,
      reason: "related_generation",
      isolatedStatement: statement,
    };
  }

  const hasExtraSkuModifier =
    variant.mentionModifiers.some((m) => !parseTargetProduct(input.target, input.aliases).modifiers.includes(m));

  if ((variant.relation === "exact" || explicitInComment) && !hasExtraSkuModifier) {
    const conf = clampConfidence(MATCH_EXPLICIT_EXACT);
    return {
      level: "exact",
      confidence: conf,
      brandMatch: true,
      nameMatch: true,
      affectsScore: true,
      reason: explicitInComment ? "explicit_product_mention" : "exact_token_overlap",
      isolatedStatement: statement,
    };
  }

  const contextualCue =
    variant.relation === "ambiguous" ||
    /\b(mine|my|this|it)\b/i.test(statement);

  if (contextualCue && ctx.sourceContextConfidence >= 0.65) {
    const conf = clampConfidence(MATCH_CONTEXTUAL_EXACT * (0.85 + ctx.sourceContextConfidence * 0.15));
    return {
      level: "exact",
      confidence: conf,
      brandMatch: Boolean(parsed.brand),
      nameMatch: false,
      affectsScore: true,
      reason: "contextual_exact_product",
      isolatedStatement: statement,
    };
  }

  if (contextualCue && ctx.sourceContextConfidence >= 0.45) {
    return {
      level: "contextual",
      confidence: clampConfidence(MATCH_AMBIGUOUS + ctx.sourceContextConfidence * 0.2),
      brandMatch: false,
      nameMatch: false,
      affectsScore: false,
      reason: "weak_contextual_reference",
      isolatedStatement: statement,
    };
  }

  const comparison = extractComparisonTargetStatement(statement, input.target);
  if (comparison) {
    return {
      level: "comparison_context",
      confidence: clampConfidence(MATCH_COMPARISON_ISOLATED),
      brandMatch: true,
      nameMatch: true,
      affectsScore: true,
      reason: "comparison_with_target",
      isolatedStatement: comparison,
    };
  }

  return {
    level: mapRelationToLevel(variant.relation),
    confidence: MATCH_REJECT,
    brandMatch: false,
    nameMatch: false,
    affectsScore: false,
    reason: "no_product_signal",
  };
}

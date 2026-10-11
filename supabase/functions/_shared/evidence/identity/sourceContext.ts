import type { RawEvidenceInput } from "../types.ts";
import type { ParsedTargetProduct } from "./productTokens.ts";
import { containsAlias, phraseOverlap, tokensInText } from "./productTokens.ts";

export type EvidenceSourceContext = {
  videoTitle?: string;
  videoDescription?: string;
  searchQuery?: string;
  parentText?: string;
  parentAuthor?: string;
  threadText?: string;
  /** 0–1 how strongly surrounding context identifies the target product. */
  sourceContextConfidence: number;
  /** Review-style video vs broad comparison. */
  contextKind: "exact_product_review" | "comparison" | "generic" | "unknown";
};

export function buildEvidenceSourceContext(
  row: RawEvidenceInput,
  parsed: ParsedTargetProduct,
  searchQuery?: string,
): EvidenceSourceContext {
  const videoTitle = row.sourceTitle?.trim() || String(row.rawMetadata?.videoTitle ?? "").trim() || undefined;
  const videoDescription = String(row.rawMetadata?.videoDescription ?? "").trim() || undefined;
  const parentText = row.contextText?.trim() || undefined;
  const parentAuthor = String(row.rawMetadata?.parentAuthor ?? "").trim() || undefined;
  const threadText = [parentText, videoTitle, videoDescription].filter(Boolean).join(" ");

  let sourceContextConfidence = 0.2;
  let contextKind: EvidenceSourceContext["contextKind"] = "unknown";

  const titleLow = (videoTitle ?? "").toLowerCase();
  const threadLow = threadText.toLowerCase();

  const titleHasTarget =
    containsAlias(titleLow, parsed.aliases) ||
    phraseOverlap(tokensInText(titleLow), parsed.coreTokens) >= 0.5 ||
    phraseOverlap(tokensInText(titleLow), parsed.nameTokens) >= 0.45;

  const reviewCue = /\b(review|after \d+ (day|week|month|year)|long.?term|honest|owner|my experience|unboxing)\b/i.test(
    `${videoTitle ?? ""} ${searchQuery ?? ""}`,
  );

  if (titleHasTarget && reviewCue) {
    sourceContextConfidence = 0.92;
    contextKind = "exact_product_review";
  } else if (titleHasTarget) {
    sourceContextConfidence = 0.82;
    contextKind = "exact_product_review";
  } else if (/\b(vs\.?|versus|compare|comparison|better than)\b/i.test(titleLow)) {
    sourceContextConfidence = 0.45;
    contextKind = "comparison";
  } else if (containsAlias(threadLow, parsed.aliases)) {
    sourceContextConfidence = 0.72;
    contextKind = "generic";
  }

  if (parentText && containsAlias(parentText, parsed.aliases)) {
    sourceContextConfidence = Math.max(sourceContextConfidence, 0.75);
  }

  return {
    videoTitle,
    videoDescription,
    searchQuery,
    parentText,
    parentAuthor,
    threadText: threadText || undefined,
    sourceContextConfidence,
    contextKind,
  };
}

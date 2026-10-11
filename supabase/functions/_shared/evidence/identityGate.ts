import { resolveEvidenceIdentity } from "./identity/resolver.ts";
import { buildEvidenceSourceContext } from "./identity/sourceContext.ts";
import { parseTargetProduct } from "./identity/productTokens.ts";
import type { ProductMatchResult } from "./types.ts";
import type { RawEvidenceInput } from "./types.ts";

export type TargetProduct = {
  name: string;
  brand: string;
  model?: string;
  query: string;
};

/** @deprecated Use resolveEvidenceIdentity with full context. */
export function assessProductEvidenceMatch(text: string, target: TargetProduct): ProductMatchResult {
  const parsed = parseTargetProduct(target);
  const ctx = buildEvidenceSourceContext({ id: "legacy", text, platform: "unknown" }, parsed, target.query);
  return resolveEvidenceIdentity({ commentText: text, target, context: ctx });
}

export function assessProductEvidenceMatchWithContext(
  row: Pick<RawEvidenceInput, "text" | "sourceTitle" | "contextText" | "rawMetadata">,
  target: TargetProduct,
  searchQuery?: string,
): ProductMatchResult {
  const parsed = parseTargetProduct(target);
  const ctx = buildEvidenceSourceContext(
    { id: "ctx", text: row.text, platform: "unknown", sourceTitle: row.sourceTitle, contextText: row.contextText, rawMetadata: row.rawMetadata },
    parsed,
    searchQuery,
  );
  return resolveEvidenceIdentity({ commentText: row.text, target, context: ctx });
}

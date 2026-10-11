import { buildEvidenceSourceContext } from "../identity/sourceContext.ts";
import { resolveEvidenceIdentity } from "../identity/resolver.ts";
import { parseTargetProduct } from "../identity/productTokens.ts";
import { mapTextToDimensions } from "../relevance/mapDimensions.ts";
import { ALL_IDENTITY_LABELS, RELEVANCE_LABELS } from "./labeledExamples.ts";

function identityExample(row: (typeof IDENTITY_LABELS)[0]) {
  const parsed = parseTargetProduct(row.target);
  const ctx = buildEvidenceSourceContext(
    {
      id: row.id,
      text: row.text,
      platform: "youtube",
      sourceTitle: row.context?.videoTitle ?? "",
      contextText: row.context?.parentText,
    },
    parsed,
    row.target.query,
  );
  return resolveEvidenceIdentity({
    commentText: row.text,
    target: row.target,
    context: ctx,
  });
}

export function runIdentityEvaluation() {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const row of ALL_IDENTITY_LABELS) {
    const r = identityExample(row);
    const pred = r.affectsScore;
    const exp = row.expect.affectsScore;
    if (pred && exp) tp++;
    else if (pred && !exp) fp++;
    else if (!pred && exp) fn++;
    else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  return { tp, fp, fn, tn, precision, recall, total: ALL_IDENTITY_LABELS.length };
}

export function runRelevanceEvaluation() {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const row of RELEVANCE_LABELS) {
    const mappings = mapTextToDimensions(
      row.text,
      [
        {
          key: row.dimension.key,
          label: row.dimension.label,
          importance: 0.8,
          keywords: row.dimension.keywords,
          whyItMatters: row.dimension.whyItMatters,
        },
      ],
      true,
      {
        sourceContext: buildEvidenceSourceContext(
          { id: row.id, text: row.text, platform: "youtube", sourceTitle: row.context?.videoTitle ?? "" },
          parseTargetProduct({ name: "x", brand: "y", query: "z" }),
        ),
      },
    );
    const hit = mappings.some((m) => m.dimensionKey === row.dimension.key);
    const exp = row.expect.maps;
    if (hit && exp) tp++;
    else if (hit && !exp) fp++;
    else if (!hit && exp) fn++;
    else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  return { tp, fp, fn, tn, precision, recall, total: RELEVANCE_LABELS.length };
}

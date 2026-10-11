import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildEvidenceSourceContext } from "../identity/sourceContext.ts";
import { parseTargetProduct } from "../identity/productTokens.ts";
import { resolveEvidenceIdentity } from "../identity/resolver.ts";
import { mapTextToDimensions } from "../relevance/mapDimensions.ts";
import { runIdentityEvaluation, runRelevanceEvaluation } from "../evaluation/metrics.ts";
import { IDENTITY_LABELS, RELEVANCE_LABELS } from "../evaluation/labeledExamples.ts";

function resolve(text: string, target: { name: string; brand: string; query: string }, videoTitle?: string) {
  const parsed = parseTargetProduct(target);
  const ctx = buildEvidenceSourceContext(
    { id: "t", text, platform: "youtube", sourceTitle: videoTitle ?? "" },
    parsed,
    target.query,
  );
  return resolveEvidenceIdentity({ commentText: text, target, context: ctx });
}

describe("evidence calibration matrix", () => {
  for (const row of IDENTITY_LABELS) {
    it(`identity ${row.id}`, () => {
      const r = resolve(row.text, row.target, row.context?.videoTitle);
      assert.equal(r.affectsScore, row.expect.affectsScore, `${row.id} affectsScore`);
      if (row.expect.minConfidence != null) assert.ok(r.confidence >= row.expect.minConfidence);
      if (row.expect.level) assert.equal(r.level, row.expect.level);
    });
  }

  for (const row of RELEVANCE_LABELS) {
    it(`relevance ${row.id}`, () => {
      const dims = [
        {
          key: row.dimension.key,
          label: row.dimension.label,
          importance: 0.8,
          keywords: row.dimension.keywords,
          whyItMatters: row.dimension.whyItMatters,
        },
      ];
      const parsed = parseTargetProduct({ name: "p", brand: "b", query: "q" });
      const sourceContext = buildEvidenceSourceContext(
        { id: row.id, text: row.text, platform: "youtube", sourceTitle: row.context?.videoTitle ?? "" },
        parsed,
      );
      const links = mapTextToDimensions(row.text, dims, true, { sourceContext });
      const hit = links.find((l) => l.dimensionKey === row.dimension.key);
      if (row.expect.maps) {
        assert.ok(hit, `expected mapping for ${row.id}`);
        if (row.expect.minConfidence != null) assert.ok(hit!.relevanceConfidence >= row.expect.minConfidence);
        if (row.expect.snippetIncludes) {
          assert.ok(hit!.extractedStatement?.toLowerCase().includes(row.expect.snippetIncludes.toLowerCase()));
        }
      } else {
        assert.ok(!hit, `should not map ${row.id}`);
      }
    });
  }

  it("evaluation identity precision/recall thresholds", () => {
    const m = runIdentityEvaluation();
    assert.ok(m.precision >= 0.8, `precision ${m.precision}`);
    assert.ok(m.recall >= 0.8, `recall ${m.recall}`);
  });

  it("evaluation relevance precision/recall thresholds", () => {
    const m = runRelevanceEvaluation();
    assert.ok(m.precision >= 0.8, `precision ${m.precision}`);
    assert.ok(m.recall >= 0.8, `recall ${m.recall}`);
  });
});

describe("adversarial calibration", () => {
  it("sibling plus model does not score for regular target", () => {
    const r = resolve("The Plus model is much bigger.", { name: "iPhone 8", brand: "Apple", query: "iPhone 8" });
    assert.equal(r.affectsScore, false);
    assert.equal(r.level, "variant_related");
  });

  it("contextual battery under review video", () => {
    const r = resolve(
      "Mine still has 88% battery health after 2 years.",
      { name: "iPhone 8", brand: "Apple", query: "iPhone 8" },
      "iPhone 8 Review After 2 Years",
    );
    assert.equal(r.affectsScore, true);
    const links = mapTextToDimensions(
      "Mine still has 88% battery health after 2 years.",
      [{ key: "battery_health", label: "Battery Health", importance: 0.9, keywords: ["battery", "health", "degradation"] }],
      true,
      {
        sourceContext: buildEvidenceSourceContext(
          { id: "x", text: "", platform: "youtube", sourceTitle: "iPhone 8 Review After 2 Years" },
          parseTargetProduct({ name: "iPhone 8", brand: "Apple", query: "iPhone 8" }),
        ),
      },
    );
    assert.ok(links.some((l) => l.dimensionKey === "battery_health" && l.relevanceConfidence >= 0.8));
  });
});

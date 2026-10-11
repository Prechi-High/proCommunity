import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateDimensionSufficiency,
  evaluateOverallScoreEligibility,
  SUFFICIENCY_THRESHOLDS,
  type ScoringEvidenceItem,
} from "../sufficiency.ts";
import { computeDimensionConfidence } from "../pipeline.ts";

function item(partial: Partial<ScoringEvidenceItem> & { evidenceId: string }): ScoringEvidenceItem {
  return {
    platform: "reddit",
    author: "user_a",
    url: "https://example.com/a",
    relevanceConfidence: 0.8,
    productMatchConfidence: 0.85,
    affectsScore: true,
    ...partial,
  };
}

describe("evaluateOverallScoreEligibility", () => {
  it("requires 3 numeric dimensions or half of primary set", () => {
    assert.equal(evaluateOverallScoreEligibility(3, 6), true);
    assert.equal(evaluateOverallScoreEligibility(2, 6), false);
    assert.equal(evaluateOverallScoreEligibility(2, 4), true);
    assert.equal(evaluateOverallScoreEligibility(3, 8), true);
    assert.equal(evaluateOverallScoreEligibility(1, 4), false);
  });
});

describe("evaluateDimensionSufficiency", () => {
  it("0 items → unavailable", () => {
    const r = evaluateDimensionSufficiency([]);
    assert.equal(r.scoreDisplay, "unavailable");
    assert.equal(r.sufficientForNumericScore, false);
  });

  it("1 valid positive item → limited", () => {
    const r = evaluateDimensionSufficiency([item({ evidenceId: "e1" })]);
    assert.equal(r.scoreDisplay, "limited");
    assert.equal(r.validatedReportCount, 1);
  });

  it("2 valid items same author → limited", () => {
    const r = evaluateDimensionSufficiency([
      item({ evidenceId: "e1", author: "same" }),
      item({ evidenceId: "e2", author: "same" }),
    ]);
    assert.equal(r.scoreDisplay, "limited");
    assert.equal(r.uniqueSources, 1);
  });

  it("3 items but only 1 unique source → limited", () => {
    const r = evaluateDimensionSufficiency([
      item({ evidenceId: "e1", author: "solo" }),
      item({ evidenceId: "e2", author: "solo" }),
      item({ evidenceId: "e3", author: "solo" }),
    ]);
    assert.equal(r.scoreDisplay, "limited");
    assert.equal(r.uniqueSources, 1);
  });

  it("3 items, 2+ sources, high relevance/match → numeric", () => {
    const r = evaluateDimensionSufficiency([
      item({ evidenceId: "e1", author: "a" }),
      item({ evidenceId: "e2", author: "b" }),
      item({ evidenceId: "e3", author: "c" }),
    ]);
    assert.equal(r.scoreDisplay, "numeric");
    assert.equal(r.sufficientForNumericScore, true);
  });

  it("low product-match prevents numeric", () => {
    const r = evaluateDimensionSufficiency([
      item({ evidenceId: "e1", author: "a", productMatchConfidence: 0.5 }),
      item({ evidenceId: "e2", author: "b", productMatchConfidence: 0.5 }),
      item({ evidenceId: "e3", author: "c", productMatchConfidence: 0.5 }),
    ]);
    assert.equal(r.scoreDisplay, "limited");
  });

  it("low relevance prevents numeric", () => {
    const r = evaluateDimensionSufficiency([
      item({ evidenceId: "e1", author: "a", relevanceConfidence: 0.5 }),
      item({ evidenceId: "e2", author: "b", relevanceConfidence: 0.5 }),
      item({ evidenceId: "e3", author: "c", relevanceConfidence: 0.5 }),
    ]);
    assert.equal(r.scoreDisplay, "limited");
  });
});

describe("confidence caps when insufficient", () => {
  it("single agreeing item cannot exceed maxConfidenceWhenInsufficient via pipeline integration", async () => {
    const { buildDimensionExperiencePackage } = await import("../pipeline.ts");
    const profile = {
      identity: { name: "Moisturizing Cream", brand: "CeraVe" },
      voices: [
        {
          id: "v1",
          text: "CeraVe moisturizing cream keeps my face hydrated all day.",
          platform: "youtube",
          author: "only_one",
          url: "https://youtube.com/watch?v=abc",
        },
      ],
    };
    const { package: pkg } = buildDimensionExperiencePackage({
      productId: "cerave-moisturizing-cream",
      blueprintId: "bp_test",
      query: "CeraVe Moisturizing Cream",
      profile,
      dimensions: [
        { key: "hydration", label: "Hydration", importance: 0.9, keywords: ["hydrat", "moistur", "dry"] },
      ],
    });
    const b = pkg.byKey.hydration;
    assert.ok(b);
    assert.equal(b.scoreDisplay, "limited");
    assert.equal(b.score, null);
    assert.ok(b.confidence <= SUFFICIENCY_THRESHOLDS.maxConfidenceWhenInsufficient + 0.001);
  });

  it("second unique source increases confidence", () => {
    const base = {
      platform: "reddit",
      relevanceConfidence: 0.75,
      productMatchConfidence: 0.85,
      affectsScore: true,
      stance: "positive" as const,
      strength: 0.7,
    };
    const mk = (uniqueSources: number) => {
      const items = [0, 1, 2].map((i) => ({
        evidenceId: String(i),
        author: `user_${i % uniqueSources}`,
        ...base,
      }));
      return computeDimensionConfidence(items, { pos: 2.1, neg: 0, mix: 0 }, true, uniqueSources, 0.75, 0.85);
    };
    assert.ok(mk(3) > mk(1));
  });
});

describe("mixed-heavy confidence", () => {
  it("does not stay extremely high when evidence is mostly mixed", () => {
    const items: Array<ScoringEvidenceItem & { stance: string; strength: number }> = [];
    for (let i = 0; i < 4; i++) {
      items.push({
        evidenceId: `p${i}`,
        platform: "reddit",
        author: `user_p${i}`,
        relevanceConfidence: 0.82,
        productMatchConfidence: 0.9,
        affectsScore: true,
        stance: "positive",
        strength: 0.7,
      });
    }
    for (let i = 0; i < 16; i++) {
      items.push({
        evidenceId: `m${i}`,
        platform: "youtube",
        author: `user_m${i}`,
        relevanceConfidence: 0.8,
        productMatchConfidence: 0.88,
        affectsScore: true,
        stance: "mixed",
        strength: 0.45,
      });
    }
    let pos = 0;
    let neg = 0;
    let mix = 0;
    for (const i of items) {
      if (i.stance === "positive") pos += i.strength;
      else if (i.stance === "mixed") mix += i.strength * 0.5;
    }
    const confidence = computeDimensionConfidence(items, { pos, neg, mix }, true, 12, 0.81, 0.89);
    assert.ok(confidence < 0.75, `expected <75% got ${confidence}`);
  });
});

describe("dynamic overall score", () => {
  it("does not fall back to legacy profile.score when dimensions are insufficient", async () => {
    const { buildPresentationFromProfile } = await import("../../blueprint/build.ts");
    const presentation = buildPresentationFromProfile(
      "test-cream",
      "Brand Test Cream",
      {
        identity: { name: "Moisturizing Cream", brand: "CeraVe" },
        score: 78,
        voices: [
          {
            id: "v1",
            text: "CeraVe moisturizing cream absorbs immediately on my dry skin.",
            platform: "reddit",
            author: "solo",
            url: "https://reddit.com/r/skincare/example",
          },
        ],
      },
      "bp_test",
      1,
      undefined,
      {
        classification: {
          domain: "beauty",
          categoryId: "skincare",
          templateId: "moisturizer",
          productType: "moisturizer",
          productSubtype: null,
          classificationConfidence: 0.9,
          primaryUses: [],
          buyerExpectations: [],
          riskFactors: [],
        },
        factSections: [],
        dimensions: [{ key: "absorption", label: "Absorption", importance: 0.9, keywords: ["absorb", "greasy", "film"] }],
      },
    );
    assert.equal(presentation.overview.score, null);
    assert.notEqual(presentation.overview.scoreDisplay, "numeric");
    assert.equal(presentation.overview.dimensions[0]?.score, null);
    assert.notEqual(presentation.overview.dimensions[0]?.scoreDisplay, "numeric");
  });
});

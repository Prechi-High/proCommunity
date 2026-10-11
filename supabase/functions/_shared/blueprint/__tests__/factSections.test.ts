import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPresentationFromProfile } from "../build.ts";

describe("fact section consolidation", () => {
  it("merges overlapping Specs and Details into one tab for grocery-style products", () => {
    const presentation = buildPresentationFromProfile(
      "kirkland-coconut-oil",
      "Kirkland Organic Virgin Coconut Oil",
      {
        identity: { name: "Organic Virgin Coconut Oil", brand: "Kirkland" },
        specs: [
          { label: "Volume", value: "84 fl oz" },
          { label: "Certification", value: "USDA Organic" },
        ],
        voices: [],
      },
      "bp_coconut",
      1,
      undefined,
      {
        classification: {
          domain: "beauty",
          categoryId: "grocery",
          templateId: "coconut_oil",
          productType: "coconut_oil",
          productSubtype: null,
          classificationConfidence: 0.85,
          primaryUses: [],
          buyerExpectations: [],
          riskFactors: [],
        },
        factSections: [
          { key: "specs", label: "Specs", renderer: "fact_groups", fieldKeys: [] },
          { key: "product_details", label: "Details", renderer: "grouped_facts", fieldKeys: [] },
          { key: "ingredients", label: "Ingredients", renderer: "ingredient_list", fieldKeys: [] },
        ],
        dimensions: [{ key: "purity_standard", label: "Purity Standard", importance: 0.9, keywords: ["organic", "pure"] }],
      },
    );
    const factual = presentation.factSections.filter((s) => s.key !== "ingredients");
    const detailTabs = factual.filter((s) => /spec|detail/i.test(s.key) || /spec|detail/i.test(s.title));
    assert.equal(detailTabs.length, 1, "expected one merged Details/Specs tab");
    assert.ok(presentation.factSections.some((s) => s.key === "ingredients"));
  });
});

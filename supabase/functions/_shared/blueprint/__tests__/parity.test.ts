import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classificationFromLlm, parseLlmBlueprintPayload } from "../llmBlueprint.ts";
import { validateBlueprintDimensions } from "../validate.ts";

const FIXTURES: Record<string, Record<string, unknown>> = {
  smartphone: {
    domain: "tech",
    product_family: "mobile",
    product_type: "smartphone",
    product_subtype: "flagship",
    primary_uses: ["communication", "photography"],
    buyer_expectations: ["reliable battery"],
    risk_factors: ["overheating"],
    fact_sections: [{ key: "specs", label: "Specs", renderer: "fact_grid" }],
    fact_field_candidates: ["display", "battery", "camera"],
    dimensions: [
      { key: "camera_quality", label: "Camera", importance: 0.9 },
      { key: "battery_endurance", label: "Battery", importance: 0.88 },
      { key: "performance", label: "Performance", importance: 0.85 },
      { key: "heat_management", label: "Heat", importance: 0.7 },
    ],
  },
  foundation: {
    domain: "beauty",
    product_family: "makeup",
    product_type: "foundation",
    fact_sections: [
      { key: "ingredients", label: "Ingredients", renderer: "ingredient_list" },
      { key: "product_details", label: "Product Details", renderer: "grouped_facts" },
    ],
    fact_field_candidates: ["ingredients", "coverage_type", "finish"],
    dimensions: [
      { key: "coverage", label: "Coverage", importance: 0.95 },
      { key: "wear_longevity", label: "Longevity", importance: 0.9 },
      { key: "oxidation", label: "Oxidation", importance: 0.8 },
      { key: "transfer_resistance", label: "Transfer", importance: 0.82 },
    ],
    excluded_examples: ["camera_quality"],
  },
  mountain_bike: {
    domain: "inferred",
    product_family: "cycling",
    product_type: "mountain_bike",
    fact_sections: [{ key: "materials", label: "Materials", renderer: "material_list" }],
    fact_field_candidates: ["frame", "suspension", "wheel_size"],
    dimensions: [
      { key: "handling", label: "Handling", importance: 0.9 },
      { key: "braking", label: "Braking", importance: 0.88 },
      { key: "comfort", label: "Comfort", importance: 0.8 },
      { key: "durability", label: "Durability", importance: 0.85 },
    ],
    excluded_examples: ["camera_quality", "coverage"],
  },
};

describe("dynamic blueprint parity", () => {
  for (const [name, payload] of Object.entries(FIXTURES)) {
    it(`parses ${name} without category leakage`, () => {
      const parsed = parseLlmBlueprintPayload(payload);
      assert.ok(parsed);
      const classification = classificationFromLlm(parsed);
      const keys = parsed.dimensions.map((d) => d.key);
      const validation = validateBlueprintDimensions(classification.domain, keys);
      assert.equal(validation.ok, true, `leaked keys: ${validation.rejected.join(",")}`);
      if (name === "foundation") {
        assert.ok(!keys.includes("camera_quality"));
      }
      if (name === "mountain_bike") {
        assert.ok(!keys.includes("camera_quality"));
        assert.ok(!keys.includes("coverage"));
      }
    });
  }
});

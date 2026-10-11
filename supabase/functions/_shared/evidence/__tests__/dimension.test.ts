import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapStatementToDimensions } from "../dimensionRelevance.ts";

const moisturizerDims = [
  { key: "hydration", label: "Hydration", importance: 0.9, keywords: ["hydrat", "moistur", "dry"] },
  { key: "absorption", label: "Absorption", importance: 0.85, keywords: ["absorb", "greasy", "film"] },
];

describe("dimension relevance gate", () => {
  it("maps least moisturising to hydration not absorption", () => {
    const links = mapStatementToDimensions("This was the least moisturising lotion I've used.", moisturizerDims, true);
    assert.ok(links.some((l) => l.dimensionKey === "hydration"));
    assert.ok(!links.some((l) => l.dimensionKey === "absorption"));
  });

  it("maps absorbs immediately to absorption", () => {
    const links = mapStatementToDimensions("It absorbs immediately without a greasy film.", moisturizerDims, true);
    assert.ok(links.some((l) => l.dimensionKey === "absorption"));
  });
});

const coconutDims = [
  { key: "purity_standard", label: "Purity Standard", importance: 0.92, keywords: ["pure", "organic", "virgin", "unrefined", "certif"] },
  { key: "value", label: "Value", importance: 0.8, keywords: ["value", "price", "worth", "cost"] },
  { key: "versatility", label: "Versatility", importance: 0.85, keywords: ["versatile", "cooking", "multi", "use"] },
  { key: "processing_quality", label: "Processing", importance: 0.82, keywords: ["cold pressed", "refined", "process", "unrefined"] },
];

describe("coconut oil dimension semantics", () => {
  it("best value maps to Value not Purity", () => {
    const links = mapStatementToDimensions("Kirkland organic coconut oil is the best value at Costco.", coconutDims, true);
    assert.ok(links.some((l) => l.dimensionKey === "value"));
    assert.ok(!links.some((l) => l.dimensionKey === "purity_standard"));
  });

  it("very versatile maps to Versatility not Purity", () => {
    const links = mapStatementToDimensions("This oil is very versatile for cooking and skin.", coconutDims, true);
    assert.ok(links.some((l) => l.dimensionKey === "versatility"));
    assert.ok(!links.some((l) => l.dimensionKey === "purity_standard"));
  });

  it("USDA Organic maps to Purity", () => {
    const links = mapStatementToDimensions("It is USDA Organic certified virgin coconut oil.", coconutDims, true);
    assert.ok(links.some((l) => l.dimensionKey === "purity_standard"));
  });

  it("cold pressed and unrefined maps to Processing and Purity", () => {
    const links = mapStatementToDimensions("Cold pressed and unrefined with no additives.", coconutDims, true);
    assert.ok(links.some((l) => l.dimensionKey === "processing_quality"));
    assert.ok(links.some((l) => l.dimensionKey === "purity_standard"));
  });
});

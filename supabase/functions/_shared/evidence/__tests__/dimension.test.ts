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

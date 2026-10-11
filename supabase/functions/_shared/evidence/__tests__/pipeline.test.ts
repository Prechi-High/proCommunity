import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDimensionExperiencePackage } from "../pipeline.ts";

describe("dimension scorecard evidence pipeline", () => {
  it("attaches evidence items used for visible score", () => {
    const profile = {
      identity: { name: "Moisturizing Cream", brand: "CeraVe" },
      voices: [
        {
          id: "v1",
          text: "CeraVe moisturizing cream absorbs immediately on my dry skin.",
          platform: "reddit",
          author: "user",
          url: "https://reddit.com/r/skincare/example",
        },
        {
          id: "v2",
          text: "CeraVe moisturizing cream keeps my face hydrated all day.",
          platform: "youtube",
          author: "viewer",
          url: "https://youtube.com/watch?v=abc",
        },
      ],
    };
    const dims = [
      { key: "hydration", label: "Hydration", importance: 0.9, keywords: ["hydrat", "moistur", "dry"] },
      { key: "absorption", label: "Absorption", importance: 0.85, keywords: ["absorb", "greasy", "film"] },
    ];
    const { package: pkg } = buildDimensionExperiencePackage({
      productId: "cerave-moisturizing-cream",
      blueprintId: "bp_cerave_v2",
      query: "CeraVe Moisturizing Cream",
      profile,
      dimensions: dims,
    });
    const scored = Object.values(pkg.byKey).find((b) => b.items.length >= 1);
    assert.ok(scored, "expected at least one dimension with mapped evidence");
    assert.ok(scored!.finding.length > 10);
  });
});

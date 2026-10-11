import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBundledYoutubeSearchPlans } from "../providers/youtube/searchBundle.ts";
import { planEvidenceQueries } from "../queryPlanner.ts";

describe("OR-bundled YouTube search plans", () => {
  it("uses anchors plus OR bundles with pipe syntax", () => {
    const input = {
      productId: "p",
      productName: "Daily Moisturizing Lotion",
      brand: "CeraVe",
      domain: "beauty" as const,
      dimensions: [
        { key: "hydration", label: "Hydration", importance: 0.9, keywords: ["hydrat"] },
        { key: "absorption", label: "Absorption", importance: 0.85, keywords: ["absorb"] },
        { key: "irritation", label: "Irritation", importance: 0.8, keywords: ["irritat"] },
      ],
    };
    const planned = planEvidenceQueries(input);
    const plans = buildBundledYoutubeSearchPlans(input, planned, 5);
    assert.ok(plans.length <= 5);
    assert.ok(plans.some((p) => p.query.includes("review")));
    const bundled = plans.filter((p) => p.kind === "bundled_or");
    assert.ok(bundled.some((p) => p.query.includes("|")));
  });
});

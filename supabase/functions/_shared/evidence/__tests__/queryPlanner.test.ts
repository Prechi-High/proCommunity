import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalProductLabel,
  planEvidenceQueries,
  selectYoutubeSearchQueries,
} from "../queryPlanner.ts";

describe("canonicalProductLabel", () => {
  it("does not duplicate brand in product name", () => {
    const label = canonicalProductLabel({
      brand: "CeraVe",
      productName: "CeraVe Daily Moisturizing Lotion",
    });
    assert.ok(!label.toLowerCase().includes("cerave cerave"));
    assert.match(label, /CeraVe/i);
    assert.match(label, /Daily Moisturizing Lotion/i);
  });
});

describe("selectYoutubeSearchQueries", () => {
  it("dedupes and caps query count", () => {
    const planned = planEvidenceQueries({
      productId: "p",
      productName: "Pixel 10 Pro",
      brand: "Google",
      domain: "tech",
      dimensions: [{ key: "battery_endurance", label: "Battery", importance: 0.9, keywords: ["battery"] }],
    });
    const selected = selectYoutubeSearchQueries(planned, 5);
    assert.equal(selected.length, 5);
    const keys = new Set(selected.map((s) => s.query.toLowerCase()));
    assert.equal(keys.size, selected.length);
    assert.ok(selected.some((s) => s.kind === "general"));
  });
});

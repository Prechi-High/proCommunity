import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessProductEvidenceMatch } from "../identityGate.ts";

const cerave = { name: "Moisturizing Cream", brand: "CeraVe", query: "CeraVe Moisturizing Cream" };

describe("product identity gate", () => {
  it("rejects competitor-only Aveeno mention for CeraVe", () => {
    const r = assessProductEvidenceMatch("Aveeno is much better for eczema.", cerave);
    assert.equal(r.level, "unrelated");
    assert.equal(r.affectsScore, false);
  });

  for (const brand of ["E45", "Palmer's", "Bio-Oil"]) {
    it(`rejects unrelated ${brand} mention`, () => {
      const r = assessProductEvidenceMatch(`I switched to ${brand} and love it.`, cerave);
      assert.equal(r.affectsScore, false);
    });
  }

  it("accepts explicit CeraVe owner statement", () => {
    const r = assessProductEvidenceMatch("CeraVe moisturizing cream absorbs fast on my face.", cerave);
    assert.equal(r.affectsScore, true);
    assert.ok(r.confidence >= 0.7);
  });
});

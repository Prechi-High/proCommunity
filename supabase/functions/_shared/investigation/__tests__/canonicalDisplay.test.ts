import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canonicalFromListing } from "../canonicalDisplay.ts";

describe("canonicalFromListing", () => {
  it("splits retailer listing into canonical name and variant", () => {
    const raw = "Apple iPhone X -64gb - Silver (unlocked) A1901 (gsm) (ca)";
    const out = canonicalFromListing(raw, "Apple");
    assert.equal(out.rawListingTitle, raw);
    assert.match(out.canonicalDisplayName, /iPhone X/i);
    assert.match(out.variantDisplay, /64 GB/i);
    assert.match(out.variantDisplay, /Silver/i);
  });
});

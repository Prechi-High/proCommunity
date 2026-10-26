import test from "node:test";
import assert from "node:assert/strict";
import { offerDiscount, offerMoney } from "../offerPresentation";
import { cleanProductQuery } from "../communitySearchQuery";
test("discount is never shown without a valid genuine price reduction", () => {
  assert.equal(offerDiscount(12500, 15000), 16);
  assert.equal(offerDiscount(15000, 12500), 0);
  assert.equal(offerDiscount(null, 100), 0);
  assert.equal(offerDiscount(50, 0), 0);
  assert.equal(offerDiscount(-1, 100), 0);
  assert.equal(offerDiscount(Infinity, 100), 0);
  assert.equal(offerDiscount(0, 100), 100);
});
test("prices preserve fractional amounts", () => {
  assert.match(offerMoney(12500.5), /12,500\.50/);
  assert.match(offerMoney(12500), /12,500/);
});
test("product filter strips PostgREST operators and keeps search text bounded", () => {
  assert.equal(cleanProductQuery("  L’Oréal, (%serum_)  "), "L Oréal serum");
  assert.equal(cleanProductQuery("a".repeat(200)).length, 100);
  assert.ok(!/[(),%_]/.test(cleanProductQuery("x),id.eq.secret%")));
});

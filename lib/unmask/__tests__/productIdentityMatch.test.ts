import { test } from "node:test";
import assert from "node:assert/strict";
import { exactCommunityMatch } from "../productIdentityMatch";
const product = (id: string, name: string, brand = "Acme") => ({
  id,
  name,
  brand,
  category: "Skincare",
  heroImageUrl: null,
});
test("finds canonical community identity despite punctuation and brand prefix", () =>
  assert.equal(
    exactCommunityMatch(product("scan", "Acme Daily Cream"), [
      product("canonical", "Daily Cream"),
    ])?.id,
    "canonical",
  ));
test("does not merge a different strength or size into its community", () =>
  assert.equal(
    exactCommunityMatch(product("scan", "Daily Cream 50ml"), [
      product("other", "Daily Cream 100ml"),
    ]),
    null,
  ));
test("does not guess between ambiguous catalogue entries", () =>
  assert.equal(
    exactCommunityMatch(product("scan", "Daily Cream"), [
      product("a", "Daily Cream"),
      product("b", "Daily Cream"),
    ]),
    null,
  ));
test("does not merge identically named products from different brands", () =>
  assert.equal(
    exactCommunityMatch(product("scan", "Daily Cream", "Other"), [
      product("a", "Daily Cream"),
    ]),
    null,
  ));

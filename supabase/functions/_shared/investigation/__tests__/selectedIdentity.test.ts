import { test } from "node:test";
import assert from "node:assert/strict";
import { selectedIdentityDetail } from "../selectedIdentity.ts";
test("web synthesis cannot invent a more restrictive model or variant", () => {
  assert.equal(selectedIdentityDetail("345 Relief Cream", "Ver.2"), "");
  assert.equal(selectedIdentityDetail("345 Relief Cream", "Standard"), "");
  assert.equal(selectedIdentityDetail("iPhone 15 Pro", "15 Pro"), "15 Pro");
  assert.equal(selectedIdentityDetail("iPhone 15 Pro", "5 Pro"), "");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSelectedProductName } from "../selectedIdentity.ts";
test("listing duplication is removed without changing the model", () => {
 assert.equal(cleanSelectedProductName('Bath & Body Works Bath & Body Works "Butterfly" Body Cream'), "Bath & Body Works Butterfly Body Cream");
 assert.equal(cleanSelectedProductName("iPhone 15 Pro"), "iPhone 15 Pro");
});

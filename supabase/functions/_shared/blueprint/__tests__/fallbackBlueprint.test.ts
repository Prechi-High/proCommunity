import { test } from "node:test";
import assert from "node:assert/strict";
import { fallbackBlueprint } from "../fallbackBlueprint.ts";
test("body cream has assessment dimensions when category generation is unavailable", () => {
 const result = fallbackBlueprint("butterfly", { name: "Bath & Body Works Butterfly Body Cream" }, "Butterfly");
 assert.equal(result.classification.domain, "beauty");
 assert.deepEqual(result.dimensions.map(d => d.key), ["hydration", "absorption", "skin_comfort", "texture", "fragrance"]);
 assert.ok(result.dimensions.every(d => d.keywords.length === 0));
});
test("talc avoids foundation dimensions and dairy cream avoids skincare dimensions", () => {
 const talc = fallbackBlueprint("talc", { name: "Passion Talcum Powder" }, "Passion");
 assert.ok(talc.dimensions.some(d => d.key === "moisture_absorption"));
 assert.ok(!talc.dimensions.some(d => /shade|coverage/.test(d.key)));
 const food = fallbackBlueprint("food", { name: "Fresh Dairy Cream" }, "Fresh Cream");
 assert.ok(!food.dimensions.some(d => d.key === "hydration"));
});

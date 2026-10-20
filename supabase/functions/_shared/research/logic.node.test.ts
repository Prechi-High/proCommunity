import test from "node:test";
import assert from "node:assert/strict";
import { logicSelfTest } from "./logic.js";
test("parallel research scheduling and aggregation regressions", () => {
  assert.equal(logicSelfTest().passed, 9);
});

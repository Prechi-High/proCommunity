import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { heuristicResolve } from "../heuristics.ts";

describe("domain heuristics", () => {
  it("beauty keyword fallback uses beauty slug", () => {
    const r = heuristicResolve({ category: "skincare", name: "Daily lotion" }, "daily lotion", new Map());
    assert.ok(r);
    assert.equal(r!.domainSlug, "beauty");
  });
});

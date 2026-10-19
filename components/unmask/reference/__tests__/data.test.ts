import { test } from "node:test";
import assert from "node:assert/strict";
import { dimensions, evidenceRows } from "../data";
import type { ProductProfile } from "@/lib/types";
import type { DimensionExperienceBundle } from "@/lib/unmask/dimensionEvidence";
const report = (id: string, parentId?: string) => ({
  evidenceId: id,
  statement: "hydration comment",
  platform: "youtube",
  url: "https://youtube.com/watch?v=fixture",
  stance: "positive" as const,
  strength: 1,
  relevanceConfidence: 1,
  productMatchConfidence: 1,
  affectsScore: true,
  parentId,
  isReply: !!parentId,
});
const hydration = {
  dimensionId: "hydration",
  dimensionKey: "hydration",
  label: "Hydration",
  finding: "Hydration is discussed",
  items: [report("root"), report("reply", "root"), report("root")],
} as DimensionExperienceBundle;
const profile = {
  id: "fixture",
  sources: [],
  specs: [],
  voices: [],
  dimensionExperience: { algorithmVersion: "1", byKey: { hydration } },
  identity: { name: "Cleanser", brand: "Example", category: "Skincare" },
} as unknown as ProductProfile;
test("uses returned product dimensions, never a hardcoded unrelated category set", () => {
  assert.deepEqual(
    dimensions(profile).map((d) => d.label),
    ["Hydration"],
  );
});
test("deduplicates records and preserves reply provenance", () => {
  const rows = evidenceRows(profile, "Hydration");
  assert.equal(rows.length, 2);
  assert.equal(rows[1].parentId, "root");
  assert.equal(rows[1].isReply, true);
});
test("an unmatched topic does not leak other topic evidence", () => {
  assert.equal(evidenceRows(profile, "Durability").length, 0);
});

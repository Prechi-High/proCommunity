import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachNativeExperience,
  nativeExperiencePolicy,
} from "../nativeExperience.ts";
const mature = {
  changed:
    "I have used this bottle daily for 60 days, but the fragrance still irritates my sensitive skin.",
  documented_days: 60,
  claimed_days: 100,
  acquisition: "purchased",
  maturity: "established",
};
test("verified possession and a backdated claim cannot mature a new contribution", () => {
  assert.equal(
    nativeExperiencePolicy({ ...mature, documented_days: 0 }, true, 5, false)
      .affectsScoring,
    false,
  );
});
test("mature native evidence still needs possession, independent acquisition and useful history", () => {
  assert.equal(
    nativeExperiencePolicy(mature, true, 2, false).affectsScoring,
    true,
  );
  assert.equal(
    nativeExperiencePolicy(mature, false, 2, false).affectsScoring,
    false,
  );
  assert.equal(
    nativeExperiencePolicy(
      { ...mature, acquisition: "brand_supplied" },
      true,
      2,
      false,
    ).affectsScoring,
    false,
  );
  assert.equal(
    nativeExperiencePolicy(mature, true, 1, false).affectsScoring,
    false,
  );
  assert.equal(
    nativeExperiencePolicy(mature, true, 2, true).affectsScoring,
    false,
  );
});
test("native acquisition excludes private/demo evidence in its database query and deduplicates authors", async () => {
  const paths: string[] = [];
  const rows = [
    {
      ...mature,
      id: "new",
      user_id: "a",
      journey_id: "j",
      product_name: "Test product",
    },
    { ...mature, id: "old", user_id: "a", journey_id: "j" },
  ];
  const result = await attachNativeExperience(
    {
      rows: async (path) => {
        paths.push(path);
        return path.startsWith("owner_verifications")
          ? [{ user_id: "a" }]
          : rows;
      },
    },
    "test-product",
    { conversationEvidence: [{ provider: "youtube", id: "yt:one" }] },
  );
  assert.match(paths[0], /visibility=eq.public/);
  assert.match(paths[0], /journey_visibility=eq.public/);
  assert.match(paths[0], /is_demo=eq.false/);
  assert.equal((result.conversationEvidence as unknown[]).length, 2);
  assert.equal(
    (result.nativeEvidenceSummary as { contributors: number }).contributors,
    1,
  );
});

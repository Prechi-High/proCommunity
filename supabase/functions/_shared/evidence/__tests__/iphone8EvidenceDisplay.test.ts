import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDimensionExperiencePackage } from "../pipeline.ts";
import { evaluateDimensionSufficiencyWithDiagnostics } from "../sufficiency.ts";
import { buildEvidenceSourceContext } from "../identity/sourceContext.ts";
import { parseTargetProduct } from "../identity/productTokens.ts";
import { resolveEvidenceIdentity } from "../identity/resolver.ts";

const target = { name: "iPhone 8", brand: "Apple", query: "iPhone 8" };

function ytComment(
  id: string,
  text: string,
  author: string,
  videoId: string,
  extra?: { parentId?: string; contextText?: string; title?: string },
) {
  return {
    id,
    provider: "youtube",
    platform: "youtube",
    sourceId: id,
    text,
    author,
    url: `https://youtube.com/watch?v=${videoId}`,
    conversationId: videoId,
    title: extra?.title,
    parentId: extra?.parentId,
    contextText: extra?.contextText,
    experienceQuality: { affectsScoring: true },
  };
}

describe("evidence display semantics (tech fixture)", () => {
  it("sibling variant does not score", () => {
    const ctx = buildEvidenceSourceContext(
      { id: "1", text: "I love my iPhone 8 Plus for one-handed use.", platform: "youtube" },
      parseTargetProduct(target),
    );
    const r = resolveEvidenceIdentity({ commentText: "I love my iPhone 8 Plus for one-handed use.", target, context: ctx });
    assert.equal(r.level, "variant_related");
    assert.equal(r.affectsScore, false);
  });

  it("parent and reply stay separate in pipeline payload", () => {
    const profile = {
      identity: { name: "iPhone 8", brand: "Apple", category: "Tech smartphone" },
      conversationEvidence: [
        ytComment(
          "r1",
          "My iPhone 8 camera is fine and battery is ok. The regular size fits my hand perfectly for one-handed use. Speaker is loud.",
          "owner_a",
          "v1",
          { parentId: "p1", contextText: "Is the iPhone 8 good for small hands?" },
        ),
      ],
    };
    const { package: pkg } = buildDimensionExperiencePackage({
      productId: "iphone-8",
      blueprintId: "bp_phone",
      query: "iPhone 8",
      profile,
      dimensions: [
        { key: "ergonomics", label: "Ergonomics", importance: 0.9, keywords: ["hand", "size", "one-handed"] },
      ],
    });
    const item = pkg.byKey.ergonomics?.items[0];
    assert.ok(item);
    assert.equal(item.isReply, true);
    assert.ok(item.parentText?.includes("small hands"));
    assert.ok(item.statement.toLowerCase().includes("one-handed"));
    assert.notEqual(item.statement.trim(), item.fullText?.trim());
  });

  it("20+ high-quality diverse links can reach numeric when thresholds met", () => {
    const items = [];
    for (let i = 0; i < 22; i++) {
      items.push({
        evidenceId: `e${i}`,
        platform: "youtube",
        author: `owner_${i}`,
        url: `https://youtube.com/watch?v=v${i % 9}`,
        conversationId: `v${i % 9}`,
        relevanceConfidence: 0.82,
        productMatchConfidence: 0.88,
        affectsScore: true,
      });
    }
    const d = evaluateDimensionSufficiencyWithDiagnostics(items);
    assert.equal(d.scoreDisplay, "numeric");
    assert.equal(d.failedConditions.length, 0);
  });

  it("22 links with low avg product match stays limited with explicit reason", () => {
    const items = [];
    for (let i = 0; i < 22; i++) {
      items.push({
        evidenceId: `e${i}`,
        platform: "youtube",
        author: `owner_${i}`,
        url: `https://youtube.com/watch?v=v${i % 9}`,
        conversationId: `v${i % 9}`,
        relevanceConfidence: 0.82,
        productMatchConfidence: 0.68,
        affectsScore: true,
      });
    }
    const d = evaluateDimensionSufficiencyWithDiagnostics(items);
    assert.equal(d.scoreDisplay, "limited");
    assert.ok(d.failedConditions.some((c) => c.startsWith("minAvgProductMatchConfidence")));
  });
});

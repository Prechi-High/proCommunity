import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dedupeRawEvidence } from "../dedupeEvidence.ts";
import { assessExperienceQuality } from "../experienceQuality.ts";
import { planEvidenceQueries } from "../queryPlanner.ts";
import { providerRouteOrder } from "../providers/routing.ts";
import type { RawEvidence } from "../providers/types.ts";

describe("experience quality gate", () => {
  it("rejects great video noise", () => {
    const q = assessExperienceQuality("Great video bro, subscribed!");
    assert.equal(q.affectsScoring, false);
    assert.equal(q.experienceQuality, "noise");
  });

  it("recognizes strong firsthand experience", () => {
    const q = assessExperienceQuality(
      "I've used it every night for six weeks and it absorbs quickly, but leaves my forehead greasy for about twenty minutes.",
    );
    assert.equal(q.experienceQuality, "strong");
    assert.equal(q.affectsScoring, true);
  });
});

describe("query planner", () => {
  it("plans beauty dimension topics", () => {
    const plans = planEvidenceQueries({
      productId: "cerave",
      productName: "Daily Moisturizing Lotion",
      brand: "CeraVe",
      domain: "beauty",
      dimensions: [
        { key: "absorption", label: "Absorption", importance: 0.9, keywords: ["absorb", "greasy"] },
        { key: "hydration", label: "Hydration", importance: 0.9, keywords: ["hydrat", "dry"] },
      ],
    });
    assert.ok(plans.some((p) => /greasy|absorb/i.test(p.query)));
    assert.ok(plans.some((p) => /after weeks/i.test(p.query)));
  });

  it("plans tech topics", () => {
    const plans = planEvidenceQueries({
      productId: "pixel",
      productName: "Pixel 10 Pro",
      brand: "Google",
      domain: "tech",
      dimensions: [{ key: "battery_endurance", label: "Battery", importance: 0.9, keywords: ["battery"] }],
    });
    assert.ok(plans.some((p) => /battery/i.test(p.query)));
    assert.ok(plans.some((p) => /after 6 months/i.test(p.query)));
  });

  it("plans home appliance topics", () => {
    const plans = planEvidenceQueries({
      productId: "lg-washer",
      productName: "Front Load Washer",
      brand: "LG",
      domain: "home-appliances",
      dimensions: [{ key: "noise", label: "Noise", importance: 0.8, keywords: ["noise"] }],
    });
    assert.ok(plans.some((p) => /noise/i.test(p.query)));
    assert.ok(plans.some((p) => /after one year/i.test(p.query)));
  });
});

describe("provider routing", () => {
  it("routes tech with github and hn", () => {
    const order = providerRouteOrder("tech");
    assert.deepEqual(order.slice(0, 3), ["youtube", "reddit", "x"]);
    assert.ok(order.includes("github"));
    assert.ok(order.includes("hackernews"));
  });

  it("routes beauty without hn", () => {
    const order = providerRouteOrder("beauty");
    assert.ok(!order.includes("hackernews"));
  });
});

describe("deduplication", () => {
  it("dedupes same url across providers", () => {
    const a: RawEvidence = {
      provider: "reddit",
      platform: "reddit",
      sourceId: "1",
      text: "I bought this and it works well for my dry skin after two weeks of daily use.",
      url: "https://reddit.com/r/test/comments/abc",
    };
    const b: RawEvidence = {
      provider: "web",
      platform: "web",
      sourceId: "2",
      text: "I bought this and it works well for my dry skin after two weeks of daily use.",
      url: "https://reddit.com/r/test/comments/abc",
    };
    const out = dedupeRawEvidence([a, b]);
    assert.equal(out.length, 1);
  });
});

describe("nested reply context", () => {
  it("preserves parent context on reply evidence", () => {
    const reply: RawEvidence = {
      provider: "youtube",
      platform: "youtube",
      sourceId: "r1",
      conversationId: "vid",
      parentId: "p1",
      text: "Mine did after about 20 minutes of gaming.",
      contextText: "Did it overheat?",
    };
    assert.ok(reply.contextText);
    assert.equal(reply.parentId, "p1");
  });
});

describe("multi-provider integration fixture", () => {
  it("merges evidence from three providers", () => {
    const items: RawEvidence[] = [
      {
        provider: "youtube",
        platform: "youtube",
        sourceId: "yt1",
        text: "I've been using this moisturizer for a month and my skin feels less dry every morning.",
      },
      {
        provider: "reddit",
        platform: "reddit",
        sourceId: "rd1",
        text: "I bought the large bottle and it absorbs fast without feeling greasy on my face.",
        url: "https://reddit.com/r/skincare/x",
      },
      {
        provider: "web",
        platform: "web",
        sourceId: "w1",
        text: "After six weeks owners say the formula stays gentle and does not cause breakouts for most people.",
        url: "https://example.com/review",
      },
    ];
    const deduped = dedupeRawEvidence(items);
    const providers = new Set(deduped.map((i) => i.provider));
    assert.equal(providers.size, 3);
  });
});

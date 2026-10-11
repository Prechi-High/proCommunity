import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dedupeRawEvidence } from "../dedupeEvidence.ts";
import {
  applyProvenanceToStrength,
  PROVENANCE_WEIGHT,
  resolveProvenanceFromRawEvidence,
  resolveSourceProvenance,
} from "../sourceEvidenceQuality.ts";
import { loadProviderEvidenceWithCache } from "../gatherConversationEvidence.ts";
import type { EvidenceProvider, RawEvidence } from "../providers/types.ts";

describe("sourceEvidenceQuality / provenanceWeight", () => {
  it("direct YouTube comment outranks Serper snippet strength", () => {
    const base = 0.82;
    const direct = applyProvenanceToStrength(base, PROVENANCE_WEIGHT.youtube_comment);
    const snippet = applyProvenanceToStrength(base, PROVENANCE_WEIGHT.serper_snippet);
    assert.ok(direct > snippet);
  });

  it("assigns tier ordering weights", () => {
    assert.ok(PROVENANCE_WEIGHT.reddit_comment > PROVENANCE_WEIGHT.serper_snippet);
    assert.ok(PROVENANCE_WEIGHT.x_post > PROVENANCE_WEIGHT.web_article_excerpt);
  });

  it("classifies serper discovery metadata", () => {
    const p = resolveSourceProvenance({
      provider: "web",
      platform: "web",
      rawMetadata: { discovery: true, serper: true },
    });
    assert.equal(p.tier, "serper_snippet");
  });
});

describe("dedupe prefers direct over snippet", () => {
  it("does not double-count duplicate direct + snippet text", () => {
    const text =
      "I have been using this coconut oil every day for three weeks and it absorbs quickly without feeling greasy on my skin.";
    const direct: RawEvidence = {
      provider: "youtube",
      platform: "youtube",
      sourceId: "yt1",
      text,
      url: "https://youtube.com/watch?v=abc",
    };
    const snippet: RawEvidence = {
      provider: "web",
      platform: "web",
      sourceId: "s1",
      text,
      url: "https://example.com/review",
      rawMetadata: { serper: true, provenanceTier: "serper_snippet" },
    };
    const out = dedupeRawEvidence([snippet, direct]);
    assert.equal(out.length, 1);
    assert.equal(resolveProvenanceFromRawEvidence(out[0]).tier, "youtube_comment");
  });
});

describe("provider cache", () => {
  it("cache hit avoids provider refetch", async () => {
    let fetchCount = 0;
    const stub: EvidenceProvider = {
      id: "youtube",
      async searchProductEvidence() {
        fetchCount += 1;
        return {
          provider: "youtube",
          status: "ok",
          items: [
            {
              provider: "youtube",
              platform: "youtube",
              sourceId: "c1",
              text: "I've used this for two months and the battery still lasts all day on a single charge.",
            },
          ],
        };
      },
    };
    const memory = new Map<string, RawEvidence[]>();
    const cache = {
      async getJson<T>(key: string) {
        const v = memory.get(key);
        return { ok: true, value: (v as T) ?? null };
      },
      async setJson(key: string, value: unknown) {
        memory.set(key, value as RawEvidence[]);
      },
    };
    const input = { productId: "p1", productName: "Test Phone", domain: "tech" as const };
    const first = await loadProviderEvidenceWithCache(stub, input, ['"Test Phone" battery'], {
      cache,
      useCache: true,
    });
    assert.equal(first.cacheHit, false);
    assert.equal(fetchCount, 1);

    const second = await loadProviderEvidenceWithCache(stub, input, ['"Test Phone" battery'], {
      cache,
      useCache: true,
    });
    assert.equal(second.cacheHit, true);
    assert.equal(fetchCount, 1);
    assert.equal(second.items.length, 1);
  });

  it("cache miss fetches and stores provider result", async () => {
    const memory = new Map<string, RawEvidence[]>();
    const cache = {
      async getJson<T>(key: string) {
        return { ok: true, value: (memory.get(key) as T) ?? null };
      },
      async setJson(key: string, value: unknown) {
        memory.set(key, value as RawEvidence[]);
      },
    };
    const stub: EvidenceProvider = {
      id: "reddit",
      async searchProductEvidence() {
        return {
          provider: "reddit",
          status: "ok",
          items: [
            {
              provider: "reddit",
              platform: "reddit",
              sourceId: "r1",
              text: "After six weeks mine still works great and I use it daily for cooking and skincare.",
            },
          ],
        };
      },
    };
    const input = { productId: "oil", productName: "Coconut Oil", domain: "beauty" as const };
    const result = await loadProviderEvidenceWithCache(stub, input, ["Coconut Oil"], { cache, useCache: true });
    assert.equal(result.cacheHit, false);
    assert.equal(memory.size, 1);
    assert.equal(result.items[0]?.provider, "reddit");
  });
});

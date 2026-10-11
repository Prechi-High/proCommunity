import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  loadProviderEvidenceWithCache,
  providerCacheKey,
  providerEvidenceCacheTtlSec,
} from "../gatherConversationEvidence.ts";
import { evidenceProviderCacheKey } from "../../redis/keys.ts";
import { DEFAULT_PROVIDER_EVIDENCE_TTL_SEC } from "../../redis/ttl.ts";
import type { EvidenceProvider, RawEvidence } from "../providers/types.ts";

const sampleItem = (): RawEvidence => ({
  provider: "youtube",
  platform: "youtube",
  sourceId: "c1",
  text: "I've used this for two months and the battery still lasts all day on a single charge.",
});

function stubProvider(fetch: () => Promise<RawEvidence[]>): EvidenceProvider {
  return {
    id: "youtube",
    async searchProductEvidence() {
      return { provider: "youtube", status: "ok", items: await fetch() };
    },
  };
}

describe("evidence provider Redis cache flow", () => {
  const input = { productId: "p1", productName: "Test Phone", domain: "tech" as const };
  const queries = ['"Test Phone" battery'];

  it("1. cache hit does not call provider", async () => {
    let fetchCount = 0;
    const provider = stubProvider(async () => {
      fetchCount += 1;
      return [sampleItem()];
    });
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
    await loadProviderEvidenceWithCache(provider, input, queries, { cache, useCache: true });
    const second = await loadProviderEvidenceWithCache(provider, input, queries, { cache, useCache: true });
    assert.equal(second.cacheHit, true);
    assert.equal(fetchCount, 1);
  });

  it("2. cache miss calls provider and writes result", async () => {
    const memory = new Map<string, RawEvidence[]>();
    let setCalls = 0;
    const cache = {
      async getJson<T>(_key: string) {
        return { ok: true, value: null as T | null };
      },
      async setJson(key: string, value: unknown, ttlSec: number) {
        setCalls += 1;
        assert.equal(ttlSec, providerEvidenceCacheTtlSec());
        memory.set(key, value as RawEvidence[]);
      },
    };
    const provider = stubProvider(async () => [sampleItem()]);
    const result = await loadProviderEvidenceWithCache(provider, input, queries, { cache, useCache: true });
    assert.equal(result.cacheHit, false);
    assert.equal(setCalls, 1);
    assert.equal(memory.size, 1);
  });

  it("3. expired/missing cache calls provider", async () => {
    let fetchCount = 0;
    const provider = stubProvider(async () => {
      fetchCount += 1;
      return [sampleItem()];
    });
    const cache = {
      async getJson<T>(_key: string) {
        return { ok: true, value: null as T | null };
      },
      async setJson() {},
    };
    await loadProviderEvidenceWithCache(provider, input, queries, { cache, useCache: true });
    assert.equal(fetchCount, 1);
  });

  it("4. Redis GET failure falls through to provider", async () => {
    let fetchCount = 0;
    const provider = stubProvider(async () => {
      fetchCount += 1;
      return [sampleItem()];
    });
    const cache = {
      async getJson<T>(_key: string) {
        return { ok: false, value: null as T | null };
      },
      async setJson() {},
    };
    const result = await loadProviderEvidenceWithCache(provider, input, queries, { cache, useCache: true });
    assert.equal(fetchCount, 1);
    assert.equal(result.cacheHit, false);
    assert.equal(result.items.length, 1);
  });

  it("5. Redis SET failure still returns provider results", async () => {
    const provider = stubProvider(async () => [sampleItem()]);
    const cache = {
      async getJson<T>(_key: string) {
        return { ok: true, value: null as T | null };
      },
      async setJson() {
        return false;
      },
    };
    const result = await loadProviderEvidenceWithCache(provider, input, queries, { cache, useCache: true });
    assert.equal(result.status, "ok");
    assert.equal(result.items.length, 1);
  });

  it("6. force: true bypasses cached data", async () => {
    let fetchCount = 0;
    const provider = stubProvider(async () => {
      fetchCount += 1;
      return [sampleItem()];
    });
    const memory = new Map<string, RawEvidence[]>();
    memory.set(providerCacheKey(input.productId, "youtube", queries[0]), [sampleItem()]);
    const cache = {
      async getJson<T>(key: string) {
        return { ok: true, value: (memory.get(key) as T) ?? null };
      },
      async setJson(key: string, value: unknown) {
        memory.set(key, value as RawEvidence[]);
      },
    };
    const result = await loadProviderEvidenceWithCache(provider, input, queries, {
      cache,
      useCache: true,
      forceRefresh: true,
    });
    assert.equal(result.cacheHit, false);
    assert.equal(fetchCount, 1);
  });

  it("7. distinct product/provider/query combinations use distinct keys", () => {
    const a = evidenceProviderCacheKey("p1", "youtube", "query a");
    const b = evidenceProviderCacheKey("p2", "youtube", "query a");
    const c = evidenceProviderCacheKey("p1", "reddit", "query a");
    const d = evidenceProviderCacheKey("p1", "youtube", "query b");
    assert.notEqual(a, b);
    assert.notEqual(a, c);
    assert.notEqual(a, d);
    const long = "x".repeat(120);
    const shortKey = evidenceProviderCacheKey("p1", "youtube", long);
    assert.match(shortKey, /:qh_[a-z0-9]+$/);
    assert.ok(shortKey.length < 120);
  });

  it("does not cache provider errors", async () => {
    const memory = new Map<string, RawEvidence[]>();
    let setCalls = 0;
    const cache = {
      async getJson<T>(_key: string) {
        return { ok: true, value: null as T | null };
      },
      async setJson(key: string, value: unknown) {
        setCalls += 1;
        memory.set(key, value as RawEvidence[]);
      },
    };
    const provider: EvidenceProvider = {
      id: "youtube",
      async searchProductEvidence() {
        return { provider: "youtube", status: "error", items: [], error: "rate_limited" };
      },
    };
    await loadProviderEvidenceWithCache(provider, input, queries, { cache, useCache: true });
    assert.equal(setCalls, 0);
    assert.equal(memory.size, 0);
  });

  it("default provider evidence TTL is 21600 seconds", () => {
    assert.equal(DEFAULT_PROVIDER_EVIDENCE_TTL_SEC, 21600);
    assert.equal(providerEvidenceCacheTtlSec(), 21600);
  });
});

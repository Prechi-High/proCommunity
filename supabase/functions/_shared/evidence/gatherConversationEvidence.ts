import { dedupeRawEvidence } from "./dedupeEvidence.ts";
import { assessExperienceQuality } from "./experienceQuality.ts";
import { planEvidenceQueries } from "./queryPlanner.ts";
import { evidenceProviderCacheKey } from "../redis/keys.ts";
import { redisService } from "../redis/service.ts";
import { CACHE_TTL } from "../redis/ttl.ts";
import {
  ALL_EVIDENCE_PROVIDERS,
  PROVIDER_ENABLED,
  providerRouteOrder,
  type EvidenceProvider,
  type EvidenceSearchInput,
  type ProviderDiagnostics,
  type ProviderId,
  type RawEvidence,
} from "./providers/index.ts";

export type GatheredConversationEvidence = {
  items: Array<RawEvidence & { experienceQuality: ReturnType<typeof assessExperienceQuality> }>;
  diagnostics: ProviderDiagnostics;
  queries: string[];
  cacheStats?: Partial<Record<ProviderId, "hit" | "miss">>;
};

export type EvidenceProviderCacheStore = {
  getJson<T>(key: string): Promise<{ ok: boolean; value: T | null }>;
  setJson(key: string, value: unknown, ttlSec: number): Promise<unknown>;
};

export const redisEvidenceProviderCache: EvidenceProviderCacheStore = {
  getJson: (key) => redisService.getJson(key),
  setJson: (key, value, ttlSec) => redisService.setJson(key, value, ttlSec),
};

export function providerCacheKey(productId: string, providerId: ProviderId, query: string): string {
  return evidenceProviderCacheKey(productId, providerId, query);
}

export async function loadProviderEvidenceWithCache(
  provider: EvidenceProvider,
  input: EvidenceSearchInput,
  queries: string[],
  options?: { cache?: EvidenceProviderCacheStore; useCache?: boolean },
): Promise<{ items: RawEvidence[]; cacheHit: boolean; status: "ok" | "disabled" | "skipped" | "error"; error?: string }> {
  const queryKey = queries[0] ?? input.productName;
  const ck = providerCacheKey(input.productId, provider.id, queryKey);

  if (options?.useCache && options.cache) {
    const hit = await options.cache.getJson<RawEvidence[]>(ck);
    if (hit.ok && hit.value != null) {
      return { items: hit.value, cacheHit: true, status: "ok" };
    }
  }

  const result = await provider.searchProductEvidence({ ...input, evidenceTopics: queries });
  if (result.status === "disabled" || result.status === "skipped") {
    return { items: [], cacheHit: false, status: result.status };
  }
  if (result.status === "error") {
    return { items: [], cacheHit: false, status: "error", error: result.error };
  }

  if (options?.cache && result.items.length) {
    await options.cache.setJson(ck, result.items, CACHE_TTL.providerEvidence());
  }

  return { items: result.items, cacheHit: false, status: "ok" };
}

export async function gatherConversationEvidence(
  input: EvidenceSearchInput,
  options?: { cache?: EvidenceProviderCacheStore; useCache?: boolean },
): Promise<GatheredConversationEvidence> {
  const order = providerRouteOrder(input.domain);
  const planned = planEvidenceQueries(input);
  const queries = planned.map((p) => p.query);

  const diagnostics: ProviderDiagnostics = {
    youtube: { status: "disabled", items: 0 },
    reddit: { status: "disabled", items: 0 },
    x: { status: "disabled", items: 0 },
    discourse: { status: "disabled", items: 0 },
    github: { status: "disabled", items: 0 },
    hackernews: { status: "disabled", items: 0 },
    web: { status: "disabled", items: 0 },
  };

  const cacheStats: Partial<Record<ProviderId, "hit" | "miss">> = {};
  const providerMap = new Map(ALL_EVIDENCE_PROVIDERS.map((p) => [p.id, p]));
  const collected: RawEvidence[] = [];

  const runProvider = async (providerId: ProviderId) => {
    const provider = providerMap.get(providerId);
    if (!provider) {
      diagnostics[providerId] = { status: "disabled", items: 0 };
      return;
    }
    try {
      const loaded = await loadProviderEvidenceWithCache(provider, input, queries, options);
      cacheStats[providerId] = loaded.cacheHit ? "hit" : "miss";
      diagnostics[providerId] = {
        status: loaded.status === "ok" ? "ok" : loaded.status,
        items: loaded.items.length,
        error: loaded.error,
      };
      if (loaded.items.length) collected.push(...loaded.items);
    } catch (e) {
      diagnostics[providerId] = { status: "error", items: 0, error: String(e) };
      cacheStats[providerId] = "miss";
    }
  };

  await Promise.all(order.map((id) => runProvider(id)));

  const deduped = dedupeRawEvidence(collected);
  const items = deduped.map((item) => ({
    ...item,
    experienceQuality: assessExperienceQuality(item.text, item.platform),
  }));

  return { items, diagnostics, queries, cacheStats };
}

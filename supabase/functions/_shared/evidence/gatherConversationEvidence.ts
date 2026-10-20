import { digest } from "./semanticReview.ts";
import { dedupeRawEvidence } from "./dedupeEvidence.ts";
import { assessExperienceQuality } from "./experienceQuality.ts";
import { planEvidenceQueries } from "./queryPlanner.ts";
import { evidenceProviderCacheKey, youtubeHarvestBundleKey } from "../redis/keys.ts";
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
  cacheStats?: Partial<Record<ProviderId, "hit" | "miss" | "bypass">>;
  youtubeAcquisition?: Record<string, unknown>;
};

export type EvidenceProviderCacheStore = {
  getJson<T>(key: string): Promise<{ ok: boolean; value: T | null }>;
  setJson(key: string, value: unknown, ttlSec: number): Promise<unknown>;
};

export type GatherCacheOptions = {
  cache?: EvidenceProviderCacheStore;
  providers?: ProviderId[];
  /** When true, read through Upstash before calling providers. */
  useCache?: boolean;
  /** Investigation force — skip Redis GET, fetch fresh, overwrite cache on success. */
  forceRefresh?: boolean;
};

export function providerCacheKey(productId: string, providerId: ProviderId, query: string): string {
  return evidenceProviderCacheKey(productId, providerId, query);
}

export function providerEvidenceCacheTtlSec(): number {
  return CACHE_TTL.providerEvidence();
}

export async function loadProviderEvidenceWithCache(
  provider: EvidenceProvider,
  input: EvidenceSearchInput,
  queries: string[],
  options?: GatherCacheOptions,
): Promise<{
  items: RawEvidence[];
  cacheHit: boolean;
  status: "ok" | "disabled" | "skipped" | "error";
  error?: string;
  acquisition?: Record<string, unknown>;
}> {
  const queryKey = provider.id === "youtube" ? "harvest_v2" : (queries[0] ?? input.productName);
  const ck =
    provider.id === "youtube"
      ? `${youtubeHarvestBundleKey(input.productId)}:${await digest([input.productName, input.brand, input.model, input.variant, input.dimensions])}`
      : providerCacheKey(input.productId, provider.id, queryKey);
  const ttl = providerEvidenceCacheTtlSec();

  const shouldReadCache = Boolean(options?.useCache && options.cache && !options?.forceRefresh);
  if (shouldReadCache && options?.cache) {
    const hit = await options.cache.getJson<RawEvidence[] | { items: RawEvidence[]; acquisition?: Record<string, unknown> }>(
      ck,
    );
    if (hit.ok && hit.value != null) {
      const bundled = Array.isArray(hit.value) ? { items: hit.value } : hit.value;
      return {
        items: bundled.items,
        cacheHit: true,
        status: "ok",
        acquisition: bundled.acquisition,
      };
    }
  }

  let result;
  try {
    result = await provider.searchProductEvidence({
      ...input,
      evidenceTopics: queries,
      forceRefresh: options?.forceRefresh,
      cacheStore: options?.cache,
    });
  } catch (e) {
    return { items: [], cacheHit: false, status: "error", error: String(e) };
  }

  if (result.status === "disabled" || result.status === "skipped") {
    return { items: [], cacheHit: false, status: result.status };
  }
  if (result.status === "error") {
    return { items: [], cacheHit: false, status: "error", error: result.error };
  }

  if (options?.cache && result.status === "ok" && result.items.length > 0) {
    const payload =
      provider.id === "youtube"
        ? { items: result.items, acquisition: result.acquisition }
        : result.items;
    await options.cache.setJson(ck, payload, result.acquisition?.stoppedBecause && (result.acquisition.stoppedBecause as string[]).includes("collection_deadline") ? 120 : ttl);
  }

  return {
    items: result.items,
    cacheHit: false,
    status: "ok",
    acquisition: result.acquisition,
  };
}

export async function gatherConversationEvidence(
  input: EvidenceSearchInput,
  options?: GatherCacheOptions,
): Promise<GatheredConversationEvidence> {
  const order = options?.providers ?? providerRouteOrder(input.domain);
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

  const cacheStats: Partial<Record<ProviderId, "hit" | "miss" | "bypass">> = {};
  const providerMap = new Map(ALL_EVIDENCE_PROVIDERS.map((p) => [p.id, p]));
  const collected: RawEvidence[] = [];

  const runProvider = async (providerId: ProviderId) => {
    if (!PROVIDER_ENABLED[providerId]) {
      diagnostics[providerId] = { status: "disabled", items: 0 };
      return;
    }
    const provider = providerMap.get(providerId);
    if (!provider) {
      diagnostics[providerId] = { status: "disabled", items: 0 };
      return;
    }
    try {
      const loaded = await loadProviderEvidenceWithCache(provider, input, queries, options);
      cacheStats[providerId] = options?.forceRefresh ? "bypass" : loaded.cacheHit ? "hit" : "miss";
      diagnostics[providerId] = {
        status: loaded.status === "ok" ? "ok" : loaded.status,
        items: loaded.items.length,
        error: loaded.error,
        acquisition: loaded.acquisition,
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

  return {
    items,
    diagnostics,
    queries,
    cacheStats,
    youtubeAcquisition: diagnostics.youtube?.acquisition,
  };
}

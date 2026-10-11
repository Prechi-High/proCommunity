import { dedupeRawEvidence } from "./dedupeEvidence.ts";
import { assessExperienceQuality } from "./experienceQuality.ts";
import { planEvidenceQueries } from "./queryPlanner.ts";
import {
  ALL_EVIDENCE_PROVIDERS,
  PROVIDER_ENABLED,
  providerRouteOrder,
  type EvidenceSearchInput,
  type ProviderDiagnostics,
  type ProviderId,
  type RawEvidence,
} from "./providers/index.ts";

export type GatheredConversationEvidence = {
  items: Array<RawEvidence & { experienceQuality: ReturnType<typeof assessExperienceQuality> }>;
  diagnostics: ProviderDiagnostics;
  queries: string[];
};

type CacheStore = {
  getJson<T>(key: string): Promise<{ ok: boolean; value: T | null }>;
  setJson(key: string, value: unknown, ttlSec: number): Promise<unknown>;
};

function cacheKey(productId: string, provider: ProviderId, query: string): string {
  const q = query.toLowerCase().replace(/\s+/g, "_").slice(0, 80);
  return `cache:evidence:${productId}:${provider}:${q}`;
}

export async function gatherConversationEvidence(
  input: EvidenceSearchInput,
  options?: { cache?: CacheStore; useCache?: boolean },
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

  const providerMap = new Map(ALL_EVIDENCE_PROVIDERS.map((p) => [p.id, p]));
  const collected: RawEvidence[] = [];

  const runProvider = async (providerId: ProviderId) => {
    const provider = providerMap.get(providerId);
    if (!provider || !PROVIDER_ENABLED[providerId]) {
      diagnostics[providerId] = { status: "disabled", items: 0 };
      return;
    }
    try {
      const ck = cacheKey(input.productId, providerId, queries[0] ?? input.productName);
      if (options?.useCache && options.cache) {
        const hit = await options.cache.getJson<RawEvidence[]>(ck);
        if (hit.ok && hit.value?.length) {
          diagnostics[providerId] = { status: "ok", items: hit.value.length };
          collected.push(...hit.value);
          return;
        }
      }
      const result = await provider.searchProductEvidence({ ...input, evidenceTopics: queries });
      if (result.status === "disabled" || result.status === "skipped") {
        diagnostics[providerId] = { status: result.status, items: 0 };
        return;
      }
      if (result.status === "error") {
        diagnostics[providerId] = { status: "error", items: 0, error: result.error };
        return;
      }
      if (options?.cache && result.items.length) {
        await options.cache.setJson(ck, result.items, 6 * 60 * 60);
      }
      diagnostics[providerId] = { status: "ok", items: result.items.length };
      collected.push(...result.items);
    } catch (e) {
      diagnostics[providerId] = { status: "error", items: 0, error: String(e) };
    }
  };

  await Promise.all(order.map((id) => runProvider(id)));

  const deduped = dedupeRawEvidence(collected);
  const items = deduped.map((item) => ({
    ...item,
    experienceQuality: assessExperienceQuality(item.text, item.platform),
  }));

  return { items, diagnostics, queries };
}

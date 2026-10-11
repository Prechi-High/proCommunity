import { CACHE_TTL } from "../../../redis/ttl.ts";
import {
  youtubeCommentPageKey,
  youtubeRepliesKey,
  youtubeSearchPageKey,
} from "../../../redis/keys.ts";
import type { EvidenceProviderCacheStore } from "../../gatherConversationEvidence.ts";

export type YoutubeCacheLayer = {
  getJson<T>(key: string): Promise<{ ok: boolean; value: T | null }>;
  setJson(key: string, value: unknown, ttlSec: number): Promise<unknown>;
};

export function cacheFromStore(store?: EvidenceProviderCacheStore): YoutubeCacheLayer | null {
  if (!store) return null;
  return store;
}

export async function cachedJson<T>(
  layer: YoutubeCacheLayer | null,
  key: string,
  forceRefresh: boolean,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (layer && !forceRefresh) {
    const hit = await layer.getJson<T>(key);
    if (hit.ok && hit.value != null) return hit.value;
  }
  const value = await fetcher();
  if (layer) {
    await layer.setJson(key, value, CACHE_TTL.providerEvidence());
  }
  return value;
}

export { youtubeSearchPageKey, youtubeCommentPageKey, youtubeRepliesKey };

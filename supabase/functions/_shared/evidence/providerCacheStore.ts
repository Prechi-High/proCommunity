import { redisService } from "../redis/service.ts";
import type { EvidenceProviderCacheStore } from "./gatherConversationEvidence.ts";

/**
 * Upstash-backed provider cache (fail-open: Redis errors behave as cache miss / no-op set).
 * Credentials: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (edge secrets only).
 */
export const redisEvidenceProviderCache: EvidenceProviderCacheStore = {
  async getJson<T>(key: string) {
    try {
      const res = await redisService.getJson<T>(key);
      if (!res.ok) return { ok: false, value: null };
      return { ok: true, value: res.value };
    } catch {
      return { ok: false, value: null };
    }
  },
  async setJson(key: string, value: unknown, ttlSec: number) {
    try {
      const res = await redisService.setJson(key, value, ttlSec);
      return res.ok;
    } catch {
      return false;
    }
  },
};

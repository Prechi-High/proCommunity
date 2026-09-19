import { redisService } from "./service.ts";

export type CacheAsideEvent = "cache_hit" | "cache_miss" | "redis_error" | "supabase_fallback";

export async function cacheAside<T>(options: {
  key: string;
  ttlSec: number;
  loader: () => Promise<T>;
  shouldCache?: (value: T) => boolean;
}): Promise<{ value: T; event: CacheAsideEvent; durationMs: number }> {
  const started = Date.now();
  const { key, ttlSec, loader, shouldCache } = options;

  const cached = await redisService.getJson<T>(key);
  if (cached.ok && cached.value !== null && cached.value !== undefined) {
    return { value: cached.value, event: "cache_hit", durationMs: Date.now() - started };
  }

  let event: CacheAsideEvent = "cache_miss";
  if (!cached.ok && cached.error !== "redis_unconfigured") event = "redis_error";
  else if (!cached.ok) event = "supabase_fallback";

  const value = await loader();
  const allow = shouldCache ? shouldCache(value) : true;
  if (allow && value !== null && value !== undefined) {
    const set = await redisService.setJson(key, value, ttlSec);
    if (!set.ok && set.error !== "redis_unconfigured") event = "redis_error";
  }

  return { value, event, durationMs: Date.now() - started };
}

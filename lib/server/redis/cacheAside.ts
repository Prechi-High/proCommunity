import { redisService } from './service';

export type CacheAsideEvent =
  | 'cache_hit'
  | 'cache_miss'
  | 'redis_error'
  | 'supabase_fallback';

export type CacheAsideMeta = {
  event: CacheAsideEvent;
  key: string;
  durationMs: number;
  source: 'redis' | 'loader';
};

/**
 * Cache-aside: Redis hit → return; miss/error → loader (Supabase/etc) → optional fill.
 * Never throws due to Redis. Loader errors propagate.
 */
export async function cacheAside<T>(options: {
  key: string;
  ttlSec: number;
  loader: () => Promise<T>;
  /** Skip caching null/undefined/empty-array results when false. Default: cache all. */
  shouldCache?: (value: T) => boolean;
  onEvent?: (meta: CacheAsideMeta) => void;
}): Promise<T> {
  const started = Date.now();
  const { key, ttlSec, loader, shouldCache, onEvent } = options;

  const cached = await redisService.getJson<T>(key);
  if (cached.ok && cached.value !== null && cached.value !== undefined) {
    onEvent?.({
      event: 'cache_hit',
      key,
      durationMs: Date.now() - started,
      source: 'redis',
    });
    return cached.value;
  }

  if (!cached.ok && cached.error !== 'redis_unconfigured') {
    onEvent?.({
      event: 'redis_error',
      key,
      durationMs: Date.now() - started,
      source: 'loader',
    });
  } else if (cached.ok) {
    onEvent?.({
      event: 'cache_miss',
      key,
      durationMs: Date.now() - started,
      source: 'loader',
    });
  } else {
    onEvent?.({
      event: 'supabase_fallback',
      key,
      durationMs: Date.now() - started,
      source: 'loader',
    });
  }

  const value = await loader();

  const allow = shouldCache ? shouldCache(value) : true;
  if (allow && value !== null && value !== undefined) {
    const set = await redisService.setJson(key, value, ttlSec);
    if (!set.ok && set.error !== 'redis_unconfigured') {
      onEvent?.({
        event: 'redis_error',
        key,
        durationMs: Date.now() - started,
        source: 'loader',
      });
    }
  }

  return value;
}

export function logCacheEvent(meta: CacheAsideMeta): void {
  if (process.env.CACHE_DEBUG === '1' || process.env.NODE_ENV === 'development') {
    console.info('[cache]', meta.event, {
      key: meta.key,
      ms: meta.durationMs,
      source: meta.source,
    });
  }
}

import { getRedisClient } from './client';

export type RedisOpResult<T> = { ok: true; value: T } | { ok: false; error: string };

function logRedisError(op: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[redis] ${op}_failed`, message);
  // Best-effort Sentry without requiring RN SDK on the server.
  try {
    const g = globalThis as { Sentry?: { captureException?: (e: unknown) => void } };
    g.Sentry?.captureException?.(error instanceof Error ? error : new Error(message));
  } catch {
    // ignore
  }
}

/**
 * Safe Redis ops. Never throws. Cache misses are normal (ok + null), not errors.
 */
export const redisService = {
  async getJson<T>(key: string): Promise<RedisOpResult<T | null>> {
    const client = getRedisClient();
    if (!client) return { ok: false, error: 'redis_unconfigured' };
    try {
      const value = await client.get<T>(key);
      return { ok: true, value: value ?? null };
    } catch (error) {
      logRedisError('get', error);
      return { ok: false, error: 'redis_get_failed' };
    }
  },

  async setJson(key: string, value: unknown, ttlSec: number): Promise<RedisOpResult<boolean>> {
    const client = getRedisClient();
    if (!client) return { ok: false, error: 'redis_unconfigured' };
    try {
      const ex = Math.max(1, Math.floor(ttlSec));
      await client.set(key, value, { ex });
      return { ok: true, value: true };
    } catch (error) {
      logRedisError('set', error);
      return { ok: false, error: 'redis_set_failed' };
    }
  },

  async delete(...keys: string[]): Promise<RedisOpResult<number>> {
    const client = getRedisClient();
    if (!client) return { ok: false, error: 'redis_unconfigured' };
    if (!keys.length) return { ok: true, value: 0 };
    try {
      const deleted = await client.del(...keys);
      return { ok: true, value: typeof deleted === 'number' ? deleted : 0 };
    } catch (error) {
      logRedisError('del', error);
      return { ok: false, error: 'redis_del_failed' };
    }
  },

  async exists(key: string): Promise<RedisOpResult<boolean>> {
    const client = getRedisClient();
    if (!client) return { ok: false, error: 'redis_unconfigured' };
    try {
      const n = await client.exists(key);
      return { ok: true, value: n > 0 };
    } catch (error) {
      logRedisError('exists', error);
      return { ok: false, error: 'redis_exists_failed' };
    }
  },

  async expire(key: string, ttlSec: number): Promise<RedisOpResult<boolean>> {
    const client = getRedisClient();
    if (!client) return { ok: false, error: 'redis_unconfigured' };
    try {
      const n = await client.expire(key, Math.max(1, Math.floor(ttlSec)));
      return { ok: true, value: n === 1 };
    } catch (error) {
      logRedisError('expire', error);
      return { ok: false, error: 'redis_expire_failed' };
    }
  },
};

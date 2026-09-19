import { Redis } from '@upstash/redis';

let cached: Redis | null | undefined;

/**
 * Singleton Upstash Redis client. Returns null when credentials are absent
 * so callers can fall back to Supabase without failing the request.
 *
 * Env (server-side only — never EXPO_PUBLIC_*):
 * - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (preferred; already used for ASR)
 * - REDIS_URL as optional alias for the REST URL (token still required)
 */
export function getRedisClient(): Redis | null {
  if (cached !== undefined) return cached;

  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.REDIS_URL?.trim() || '';
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.REDIS_TOKEN?.trim() || '';

  if (!url || !token) {
    cached = null;
    return cached;
  }

  try {
    cached = new Redis({ url, token });
  } catch (error) {
    console.error('[redis] client_init_failed', error instanceof Error ? error.message : error);
    cached = null;
  }
  return cached;
}

/** Test helper: reset singleton between tests. */
export function resetRedisClientForTests(): void {
  cached = undefined;
}

/** Test helper: inject a fake Redis-compatible client. */
export function setRedisClientForTests(client: Redis | null): void {
  cached = client;
}

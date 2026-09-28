import { readRedisCredentials, redisCommand } from "../redis/client.ts";

export type RateRule = { limit: number; windowSec: number };

export const RATE_RULES = {
  research: { limit: 12, windowSec: 3600 },
  image: { limit: 20, windowSec: 3600 },
  question: { limit: 40, windowSec: 3600 },
  share: { limit: 20, windowSec: 3600 },
  flow: { limit: 120, windowSec: 600 },
  inbound: { limit: 60, windowSec: 60 },
  link: { limit: 6, windowSec: 900 },
} satisfies Record<string, RateRule>;

export interface RateLimiter {
  hit(key: string, rule: RateRule): Promise<{ allowed: boolean; remaining: number }>;
}

/**
 * Fixed-window counter in Redis. When Redis is unavailable it falls back to a per-isolate
 * in-memory window, so expensive work is still bounded but the platform keeps working.
 */
export function redisRateLimiter(): RateLimiter {
  const local = new Map<string, { count: number; resetAt: number }>();
  const localHit = (key: string, rule: RateRule) => {
    const now = Date.now();
    const cur = local.get(key);
    const entry = cur && cur.resetAt > now ? cur : { count: 0, resetAt: now + rule.windowSec * 1000 };
    entry.count += 1;
    local.set(key, entry);
    return { allowed: entry.count <= rule.limit, remaining: Math.max(0, rule.limit - entry.count) };
  };
  return {
    async hit(key, rule) {
      const creds = readRedisCredentials();
      if (!creds) return localHit(key, rule);
      const window = Math.floor(Date.now() / (rule.windowSec * 1000));
      const k = `rl:${key}:${window}`;
      const incr = await redisCommand(creds, ["INCR", k]);
      if (!incr.ok) return localHit(key, rule);
      const count = Number(incr.result);
      if (count === 1) await redisCommand(creds, ["EXPIRE", k, rule.windowSec + 5]);
      return { allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count) };
    },
  };
}

/** Short-lived idempotency lock (SET NX EX). Returns true if this caller acquired it. */
export async function acquireLock(key: string, ttlSec: number): Promise<boolean> {
  const creds = readRedisCredentials();
  if (!creds) return true;
  const res = await redisCommand(creds, ["SET", `lock:${key}`, "1", "NX", "EX", ttlSec]);
  if (!res.ok) return true;
  return res.result === "OK";
}

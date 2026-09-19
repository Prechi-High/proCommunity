import { readRedisCredentials, redisCommand } from "./client.ts";

export type RedisOpResult<T> = { ok: true; value: T } | { ok: false; error: string };

function parseJsonValue<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }
  return raw as T;
}

export const redisService = {
  async getJson<T>(key: string): Promise<RedisOpResult<T | null>> {
    const creds = readRedisCredentials();
    if (!creds) return { ok: false, error: "redis_unconfigured" };
    const res = await redisCommand(creds, ["GET", key]);
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, value: parseJsonValue<T>(res.result) };
  },

  async setJson(key: string, value: unknown, ttlSec: number): Promise<RedisOpResult<boolean>> {
    const creds = readRedisCredentials();
    if (!creds) return { ok: false, error: "redis_unconfigured" };
    const ex = Math.max(1, Math.floor(ttlSec));
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    const res = await redisCommand(creds, ["SET", key, payload, "EX", ex]);
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, value: true };
  },

  async delete(...keys: string[]): Promise<RedisOpResult<number>> {
    const creds = readRedisCredentials();
    if (!creds) return { ok: false, error: "redis_unconfigured" };
    if (!keys.length) return { ok: true, value: 0 };
    const res = await redisCommand(creds, ["DEL", ...keys]);
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, value: typeof res.result === "number" ? res.result : 0 };
  },

  async exists(key: string): Promise<RedisOpResult<boolean>> {
    const creds = readRedisCredentials();
    if (!creds) return { ok: false, error: "redis_unconfigured" };
    const res = await redisCommand(creds, ["EXISTS", key]);
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, value: Number(res.result) > 0 };
  },

  async expire(key: string, ttlSec: number): Promise<RedisOpResult<boolean>> {
    const creds = readRedisCredentials();
    if (!creds) return { ok: false, error: "redis_unconfigured" };
    const res = await redisCommand(creds, ["EXPIRE", key, Math.max(1, Math.floor(ttlSec))]);
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, value: Number(res.result) === 1 };
  },
};

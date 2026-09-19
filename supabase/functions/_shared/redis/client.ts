/** Deno Edge twin of lib/server/redis — Upstash REST via fetch (no npm SDK). */

export type RedisCredentials = { url: string; token: string };

export function readRedisCredentials(): RedisCredentials | null {
  const url =
    Deno.env.get("UPSTASH_REDIS_REST_URL")?.trim() || Deno.env.get("REDIS_URL")?.trim() || "";
  const token =
    Deno.env.get("UPSTASH_REDIS_REST_TOKEN")?.trim() || Deno.env.get("REDIS_TOKEN")?.trim() || "";
  if (!url || !token) return null;
  return { url, token };
}

export async function redisCommand(
  creds: RedisCredentials,
  command: (string | number)[],
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  try {
    const response = await fetch(creds.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    if (!response.ok) {
      return { ok: false, error: `redis_http_${response.status}` };
    }
    const json = (await response.json()) as { result?: unknown; error?: string };
    if (json.error) return { ok: false, error: json.error };
    return { ok: true, result: json.result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[redis] command_failed", message);
    return { ok: false, error: "redis_command_failed" };
  }
}

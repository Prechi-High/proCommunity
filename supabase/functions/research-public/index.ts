// Public, read-only view of a shared Research Card. The raw token is hashed and resolved by a
// security-definer function that only returns share-safe fields; private profile data never leaves.
import { sha256Hex } from "../_shared/core/crypto.ts";
import { serviceRest } from "../_shared/core/db.ts";
import { cors, json } from "../_shared/core/http.ts";
import { captureError } from "../_shared/core/observability.ts";
import { redisRateLimiter } from "../_shared/core/ratelimit.ts";
import { ogFor, toPublicCard } from "../_shared/research/sharing.ts";

const limiter = redisRateLimiter();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? (req.method === "POST" ? ((await req.json().catch(() => ({}))) as { token?: string }).token : "") ?? "").trim();
  if (!/^[A-Za-z0-9]{8,64}$/.test(token)) return json({ error: "not_found" }, 404);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!(await limiter.hit(`share_view:${await sha256Hex(ip)}`, { limit: 60, windowSec: 60 })).allowed) return json({ error: "rate_limited" }, 429);

  const rest = serviceRest();
  if (!rest) return json({ error: "not_configured" }, 503);
  try {
    const raw = await rest.rpc<Record<string, unknown> | null>("research_card_by_share", { token_hash: await sha256Hex(token) });
    const card = toPublicCard(raw);
    if (!card) return json({ error: "not_found" }, 404, { "Cache-Control": "no-store" });
    return json({ card, og: ogFor(card) }, 200, { "Cache-Control": "public, max-age=60" });
  } catch (err) {
    await captureError(err, { area: "research_public" });
    return json({ error: "temporary_error" }, 500);
  }
});

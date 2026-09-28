// Research Card + saves + WhatsApp connection API for the signed-in Sourced app.
// Identity always comes from the Supabase access token; ids in the body are requests, not proof.
import { z } from "zod";
import { userFromRequest } from "../_shared/core/auth.ts";
import { q, serviceRest } from "../_shared/core/db.ts";
import { flags } from "../_shared/core/env.ts";
import { cors, json } from "../_shared/core/http.ts";
import { capture, captureError, userRef } from "../_shared/core/observability.ts";
import { RATE_RULES } from "../_shared/core/ratelimit.ts";
import { ResearchError, FOCUSES } from "../_shared/research/types.ts";
import { createLinkToken, disconnectWhatsApp, LINK_TOKEN_TTL_MIN, preferencesOf, updatePreferences } from "../_shared/whatsapp/connections.ts";
import { background, kickWorker, productionDeps } from "../_shared/whatsapp/runtime.ts";

const id = z.string().uuid();
const product = z.object({
  productId: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  brand: z.string().max(100).optional().default(""),
  category: z.string().max(100).optional().default(""),
  image: z.string().max(1000).nullable().optional(),
});

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), limit: z.number().int().min(1).max(30).optional(), before: z.string().max(40).optional(), q: z.string().max(60).optional() }),
  z.object({ action: z.literal("get"), cardId: id }),
  z.object({ action: z.literal("create"), product: product.optional(), query: z.string().min(2).max(140).optional(), focus: z.enum(FOCUSES as [string, ...string[]]).optional() }),
  z.object({ action: z.literal("ask"), cardId: id, question: z.string().min(2).max(500) }),
  z.object({ action: z.literal("compare"), cardId: id, target: z.union([z.string().min(2).max(140), product]) }),
  z.object({ action: z.literal("share"), cardId: id }),
  z.object({ action: z.literal("revoke_shares"), cardId: id }),
  z.object({ action: z.literal("refresh"), cardId: id }),
  z.object({ action: z.literal("archive"), cardId: id }),
  z.object({ action: z.literal("saves") }),
  z.object({ action: z.literal("save"), product }),
  z.object({ action: z.literal("unsave"), productId: z.string().min(1).max(80) }),
  z.object({ action: z.literal("import_saves"), products: z.array(product).max(200) }),
  z.object({ action: z.literal("whatsapp_status") }),
  z.object({ action: z.literal("whatsapp_link") }),
  z.object({ action: z.literal("whatsapp_disconnect") }),
  z.object({ action: z.literal("whatsapp_preferences"), preferences: z.record(z.string(), z.boolean()) }),
]);

const ERROR_STATUS: Record<string, number> = { RESEARCH_NOT_FOUND: 404, PERMISSION_DENIED: 404, INVALID_INPUT: 400, PRODUCT_NOT_IDENTIFIED: 422, RESEARCH_FAILED: 502, TEMPORARY_ERROR: 503 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const user = await userFromRequest(req);
  if (!user) return json({ error: "sign_in_required" }, 401);
  const deps = productionDeps();
  const rest = serviceRest();
  if (!deps || !rest) return json({ error: "not_configured" }, 503);

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_input", issues: parsed.error.issues.slice(0, 3).map((i) => i.path.join(".")) }, 400);
  const b = parsed.data;
  const research = deps.research;
  const limited = async (bucket: keyof typeof RATE_RULES) => !(await deps.limiter.hit(`${bucket}:u:${user.id}`, RATE_RULES[bucket])).allowed;
  const track = async (event: string, props: Record<string, unknown> = {}) => capture(event, await userRef(user.id), { ...props, channel: "app" }).catch(() => undefined);

  try {
    switch (b.action) {
      case "list":
        return json({ cards: await research.listForUser(user.id, { limit: b.limit, before: b.before, q: b.q }) });
      case "get":
        return json(await research.get(b.cardId, user.id));
      case "create": {
        if (await limited("research")) return json({ error: "rate_limited" }, 429);
        let ref = b.product ?? null;
        if (!ref && b.query) {
          const found = await research.resolveProduct(b.query);
          if (!found.best) return json({ error: "ambiguous", candidates: found.candidates.slice(0, 5) }, 409);
          ref = { ...found.best, brand: found.best.brand ?? "", category: found.best.category ?? "" };
        }
        if (!ref) return json({ error: "invalid_input" }, 400);
        const recent = await research.findRecent(user.id, ref.productId);
        if (recent) return json({ card: recent, existing: true });
        const card = await research.create({ userId: user.id, product: ref, sourceChannel: "app", focus: (b.focus ?? "everything") as never });
        await deps.repo.enqueue("research_run", { cardId: card.id, userId: user.id }, { idempotencyKey: `run:${card.id}` });
        background(kickWorker());
        await track("research_card_created", { focus: card.focus });
        return json({ card, existing: false });
      }
      case "ask":
        if (await limited("question")) return json({ error: "rate_limited" }, 429);
        return json({ question: await research.askQuestion(b.cardId, user.id, b.question, "app") });
      case "compare":
        if (await limited("research")) return json({ error: "rate_limited" }, 429);
        return json({ comparison: await research.compare(b.cardId, user.id, b.target) });
      case "share": {
        if (await limited("share")) return json({ error: "rate_limited" }, 429);
        const out = await research.share(b.cardId, user.id);
        await track("research_card_shared");
        return json({ url: out.url });
      }
      case "revoke_shares":
        return json({ revoked: await research.revokeShares(b.cardId, user.id) });
      case "refresh": {
        if (await limited("research")) return json({ error: "rate_limited" }, 429);
        await research.owned(b.cardId, user.id);
        await deps.repo.enqueue("research_run", { cardId: b.cardId, userId: user.id, force: true }, { idempotencyKey: `refresh:${b.cardId}:${Math.floor(Date.now() / 60_000)}` });
        background(kickWorker());
        return json({ queued: true });
      }
      case "archive":
        await research.archive(b.cardId, user.id);
        return json({ ok: true });

      case "saves":
        return json({ saves: await rest.select("saved_products", `user_id=eq.${q(user.id)}&order=created_at.desc&limit=500`) });
      case "save":
        await rest.insert(
          "saved_products",
          { user_id: user.id, product_id: b.product.productId, name: b.product.name, brand: b.product.brand, category: b.product.category, image: b.product.image ?? null, source_channel: "app" },
          { onConflict: "user_id,product_id", ignoreDuplicates: true },
        );
        return json({ ok: true });
      case "unsave":
        await rest.remove("saved_products", `user_id=eq.${q(user.id)}&product_id=eq.${q(b.productId)}`);
        return json({ ok: true });
      case "import_saves":
        if (b.products.length) {
          await rest.insert(
            "saved_products",
            b.products.map((p) => ({ user_id: user.id, product_id: p.productId, name: p.name, brand: p.brand, category: p.category, image: p.image ?? null, source_channel: "app" })),
            { onConflict: "user_id,product_id", ignoreDuplicates: true },
          );
        }
        return json({ imported: b.products.length });

      case "whatsapp_status": {
        const conn = await deps.repo.activeConnectionForUser(user.id);
        return json({
          enabled: flags.whatsapp,
          connected: Boolean(conn),
          phone: conn?.phone_e164 ? `•••• ${conn.phone_e164.slice(-4)}` : null,
          connectedAt: conn?.connected_at ?? null,
          preferences: preferencesOf(conn),
        });
      }
      case "whatsapp_link": {
        if (!flags.whatsapp) return json({ error: "whatsapp_disabled" }, 503);
        if (await limited("link")) return json({ error: "rate_limited" }, 429);
        const out = await createLinkToken(deps.repo, user.id);
        await track("whatsapp_connection_started");
        return json({ code: `LINK ${out.token}`, waLink: out.waLink, expiresAt: out.expiresAt, ttlMinutes: LINK_TOKEN_TTL_MIN });
      }
      case "whatsapp_disconnect": {
        const n = await disconnectWhatsApp(deps.repo, { userId: user.id });
        await track("whatsapp_disconnected", { source: "app" });
        return json({ disconnected: n > 0 });
      }
      case "whatsapp_preferences": {
        const prefs = await updatePreferences(deps.repo, user.id, b.preferences).catch(() => "invalid" as const);
        if (prefs === "invalid") return json({ error: "invalid_input" }, 400);
        if (!prefs) return json({ error: "not_connected" }, 409);
        return json({ preferences: prefs });
      }
    }
  } catch (err) {
    if (err instanceof ResearchError) return json({ error: err.code }, ERROR_STATUS[err.code] ?? 400);
    await captureError(err, { area: "research_api", action: b.action });
    return json({ error: "temporary_error" }, 500);
  }
});

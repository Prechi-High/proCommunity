// WhatsApp Cloud API webhook: GET verification + signed POST events.
// Validates the Meta signature, de-duplicates every event, handles light intents inline and
// queues heavy work (research, image identification, comparisons) for whatsapp-worker.
import { env, flags } from "../_shared/core/env.ts";
import { captureError, log } from "../_shared/core/observability.ts";
import { handleInbound } from "../_shared/whatsapp/orchestrator.ts";
import { background, kickWorker, productionDeps } from "../_shared/whatsapp/runtime.ts";
import { eventKey, parseWebhook, verifySignature, verifySubscription } from "../_shared/whatsapp/webhook.ts";

const ok = () => new Response("ok", { status: 200 });

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const challenge = verifySubscription(url.searchParams, env("WHATSAPP_VERIFY_TOKEN"));
    log("whatsapp_webhook_verification", { status: challenge ? "ok" : "rejected" }, challenge ? "info" : "warn");
    return challenge ? new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } }) : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  if (raw.length > 256_000) return new Response("payload too large", { status: 413 });
  if (!(await verifySignature(raw, req.headers.get("x-hub-signature-256"), env("META_APP_SECRET")))) {
    log("whatsapp_webhook_signature_invalid", {}, "warn");
    return new Response("invalid signature", { status: 401 });
  }
  // Acknowledge but ignore everything while the integration is switched off.
  if (!flags.whatsapp) return ok();

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return ok();
  }
  const parsed = parseWebhook(body);
  if (!parsed) {
    log("whatsapp_webhook_unrecognised", {}, "warn");
    return ok();
  }

  const deps = productionDeps();
  if (!deps) {
    log("whatsapp_webhook_not_configured", {}, "error");
    return new Response("not configured", { status: 503 });
  }
  const expected = env("WHATSAPP_PHONE_NUMBER_ID");
  let queued = false;

  for (const msg of parsed.messages) {
    if (expected && msg.phoneNumberId && msg.phoneNumberId !== expected) continue;
    const key = eventKey.message(msg);
    try {
      // Only minimal metadata is stored — never message text or media.
      const state = await deps.repo.recordEvent({ provider_event_id: key, provider_message_id: msg.id, event_type: `message.${msg.rawType}`, payload: { kind: msg.kind } });
      if (state === "duplicate") continue;
      const out = await handleInbound(msg, deps);
      await deps.repo.markEvent(key, "processed");
      if (out.intent !== "UNLINKED") queued = true;
      log("whatsapp_inbound", { kind: msg.kind, intent: out.intent });
    } catch (err) {
      await deps.repo.markEvent(key, "failed", { code: err instanceof Error ? err.name : "error", message: err instanceof Error ? err.message : "failed" }).catch(() => undefined);
      await captureError(err, { area: "whatsapp_webhook", kind: msg.kind });
    }
  }

  for (const st of parsed.statuses) {
    const key = eventKey.status(st);
    try {
      const state = await deps.repo.recordEvent({ provider_event_id: key, provider_message_id: st.messageId, event_type: `status.${st.status}`, payload: { error: st.errorCode } });
      if (state === "duplicate") continue;
      await deps.repo.updateMessageStatus(st.messageId, st.status);
      await deps.repo.updateDeliveryByProviderId(st.messageId, st.status);
      await deps.repo.markEvent(key, "processed");
    } catch (err) {
      await captureError(err, { area: "whatsapp_status" });
    }
  }

  if (queued) background(kickWorker());
  return ok();
});

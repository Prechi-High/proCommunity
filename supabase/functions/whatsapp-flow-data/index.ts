// WhatsApp Flows data endpoint (encrypted). Verifies the Meta signature, decrypts with our
// RSA private key, resolves identity from the server-issued flow_token and returns an
// AES-GCM encrypted, base64 plain-text response.
import { env, flags } from "../_shared/core/env.ts";
import { captureError, log } from "../_shared/core/observability.ts";
import { RATE_RULES } from "../_shared/core/ratelimit.ts";
import { sha256Hex } from "../_shared/core/crypto.ts";
import { decryptFlowRequest, encryptFlowResponse, FlowCryptoError, importPrivateKey } from "../_shared/whatsapp/flows/crypto.ts";
import { handleFlowRequest } from "../_shared/whatsapp/flows/handler.ts";
import { background, kickWorker, productionDeps } from "../_shared/whatsapp/runtime.ts";
import { verifySignature } from "../_shared/whatsapp/webhook.ts";

let keyPromise: Promise<CryptoKey> | null = null;
const privateKey = () => (keyPromise ??= importPrivateKey(env("WHATSAPP_FLOW_PRIVATE_KEY")));

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const raw = await req.text();
  if (raw.length > 128_000) return new Response("payload too large", { status: 413 });
  // 432 tells WhatsApp the request signature didn't verify.
  if (!(await verifySignature(raw, req.headers.get("x-hub-signature-256"), env("META_APP_SECRET")))) {
    log("whatsapp_flow_signature_invalid", {}, "warn");
    return new Response("invalid signature", { status: 432 });
  }
  if (!env("WHATSAPP_FLOW_PRIVATE_KEY")) return new Response("not configured", { status: 503 });

  let decrypted;
  try {
    decrypted = await decryptFlowRequest(JSON.parse(raw), await privateKey());
  } catch (err) {
    if (err instanceof FlowCryptoError) {
      if (err.status === 421) keyPromise = null;
      log("whatsapp_flow_decrypt_failed", { reason: err.message }, "warn");
      return new Response(err.message, { status: err.status });
    }
    return new Response("bad request", { status: 400 });
  }

  const deps = productionDeps();
  let response: unknown;
  try {
    const action = String(decrypted.body.action ?? "");
    if (action === "ping") response = { data: { status: "active" } };
    else if (!flags.whatsappFlows || !deps) {
      response = { screen: "ERROR", data: { message: "Sourced research in WhatsApp is temporarily unavailable. Please use the app." } };
    } else {
      const token = typeof decrypted.body.flow_token === "string" ? decrypted.body.flow_token : "";
      const rl = await deps.limiter.hit(`flow:${await sha256Hex(token || "anon")}`, RATE_RULES.flow);
      response = rl.allowed
        ? await handleFlowRequest(decrypted.body, { repo: deps.repo, research: deps.research })
        : { screen: "ERROR", data: { message: "You're going a bit fast. Wait a minute and try again." } };
      if (decrypted.body.data && (decrypted.body.data as Record<string, unknown>).cmd === "research") background(kickWorker());
      log("whatsapp_flow_request", { action, screen: String(decrypted.body.screen ?? "") });
    }
  } catch (err) {
    await captureError(err, { area: "whatsapp_flow" });
    response = { screen: "ERROR", data: { message: "Something went wrong loading your research. Try again from the chat." } };
  }

  const body = await encryptFlowResponse(response, decrypted.aesKey, decrypted.iv);
  return new Response(body, { status: 200, headers: { "Content-Type": "text/plain" } });
});

import { hmacSha256Hex, timingSafeEqual } from "../core/crypto.ts";
import { type InboundMessage, type StatusUpdate, webhookMessage, webhookPayload, webhookStatus } from "./types.ts";

/** GET verification handshake (hub.mode=subscribe + matching verify token). */
export function verifySubscription(params: URLSearchParams, verifyToken: string): string | null {
  if (!verifyToken) return null;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && challenge && timingSafeEqual(token, verifyToken)) return challenge;
  return null;
}

/** Validates X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the Meta app secret). */
export async function verifySignature(rawBody: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const expected = await hmacSha256Hex(appSecret, rawBody);
  return timingSafeEqual(header.slice(7).toLowerCase(), expected);
}

export type ParsedWebhook = { messages: InboundMessage[]; statuses: StatusUpdate[]; invalid: number };

export function parseWebhook(body: unknown): ParsedWebhook | null {
  const parsed = webhookPayload.safeParse(body);
  if (!parsed.success) return null;
  const out: ParsedWebhook = { messages: [], statuses: [], invalid: 0 };
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const phoneNumberId = change.value.metadata?.phone_number_id ?? null;
      for (const raw of change.value.messages ?? []) {
        const m = webhookMessage.safeParse(raw);
        if (!m.success) {
          out.invalid++;
          continue;
        }
        out.messages.push(normaliseMessage(m.data, phoneNumberId));
      }
      for (const raw of change.value.statuses ?? []) {
        const s = webhookStatus.safeParse(raw);
        if (!s.success) {
          out.invalid++;
          continue;
        }
        out.statuses.push({
          messageId: s.data.id,
          status: s.data.status,
          timestamp: Number(s.data.timestamp) || 0,
          recipient: s.data.recipient_id ?? null,
          errorCode: s.data.errors?.[0]?.code ?? null,
        });
      }
    }
  }
  return out;
}

function normaliseMessage(m: ReturnType<typeof webhookMessage.parse>, phoneNumberId: string | null): InboundMessage {
  const base = { id: m.id, from: m.from, timestamp: Number(m.timestamp) || 0, phoneNumberId, rawType: m.type };
  if (m.type === "text" && m.text) return { ...base, kind: "text", text: m.text.body.trim() };
  if (m.type === "image" && m.image) {
    return { ...base, kind: "image", image: { mediaId: m.image.id, mimeType: m.image.mime_type ?? null, caption: m.image.caption?.trim() || null } };
  }
  if (m.type === "interactive" && m.interactive) {
    const reply = m.interactive.button_reply ?? m.interactive.list_reply;
    if (reply) return { ...base, kind: "action", actionId: reply.id, text: reply.title };
    if (m.interactive.nfm_reply) {
      let flowResponse: Record<string, unknown> = {};
      try {
        const j = JSON.parse(m.interactive.nfm_reply.response_json);
        if (j && typeof j === "object") flowResponse = j as Record<string, unknown>;
      } catch {
        // malformed flow response
      }
      return { ...base, kind: "flow_reply", flowResponse };
    }
  }
  if (m.type === "button" && m.button?.payload) return { ...base, kind: "action", actionId: m.button.payload, text: m.button.text };
  return { ...base, kind: "unsupported" };
}

/** Stable dedupe key per provider event. */
export const eventKey = {
  message: (m: InboundMessage) => `msg:${m.id}`,
  status: (s: StatusUpdate) => `st:${s.messageId}:${s.status}`,
};

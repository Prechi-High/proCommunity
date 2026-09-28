import { randomToken, sha256Hex } from "../core/crypto.ts";
import { env } from "../core/env.ts";
import type { WhatsAppRepo } from "./repository.ts";
import { type Connection, DEFAULT_PREFERENCES, type NotificationPreferences, preferencesPatch } from "./types.ts";

export const LINK_TOKEN_TTL_MIN = 12;
const TOKEN_PATTERN = /^wa_link_[A-Za-z0-9]{16,64}$/;

/** Creates a single-use link token. Only its SHA-256 hash is stored; the raw token only travels inside the prefilled WhatsApp message. */
export async function createLinkToken(repo: WhatsAppRepo, userId: string, now = new Date()): Promise<{ token: string; expiresAt: string; waLink: string | null }> {
  await repo.revokePendingTokens(userId);
  const token = randomToken(24, "wa_link_");
  const expiresAt = new Date(now.getTime() + LINK_TOKEN_TTL_MIN * 60_000).toISOString();
  await repo.insertLinkToken({ user_id: userId, token_hash: await sha256Hex(token), expires_at: expiresAt });
  const number = env("WHATSAPP_BUSINESS_NUMBER").replace(/\D/g, "");
  const waLink = number ? `https://wa.me/${number}?text=${encodeURIComponent(`LINK ${token}`)}` : null;
  return { token, expiresAt, waLink };
}

export type LinkResult =
  | { ok: true; connection: Connection; switchedFrom: string | null }
  | { ok: false; reason: "invalid" | "expired" | "used" };

export async function completeLink(repo: WhatsAppRepo, waId: string, rawToken: string, now = new Date()): Promise<LinkResult> {
  if (!TOKEN_PATTERN.test(rawToken)) return { ok: false, reason: "invalid" };
  const row = await repo.linkTokenByHash(await sha256Hex(rawToken));
  if (!row) return { ok: false, reason: "invalid" };
  if (row.status === "used") return { ok: false, reason: "used" };
  if (row.status !== "pending") return { ok: false, reason: "invalid" };
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    await repo.expireLinkToken(row.id);
    return { ok: false, reason: "expired" };
  }
  if (!(await repo.consumeLinkToken(row.id))) return { ok: false, reason: "used" };
  const previous = await repo.connectionByWaId(waId);
  const connection = await repo.upsertActiveConnection({ userId: row.user_id, waId, phoneE164: `+${waId}` });
  return { ok: true, connection, switchedFrom: previous && previous.status === "active" && previous.user_id !== row.user_id ? previous.user_id : null };
}

export function disconnectWhatsApp(repo: WhatsAppRepo, filter: { userId?: string; waId?: string }): Promise<number> {
  if (!filter.userId && !filter.waId) return Promise.resolve(0);
  return repo.disconnect(filter);
}

export function preferencesOf(connection: Pick<Connection, "notification_preferences"> | null): NotificationPreferences {
  return { ...DEFAULT_PREFERENCES, ...(connection?.notification_preferences ?? {}) };
}

/** Product drops are never switched on implicitly: only an explicit `product_drops: true` in this patch enables them. */
export async function updatePreferences(repo: WhatsAppRepo, userId: string, patch: unknown): Promise<NotificationPreferences | null> {
  const parsed = preferencesPatch.safeParse(patch);
  if (!parsed.success) throw new Error("invalid_preferences");
  const current = await repo.activeConnectionForUser(userId);
  if (!current) return null;
  const next = { ...preferencesOf(current), ...parsed.data };
  await repo.updatePreferences(userId, next);
  return next;
}

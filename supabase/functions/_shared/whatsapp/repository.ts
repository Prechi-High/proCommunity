import { q, type Rest, RestError } from "../core/db.ts";
import type { Connection, Conversation, ConversationState, Job, JobKind, NotificationPreferences } from "./types.ts";

export type LinkTokenRow = { id: string; user_id: string; status: string; expires_at: string; used_at: string | null };
export type FlowSession = { id: string; connection_id: string; user_id: string; entry_mode: string; research_card_id: string | null; expires_at: string };
export type Delivery = { id: string; user_id: string; channel: string; event_type: string; status: string; attempt_count: number };

export interface WhatsAppRepo {
  // connections
  connectionByWaId(waId: string): Promise<Connection | null>;
  activeConnectionForUser(userId: string): Promise<Connection | null>;
  upsertActiveConnection(input: { userId: string; waId: string; phoneE164: string | null }): Promise<Connection>;
  disconnect(filter: { userId?: string; waId?: string }): Promise<number>;
  touchConnection(id: string, field: "last_inbound_at" | "last_outbound_at"): Promise<void>;
  updatePreferences(userId: string, prefs: NotificationPreferences): Promise<Connection | null>;

  // link tokens
  insertLinkToken(row: { user_id: string; token_hash: string; expires_at: string }): Promise<void>;
  revokePendingTokens(userId: string): Promise<void>;
  linkTokenByHash(hash: string): Promise<LinkTokenRow | null>;
  /** Atomically marks a pending, unexpired token used. Returns false if someone else already used it. */
  consumeLinkToken(id: string): Promise<boolean>;
  expireLinkToken(id: string): Promise<void>;

  // webhook events (idempotency)
  recordEvent(row: { provider_event_id: string; provider_message_id: string | null; event_type: string; payload: object }): Promise<"new" | "duplicate">;
  markEvent(providerEventId: string, status: "queued" | "processing" | "processed" | "failed" | "ignored", error?: { code: string; message: string }): Promise<void>;

  // messages (minimal)
  recordMessage(row: {
    connection_id: string | null;
    conversation_id: string | null;
    provider_message_id: string | null;
    direction: "inbound" | "outbound";
    message_type: string;
    research_card_id?: string | null;
    status: string;
    metadata?: object;
  }): Promise<void>;
  updateMessageStatus(providerMessageId: string, status: string): Promise<void>;

  // conversations
  conversationFor(connectionId: string): Promise<Conversation>;
  updateConversation(id: string, patch: { active_research_card_id?: string | null; active_product_id?: string | null; state?: ConversationState }): Promise<void>;

  // jobs
  enqueue(kind: JobKind, payload: object, opts?: { idempotencyKey?: string; delaySec?: number; maxAttempts?: number }): Promise<string | null>;
  claimJobs(worker: string, max: number): Promise<Job[]>;
  completeJob(id: string): Promise<void>;
  failJob(id: string, error: string, retryInSec: number | null): Promise<void>;

  // flow sessions
  createFlowSession(row: { token_hash: string; connection_id: string; user_id: string; entry_mode: string; research_card_id: string | null; expires_at: string }): Promise<void>;
  flowSessionByHash(hash: string): Promise<FlowSession | null>;

  // notification deliveries
  createDelivery(row: { user_id: string; notification_id: string | null; channel: string; event_type: string; status: string; error?: string | null }): Promise<Delivery>;
  updateDelivery(id: string, patch: Partial<{ status: string; provider_message_id: string | null; attempt_count: number; last_attempt_at: string; error: string | null }>): Promise<void>;
  updateDeliveryByProviderId(providerMessageId: string, status: string): Promise<void>;
}

export function supabaseWhatsAppRepo(rest: Rest): WhatsAppRepo {
  const now = () => new Date().toISOString();
  return {
    connectionByWaId: (waId) => rest.one<Connection>("whatsapp_connections", `wa_id=eq.${q(waId)}`),
    activeConnectionForUser: (userId) => rest.one<Connection>("whatsapp_connections", `user_id=eq.${q(userId)}&status=eq.active`),
    async upsertActiveConnection({ userId, waId, phoneE164 }) {
      // A Sourced account keeps at most one active number: retire any other active link first.
      await rest.update("whatsapp_connections", `user_id=eq.${q(userId)}&status=eq.active&wa_id=neq.${q(waId)}`, { status: "disconnected", disconnected_at: now(), updated_at: now() });
      const [row] = await rest.insert<Connection>(
        "whatsapp_connections",
        { user_id: userId, wa_id: waId, phone_e164: phoneE164, status: "active", connected_at: now(), disconnected_at: null, last_inbound_at: now(), updated_at: now() },
        { onConflict: "wa_id", upsert: true },
      );
      return row;
    },
    async disconnect({ userId, waId }) {
      const filter = [userId ? `user_id=eq.${q(userId)}` : "", waId ? `wa_id=eq.${q(waId)}` : "", "status=eq.active"].filter(Boolean).join("&");
      const rows = await rest.update("whatsapp_connections", filter, { status: "disconnected", disconnected_at: now(), updated_at: now() });
      return rows.length;
    },
    async touchConnection(id, field) {
      await rest.update("whatsapp_connections", `id=eq.${q(id)}`, { [field]: now() });
    },
    async updatePreferences(userId, prefs) {
      const [row] = await rest.update<Connection>("whatsapp_connections", `user_id=eq.${q(userId)}&status=eq.active`, { notification_preferences: prefs, updated_at: now() });
      return row ?? null;
    },

    async insertLinkToken(row) {
      await rest.insert("whatsapp_link_tokens", row);
    },
    async revokePendingTokens(userId) {
      await rest.update("whatsapp_link_tokens", `user_id=eq.${q(userId)}&status=eq.pending`, { status: "revoked" });
    },
    linkTokenByHash: (hash) => rest.one<LinkTokenRow>("whatsapp_link_tokens", `token_hash=eq.${q(hash)}`),
    async consumeLinkToken(id) {
      const rows = await rest.update("whatsapp_link_tokens", `id=eq.${q(id)}&status=eq.pending&expires_at=gt.${q(now())}`, { status: "used", used_at: now() });
      return rows.length === 1;
    },
    async expireLinkToken(id) {
      await rest.update("whatsapp_link_tokens", `id=eq.${q(id)}&status=eq.pending`, { status: "expired" });
    },

    async recordEvent(row) {
      try {
        const rows = await rest.insert("whatsapp_webhook_events", row, { onConflict: "provider_event_id", ignoreDuplicates: true });
        return rows.length ? "new" : "duplicate";
      } catch (err) {
        if (err instanceof RestError && err.code === "23505") return "duplicate";
        throw err;
      }
    },
    async markEvent(id, status, error) {
      await rest.update("whatsapp_webhook_events", `provider_event_id=eq.${q(id)}`, {
        status,
        processed_at: ["processed", "failed", "ignored"].includes(status) ? now() : null,
        error_code: error?.code ?? null,
        error_message: error?.message?.slice(0, 300) ?? null,
      });
    },

    async recordMessage(row) {
      await rest.insert("whatsapp_messages", { research_card_id: null, metadata: {}, ...row }, { onConflict: "provider_message_id", ignoreDuplicates: true }).catch(() => undefined);
    },
    async updateMessageStatus(id, status) {
      await rest.update("whatsapp_messages", `provider_message_id=eq.${q(id)}`, { status });
    },

    async conversationFor(connectionId) {
      const existing = await rest.one<Conversation>("whatsapp_conversations", `connection_id=eq.${q(connectionId)}`);
      if (existing) return existing;
      const [row] = await rest.insert<Conversation>("whatsapp_conversations", { connection_id: connectionId, state: {} }, { onConflict: "connection_id", upsert: true });
      return row;
    },
    async updateConversation(id, patch) {
      await rest.update("whatsapp_conversations", `id=eq.${q(id)}`, { ...patch, updated_at: now() });
    },

    async enqueue(kind, payload, opts = {}) {
      const rows = await rest.insert<{ id: string }>(
        "integration_jobs",
        {
          kind,
          payload,
          idempotency_key: opts.idempotencyKey ?? null,
          max_attempts: opts.maxAttempts ?? 4,
          run_after: new Date(Date.now() + (opts.delaySec ?? 0) * 1000).toISOString(),
        },
        opts.idempotencyKey ? { onConflict: "idempotency_key", ignoreDuplicates: true } : {},
      );
      return rows[0]?.id ?? null;
    },
    claimJobs: (worker, max) => rest.rpc<Job[]>("claim_integration_jobs", { worker, max_jobs: max }),
    async completeJob(id) {
      await rest.update("integration_jobs", `id=eq.${q(id)}`, { status: "done", locked_at: null, updated_at: now() });
    },
    async failJob(id, error, retryInSec) {
      await rest.update("integration_jobs", `id=eq.${q(id)}`, {
        status: retryInSec == null ? "dead" : "failed",
        last_error: error.slice(0, 500),
        locked_at: null,
        run_after: new Date(Date.now() + (retryInSec ?? 0) * 1000).toISOString(),
        updated_at: now(),
      });
    },

    async createFlowSession(row) {
      await rest.insert("whatsapp_flow_sessions", row);
    },
    flowSessionByHash: (hash) => rest.one<FlowSession>("whatsapp_flow_sessions", `token_hash=eq.${q(hash)}&expires_at=gt.${q(now())}`),

    async createDelivery(row) {
      const [out] = await rest.insert<Delivery>("notification_deliveries", row);
      return out;
    },
    async updateDelivery(id, patch) {
      await rest.update("notification_deliveries", `id=eq.${q(id)}`, patch);
    },
    async updateDeliveryByProviderId(id, status) {
      await rest.update("notification_deliveries", `provider_message_id=eq.${q(id)}`, { status });
    },
  };
}

import type { Intelligence, ProductCandidate, ProductProfile } from "../core/intelligence.ts";
import type { RateLimiter } from "../core/ratelimit.ts";
import type { ResearchRepo } from "../research/repository.ts";
import { ResearchService } from "../research/service.ts";
import type { ResearchCard, ResearchComparison, ResearchProduct, ResearchQuestion, ResearchSection, ResearchShare, ResearchSnapshot, ResearchSource } from "../research/types.ts";
import type { WhatsAppClient } from "../whatsapp/client.ts";
import type { OrchestratorDeps } from "../whatsapp/orchestrator.ts";
import type { Delivery, FlowSession, LinkTokenRow, WhatsAppRepo } from "../whatsapp/repository.ts";
import type { Connection, Conversation, Job } from "../whatsapp/types.ts";

let seq = 0;
export const uuid = () => {
  seq++;
  return `00000000-0000-4000-8000-${seq.toString(16).padStart(12, "0")}`;
};
const now = () => new Date().toISOString();

export function memoryWhatsAppRepo() {
  const connections: Connection[] = [];
  const tokens: Array<LinkTokenRow & { token_hash: string }> = [];
  const events = new Map<string, string>();
  const messages: Array<Record<string, unknown>> = [];
  const conversations: Conversation[] = [];
  const jobs: Array<Job & { idempotency_key: string | null; last_error?: string; run_after?: string }> = [];
  const flowSessions: Array<FlowSession & { token_hash: string }> = [];
  const deliveries: Array<Delivery & Record<string, unknown>> = [];

  const repo: WhatsAppRepo = {
    connectionByWaId: async (waId) => connections.find((c) => c.wa_id === waId) ?? null,
    activeConnectionForUser: async (userId) => connections.find((c) => c.user_id === userId && c.status === "active") ?? null,
    async upsertActiveConnection({ userId, waId, phoneE164 }) {
      for (const c of connections) if (c.user_id === userId && c.status === "active" && c.wa_id !== waId) c.status = "disconnected";
      let row = connections.find((c) => c.wa_id === waId);
      if (!row) {
        row = { id: uuid(), user_id: userId, wa_id: waId, phone_e164: phoneE164, status: "active", connected_at: now(), disconnected_at: null, last_inbound_at: now(), last_outbound_at: null, notification_preferences: {} };
        connections.push(row);
      } else Object.assign(row, { user_id: userId, status: "active", connected_at: now(), disconnected_at: null, last_inbound_at: now() });
      return row;
    },
    async disconnect({ userId, waId }) {
      let n = 0;
      for (const c of connections) {
        if (c.status === "active" && (!userId || c.user_id === userId) && (!waId || c.wa_id === waId)) {
          c.status = "disconnected";
          n++;
        }
      }
      return n;
    },
    async touchConnection(id, field) {
      const c = connections.find((x) => x.id === id);
      if (c) c[field] = now();
    },
    async updatePreferences(userId, prefs) {
      const c = connections.find((x) => x.user_id === userId && x.status === "active");
      if (!c) return null;
      c.notification_preferences = prefs;
      return c;
    },
    async insertLinkToken(row) {
      tokens.push({ id: uuid(), user_id: row.user_id, token_hash: row.token_hash, expires_at: row.expires_at, status: "pending", used_at: null });
    },
    async revokePendingTokens(userId) {
      for (const t of tokens) if (t.user_id === userId && t.status === "pending") t.status = "revoked";
    },
    linkTokenByHash: async (hash) => tokens.find((t) => t.token_hash === hash) ?? null,
    async consumeLinkToken(id) {
      const t = tokens.find((x) => x.id === id);
      if (!t || t.status !== "pending" || new Date(t.expires_at) <= new Date()) return false;
      t.status = "used";
      t.used_at = now();
      return true;
    },
    async expireLinkToken(id) {
      const t = tokens.find((x) => x.id === id);
      if (t && t.status === "pending") t.status = "expired";
    },
    async recordEvent(row) {
      if (events.has(row.provider_event_id)) return "duplicate";
      events.set(row.provider_event_id, "received");
      return "new";
    },
    async markEvent(id, status) {
      events.set(id, status);
    },
    async recordMessage(row) {
      messages.push(row);
    },
    async updateMessageStatus() {},
    async conversationFor(connectionId) {
      let c = conversations.find((x) => x.connection_id === connectionId);
      if (!c) {
        c = { id: uuid(), connection_id: connectionId, active_research_card_id: null, active_product_id: null, state: {} };
        conversations.push(c);
      }
      return { ...c, state: { ...c.state } };
    },
    async updateConversation(id, patch) {
      const c = conversations.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
    },
    async enqueue(kind, payload, opts = {}) {
      if (opts.idempotencyKey && jobs.some((j) => j.idempotency_key === opts.idempotencyKey)) return null;
      const job = { id: uuid(), kind, payload: payload as Record<string, unknown>, status: "queued" as const, attempts: 0, max_attempts: opts.maxAttempts ?? 4, idempotency_key: opts.idempotencyKey ?? null };
      jobs.push(job);
      return job.id;
    },
    async claimJobs(_worker, max) {
      const ready = jobs.filter((j) => j.status === "queued" || j.status === "failed").slice(0, max);
      for (const j of ready) {
        j.status = "processing";
        j.attempts++;
      }
      return ready.map((j) => ({ ...j }));
    },
    async completeJob(id) {
      const j = jobs.find((x) => x.id === id);
      if (j) j.status = "done";
    },
    async failJob(id, error, retryInSec) {
      const j = jobs.find((x) => x.id === id);
      if (j) Object.assign(j, { status: retryInSec == null ? "dead" : "failed", last_error: error });
    },
    async createFlowSession(row) {
      flowSessions.push({ id: uuid(), ...row });
    },
    flowSessionByHash: async (hash) => flowSessions.find((s) => s.token_hash === hash && new Date(s.expires_at) > new Date()) ?? null,
    async createDelivery(row) {
      const d = { id: uuid(), attempt_count: 0, ...row, error: row.error ?? null };
      deliveries.push(d);
      return d;
    },
    async updateDelivery(id, patch) {
      const d = deliveries.find((x) => x.id === id);
      if (d) Object.assign(d, patch);
    },
    async updateDeliveryByProviderId() {},
  };
  return { repo, connections, tokens, events, messages, conversations, jobs, flowSessions, deliveries };
}

export function memoryResearchRepo() {
  const cards: ResearchCard[] = [];
  const products: ResearchProduct[] = [];
  const sections = new Map<string, ResearchSection[]>();
  const snaps: ResearchSnapshot[] = [];
  const sources = new Map<string, ResearchSource[]>();
  const questions: ResearchQuestion[] = [];
  const comparisons: ResearchComparison[] = [];
  const shares: ResearchShare[] = [];
  const activity: Array<{ cardId: string; event: string }> = [];
  const saves: Array<{ userId: string; productId: string }> = [];
  let ref = 100000;

  const repo: ResearchRepo = {
    async createCard(input) {
      const card: ResearchCard = { id: uuid(), public_reference: `SR-${++ref}`, created_at: now(), updated_at: now(), completed_at: null, last_refreshed_at: null, is_shared: false, ...input };
      cards.push(card);
      return card;
    },
    getCard: async (id) => cards.find((c) => c.id === id) ?? null,
    async updateCard(id, patch) {
      const c = cards.find((x) => x.id === id);
      if (!c) return null;
      Object.assign(c, patch, { updated_at: now() });
      return c;
    },
    listCards: async (userId, { limit, q }) =>
      cards.filter((c) => c.user_id === userId && c.status !== "archived" && (!q || (c.search_text ?? "").includes(q))).slice(0, limit),
    findRecentCard: async (userId, productId, since) =>
      cards.find((c) => c.user_id === userId && c.primary_product_id === productId && c.created_at >= since && c.status !== "archived") ?? null,
    async addProduct(row) {
      if (!products.some((p) => p.research_card_id === row.research_card_id && p.product_id === row.product_id && p.role === row.role)) products.push(row);
    },
    listProducts: async (cardId) => products.filter((p) => p.research_card_id === cardId),
    async upsertSections(cardId, rows) {
      sections.set(cardId, rows);
    },
    listSections: async (cardId) => sections.get(cardId) ?? [],
    async addSnapshots(rows) {
      snaps.push(...rows);
    },
    snapshots: async (cardId, type) => snaps.filter((s) => s.research_card_id === cardId && s.snapshot_type === type),
    async replaceSources(cardId, rows) {
      sources.set(cardId, rows);
    },
    async createQuestion(row) {
      const q = { id: uuid(), created_at: now(), answered_at: null, answer: null, ...row };
      questions.push(q);
      return q;
    },
    async updateQuestion(id, patch) {
      const q = questions.find((x) => x.id === id);
      if (q) Object.assign(q, patch);
    },
    listQuestions: async (cardId) => questions.filter((q) => q.research_card_id === cardId),
    async upsertComparison(row) {
      const c = { id: uuid(), created_at: now(), updated_at: now(), ...row };
      comparisons.push(c);
      return c;
    },
    listComparisons: async (cardId) => comparisons.filter((c) => c.research_card_id === cardId),
    async addActivity(cardId, _actor, event) {
      activity.push({ cardId, event });
    },
    async createShare(row) {
      const s: ResearchShare = { id: uuid(), status: "active", created_at: now(), revoked_at: null, ...row };
      shares.push(s);
      return s;
    },
    async revokeShares(cardId) {
      let n = 0;
      for (const s of shares) if (s.research_card_id === cardId && s.status === "active") (s.status = "revoked"), n++;
      return n;
    },
    async saveProduct(userId, p) {
      if (!saves.some((s) => s.userId === userId && s.productId === p.productId)) saves.push({ userId, productId: p.productId });
    },
  };
  return { repo, cards, products, sections, snaps, questions, comparisons, shares, activity, saves };
}

export const PROFILE: ProductProfile = {
  id: "cerave-foaming-cleanser",
  query: "CeraVe Foaming Cleanser",
  identity: { name: "Foaming Facial Cleanser", brand: "CeraVe", category: "Skincare", variant: "236ml" },
  summary: "A gentle foaming cleanser for normal to oily skin.",
  verdict: "Most owners with oily skin love it.",
  consensus: "Reliable daily cleanser.",
  score: 84,
  confidence: 0.9,
  voices: [{ author: "jane_doe_private", platform: "reddit", stance: "love", text: "Doesn't strip my skin.", url: "https://reddit.com/x" }],
  praise: [{ text: "Gentle", source: 1 }],
  complaints: [{ text: "Pump breaks", source: 2 }],
  bestFor: ["Oily skin"],
  notFor: ["Very dry skin"],
  specs: [{ label: "Niacinamide", value: "Yes" }],
  priceRange: { min: 9000, max: 14000, currency: "NGN", count: 5 },
  offers: [{ seller: "Jumia", price: { display: "₦9,000" }, link: "https://jumia.com.ng/x" }],
  sources: [{ n: 1, title: "Review", url: "https://example.com/review", domain: "example.com", kind: "web" }],
  images: ["https://example.com/img.jpg"],
};

export function fakeIntel(opts: { candidates?: ProductCandidate[]; profile?: ProductProfile | null; identify?: Partial<Awaited<ReturnType<Intelligence["identifyImage"]>>> } = {}) {
  const calls: string[] = [];
  const candidates = opts.candidates ?? [{ productId: "cerave-foaming-cleanser", name: "Foaming Facial Cleanser", brand: "CeraVe", category: "Skincare", image: null, confidence: 0.9 }];
  const intel: Intelligence = {
    async search(query) {
      calls.push(`search:${query}`);
      return candidates;
    },
    async investigate(input) {
      calls.push(`investigate:${input.productId}`);
      return opts.profile === undefined ? { ...PROFILE, id: input.productId } : opts.profile;
    },
    async get(productId) {
      calls.push(`get:${productId}`);
      return opts.profile === undefined ? { ...PROFILE, id: productId } : opts.profile;
    },
    async ask() {
      calls.push("ask");
      return { answer: "Yes, owners say it's gentle.", mark: "gentle", enough: true, cites: [], basedOn: 3, followups: [] };
    },
    async identifyImage() {
      calls.push("identify");
      return { confidence: 0.9, label: "CeraVe Foaming Cleanser", searchQuery: "CeraVe Foaming Cleanser", candidates, looksLikePerson: false, ...opts.identify };
    },
  };
  return { intel, calls };
}

export type Sent = { kind: string; to: string; body?: string; payload?: unknown };
export function recordingClient(overrides: Partial<WhatsAppClient> = {}) {
  const sent: Sent[] = [];
  let n = 0;
  const id = () => `wamid.${++n}`;
  const client: WhatsAppClient = {
    sendText: async (to, body) => (sent.push({ kind: "text", to, body }), id()),
    sendButtons: async (to, body, buttons) => (sent.push({ kind: "buttons", to, body, payload: buttons }), id()),
    sendList: async (to, body, _l, sections) => (sent.push({ kind: "list", to, body, payload: sections }), id()),
    sendCtaUrl: async (to, body, _d, url) => (sent.push({ kind: "cta", to, body, payload: url }), id()),
    sendFlow: async (to, input) => (sent.push({ kind: "flow", to, body: input.body, payload: input }), id()),
    sendTemplate: async (to, name, _lang, components) => (sent.push({ kind: "template", to, body: name, payload: components }), id()),
    retrieveMedia: async () => ({ url: "https://lookaside.fbsbx.com/media/1", mimeType: "image/jpeg", fileSize: 1000 }),
    downloadMedia: async () => new Uint8Array([1, 2, 3]),
    markRead: async () => undefined,
    ...overrides,
  };
  return { client, sent };
}

export const allowAll: RateLimiter = { hit: async () => ({ allowed: true, remaining: 99 }) };

export function world(opts: Parameters<typeof fakeIntel>[0] = {}) {
  const wa = memoryWhatsAppRepo();
  const rr = memoryResearchRepo();
  const { intel, calls } = fakeIntel(opts);
  const research = new ResearchService({ repo: rr.repo, intel });
  const { client, sent } = recordingClient();
  const deps: OrchestratorDeps = { repo: wa.repo, research, intel, client, limiter: allowAll, researchEnabled: true };
  return { wa, rr, intel, calls, research, client, sent, deps };
}

export async function linkedUser(w: ReturnType<typeof world>, userId = uuid(), waId = "2348000000001") {
  const conn = await w.wa.repo.upsertActiveConnection({ userId, waId, phoneE164: `+${waId}` });
  return { userId, waId, conn };
}

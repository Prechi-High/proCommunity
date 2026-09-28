import { q, type Rest } from "../core/db.ts";
import type {
  ActivityEvent,
  Channel,
  ProductRef,
  ResearchCard,
  ResearchComparison,
  ResearchProduct,
  ResearchQuestion,
  ResearchSection,
  ResearchShare,
  ResearchSnapshot,
  ResearchSource,
  SnapshotType,
} from "./types.ts";

export type NewCard = Pick<ResearchCard, "user_id" | "title" | "primary_product_id" | "research_type" | "status" | "focus" | "source_channel" | "image_url" | "search_text">;

export interface ResearchRepo {
  createCard(input: NewCard): Promise<ResearchCard>;
  getCard(id: string): Promise<ResearchCard | null>;
  updateCard(id: string, patch: Partial<ResearchCard>): Promise<ResearchCard | null>;
  listCards(userId: string, opts: { limit: number; before?: string; q?: string }): Promise<ResearchCard[]>;
  findRecentCard(userId: string, productId: string, sinceIso: string): Promise<ResearchCard | null>;

  addProduct(row: ResearchProduct): Promise<void>;
  listProducts(cardId: string): Promise<ResearchProduct[]>;

  upsertSections(cardId: string, sections: ResearchSection[]): Promise<void>;
  listSections(cardId: string): Promise<ResearchSection[]>;

  addSnapshots(rows: ResearchSnapshot[]): Promise<void>;
  snapshots(cardId: string, type: SnapshotType): Promise<ResearchSnapshot[]>;

  replaceSources(cardId: string, rows: ResearchSource[]): Promise<void>;

  createQuestion(row: Omit<ResearchQuestion, "id" | "created_at" | "answered_at" | "answer">): Promise<ResearchQuestion>;
  updateQuestion(id: string, patch: Partial<ResearchQuestion>): Promise<void>;
  listQuestions(cardId: string): Promise<ResearchQuestion[]>;

  upsertComparison(row: Pick<ResearchComparison, "research_card_id" | "product_a_id" | "product_b_id" | "comparison_snapshot">): Promise<ResearchComparison>;
  listComparisons(cardId: string): Promise<ResearchComparison[]>;

  addActivity(cardId: string, actor: "user" | "system", event: ActivityEvent, metadata?: Record<string, unknown>): Promise<void>;

  createShare(row: Pick<ResearchShare, "research_card_id" | "created_by" | "share_token_hash" | "expires_at">): Promise<ResearchShare>;
  revokeShares(cardId: string): Promise<number>;

  saveProduct(userId: string, product: ProductRef, channel: Channel): Promise<void>;
}

export function supabaseResearchRepo(rest: Rest): ResearchRepo {
  const now = () => new Date().toISOString();
  return {
    async createCard(input) {
      const [row] = await rest.insert<ResearchCard>("research_cards", input);
      return row;
    },
    getCard: (id) => rest.one<ResearchCard>("research_cards", `id=eq.${q(id)}`),
    async updateCard(id, patch) {
      const [row] = await rest.update<ResearchCard>("research_cards", `id=eq.${q(id)}`, { ...patch, updated_at: now() });
      return row ?? null;
    },
    listCards(userId, { limit, before, q: search }) {
      const filters = [`user_id=eq.${q(userId)}`, "status=neq.archived"];
      if (before) filters.push(`updated_at=lt.${q(before)}`);
      if (search) filters.push(`search_text=ilike.${q(`*${search.replace(/[*,()]/g, " ")}*`)}`);
      return rest.select<ResearchCard>("research_cards", `${filters.join("&")}&order=updated_at.desc&limit=${limit}`);
    },
    findRecentCard: (userId, productId, sinceIso) =>
      rest.one<ResearchCard>(
        "research_cards",
        `user_id=eq.${q(userId)}&primary_product_id=eq.${q(productId)}&created_at=gte.${q(sinceIso)}&status=neq.archived&order=created_at.desc`,
      ),

    async addProduct(row) {
      await rest.insert("research_products", row, { onConflict: "research_card_id,product_id,role", ignoreDuplicates: true });
    },
    listProducts: (cardId) => rest.select<ResearchProduct>("research_products", `research_card_id=eq.${q(cardId)}&order=added_at.asc`),

    async upsertSections(cardId, sections) {
      if (!sections.length) return;
      await rest.insert(
        "research_sections",
        sections.map((s) => ({ ...s, research_card_id: cardId, updated_at: now(), generated_at: now() })),
        { onConflict: "research_card_id,section_key", upsert: true },
      );
    },
    listSections: (cardId) =>
      rest.select<ResearchSection>("research_sections", `research_card_id=eq.${q(cardId)}&select=section_key,title,content,status,display_order&order=display_order.asc`),

    async addSnapshots(rows) {
      if (rows.length) await rest.insert("research_snapshots", rows);
    },
    snapshots: (cardId, type) =>
      rest.select<ResearchSnapshot>("research_snapshots", `research_card_id=eq.${q(cardId)}&snapshot_type=eq.${type}&order=created_at.asc&limit=50`),

    async replaceSources(cardId, rows) {
      await rest.remove("research_sources", `research_card_id=eq.${q(cardId)}`);
      if (rows.length) await rest.insert("research_sources", rows.map((r) => ({ ...r, research_card_id: cardId })));
    },

    async createQuestion(row) {
      const [out] = await rest.insert<ResearchQuestion>("research_questions", row);
      return out;
    },
    async updateQuestion(id, patch) {
      await rest.update("research_questions", `id=eq.${q(id)}`, patch);
    },
    listQuestions: (cardId) => rest.select<ResearchQuestion>("research_questions", `research_card_id=eq.${q(cardId)}&order=created_at.desc&limit=50`),

    async upsertComparison(row) {
      const [out] = await rest.insert<ResearchComparison>("research_comparisons", { ...row, updated_at: now() }, {
        onConflict: "research_card_id,product_a_id,product_b_id",
        upsert: true,
      });
      return out;
    },
    listComparisons: (cardId) => rest.select<ResearchComparison>("research_comparisons", `research_card_id=eq.${q(cardId)}&order=created_at.asc`),

    async addActivity(cardId, actor, event, metadata = {}) {
      await rest.insert("research_activity", { research_card_id: cardId, actor_type: actor, event_type: event, metadata });
    },

    async createShare(row) {
      const [out] = await rest.insert<ResearchShare>("research_shares", row);
      return out;
    },
    async revokeShares(cardId) {
      const rows = await rest.update<ResearchShare>("research_shares", `research_card_id=eq.${q(cardId)}&status=eq.active`, { status: "revoked", revoked_at: now() });
      return rows.length;
    },

    async saveProduct(userId, p, channel) {
      await rest.insert(
        "saved_products",
        { user_id: userId, product_id: p.productId, name: p.name, brand: p.brand ?? null, category: p.category ?? null, image: p.image ?? null, source_channel: channel },
        { onConflict: "user_id,product_id", ignoreDuplicates: true },
      );
    },
  };
}

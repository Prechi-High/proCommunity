import { randomToken, sha256Hex } from "../core/crypto.ts";
import { publicUrl } from "../core/env.ts";
import type { Intelligence, ProductCandidate, ProductProfile } from "../core/intelligence.ts";
import type { ResearchRepo } from "./repository.ts";
import { buildSections, STATUS_LABEL } from "./sections.ts";
import {
  type Channel,
  type Focus,
  type ProductRef,
  type ResearchCard,
  type ResearchCardView,
  type ResearchComparison,
  ResearchError,
  type ResearchQuestion,
} from "./types.ts";

export type ResearchDeps = { repo: ResearchRepo; intel: Intelligence; now?: () => Date };

const DEDUPE_WINDOW_HOURS = 24;

const words = (v: string) => new Set(v.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1));
export function nameOverlap(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.min(A.size, B.size);
}

/** The one Research Card service. The app API and WhatsApp both call this — never the tables directly. */
export class ResearchService {
  private repo: ResearchRepo;
  private intel: Intelligence;
  private now: () => Date;

  constructor(deps: ResearchDeps) {
    this.repo = deps.repo;
    this.intel = deps.intel;
    this.now = deps.now ?? (() => new Date());
  }

  /** Canonical product lookup (database-first via the existing search, which reuses cached catalog entries). */
  async resolveProduct(query: string, region?: string): Promise<{ best: ProductRef | null; candidates: ProductCandidate[] }> {
    const clean = query.trim().slice(0, 140);
    if (clean.length < 2) return { best: null, candidates: [] };
    const candidates = await this.intel.search(clean, region);
    const top = candidates[0];
    const confident = top && (nameOverlap(clean, `${top.brand} ${top.name}`) >= 0.5 || candidates.length === 1);
    return {
      best: confident ? { productId: top.productId, name: top.name, brand: top.brand, category: top.category, image: top.image } : null,
      candidates,
    };
  }

  async findRecent(userId: string, productId: string): Promise<ResearchCard | null> {
    const since = new Date(this.now().getTime() - DEDUPE_WINDOW_HOURS * 3600_000).toISOString();
    return this.repo.findRecentCard(userId, productId, since);
  }

  async create(input: { userId: string; product?: ProductRef | null; query?: string; sourceChannel: Channel; focus?: Focus; imageUrl?: string | null }): Promise<ResearchCard> {
    const p = input.product ?? null;
    const title = p ? [p.brand && !p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? p.brand : "", p.name].filter(Boolean).join(" ") : input.query?.slice(0, 140) ?? null;
    const card = await this.repo.createCard({
      user_id: input.userId,
      title,
      primary_product_id: p?.productId ?? null,
      research_type: "product",
      status: p ? "created" : "identifying",
      focus: input.focus ?? "everything",
      source_channel: input.sourceChannel,
      image_url: input.imageUrl ?? p?.image ?? null,
      search_text: [title, p?.brand, p?.category].filter(Boolean).join(" ").toLowerCase(),
    });
    if (p) await this.attachPrimary(card.id, p);
    await this.repo.addActivity(card.id, "user", "research_created", { channel: input.sourceChannel, focus: card.focus });
    return card;
  }

  /** Sets the identified product on a card that started from a photo. */
  async identify(cardId: string, product: ProductRef): Promise<ResearchCard> {
    await this.attachPrimary(cardId, product);
    const title = [product.brand && !product.name.toLowerCase().startsWith((product.brand ?? "").toLowerCase()) ? product.brand : "", product.name].filter(Boolean).join(" ");
    const card = await this.repo.updateCard(cardId, {
      primary_product_id: product.productId,
      title,
      status: "created",
      search_text: [title, product.brand, product.category].filter(Boolean).join(" ").toLowerCase(),
    });
    await this.repo.addActivity(cardId, "system", "product_identified", { productId: product.productId });
    if (!card) throw new ResearchError("RESEARCH_NOT_FOUND");
    return card;
  }

  private async attachPrimary(cardId: string, p: ProductRef) {
    await this.repo.addProduct({
      research_card_id: cardId,
      product_id: p.productId,
      name: p.name,
      brand: p.brand ?? null,
      category: p.category ?? null,
      image: p.image ?? null,
      role: "primary",
    });
  }

  /** Runs the existing Product Intelligence for the card's primary product and stores the result as sections + snapshots. */
  async run(cardId: string, opts: { force?: boolean; region?: string } = {}): Promise<ResearchCard> {
    const card = await this.repo.getCard(cardId);
    if (!card) throw new ResearchError("RESEARCH_NOT_FOUND");
    if (!card.primary_product_id) throw new ResearchError("PRODUCT_NOT_IDENTIFIED");
    const [primary] = (await this.repo.listProducts(cardId)).filter((p) => p.role === "primary");
    await this.repo.updateCard(cardId, { status: "researching" });
    await this.repo.addActivity(cardId, "system", "research_started", {});

    let profile: ProductProfile | null = null;
    try {
      profile = opts.force ? null : await this.intel.get(card.primary_product_id);
      if (!profile) {
        const query = [primary?.brand, primary?.name ?? card.title].filter(Boolean).join(" ") || card.title || card.primary_product_id;
        profile = await this.intel.investigate({ productId: card.primary_product_id, query, region: opts.region, force: opts.force });
      }
    } catch (err) {
      await this.repo.updateCard(cardId, { status: "failed" });
      await this.repo.addActivity(cardId, "system", "research_failed", { reason: err instanceof Error ? err.message : "unknown" });
      throw new ResearchError("RESEARCH_FAILED");
    }
    if (!profile) {
      await this.repo.updateCard(cardId, { status: "failed" });
      await this.repo.addActivity(cardId, "system", "research_failed", { reason: "no_profile" });
      throw new ResearchError("RESEARCH_FAILED");
    }

    const built = buildSections(profile, card.focus);
    await this.repo.upsertSections(cardId, built.sections);
    await this.repo.replaceSources(cardId, built.sources);

    const previousPrice = (await this.repo.snapshots(cardId, "price")).at(-1);
    await this.repo.addSnapshots(built.snapshots.map((x) => ({ ...x, research_card_id: cardId })));
    const newPrice = built.snapshots.find((x) => x.snapshot_type === "price");
    if (previousPrice && newPrice && previousPrice.data.min !== newPrice.data.min) {
      await this.repo.addActivity(cardId, "system", "price_changed", { from: previousPrice.data.min, to: newPrice.data.min });
    }

    const images = Array.isArray(profile.images) ? (profile.images as string[]) : [];
    const stamp = this.now().toISOString();
    const updated = await this.repo.updateCard(cardId, {
      status: built.status,
      title: built.title || card.title,
      image_url: card.image_url ?? images[0] ?? null,
      completed_at: built.status === "failed" ? null : stamp,
      last_refreshed_at: stamp,
    });
    await this.repo.addActivity(cardId, "system", built.status === "failed" ? "research_failed" : "research_completed", { status: built.status });
    if (built.status === "failed") throw new ResearchError("RESEARCH_FAILED");
    return updated ?? card;
  }

  /** Ownership check shared by every read/write. Unknown and foreign cards look identical to callers. */
  async owned(cardId: string, userId: string): Promise<ResearchCard> {
    if (!/^[0-9a-f-]{36}$/i.test(cardId)) throw new ResearchError("RESEARCH_NOT_FOUND");
    const card = await this.repo.getCard(cardId);
    if (!card || card.user_id !== userId || card.status === "archived") throw new ResearchError("RESEARCH_NOT_FOUND");
    return card;
  }

  async get(cardId: string, userId: string): Promise<ResearchCardView> {
    const card = await this.owned(cardId, userId);
    const [products, sections, questions, comparisons, prices] = await Promise.all([
      this.repo.listProducts(cardId),
      this.repo.listSections(cardId),
      this.repo.listQuestions(cardId),
      this.repo.listComparisons(cardId),
      this.repo.snapshots(cardId, "price"),
    ]);
    return {
      card,
      statusLabel: STATUS_LABEL[card.status],
      products,
      sections: sections.filter((x) => x.status !== "unavailable"),
      questions,
      comparisons,
      price: { then: prices[0]?.data ?? null, now: prices.at(-1)?.data ?? null },
    };
  }

  listForUser(userId: string, opts: { limit?: number; before?: string; q?: string } = {}): Promise<ResearchCard[]> {
    const search = opts.q?.trim().toLowerCase().slice(0, 60) || undefined;
    return this.repo.listCards(userId, { limit: Math.min(Math.max(opts.limit ?? 10, 1), 30), before: opts.before, q: search });
  }

  async askQuestion(cardId: string, userId: string, question: string, channel: Channel): Promise<ResearchQuestion> {
    const card = await this.owned(cardId, userId);
    const text = question.trim().slice(0, 500);
    if (text.length < 2) throw new ResearchError("INVALID_INPUT");
    if (!card.primary_product_id) throw new ResearchError("PRODUCT_NOT_IDENTIFIED");
    const row = await this.repo.createQuestion({ research_card_id: cardId, user_id: userId, question: text, status: "processing", source_channel: channel });
    await this.repo.addActivity(cardId, "user", "question_asked", { channel });
    const comparison = (await this.repo.listComparisons(cardId)).at(-1);
    try {
      const out = await this.intel.ask({ productId: card.primary_product_id, question: text, compareId: comparison?.product_b_id });
      const answer = out
        ? { text: out.answer, takeaway: out.mark, enough: out.enough, basedOn: out.basedOn, cites: out.cites.slice(0, 4), followups: out.followups }
        : { text: "No owner has talked about that yet.", enough: false, basedOn: 0, cites: [], followups: [] };
      await this.repo.updateQuestion(row.id, { status: "answered", answer, answered_at: this.now().toISOString() });
      return { ...row, status: "answered", answer, answered_at: this.now().toISOString() };
    } catch {
      await this.repo.updateQuestion(row.id, { status: "failed" });
      return { ...row, status: "failed" };
    }
  }

  async compare(cardId: string, userId: string, target: string | ProductRef, region?: string): Promise<ResearchComparison> {
    const card = await this.owned(cardId, userId);
    if (!card.primary_product_id) throw new ResearchError("PRODUCT_NOT_IDENTIFIED");
    const other = typeof target === "string" ? (await this.resolveProduct(target, region)).best : target;
    if (!other) throw new ResearchError("PRODUCT_NOT_IDENTIFIED");
    if (other.productId === card.primary_product_id) throw new ResearchError("INVALID_INPUT", "same_product");

    const [a, b] = await Promise.all([
      this.intel.get(card.primary_product_id),
      this.intel.get(other.productId).then((p) => p ?? this.intel.investigate({ productId: other.productId, query: [other.brand, other.name].filter(Boolean).join(" "), region })),
    ]);
    if (!a || !b) throw new ResearchError("RESEARCH_FAILED");
    const verdict = await this.intel
      .ask({ productId: card.primary_product_id, compareId: other.productId, question: "Which one is better, and who is each one better for?" })
      .catch(() => null);

    const side = (p: ProductProfile) => {
      const id = (p.identity ?? {}) as Record<string, unknown>;
      const list = (v: unknown) => (Array.isArray(v) ? (v as Array<{ text?: string }>).slice(0, 3).map((c) => String(c.text ?? "").slice(0, 200)) : []);
      return {
        productId: String(p.id ?? ""),
        name: String(id.name ?? p.query ?? ""),
        brand: String(id.brand ?? ""),
        score: typeof p.score === "number" ? p.score : null,
        priceRange: p.priceRange ?? null,
        praise: list(p.praise),
        complaints: list(p.complaints),
        bestFor: Array.isArray(p.bestFor) ? (p.bestFor as string[]).slice(0, 3) : [],
      };
    };
    await this.repo.addProduct({
      research_card_id: cardId,
      product_id: other.productId,
      name: other.name,
      brand: other.brand ?? null,
      category: other.category ?? null,
      image: other.image ?? null,
      role: "comparison",
    });
    const cmp = await this.repo.upsertComparison({
      research_card_id: cardId,
      product_a_id: card.primary_product_id,
      product_b_id: other.productId,
      comparison_snapshot: { a: side(a), b: side(b), verdict: verdict ? { text: verdict.answer, enough: verdict.enough } : null, at: this.now().toISOString() },
    });
    await this.repo.addActivity(cardId, "user", "comparison_added", { productB: other.productId });
    return cmp;
  }

  async save(cardId: string, userId: string, channel: Channel): Promise<ProductRef> {
    await this.owned(cardId, userId);
    const [primary] = (await this.repo.listProducts(cardId)).filter((p) => p.role === "primary");
    if (!primary) throw new ResearchError("PRODUCT_NOT_IDENTIFIED");
    const ref: ProductRef = { productId: primary.product_id, name: primary.name ?? primary.product_id, brand: primary.brand ?? "", category: primary.category ?? "", image: primary.image };
    await this.repo.saveProduct(userId, ref, channel);
    await this.repo.addActivity(cardId, "user", "product_saved", { channel });
    return ref;
  }

  /** Issues a new opaque share link. Only its hash is stored, so a lost link can't be recovered — only revoked. */
  async share(cardId: string, userId: string, opts: { expiresInDays?: number } = {}): Promise<{ url: string; token: string }> {
    const card = await this.owned(cardId, userId);
    if (!["complete", "partial"].includes(card.status)) throw new ResearchError("INVALID_INPUT", "not_ready");
    const token = randomToken(16);
    await this.repo.createShare({
      research_card_id: cardId,
      created_by: userId,
      share_token_hash: await sha256Hex(token),
      expires_at: opts.expiresInDays ? new Date(this.now().getTime() + opts.expiresInDays * 86400_000).toISOString() : null,
    });
    await this.repo.updateCard(cardId, { is_shared: true });
    await this.repo.addActivity(cardId, "user", "research_shared", {});
    return { url: `${publicUrl()}/r/${token}`, token };
  }

  async revokeShares(cardId: string, userId: string): Promise<number> {
    await this.owned(cardId, userId);
    const count = await this.repo.revokeShares(cardId);
    await this.repo.updateCard(cardId, { is_shared: false });
    await this.repo.addActivity(cardId, "user", "share_revoked", { count });
    return count;
  }

  async refresh(cardId: string, userId: string, region?: string): Promise<ResearchCard> {
    await this.owned(cardId, userId);
    await this.repo.addActivity(cardId, "user", "research_refreshed", {});
    return this.run(cardId, { force: true, region });
  }

  async archive(cardId: string, userId: string): Promise<void> {
    await this.owned(cardId, userId);
    await this.repo.revokeShares(cardId);
    await this.repo.updateCard(cardId, { status: "archived", is_shared: false });
    await this.repo.addActivity(cardId, "user", "research_archived", {});
  }
}

import { RATE_RULES, type RateLimiter } from "../core/ratelimit.ts";
import type { Intelligence } from "../core/intelligence.ts";
import type { ResearchService } from "../research/service.ts";
import { ResearchError } from "../research/types.ts";
import type { WhatsAppClient } from "./client.ts";
import { completeLink, disconnectWhatsApp } from "./connections.ts";
import { routeWithFallback, type Intent, type RoutedIntent } from "./intent.ts";
import { reply } from "./replies.ts";
import type { WhatsAppRepo } from "./repository.ts";
import type { Connection, Conversation, InboundMessage, UserSafeError } from "./types.ts";

export type Analytics = (event: string, userId: string | undefined, props?: Record<string, unknown>) => Promise<void>;

export type FlowLauncher = (connection: Connection, mode: "HOME" | "OPEN_RESEARCH" | "MY_RESEARCH" | "START_RESEARCH", cardId?: string) => Promise<boolean>;

export interface OrchestratorDeps {
  repo: WhatsAppRepo;
  research: ResearchService;
  intel: Intelligence;
  client: WhatsAppClient;
  limiter: RateLimiter;
  analytics?: Analytics;
  launchFlow?: FlowLauncher | null;
  classify?: (text: string) => Promise<Intent | null>;
  researchEnabled?: boolean;
}

export function userSafe(err: unknown): UserSafeError {
  if (err instanceof ResearchError) {
    if (err.code === "RESEARCH_NOT_FOUND" || err.code === "PERMISSION_DENIED") return "RESEARCH_NOT_FOUND";
    if (err.code === "PRODUCT_NOT_IDENTIFIED") return "PRODUCT_NOT_IDENTIFIED";
    if (err.code === "RESEARCH_FAILED") return "RESEARCH_FAILED";
  }
  return "TEMPORARY_ERROR";
}

const CARD_INTENTS = new Set<Intent>(["OPEN_RESEARCH", "COMPARE_PRODUCT", "SAVE_PRODUCT", "SHARE_RESEARCH", "FIND_STORES"]);

type Ctx = { deps: OrchestratorDeps; msg: InboundMessage; conn: Connection; conv: Conversation; to: string };

/** Entry point for one validated, de-duplicated inbound message. Heavy work is queued, never run here. */
export async function handleInbound(msg: InboundMessage, deps: OrchestratorDeps): Promise<{ intent: Intent | "UNLINKED" }> {
  const { repo, client } = deps;
  const to = msg.from;
  await client.markRead(msg.id).catch(() => undefined);

  const conn = await repo.connectionByWaId(msg.from);
  const routedUnlinked = await routeWithFallback({ messageType: msg.kind, text: msg.text, actionId: msg.actionId });

  if (!conn || conn.status !== "active") {
    await repo.recordMessage({ connection_id: conn?.id ?? null, conversation_id: null, provider_message_id: msg.id, direction: "inbound", message_type: msg.rawType, status: "received", metadata: { linked: false } });
    if (conn?.status === "blocked") return { intent: "UNLINKED" };
    if (routedUnlinked.intent === "CONNECT_ACCOUNT" && routedUnlinked.token) {
      const allowed = await deps.limiter.hit(`link:${msg.from}`, RATE_RULES.link);
      if (!allowed.allowed) {
        await reply.error(client, to, "RATE_LIMITED");
        return { intent: "CONNECT_ACCOUNT" };
      }
      const result = await completeLink(repo, msg.from, routedUnlinked.token);
      if (result.ok) {
        await reply.linked(client, to);
        await deps.analytics?.("whatsapp_connected", result.connection.user_id, {});
      } else {
        await reply.linkFailed(client, to, result.reason);
      }
      return { intent: "CONNECT_ACCOUNT" };
    }
    await reply.welcome(client, to);
    return { intent: "UNLINKED" };
  }

  await repo.touchConnection(conn.id, "last_inbound_at");
  const conv = await repo.conversationFor(conn.id);
  const routed = await routeWithFallback(
    { messageType: msg.kind, text: msg.text, actionId: msg.actionId, activeResearchCardId: conv.active_research_card_id, awaiting: conv.state?.awaiting ?? null },
    deps.classify,
  );
  await repo.recordMessage({
    connection_id: conn.id,
    conversation_id: conv.id,
    provider_message_id: msg.id,
    direction: "inbound",
    message_type: msg.rawType,
    research_card_id: routed.cardId ?? null,
    status: "received",
    metadata: { intent: routed.intent },
  });

  const flood = await deps.limiter.hit(`in:${msg.from}`, RATE_RULES.inbound);
  if (!flood.allowed) {
    if (flood.remaining === 0) await reply.error(client, to, "RATE_LIMITED");
    return { intent: routed.intent };
  }

  const ctx: Ctx = { deps, msg, conn, conv, to };
  try {
    await dispatch(ctx, routed);
  } catch (err) {
    await reply.error(client, to, userSafe(err)).catch(() => undefined);
    if (!(err instanceof ResearchError)) throw err;
  }
  return { intent: routed.intent };
}

async function setActive(ctx: Ctx, cardId: string | null, productId: string | null, state: Conversation["state"] = {}) {
  await ctx.deps.repo.updateConversation(ctx.conv.id, { active_research_card_id: cardId, active_product_id: productId, state });
}

async function dispatch(ctx: Ctx, r: RoutedIntent): Promise<void> {
  const { deps, conn, conv, to, msg } = ctx;
  const { client, research, repo, limiter } = deps;
  const userId = conn.user_id;
  const researchOn = deps.researchEnabled !== false;

  if (CARD_INTENTS.has(r.intent) && !r.cardId) return void (await reply.askForProduct(client, to));

  switch (r.intent) {
    case "CONNECT_ACCOUNT": {
      const result = r.token ? await completeLink(repo, msg.from, r.token) : { ok: false as const, reason: "invalid" as const };
      if (result.ok) await reply.linked(client, to);
      else await reply.linkFailed(client, to, result.reason);
      return;
    }
    case "DISCONNECT_ACCOUNT":
      await disconnectWhatsApp(repo, { waId: msg.from });
      await reply.disconnected(client, to);
      await deps.analytics?.("whatsapp_disconnected", userId, { via: "whatsapp" });
      return;

    case "HELP":
    case "UNKNOWN":
      if (deps.launchFlow && r.intent === "HELP" && msg.kind === "text" && /^(menu)$/i.test(msg.text ?? "")) {
        if (await deps.launchFlow(conn, "HOME")) return;
      }
      await reply.help(client, to);
      return;

    case "START_RESEARCH": {
      if (!researchOn) return void (await reply.help(client, to));
      if (r.image && msg.image) {
        const rl = await limiter.hit(`img:${userId}`, RATE_RULES.image);
        if (!rl.allowed) return void (await reply.error(client, to, "RATE_LIMITED"));
        await repo.enqueue("research_image", { connectionId: conn.id, userId, waId: to, mediaId: msg.image.mediaId, mimeType: msg.image.mimeType, caption: msg.image.caption }, { idempotencyKey: `img:${msg.id}` });
        await reply.identifying(client, to);
        await deps.analytics?.("whatsapp_image_received", userId, {});
        return;
      }
      if (!r.query) return void (await reply.askForProduct(client, to));
      const rl = await limiter.hit(`res:${userId}`, RATE_RULES.research);
      if (!rl.allowed) return void (await reply.error(client, to, "RATE_LIMITED"));
      await repo.enqueue("research_text", { connectionId: conn.id, userId, waId: to, query: r.query, focus: conv.state?.pendingFocus ?? "everything" }, { idempotencyKey: `txt:${msg.id}` });
      await reply.researching(client, to, `“${r.query}”`);
      await deps.analytics?.("whatsapp_research_started", userId, { source: "text" });
      return;
    }

    case "RESEARCH_AGAIN": {
      if (!r.productId) return void (await reply.help(client, to));
      const rl = await limiter.hit(`res:${userId}`, RATE_RULES.research);
      if (!rl.allowed) return void (await reply.error(client, to, "RATE_LIMITED"));
      await repo.enqueue("research_text", { connectionId: conn.id, userId, waId: to, productId: r.productId, force: true }, { idempotencyKey: `again:${msg.id}` });
      await reply.researching(client, to, "it again");
      return;
    }

    case "PICK_CANDIDATE": {
      const picked = conv.state?.pendingCandidates?.[r.index ?? -1];
      if (!picked) return void (await reply.askForProduct(client, to));
      await setActive(ctx, conv.active_research_card_id, picked.productId, {});
      await repo.enqueue("research_text", { connectionId: conn.id, userId, waId: to, product: picked, imageUrl: conv.state?.pendingImageUrl ?? null }, { idempotencyKey: `pick:${msg.id}` });
      await reply.researching(client, to, picked.name);
      return;
    }

    case "OPEN_RESEARCH": {
      const view = await research.get(r.cardId!, userId);
      await setActive(ctx, view.card.id, view.card.primary_product_id, {});
      await deps.analytics?.("whatsapp_research_opened", userId, { status: view.card.status });
      if (deps.launchFlow && (await deps.launchFlow(conn, "OPEN_RESEARCH", view.card.id))) return;
      await reply.overview(client, to, view);
      return;
    }

    case "LIST_RESEARCH":
    case "SEARCH_RESEARCH": {
      await deps.analytics?.("whatsapp_my_research_opened", userId, { search: r.intent === "SEARCH_RESEARCH" });
      if (r.intent === "LIST_RESEARCH" && deps.launchFlow && (await deps.launchFlow(conn, "MY_RESEARCH"))) return;
      const cards = await research.listForUser(userId, { limit: 10, q: r.query });
      await reply.list(client, to, cards, r.query ? `Research matching “${r.query}”` : "Your recent Research Cards");
      return;
    }

    case "ASK_RESEARCH_QUESTION": {
      if (!r.cardId || !r.query) return void (await reply.help(client, to));
      await research.owned(r.cardId, userId);
      const rl = await limiter.hit(`q:${userId}`, RATE_RULES.question);
      if (!rl.allowed) return void (await reply.error(client, to, "RATE_LIMITED"));
      await repo.enqueue("ask", { connectionId: conn.id, userId, waId: to, cardId: r.cardId, question: r.query }, { idempotencyKey: `ask:${msg.id}` });
      await reply.thinking(client, to);
      await deps.analytics?.("whatsapp_question_asked", userId, {});
      return;
    }

    case "COMPARE_PRODUCT": {
      const card = await research.owned(r.cardId!, userId);
      if (!r.query) {
        await setActive(ctx, card.id, card.primary_product_id, { awaiting: "compare_target" });
        return void (await reply.askCompareTarget(client, to, card.title ?? "this product"));
      }
      const rl = await limiter.hit(`res:${userId}`, RATE_RULES.research);
      if (!rl.allowed) return void (await reply.error(client, to, "RATE_LIMITED"));
      await setActive(ctx, card.id, card.primary_product_id, {});
      await repo.enqueue("compare", { connectionId: conn.id, userId, waId: to, cardId: card.id, target: r.query }, { idempotencyKey: `cmp:${msg.id}` });
      await reply.comparing(client, to, r.query);
      return;
    }

    case "SAVE_PRODUCT": {
      const ref = await research.save(r.cardId!, userId, "whatsapp");
      await reply.saved(client, to, ref.name);
      await deps.analytics?.("whatsapp_product_saved", userId, {});
      return;
    }

    case "ADD_TO_SATCHEL":
      await reply.satchelUnavailable(client, to);
      return;

    case "SHARE_RESEARCH": {
      const rl = await limiter.hit(`share:${userId}`, RATE_RULES.share);
      if (!rl.allowed) return void (await reply.error(client, to, "RATE_LIMITED"));
      const { url } = await research.share(r.cardId!, userId);
      await reply.shared(client, to, url);
      await deps.analytics?.("whatsapp_research_shared", userId, {});
      return;
    }

    case "FIND_STORES": {
      const view = await research.get(r.cardId!, userId);
      const stores = view.sections.find((s) => s.section_key === "stores")?.content as { offers?: Array<Record<string, unknown>> } | undefined;
      await reply.stores(client, to, view.card, (stores?.offers ?? []) as never);
      return;
    }

    default:
      await reply.help(client, to);
  }
}

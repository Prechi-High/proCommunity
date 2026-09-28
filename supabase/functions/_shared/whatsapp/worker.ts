import { bytesToBase64 } from "../core/crypto.ts";
import { IntelligenceError, type ProductCandidate } from "../core/intelligence.ts";
import { captureError, log } from "../core/observability.ts";
import { ResearchError, type ProductRef, type ResearchCard } from "../research/types.ts";
import type { WhatsAppClient } from "./client.ts";
import { deliverNotification, type NotificationInput } from "./notifications.ts";
import type { Analytics, OrchestratorDeps } from "./orchestrator.ts";
import { userSafe } from "./orchestrator.ts";
import { reply } from "./replies.ts";
import { type Job, WhatsAppError } from "./types.ts";

export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const AUTO_CONFIDENCE = 0.75;
export const MIN_CONFIDENCE = 0.4;

export type WorkerDeps = Omit<OrchestratorDeps, "classify" | "launchFlow" | "limiter"> & { analytics?: Analytics };

type P = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Exponential backoff: 30s, 60s, 120s … capped at 15 minutes. */
export const backoffSec = (attempt: number) => Math.min(900, 30 * 2 ** Math.max(0, attempt - 1));

export function isRetryable(err: unknown): boolean {
  if (err instanceof WhatsAppError) return err.retryable;
  if (err instanceof IntelligenceError) return err.retryable;
  if (err instanceof ResearchError) return err.code === "TEMPORARY_ERROR";
  return true;
}

export async function processJob(job: Job, deps: WorkerDeps): Promise<"done" | "retry" | "dead"> {
  try {
    await runJob(job, deps);
    await deps.repo.completeJob(job.id);
    return "done";
  } catch (err) {
    const retry = isRetryable(err) && job.attempts < job.max_attempts;
    await deps.repo.failJob(job.id, err instanceof Error ? `${err.name}: ${err.message}` : String(err), retry ? backoffSec(job.attempts) : null);
    if (!retry) {
      await captureError(err, { area: "whatsapp_worker", job_id: job.id, kind: job.kind, attempts: job.attempts });
      const waId = str(job.payload.waId);
      if (waId && job.kind !== "notify") await reply.error(deps.client, waId, userSafe(err)).catch(() => undefined);
    } else {
      log("job_retry", { job_id: job.id, kind: job.kind, attempts: job.attempts }, "warn");
    }
    return retry ? "retry" : "dead";
  }
}

async function runJob(job: Job, deps: WorkerDeps): Promise<void> {
  const p = job.payload as P;
  switch (job.kind) {
    case "research_text":
      return researchText(p, deps);
    case "research_image":
      return researchImage(p, deps);
    case "research_run":
      return runAndReport(str(p.cardId), p, deps);
    case "ask":
      return ask(p, deps);
    case "compare":
      return compare(p, deps);
    case "notify":
      await deliverNotification(p as unknown as NotificationInput, deps);
      return;
    default:
      throw new ResearchError("INVALID_INPUT", `unknown_job_${job.kind}`);
  }
}

async function outbound(deps: WorkerDeps, connectionId: string, send: (c: WhatsAppClient) => Promise<string>, cardId?: string) {
  const id = await send(deps.client);
  await deps.repo.recordMessage({ connection_id: connectionId, conversation_id: null, provider_message_id: id, direction: "outbound", message_type: "interactive", research_card_id: cardId ?? null, status: "sent" });
  await deps.repo.touchConnection(connectionId, "last_outbound_at");
}

async function stillLinked(deps: WorkerDeps, waId: string, userId: string): Promise<boolean> {
  const conn = await deps.repo.connectionByWaId(waId);
  return Boolean(conn && conn.status === "active" && conn.user_id === userId);
}

async function startCard(p: P, product: ProductRef, deps: WorkerDeps, imageUrl: string | null, force: boolean): Promise<ResearchCard | null> {
  const userId = str(p.userId);
  const waId = str(p.waId);
  const connectionId = str(p.connectionId);
  if (!force) {
    const recent = await deps.research.findRecent(userId, product.productId);
    if (recent) {
      await outbound(deps, connectionId, (c) => reply.recent(c, waId, recent, product.productId), recent.id);
      const conv = await deps.repo.conversationFor(connectionId);
      await deps.repo.updateConversation(conv.id, { active_research_card_id: recent.id, active_product_id: product.productId, state: {} });
      return null;
    }
  }
  const card = await deps.research.create({ userId, product, sourceChannel: "whatsapp", focus: (str(p.focus) || "everything") as never, imageUrl });
  const conv = await deps.repo.conversationFor(connectionId);
  await deps.repo.updateConversation(conv.id, { active_research_card_id: card.id, active_product_id: product.productId, state: {} });
  return card;
}

async function researchText(p: P, deps: WorkerDeps) {
  const userId = str(p.userId);
  const waId = str(p.waId);
  const connectionId = str(p.connectionId);
  if (!(await stillLinked(deps, waId, userId))) return;

  let product: ProductRef | null = (p.product as ProductRef | undefined) ?? null;
  if (!product && str(p.productId)) {
    const profile = await deps.intel.get(str(p.productId));
    const id = (profile?.identity ?? {}) as P;
    product = profile ? { productId: str(p.productId), name: str(id.name) || str(profile.query), brand: str(id.brand), category: str(id.category), image: (profile.images as string[] | undefined)?.[0] ?? null } : null;
  }
  if (!product) {
    const { best, candidates } = await deps.research.resolveProduct(str(p.query));
    if (!best) {
      if (candidates.length > 1) return askToPick(deps, connectionId, waId, candidates, null);
      throw new ResearchError("PRODUCT_NOT_IDENTIFIED");
    }
    product = best;
  }
  const card = await startCard(p, product, deps, (p.imageUrl as string | null) ?? null, p.force === true);
  if (card) await runAndReport(card.id, p, deps);
}

async function askToPick(deps: WorkerDeps, connectionId: string, waId: string, candidates: ProductCandidate[], imageUrl: string | null) {
  const conv = await deps.repo.conversationFor(connectionId);
  const pending = candidates.slice(0, 5).map((c) => ({ productId: c.productId, name: c.name, brand: c.brand, category: c.category, image: c.image }));
  await deps.repo.updateConversation(conv.id, { state: { ...conv.state, pendingCandidates: pending, pendingImageUrl: imageUrl } });
  await outbound(deps, connectionId, (c) => reply.ambiguous(c, waId, candidates));
}

async function researchImage(p: P, deps: WorkerDeps) {
  const userId = str(p.userId);
  const waId = str(p.waId);
  const connectionId = str(p.connectionId);
  if (!(await stillLinked(deps, waId, userId))) return;

  let bytes: Uint8Array;
  let mime: string;
  try {
    const media = await deps.client.retrieveMedia(str(p.mediaId));
    mime = (media.mimeType || str(p.mimeType)).split(";")[0].trim().toLowerCase();
    if (!MEDIA_TYPES.has(mime)) throw new WhatsAppError("media_type", "Unsupported image type", false);
    if (media.fileSize > MEDIA_MAX_BYTES) throw new WhatsAppError("media_too_large", "Image too large", false);
    bytes = await deps.client.downloadMedia(media.url, MEDIA_MAX_BYTES);
  } catch (err) {
    if (err instanceof WhatsAppError && !err.retryable) {
      await outbound(deps, connectionId, (c) => reply.error(c, waId, "MEDIA_UNAVAILABLE"));
      return;
    }
    throw err;
  }

  // The image only lives in memory for the identification call; it is not written to Sourced storage here.
  const found = await deps.intel.identifyImage({ base64: bytesToBase64(bytes), mimeType: mime });
  bytes = new Uint8Array(0);

  if (found.looksLikePerson) return void (await outbound(deps, connectionId, (c) => reply.sensitiveImage(c, waId)));
  if (!found.candidates.length || found.confidence < MIN_CONFIDENCE) {
    return void (await outbound(deps, connectionId, (c) => reply.error(c, waId, "PRODUCT_NOT_IDENTIFIED")));
  }

  const { best, candidates } = await deps.research.resolveProduct(found.searchQuery || found.label);
  await deps.analytics?.("whatsapp_product_identified", userId, { confidence: Math.round(found.confidence * 100) / 100, resolved: Boolean(best) });

  if (found.confidence < AUTO_CONFIDENCE || !best) {
    const merged: ProductCandidate[] = [...(best ? [{ ...best, brand: best.brand ?? "", category: best.category ?? "", image: best.image ?? null, confidence: found.confidence }] : []), ...candidates, ...found.candidates];
    const unique = merged.filter((c, i) => c.productId && merged.findIndex((x) => x.productId === c.productId) === i);
    if (unique.length) return askToPick(deps, connectionId, waId, unique, null);
    return void (await outbound(deps, connectionId, (c) => reply.error(c, waId, "PRODUCT_NOT_IDENTIFIED")));
  }

  const card = await startCard(p, best, deps, null, false);
  if (card) await runAndReport(card.id, p, deps);
}

async function runAndReport(cardId: string, p: P, deps: WorkerDeps) {
  const waId = str(p.waId);
  const connectionId = str(p.connectionId);
  const userId = str(p.userId);
  let card: ResearchCard;
  try {
    card = await deps.research.run(cardId, { force: p.force === true });
  } catch (err) {
    await deps.analytics?.("whatsapp_research_failed", userId, { reason: err instanceof ResearchError ? err.code : "unknown" });
    throw err;
  }
  if (!(await stillLinked(deps, waId, userId))) return;
  const view = await deps.research.get(card.id, userId);
  const summary = view.sections.find((s) => s.section_key === "summary")?.content as { verdict?: string } | undefined;
  await outbound(deps, connectionId, (c) => reply.completed(c, waId, card, summary?.verdict ?? ""), card.id);
  await deps.analytics?.("whatsapp_research_completed", userId, { status: card.status });
}

async function ask(p: P, deps: WorkerDeps) {
  const userId = str(p.userId);
  const waId = str(p.waId);
  if (!(await stillLinked(deps, waId, userId))) return;
  const card = await deps.research.owned(str(p.cardId), userId);
  const q = await deps.research.askQuestion(card.id, userId, str(p.question), "whatsapp");
  if (q.status !== "answered" || !q.answer) throw new ResearchError("TEMPORARY_ERROR");
  await outbound(deps, str(p.connectionId), (c) => reply.answer(c, waId, card, q.answer as never), card.id);
}

async function compare(p: P, deps: WorkerDeps) {
  const userId = str(p.userId);
  const waId = str(p.waId);
  if (!(await stillLinked(deps, waId, userId))) return;
  const card = await deps.research.owned(str(p.cardId), userId);
  const cmp = await deps.research.compare(card.id, userId, str(p.target));
  await outbound(deps, str(p.connectionId), (c) => reply.comparison(c, waId, card, cmp.comparison_snapshot ?? {}), card.id);
  await deps.analytics?.("whatsapp_comparison_created", userId, {});
}

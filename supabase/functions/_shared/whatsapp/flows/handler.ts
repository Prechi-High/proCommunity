import { z } from "zod";
import { randomToken, sha256Hex } from "../../core/crypto.ts";
import { STATUS_LABEL } from "../../research/sections.ts";
import type { ResearchService } from "../../research/service.ts";
import { ResearchError, type ResearchCard, type ResearchCardView, type ResearchSection } from "../../research/types.ts";
import type { WhatsAppClient } from "../client.ts";
import type { WhatsAppRepo } from "../repository.ts";
import type { Connection } from "../types.ts";

/**
 * WhatsApp Flow data exchange. Identity comes only from the opaque flow_token we issued
 * (flow_token → whatsapp_flow_sessions → active connection → user). Ids inside the payload
 * are treated as requests and re-authorised against that user.
 */

export const FLOW_SESSION_TTL_MIN = 60;
const PAGE = 8;

export const flowRequest = z.object({
  version: z.string().max(10).optional(),
  action: z.enum(["ping", "INIT", "data_exchange", "BACK", "navigate"]),
  screen: z.string().max(40).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  flow_token: z.string().max(200).optional(),
});

const exchange = z.object({
  cmd: z.enum(["home", "start", "research", "list", "open", "section"]),
  card_id: z.string().max(40).optional(),
  section: z.string().max(40).optional(),
  query: z.string().max(140).optional(),
  focus: z.string().max(20).optional(),
  cursor: z.string().max(40).optional(),
  q: z.string().max(60).optional(),
});

export type FlowDeps = { repo: WhatsAppRepo; research: ResearchService };
export type FlowResponse = { screen?: string; data: Record<string, unknown> };

const FOCUS_OPTIONS = [
  { id: "everything", title: "Everything" },
  { id: "fit", title: "Is it right for me?" },
  { id: "ingredients", title: "Ingredients / Specs" },
  { id: "community", title: "Community" },
  { id: "price", title: "Price & Stores" },
  { id: "alternatives", title: "Alternatives" },
];

const clip = (v: string, max: number) => (v.length <= max ? v : `${v.slice(0, max - 1)}…`);
const s = (v: unknown, max = 400) => (typeof v === "string" ? clip(v.trim(), max) : "");

function cardItem(card: ResearchCard) {
  return {
    id: card.id,
    title: clip(card.title ?? card.public_reference, 30),
    description: `${card.public_reference} · ${STATUS_LABEL[card.status]} · ${new Date(card.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
  };
}

export function sectionBody(section: ResearchSection): string {
  const c = section.content as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? (v as Array<Record<string, unknown> | string>) : []);
  switch (section.section_key) {
    case "identity":
      return [`**${s(c.name, 120)}**`, s(c.brand, 60) && `Brand: ${s(c.brand, 60)}`, s(c.variant, 60) && `Variant: ${s(c.variant, 60)}`, s(c.size, 40) && `Size: ${s(c.size, 40)}`, s(c.category, 60) && `Category: ${s(c.category, 60)}`].filter(Boolean).join("\n");
    case "summary":
      return [s(c.verdict, 400), s(c.summary, 900), s(c.consensus, 300) && `Owners: ${s(c.consensus, 300)}`].filter(Boolean).join("\n\n");
    case "confidence":
      return [
        c.score != null ? `**Owner score: ${c.score}/100**` : "",
        list(c.drivers).length ? `What drove it:\n${list(c.drivers).map((d) => `• ${s(d, 160)}`).join("\n")}` : "",
        list(c.uncertainty).length ? `What's still uncertain:\n${list(c.uncertainty).map((d) => `• ${s(d, 200)}`).join("\n")}` : "",
        s(c.note, 200),
      ].filter(Boolean).join("\n\n");
    case "fit":
      return [
        list(c.bestFor).length ? `**Best for**\n${list(c.bestFor).map((x) => `• ${s(x, 140)}`).join("\n")}` : "",
        list(c.notFor).length ? `**Not ideal for**\n${list(c.notFor).map((x) => `• ${s(x, 140)}`).join("\n")}` : "",
        s(c.howToUse, 400),
      ].filter(Boolean).join("\n\n");
    case "ingredients_or_specs":
      return list(c.rows).slice(0, 20).map((r) => `**${s((r as Record<string, unknown>).label, 40)}:** ${s((r as Record<string, unknown>).value, 160)}`).join("\n");
    case "key_facts":
      return list(c.facts).map((f) => `• ${s(f, 220)}`).join("\n");
    case "community": {
      const voices = list(c.voices).slice(0, 5) as Array<Record<string, unknown>>;
      return [s(c.consensus, 300), ...voices.map((v) => `${v.stance === "warn" ? "⚠️" : v.stance === "love" ? "👍" : "•"} “${s(v.text, 220)}” — ${s(v.platform, 12)}`)].filter(Boolean).join("\n\n");
    }
    case "pros_cons":
      return [
        list(c.praise).length ? `**Praise**\n${list(c.praise).slice(0, 5).map((x) => `+ ${s((x as Record<string, unknown>).text, 180)}`).join("\n")}` : "",
        list(c.complaints).length ? `**Complaints**\n${list(c.complaints).slice(0, 5).map((x) => `− ${s((x as Record<string, unknown>).text, 180)}`).join("\n")}` : "",
      ].filter(Boolean).join("\n\n");
    case "pricing": {
      const r = (c.range ?? null) as Record<string, unknown> | null;
      return r ? `Seen from ${r.currency ?? ""} ${r.min} to ${r.currency ?? ""} ${r.max} across ${r.count} listings.\nPrices change often — check before paying.` : "";
    }
    case "stores":
      return list(c.offers).slice(0, 6).map((o) => {
        const x = o as Record<string, unknown>;
        const price = (x.price ?? null) as Record<string, unknown> | null;
        return `• ${s(x.seller, 60)}${price?.display ? ` — ${s(price.display, 30)}` : ""}`;
      }).join("\n");
    case "alternatives":
      return list(c.items).map((a) => `• **${s((a as Record<string, unknown>).name, 80)}** — ${s((a as Record<string, unknown>).reason, 180)}`).join("\n");
    case "sources":
      return list(c.items).slice(0, 15).map((x) => `• ${s((x as Record<string, unknown>).title, 90) || s((x as Record<string, unknown>).domain, 60)} (${s((x as Record<string, unknown>).domain, 60)})`).join("\n");
    default:
      return "";
  }
}

export function overviewData(view: ResearchCardView): Record<string, unknown> {
  const find = (k: string) => view.sections.find((x) => x.section_key === k);
  const identity = (find("identity")?.content ?? {}) as Record<string, unknown>;
  const summary = find("summary");
  const fit = find("fit");
  const facts = find("key_facts");
  const confidence = find("confidence");
  const sections = view.sections.filter((x) => !["identity", "summary"].includes(x.section_key)).map((x) => ({ id: x.section_key, title: clip(x.title, 30) }));
  if (view.comparisons.length) sections.push({ id: "comparisons", title: "Comparisons" });
  return {
    card_id: view.card.id,
    title: clip(view.card.title ?? "Research", 80),
    subtitle: [s(identity.brand, 40), s(identity.variant, 40), s(identity.category, 40)].filter(Boolean).join(" · ") || view.card.public_reference,
    reference: `Research Card ${view.card.public_reference} · ${view.statusLabel}`,
    summary: summary ? sectionBody(summary) || "No summary yet." : "No summary yet.",
    fit_text: fit ? sectionBody(fit) : "",
    has_fit: Boolean(fit),
    findings: [facts ? sectionBody(facts) : "", confidence ? sectionBody(confidence) : ""].filter(Boolean).join("\n\n") || "Key findings will appear here once research completes.",
    sections: sections.length ? sections : [{ id: "sources", title: "Sources" }],
  };
}

function comparisonsBody(view: ResearchCardView): string {
  return view.comparisons
    .map((c) => {
      const snap = (c.comparison_snapshot ?? {}) as Record<string, Record<string, unknown>>;
      const side = (x: Record<string, unknown> | undefined) => (x ? `**${s(x.name, 80)}**${x.score != null ? ` — ${x.score}/100` : ""}` : "");
      return [side(snap.a), side(snap.b), s((snap.verdict as Record<string, unknown> | undefined)?.text, 400)].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

export async function resolveSession(deps: FlowDeps, flowToken: string | undefined): Promise<{ connection: Connection; entryMode: string; cardId: string | null } | null> {
  if (!flowToken) return null;
  const session = await deps.repo.flowSessionByHash(await sha256Hex(flowToken));
  if (!session) return null;
  const connection = await deps.repo.activeConnectionForUser(session.user_id);
  if (!connection || connection.id !== session.connection_id) return null;
  return { connection, entryMode: session.entry_mode, cardId: session.research_card_id };
}

export async function handleFlowRequest(raw: unknown, deps: FlowDeps): Promise<FlowResponse> {
  const parsed = flowRequest.safeParse(raw);
  if (!parsed.success) return { screen: "ERROR", data: { message: "Something went wrong. Close this and try again from the chat." } };
  const req = parsed.data;
  if (req.action === "ping") return { data: { status: "active" } };
  // Client-side error notifications from WhatsApp.
  if (req.data && "error" in req.data && req.action === "data_exchange" && !req.data.cmd) return { data: { acknowledged: true } };

  const session = await resolveSession(deps, req.flow_token);
  if (!session) return { screen: "ERROR", data: { message: "This Sourced link has expired or your WhatsApp is no longer connected. Send “menu” in the chat to get a fresh one." } };
  const userId = session.connection.user_id;

  if (req.action === "INIT") {
    if (session.entryMode === "OPEN_RESEARCH" && session.cardId) return openCard(deps, session.cardId, userId);
    if (session.entryMode === "MY_RESEARCH") return myResearch(deps, userId);
    if (session.entryMode === "START_RESEARCH") return startScreen();
    return home(deps, userId);
  }

  if (req.action === "BACK") return home(deps, userId);

  const cmd = exchange.safeParse(req.data ?? {});
  if (!cmd.success) return home(deps, userId);
  const d = cmd.data;
  switch (d.cmd) {
    case "home":
      return home(deps, userId);
    case "start":
      return startScreen();
    case "list":
      return myResearch(deps, userId, d.cursor, d.q);
    case "open":
      return d.card_id && /^[0-9a-f-]{36}$/i.test(d.card_id) ? openCard(deps, d.card_id, userId) : myResearch(deps, userId);
    case "section":
      return d.card_id && d.section ? openSection(deps, d.card_id, d.section, userId) : home(deps, userId);
    case "research": {
      const query = (d.query ?? "").trim();
      if (query.length < 2) return startScreen();
      await deps.repo.enqueue(
        "research_text",
        { connectionId: session.connection.id, userId, waId: session.connection.wa_id, query, focus: FOCUS_OPTIONS.some((f) => f.id === d.focus) ? d.focus : "everything" },
        { idempotencyKey: `flow:${await sha256Hex(`${req.flow_token}:${query}`)}` },
      );
      return { screen: "DONE", data: { message: `Researching “${clip(query, 60)}”. I'll message you in the chat when your Research Card is ready.` } };
    }
  }
}

async function home(deps: FlowDeps, userId: string): Promise<FlowResponse> {
  const cards = await deps.research.listForUser(userId, { limit: 5 });
  return { screen: "HOME", data: { recent: cards.length ? cards.map(cardItem) : [{ id: "none", title: "No research yet" }], has_recent: cards.length > 0 } };
}

function startScreen(): FlowResponse {
  return { screen: "START_RESEARCH", data: { focus_options: FOCUS_OPTIONS } };
}

async function myResearch(deps: FlowDeps, userId: string, cursor?: string, q?: string): Promise<FlowResponse> {
  const cards = await deps.research.listForUser(userId, { limit: PAGE + 1, before: cursor && !Number.isNaN(Date.parse(cursor)) ? cursor : undefined, q });
  const page = cards.slice(0, PAGE);
  return {
    screen: "MY_RESEARCH",
    data: {
      cards: page.length ? page.map(cardItem) : [{ id: "none", title: q ? "No matches" : "No research yet" }],
      has_cards: page.length > 0,
      has_more: cards.length > PAGE,
      next_cursor: page.at(-1)?.updated_at ?? "",
      heading: q ? `Research matching “${clip(q, 30)}”` : "My Research",
    },
  };
}

async function openCard(deps: FlowDeps, cardId: string, userId: string): Promise<FlowResponse> {
  try {
    const view = await deps.research.get(cardId, userId);
    return { screen: "OVERVIEW", data: overviewData(view) };
  } catch (err) {
    if (err instanceof ResearchError) return { screen: "ERROR", data: { message: "That Research Card isn't available in your account." } };
    throw err;
  }
}

async function openSection(deps: FlowDeps, cardId: string, key: string, userId: string): Promise<FlowResponse> {
  try {
    const view = await deps.research.get(cardId, userId);
    if (key === "comparisons") return { screen: "SECTION", data: { card_id: view.card.id, title: "Comparisons", body: comparisonsBody(view) || "No comparisons yet. Reply “compare with …” in the chat." } };
    const section = view.sections.find((x) => x.section_key === key);
    if (!section) return { screen: "OVERVIEW", data: overviewData(view) };
    return { screen: "SECTION", data: { card_id: view.card.id, title: section.title, body: sectionBody(section) || "Nothing here yet." } };
  } catch (err) {
    if (err instanceof ResearchError) return { screen: "ERROR", data: { message: "That Research Card isn't available in your account." } };
    throw err;
  }
}

/** Issues a flow_token for a linked connection and sends the Flow message. */
export async function launchResearchFlow(
  deps: { repo: WhatsAppRepo; client: WhatsAppClient; flowId: string },
  connection: Connection,
  mode: "HOME" | "OPEN_RESEARCH" | "MY_RESEARCH" | "START_RESEARCH",
  cardId?: string,
): Promise<boolean> {
  if (!deps.flowId) return false;
  const token = randomToken(32, "ft_");
  await deps.repo.createFlowSession({
    token_hash: await sha256Hex(token),
    connection_id: connection.id,
    user_id: connection.user_id,
    entry_mode: mode,
    research_card_id: cardId ?? null,
    expires_at: new Date(Date.now() + FLOW_SESSION_TTL_MIN * 60_000).toISOString(),
  });
  const copy = {
    HOME: { body: "Your Sourced research, organised.", cta: "Open Sourced" },
    OPEN_RESEARCH: { body: "Your Research Card is ready to browse.", cta: "Open Research" },
    MY_RESEARCH: { body: "All your Research Cards in one place.", cta: "My Research" },
    START_RESEARCH: { body: "Start structured research on a product.", cta: "Start Research" },
  }[mode];
  await deps.client.sendFlow(connection.wa_id, { ...copy, flowId: deps.flowId, flowToken: token });
  return true;
}

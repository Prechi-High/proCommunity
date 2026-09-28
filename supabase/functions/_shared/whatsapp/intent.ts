/**
 * Deterministic intent routing. Button/list ids and explicit commands are matched first;
 * an optional classifier is consulted only for free text that no rule understands.
 * Authorisation is never decided here.
 */

export type Intent =
  | "START_RESEARCH"
  | "OPEN_RESEARCH"
  | "LIST_RESEARCH"
  | "SEARCH_RESEARCH"
  | "ASK_RESEARCH_QUESTION"
  | "COMPARE_PRODUCT"
  | "SAVE_PRODUCT"
  | "ADD_TO_SATCHEL"
  | "FIND_STORES"
  | "SHARE_RESEARCH"
  | "CONNECT_ACCOUNT"
  | "DISCONNECT_ACCOUNT"
  | "PICK_CANDIDATE"
  | "RESEARCH_AGAIN"
  | "HELP"
  | "UNKNOWN";

export type RoutedIntent = {
  intent: Intent;
  cardId?: string;
  query?: string;
  token?: string;
  index?: number;
  productId?: string;
  image?: boolean;
};

export type IntentInput = {
  messageType: "text" | "image" | "action" | "flow_reply" | "unsupported";
  text?: string;
  actionId?: string;
  activeResearchCardId?: string | null;
  awaiting?: string | null;
};

// ---------------------------------------------------------------------------
// Action ids: stable, never visible text, never authorisation-bearing (ownership is re-checked server-side).

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const Action = {
  open: (cardId: string) => `OPEN:${cardId}`,
  compare: (cardId: string) => `COMPARE:${cardId}`,
  save: (cardId: string) => `SAVE:${cardId}`,
  share: (cardId: string) => `SHARE:${cardId}`,
  stores: (cardId: string) => `STORES:${cardId}`,
  pick: (index: number) => `PICK:${index}`,
  again: (productId: string) => `AGAIN:${productId.slice(0, 200)}`,
  start: "START",
  list: "LIST",
  help: "HELP",
};

const ACTION_RULES: Array<[RegExp, (m: RegExpMatchArray) => RoutedIntent]> = [
  [new RegExp(`^OPEN:(${UUID})$`, "i"), (m) => ({ intent: "OPEN_RESEARCH", cardId: m[1].toLowerCase() })],
  [new RegExp(`^COMPARE:(${UUID})$`, "i"), (m) => ({ intent: "COMPARE_PRODUCT", cardId: m[1].toLowerCase() })],
  [new RegExp(`^SAVE:(${UUID})$`, "i"), (m) => ({ intent: "SAVE_PRODUCT", cardId: m[1].toLowerCase() })],
  [new RegExp(`^SHARE:(${UUID})$`, "i"), (m) => ({ intent: "SHARE_RESEARCH", cardId: m[1].toLowerCase() })],
  [new RegExp(`^STORES:(${UUID})$`, "i"), (m) => ({ intent: "FIND_STORES", cardId: m[1].toLowerCase() })],
  [/^PICK:(\d{1,2})$/, (m) => ({ intent: "PICK_CANDIDATE", index: Number(m[1]) })],
  [/^AGAIN:([a-z0-9-]{1,200})$/, (m) => ({ intent: "RESEARCH_AGAIN", productId: m[1] })],
  [/^START$/, () => ({ intent: "START_RESEARCH" })],
  [/^LIST$/, () => ({ intent: "LIST_RESEARCH" })],
  [/^HELP$/, () => ({ intent: "HELP" })],
];

const QUESTION_START = /^(does|do|is|are|can|could|will|would|should|how|what|why|when|which|who|any|has|have|was|were)\b/i;

export function routeIntent(input: IntentInput): RoutedIntent {
  if (input.messageType === "image") return { intent: "START_RESEARCH", image: true };

  if (input.actionId) {
    for (const [re, make] of ACTION_RULES) {
      const m = input.actionId.match(re);
      if (m) return make(m);
    }
    return { intent: "UNKNOWN" };
  }

  const text = (input.text ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { intent: "HELP" };
  const active = input.activeResearchCardId ?? undefined;

  const link = text.match(/^link\s+(wa_link_[A-Za-z0-9]{16,64})$/i);
  if (link) return { intent: "CONNECT_ACCOUNT", token: link[1] };
  if (/^disconnect( whatsapp)?$/i.test(text)) return { intent: "DISCONNECT_ACCOUNT" };
  if (/^(hi|hello|hey|help|menu|start|\?)$/i.test(text)) return { intent: "HELP" };
  if (/^(my research|research history|history|my cards|my research cards|previous research)$/i.test(text)) return { intent: "LIST_RESEARCH" };

  const search = text.match(/^(?:show|find|open)\s+(?:me\s+)?my\s+(.{2,60}?)\s+research$/i);
  if (search) return { intent: "SEARCH_RESEARCH", query: search[1] };

  if (input.awaiting === "compare_target" && active) return { intent: "COMPARE_PRODUCT", cardId: active, query: text.slice(0, 140) };

  const compare = text.match(/^compare\s+(?:it\s+)?(?:with|to|against|vs\.?)?\s*(.{2,140})$/i);
  if (compare && active) return { intent: "COMPARE_PRODUCT", cardId: active, query: compare[1] };
  if (/^compare( it)?$/i.test(text) && active) return { intent: "COMPARE_PRODUCT", cardId: active };

  if (/^save( it| this| product)?$/i.test(text) && active) return { intent: "SAVE_PRODUCT", cardId: active };
  if (/^(add (it |this )?to (my )?satchel)$/i.test(text)) return { intent: "ADD_TO_SATCHEL", cardId: active };
  if (/^share( it| this| research)?$/i.test(text) && active) return { intent: "SHARE_RESEARCH", cardId: active };
  if (/^(where (can i|to|do i) buy( it)?|stores|prices?|best price)\??$/i.test(text) && active) return { intent: "FIND_STORES", cardId: active };

  const research = text.match(/^(?:research|look up|lookup|check|search)\s+(.{2,140})$/i);
  if (research) return { intent: "START_RESEARCH", query: research[1] };

  const questionish = text.endsWith("?") || QUESTION_START.test(text);
  if (questionish && active) return { intent: "ASK_RESEARCH_QUESTION", cardId: active, query: text.slice(0, 500) };
  if (!questionish && text.length <= 80) return { intent: "START_RESEARCH", query: text };
  return { intent: "UNKNOWN", query: text.slice(0, 500) };
}

export async function routeWithFallback(input: IntentInput, classify?: (text: string) => Promise<Intent | null>): Promise<RoutedIntent> {
  const routed = routeIntent(input);
  if (routed.intent !== "UNKNOWN" || !classify || !input.text) return routed;
  const guess = await classify(input.text).catch(() => null);
  const safe: Intent[] = ["START_RESEARCH", "LIST_RESEARCH", "ASK_RESEARCH_QUESTION", "HELP"];
  if (!guess || !safe.includes(guess)) return routed;
  if (guess === "ASK_RESEARCH_QUESTION" && !input.activeResearchCardId) return routed;
  return { ...routed, intent: guess, cardId: input.activeResearchCardId ?? undefined, query: input.text.slice(0, 500) };
}

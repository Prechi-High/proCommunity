import { env } from "../core/env.ts";
import type { TemplateComponent } from "./client.ts";

/**
 * Every Meta template the platform can send, keyed by internal event.
 * Template names live only here. A template is used only once it is listed in
 * WHATSAPP_APPROVED_TEMPLATES (comma-separated), i.e. after Meta approves it.
 */

export type TemplateEvent = "research_completed" | "price_drop" | "research_updated" | "community_reply" | "refill_reminder" | "product_drop";

type Params = Record<string, string>;

export interface TemplateDefinition {
  event: TemplateEvent;
  name: string;
  language: string;
  version: number;
  category: "UTILITY" | "MARKETING";
  /** Body text as submitted to Meta ({{1}}, {{2}} placeholders). Kept here for review and docs. */
  body: string;
  build(params: Params): TemplateComponent[];
}

const bodyParams = (...values: string[]): TemplateComponent => ({ type: "body", parameters: values.map((text) => ({ type: "text", text: text.slice(0, 200) })) });
const urlButton = (suffix: string): TemplateComponent => ({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: suffix }] });

export const WhatsAppTemplateRegistry: Record<TemplateEvent, TemplateDefinition> = {
  research_completed: {
    event: "research_completed",
    name: "sourced_research_completed_v1",
    language: "en",
    version: 1,
    category: "UTILITY",
    body: "Research complete ✓\n\n{{1}}\n\nResearch Card {{2}} is ready with product details, owner evidence and sources.",
    build: (p) => [bodyParams(p.title, p.reference), urlButton(p.cardPath)],
  },
  research_updated: {
    event: "research_updated",
    name: "sourced_research_updated_v1",
    language: "en",
    version: 1,
    category: "UTILITY",
    body: "Research updated\n\n{{1}}\n\nNew information is available in Research Card {{2}}.",
    build: (p) => [bodyParams(p.title, p.reference), urlButton(p.cardPath)],
  },
  price_drop: {
    event: "price_drop",
    name: "sourced_price_drop_v1",
    language: "en",
    version: 1,
    category: "UTILITY",
    body: "Price update for {{1}}\n\nWhen you researched it: {{2}}\nNow: {{3}}",
    build: (p) => [bodyParams(p.title, p.then, p.now), urlButton(p.cardPath)],
  },
  community_reply: {
    event: "community_reply",
    name: "sourced_community_reply_v1",
    language: "en",
    version: 1,
    category: "UTILITY",
    body: "{{1}} replied in a discussion you follow about {{2}}.",
    build: (p) => [bodyParams(p.actor, p.product), urlButton(p.threadPath)],
  },
  refill_reminder: {
    event: "refill_reminder",
    name: "sourced_refill_reminder_v1",
    language: "en",
    version: 1,
    category: "UTILITY",
    body: "You may be running low on {{1}}. Your Research Card has current prices and stores.",
    build: (p) => [bodyParams(p.title), urlButton(p.cardPath)],
  },
  product_drop: {
    event: "product_drop",
    name: "sourced_product_drop_v1",
    language: "en",
    version: 1,
    category: "MARKETING",
    body: "New from {{1}}: {{2}}. See what owners say before you buy.",
    build: (p) => [bodyParams(p.brand, p.title), urlButton(p.path)],
  },
};

export function approvedTemplate(event: TemplateEvent): TemplateDefinition | null {
  const def = WhatsAppTemplateRegistry[event];
  const approved = new Set(env("WHATSAPP_APPROVED_TEMPLATES").split(",").map((s) => s.trim()).filter(Boolean));
  return approved.has(def.name) ? def : null;
}

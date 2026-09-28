import { flags } from "../core/env.ts";
import { clip, type WhatsAppClient } from "./client.ts";
import { preferencesOf } from "./connections.ts";
import { Action } from "./intent.ts";
import { sendPermittedMessage } from "./policy.ts";
import { cardLink } from "./replies.ts";
import type { WhatsAppRepo } from "./repository.ts";
import type { TemplateEvent } from "./templates.ts";
import type { NotificationPreferences } from "./types.ts";

/**
 * Delivery layer: the Sourced domain decides WHAT happened ({ userId, type, entityId, payload });
 * this module decides whether and how to deliver it over WhatsApp.
 */

export type NotificationInput = {
  userId: string;
  type: TemplateEvent;
  entityId: string;
  payload: Record<string, string>;
  notificationId?: string | null;
};

export const PREFERENCE_FOR: Record<TemplateEvent, keyof NotificationPreferences> = {
  research_completed: "research_updates",
  research_updated: "research_updates",
  price_drop: "price_alerts",
  community_reply: "community_replies",
  refill_reminder: "refill_reminders",
  product_drop: "product_drops",
};

export function allowedByPreferences(type: TemplateEvent, stored: Partial<NotificationPreferences> | null | undefined): boolean {
  const key = PREFERENCE_FOR[type];
  // Product drops require an explicit stored opt-in; defaults never enable them.
  if (key === "product_drops") return stored?.product_drops === true;
  return preferencesOf({ notification_preferences: stored ?? {} })[key];
}

function freeformFor(input: NotificationInput): (c: WhatsAppClient, to: string) => Promise<string> {
  const p = input.payload;
  switch (input.type) {
    case "research_updated":
    case "research_completed":
      return (c, to) =>
        c.sendButtons(to, `Research updated\n\n${clip(p.title ?? "", 80)}\n\nNew information is available in Research Card ${p.reference ?? ""}.`, [{ id: Action.open(input.entityId), title: "Open Research" }]);
    case "price_drop":
      return (c, to) => c.sendButtons(to, `Price update for ${clip(p.title ?? "", 80)}\n\nWhen you researched it: ${p.then}\nNow: ${p.now}`, [{ id: Action.open(input.entityId), title: "Open Research" }]);
    case "community_reply":
      return (c, to) => c.sendCtaUrl(to, `${clip(p.actor ?? "Someone", 40)} replied in a discussion you follow about ${clip(p.product ?? "a product", 60)}.`, "Open discussion", p.threadUrl ?? cardLink(input.entityId));
    default:
      return (c, to) => c.sendCtaUrl(to, clip(p.title ?? "Update from Sourced", 200), "Open Sourced", p.url ?? cardLink(input.entityId));
  }
}

export async function deliverNotification(input: NotificationInput, deps: { repo: WhatsAppRepo; client: WhatsAppClient; notificationsEnabled?: boolean }): Promise<"sent" | "skipped"> {
  const enabled = deps.notificationsEnabled ?? flags.whatsappNotifications;
  const conn = await deps.repo.activeConnectionForUser(input.userId);
  const skip = async (error: string) => {
    await deps.repo.createDelivery({ user_id: input.userId, notification_id: input.notificationId ?? null, channel: "whatsapp", event_type: input.type, status: "skipped", error });
    return "skipped" as const;
  };
  if (!enabled) return skip("disabled");
  if (!conn) return skip("not_connected");
  if (!allowedByPreferences(input.type, conn.notification_preferences)) return skip("preference_off");

  const delivery = await deps.repo.createDelivery({ user_id: input.userId, notification_id: input.notificationId ?? null, channel: "whatsapp", event_type: input.type, status: "pending" });
  const attempt = { attempt_count: delivery.attempt_count + 1, last_attempt_at: new Date().toISOString() };
  try {
    const result = await sendPermittedMessage(deps.client, conn, {
      freeform: freeformFor(input),
      template: { event: input.type, params: { ...input.payload, cardPath: `research/${input.entityId}` } },
    });
    if (!result.sent) {
      await deps.repo.updateDelivery(delivery.id, { ...attempt, status: "skipped", error: result.reason });
      return "skipped";
    }
    await deps.repo.updateDelivery(delivery.id, { ...attempt, status: "sent", provider_message_id: result.messageId, error: null });
    await deps.repo.touchConnection(conn.id, "last_outbound_at");
    return "sent";
  } catch (err) {
    await deps.repo.updateDelivery(delivery.id, { ...attempt, status: "failed", error: err instanceof Error ? err.message.slice(0, 200) : "send_failed" });
    throw err;
  }
}

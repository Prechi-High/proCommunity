import type { WhatsAppClient } from "./client.ts";
import { approvedTemplate, type TemplateEvent } from "./templates.ts";
import type { Connection } from "./types.ts";

/**
 * The single place that knows Meta's messaging rules:
 * free-form messages are allowed within 24 hours of the user's last inbound message
 * (customer service window); outside it, only approved templates may be sent.
 */

export const SERVICE_WINDOW_MS = 24 * 3600_000;

export function canSendFreeformMessage(connection: Pick<Connection, "status" | "last_inbound_at">, now = new Date()): boolean {
  if (connection.status !== "active" || !connection.last_inbound_at) return false;
  return now.getTime() - new Date(connection.last_inbound_at).getTime() < SERVICE_WINDOW_MS - 60_000;
}

export type PermittedResult = { sent: true; messageId: string; via: "freeform" | "template" } | { sent: false; reason: "outside_window" | "not_active" | "no_template" };

export async function sendPermittedMessage(
  client: WhatsAppClient,
  connection: Pick<Connection, "status" | "last_inbound_at" | "wa_id">,
  message: { freeform: (c: WhatsAppClient, to: string) => Promise<string>; template?: { event: TemplateEvent; params: Record<string, string> } },
  now = new Date(),
): Promise<PermittedResult> {
  if (connection.status !== "active") return { sent: false, reason: "not_active" };
  if (canSendFreeformMessage(connection, now)) {
    return { sent: true, messageId: await message.freeform(client, connection.wa_id), via: "freeform" };
  }
  if (!message.template) return { sent: false, reason: "outside_window" };
  const def = approvedTemplate(message.template.event);
  if (!def) return { sent: false, reason: "no_template" };
  const id = await client.sendTemplate(connection.wa_id, def.name, def.language, def.build(message.template.params));
  return { sent: true, messageId: id, via: "template" };
}

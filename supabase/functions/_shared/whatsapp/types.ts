import { z } from "zod";

// ---------------------------------------------------------------------------
// Webhook payload (validated — Meta payloads are never trusted blindly)

const text = z.object({ body: z.string().max(4096) });
const image = z.object({ id: z.string().max(128), mime_type: z.string().max(64).optional(), sha256: z.string().optional(), caption: z.string().max(1024).optional() });
const interactive = z.object({
  type: z.string(),
  button_reply: z.object({ id: z.string().max(256), title: z.string().max(40) }).optional(),
  list_reply: z.object({ id: z.string().max(256), title: z.string().max(40), description: z.string().max(100).optional() }).optional(),
  nfm_reply: z.object({ response_json: z.string().max(10000), name: z.string().optional(), body: z.string().optional() }).optional(),
});

export const webhookMessage = z.object({
  from: z.string().regex(/^\d{6,20}$/),
  id: z.string().max(200),
  timestamp: z.string().max(20),
  type: z.string().max(30),
  text: text.optional(),
  image: image.optional(),
  interactive: interactive.optional(),
  button: z.object({ payload: z.string().max(256).optional(), text: z.string().max(100).optional() }).optional(),
});

export const webhookStatus = z.object({
  id: z.string().max(200),
  status: z.enum(["sent", "delivered", "read", "failed", "deleted"]),
  timestamp: z.string().max(20),
  recipient_id: z.string().max(20).optional(),
  errors: z.array(z.object({ code: z.number().optional(), title: z.string().optional() })).optional(),
});

export const webhookPayload = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z
    .array(
      z.object({
        id: z.string(),
        changes: z.array(
          z.object({
            field: z.string(),
            value: z
              .object({
                metadata: z.object({ phone_number_id: z.string() }).partial().optional(),
                contacts: z.array(z.object({ wa_id: z.string().optional() }).passthrough()).optional(),
                messages: z.array(z.unknown()).optional(),
                statuses: z.array(z.unknown()).optional(),
              })
              .passthrough(),
          }),
        ),
      }),
    )
    .max(50),
});

// ---------------------------------------------------------------------------
// Normalised internal shapes

export type InboundKind = "text" | "image" | "action" | "flow_reply" | "unsupported";

export interface InboundMessage {
  id: string;
  from: string;
  timestamp: number;
  phoneNumberId: string | null;
  kind: InboundKind;
  rawType: string;
  text?: string;
  image?: { mediaId: string; mimeType: string | null; caption: string | null };
  actionId?: string;
  flowResponse?: Record<string, unknown>;
}

export interface StatusUpdate {
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed" | "deleted";
  timestamp: number;
  recipient: string | null;
  errorCode: number | null;
}

export type ConnectionStatus = "pending" | "active" | "disconnected" | "blocked";

export interface NotificationPreferences {
  price_alerts: boolean;
  research_updates: boolean;
  community_replies: boolean;
  refill_reminders: boolean;
  product_drops: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  price_alerts: true,
  research_updates: true,
  community_replies: true,
  refill_reminders: false,
  product_drops: false,
};

export const preferencesPatch = z
  .object({
    price_alerts: z.boolean(),
    research_updates: z.boolean(),
    community_replies: z.boolean(),
    refill_reminders: z.boolean(),
    product_drops: z.boolean(),
  })
  .partial()
  .strict();

export interface Connection {
  id: string;
  user_id: string;
  wa_id: string;
  phone_e164: string | null;
  status: ConnectionStatus;
  connected_at: string | null;
  disconnected_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  notification_preferences: Partial<NotificationPreferences>;
}

export interface Conversation {
  id: string;
  connection_id: string;
  active_research_card_id: string | null;
  active_product_id: string | null;
  state: ConversationState;
}

export interface ConversationState {
  awaiting?: "compare_target" | "question" | null;
  pendingCandidates?: Array<{ productId: string; name: string; brand?: string; category?: string; image?: string | null }>;
  pendingFocus?: string;
  pendingImageUrl?: string | null;
}

export interface Job {
  id: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  status: "queued" | "processing" | "done" | "failed" | "dead";
  attempts: number;
  max_attempts: number;
}

export type JobKind = "research_text" | "research_image" | "research_run" | "ask" | "compare" | "notify";

/** Normalised Meta error — business logic never sees Meta's raw error shape. */
export class WhatsAppError extends Error {
  readonly provider = "meta_whatsapp";
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly requestId: string | null = null,
    readonly status = 0,
  ) {
    super(message);
  }
}

export type UserSafeError =
  | "PRODUCT_NOT_IDENTIFIED"
  | "PRODUCT_AMBIGUOUS"
  | "RESEARCH_FAILED"
  | "MEDIA_UNAVAILABLE"
  | "ACCOUNT_NOT_LINKED"
  | "RESEARCH_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "RATE_LIMITED"
  | "TEMPORARY_ERROR";

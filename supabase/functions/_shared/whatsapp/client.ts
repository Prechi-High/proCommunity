import { env } from "../core/env.ts";
import { WhatsAppError } from "./types.ts";

/**
 * The only module that talks to the WhatsApp Cloud API. The Graph version comes from
 * WHATSAPP_API_VERSION so upgrades don't touch business logic.
 */

export type Button = { id: string; title: string };
export type ListRow = { id: string; title: string; description?: string };
export type ListSection = { title: string; rows: ListRow[] };
export type TemplateComponent = { type: "header" | "body" | "button"; sub_type?: "url" | "quick_reply"; index?: string; parameters: Array<Record<string, unknown>> };

export interface WhatsAppClient {
  sendText(to: string, body: string, opts?: { previewUrl?: boolean }): Promise<string>;
  sendButtons(to: string, body: string, buttons: Button[], opts?: { header?: string; footer?: string }): Promise<string>;
  sendList(to: string, body: string, buttonLabel: string, sections: ListSection[], opts?: { header?: string; footer?: string }): Promise<string>;
  sendCtaUrl(to: string, body: string, displayText: string, url: string, opts?: { header?: string; footer?: string }): Promise<string>;
  sendFlow(to: string, input: { body: string; cta: string; flowId: string; flowToken: string; header?: string; footer?: string }): Promise<string>;
  sendTemplate(to: string, name: string, language: string, components: TemplateComponent[]): Promise<string>;
  retrieveMedia(mediaId: string): Promise<{ url: string; mimeType: string; fileSize: number }>;
  downloadMedia(url: string, maxBytes: number): Promise<Uint8Array>;
  markRead(messageId: string): Promise<void>;
}

export const LIMITS = { body: 1024, buttonTitle: 20, buttonId: 256, rowTitle: 24, rowDescription: 72, header: 60, footer: 60, listButton: 20, text: 4096 };

export function clip(value: string, max: number): string {
  const v = value.replace(/\s+\n/g, "\n").trim();
  return v.length <= max ? v : `${v.slice(0, max - 1).trimEnd()}…`;
}

const RETRYABLE_CODES = new Set([1, 2, 4, 17, 341, 80007, 130429, 131000, 131016, 131048, 131056, 133004]);

export function normaliseMetaError(status: number, body: unknown, requestId: string | null): WhatsAppError {
  const e = ((body as { error?: Record<string, unknown> })?.error ?? {}) as Record<string, unknown>;
  const code = typeof e.code === "number" ? e.code : 0;
  const message = typeof e.message === "string" ? e.message.slice(0, 200) : `http_${status}`;
  const retryable = status >= 500 || status === 429 || RETRYABLE_CODES.has(code);
  return new WhatsAppError(code ? `meta_${code}` : `http_${status}`, message, retryable, requestId ?? (typeof e.fbtrace_id === "string" ? e.fbtrace_id : null), status);
}

export function cloudClient(opts: { token?: string; phoneNumberId?: string; version?: string; fetcher?: typeof fetch } = {}): WhatsAppClient {
  const token = opts.token ?? env("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = opts.phoneNumberId ?? env("WHATSAPP_PHONE_NUMBER_ID");
  const version = opts.version ?? (env("WHATSAPP_API_VERSION") || "v23.0");
  const fetcher = opts.fetcher ?? fetch;
  const graph = `https://graph.facebook.com/${version}`;

  const request = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
    if (!token || !phoneNumberId) throw new WhatsAppError("not_configured", "WhatsApp credentials missing", false);
    let res: Response;
    try {
      res = await fetcher(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
    } catch {
      throw new WhatsAppError("network", "Meta API unreachable", true);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw normaliseMetaError(res.status, body, res.headers.get("x-fb-trace-id"));
    return body as T;
  };

  const send = async (to: string, payload: Record<string, unknown>): Promise<string> => {
    const out = await request<{ messages?: Array<{ id: string }> }>(`${graph}/${phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...payload }),
    });
    const id = out.messages?.[0]?.id;
    if (!id) throw new WhatsAppError("no_message_id", "Meta returned no message id", true);
    return id;
  };

  const chrome = (o?: { header?: string; footer?: string }) => ({
    ...(o?.header ? { header: { type: "text", text: clip(o.header, LIMITS.header) } } : {}),
    ...(o?.footer ? { footer: { text: clip(o.footer, LIMITS.footer) } } : {}),
  });

  return {
    sendText: (to, body, o) => send(to, { type: "text", text: { body: clip(body, LIMITS.text), preview_url: o?.previewUrl ?? false } }),
    sendButtons: (to, body, buttons, o) =>
      send(to, {
        type: "interactive",
        interactive: {
          type: "button",
          ...chrome(o),
          body: { text: clip(body, LIMITS.body) },
          action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id.slice(0, LIMITS.buttonId), title: clip(b.title, LIMITS.buttonTitle) } })) },
        },
      }),
    sendList: (to, body, buttonLabel, sections, o) =>
      send(to, {
        type: "interactive",
        interactive: {
          type: "list",
          ...chrome(o),
          body: { text: clip(body, LIMITS.body) },
          action: {
            button: clip(buttonLabel, LIMITS.listButton),
            sections: sections.slice(0, 10).map((s) => ({
              title: clip(s.title, 24),
              rows: s.rows.slice(0, 10).map((r) => ({ id: r.id.slice(0, 200), title: clip(r.title, LIMITS.rowTitle), ...(r.description ? { description: clip(r.description, LIMITS.rowDescription) } : {}) })),
            })),
          },
        },
      }),
    sendCtaUrl: (to, body, displayText, url, o) =>
      send(to, {
        type: "interactive",
        interactive: { type: "cta_url", ...chrome(o), body: { text: clip(body, LIMITS.body) }, action: { name: "cta_url", parameters: { display_text: clip(displayText, 20), url } } },
      }),
    sendFlow: (to, i) =>
      send(to, {
        type: "interactive",
        interactive: {
          type: "flow",
          ...chrome(i),
          body: { text: clip(i.body, LIMITS.body) },
          action: {
            name: "flow",
            parameters: { flow_message_version: "3", flow_token: i.flowToken, flow_id: i.flowId, flow_cta: clip(i.cta, 20), flow_action: "data_exchange" },
          },
        },
      }),
    sendTemplate: (to, name, language, components) => send(to, { type: "template", template: { name, language: { code: language }, components } }),
    async retrieveMedia(mediaId) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(mediaId)) throw new WhatsAppError("invalid_media_id", "Invalid media id", false);
      const out = await request<{ url?: string; mime_type?: string; file_size?: number }>(`${graph}/${mediaId}`);
      if (!out.url) throw new WhatsAppError("media_unavailable", "Media URL missing", false);
      return { url: out.url, mimeType: out.mime_type ?? "application/octet-stream", fileSize: Number(out.file_size ?? 0) };
    },
    async downloadMedia(url, maxBytes) {
      if (!/^https:\/\/([a-z0-9-]+\.)*(fbsbx\.com|facebook\.com|whatsapp\.net)\//i.test(url)) throw new WhatsAppError("media_host", "Unexpected media host", false);
      let res: Response;
      try {
        res = await fetcher(url, { headers: { Authorization: `Bearer ${token}` } });
      } catch {
        throw new WhatsAppError("network", "Media download failed", true);
      }
      if (res.status === 404 || res.status === 410) throw new WhatsAppError("media_expired", "Media URL expired", false, null, res.status);
      if (!res.ok) throw new WhatsAppError(`http_${res.status}`, "Media download failed", res.status >= 500, null, res.status);
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > maxBytes) throw new WhatsAppError("media_too_large", "Media too large", false);
      return buf;
    },
    async markRead(messageId) {
      await request(`${graph}/${phoneNumberId}/messages`, {
        method: "POST",
        body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
      });
    },
  };
}

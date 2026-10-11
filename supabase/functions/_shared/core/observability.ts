import { env } from "./env.ts";
import { sha256Hex } from "./crypto.ts";

/**
 * Structured logs + Sentry (envelope API) + PostHog (capture API), all over plain fetch.
 * Secrets, tokens and message bodies are redacted before anything leaves the function.
 */

const SECRET_KEYS = /token|secret|password|authorization|apikey|api_key|private|signature|body|text|caption|phone/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
    return out;
  }
  if (typeof value === "string") return value.replace(/(EAA[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9._-]{20,}|wa_link_[A-Za-z0-9]+)/g, "[redacted]").slice(0, 500);
  return value;
}

export type LogFields = {
  request_id?: string;
  provider_message_id?: string;
  research_card_id?: string;
  user?: string;
  job_id?: string;
  [key: string]: unknown;
};

export function log(event: string, fields: LogFields = {}, level: "info" | "warn" | "error" = "info") {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...(redact(fields) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Internal user ids are hashed before they reach logs or Sentry. */
export async function userRef(userId: string | null | undefined): Promise<string | undefined> {
  return userId ? (await sha256Hex(`u:${userId}`)).slice(0, 16) : undefined;
}

export async function captureError(error: unknown, context: LogFields = {}, fetcher: typeof fetch = fetch): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  log("error", { ...context, message }, "error");
  const dsn = env("SENTRY_DSN");
  const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
  if (!m) return;
  const [, publicKey, host, projectId] = m;
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    environment: env("SENTRY_ENVIRONMENT") || "production",
    server_name: "supabase-edge",
    tags: { integration: "whatsapp", area: String(context.area ?? "unknown") },
    extra: redact(context),
    exception: { values: [{ type: error instanceof Error ? error.name : "Error", value: String(redact(message)) }] },
  };
  const envelope = `${JSON.stringify({ event_id: eventId, dsn })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`;
  await fetcher(`https://${host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`, {
    method: "POST",
    headers: { "Content-Type": "application/x-sentry-envelope" },
    body: envelope,
  }).catch(() => undefined);
}

/** Server-side product analytics. Never include message contents. */
export async function capture(event: string, distinctId: string | undefined, properties: Record<string, unknown> = {}, fetcher: typeof fetch = fetch) {
  const key = env("POSTHOG_KEY") || env("EXPO_PUBLIC_POSTHOG_KEY");
  if (!key || !distinctId) return;
  const host = (env("POSTHOG_HOST") || env("EXPO_PUBLIC_POSTHOG_HOST") || "https://us.i.posthog.com").replace(/\/+$/, "");
  await fetcher(`${host}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event,
      distinct_id: distinctId,
      properties: { ...(redact(properties) as object), channel: String(properties.channel ?? "whatsapp") },
    }),
  }).catch(() => undefined);
}

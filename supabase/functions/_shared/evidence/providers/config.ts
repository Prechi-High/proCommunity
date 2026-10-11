import type { ProviderId } from "./types.ts";

function envBool(name: string, defaultValue: boolean): boolean {
  const v = (Deno.env.get(name) ?? "").trim().toLowerCase();
  if (!v) return defaultValue;
  return v === "1" || v === "true" || v === "yes";
}

function envInt(name: string, defaultValue: number): number {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : defaultValue;
}

export function secret(name: string): string {
  return (Deno.env.get(name) ?? "").trim().replace(/^["']|["']$/g, "");
}

export const PROVIDER_TIMEOUT_MS = envInt("EVIDENCE_PROVIDER_TIMEOUT_MS", 8000);

export const PROVIDER_CAPS: Record<ProviderId, number> = {
  youtube: envInt("MAX_YOUTUBE_EVIDENCE", 40),
  reddit: envInt("MAX_REDDIT_EVIDENCE", 35),
  x: envInt("MAX_X_EVIDENCE", 25),
  discourse: envInt("MAX_FORUM_EVIDENCE", 25),
  github: envInt("MAX_GITHUB_EVIDENCE", 20),
  hackernews: envInt("MAX_HN_EVIDENCE", 20),
  web: envInt("MAX_WEB_EVIDENCE", 20),
};

export const PROVIDER_ENABLED: Record<ProviderId, boolean> = {
  youtube: envBool("EVIDENCE_YOUTUBE_ENABLED", true),
  reddit: envBool("EVIDENCE_REDDIT_ENABLED", false),
  x: envBool("EVIDENCE_X_ENABLED", false),
  discourse: envBool("EVIDENCE_DISCOURSE_ENABLED", false),
  github: envBool("EVIDENCE_GITHUB_ENABLED", false),
  hackernews: envBool("EVIDENCE_HN_ENABLED", false),
  web: envBool("EVIDENCE_WEB_ENABLED", true),
};

export const DISCOURSE_ALLOWLIST = (Deno.env.get("DISCOURSE_ALLOWLIST_DOMAINS") ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const REDDIT_PROVIDER = {
  type: secret("REDDIT_PROVIDER_TYPE") || "rest",
  baseUrl: secret("REDDIT_PROVIDER_BASE_URL"),
  apiKey: secret("REDDIT_PROVIDER_API_KEY"),
};

export const X_PROVIDER = {
  type: secret("X_PROVIDER_TYPE") || "rest",
  baseUrl: secret("X_PROVIDER_BASE_URL"),
  apiKey: secret("X_PROVIDER_API_KEY"),
};

export const GITHUB_TOKEN = secret("GITHUB_TOKEN");

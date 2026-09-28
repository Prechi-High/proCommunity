/** Runtime-agnostic env access so shared modules run under Deno (edge) and Node (tests). */

type DenoLike = { env: { get(name: string): string | undefined } };

export function env(name: string): string {
  const deno = (globalThis as { Deno?: DenoLike }).Deno;
  const raw = deno ? deno.env.get(name) : (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env[name];
  return (raw ?? "").trim();
}

function flag(name: string, fallback: boolean): boolean {
  const v = env(name).toLowerCase();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export const flags = {
  get whatsapp() {
    return flag("WHATSAPP_INTEGRATION_ENABLED", false);
  },
  get whatsappResearch() {
    return this.whatsapp && flag("WHATSAPP_RESEARCH_ENABLED", true);
  },
  get whatsappFlows() {
    return this.whatsapp && flag("WHATSAPP_FLOWS_ENABLED", false);
  },
  get whatsappNotifications() {
    return this.whatsapp && flag("WHATSAPP_NOTIFICATIONS_ENABLED", false);
  },
};

export function publicUrl(): string {
  return (env("SOURCED_PUBLIC_URL") || "https://sourced.app").replace(/\/+$/, "");
}

export function appDeepLink(): string {
  return (env("SOURCED_APP_DEEP_LINK") || `${publicUrl()}`).replace(/\/+$/, "");
}

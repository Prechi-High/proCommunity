import { serviceRest } from "../core/db.ts";
import { env, flags } from "../core/env.ts";
import { edgeIntelligence } from "../core/intelligence.ts";
import { capture, userRef } from "../core/observability.ts";
import { redisRateLimiter } from "../core/ratelimit.ts";
import { supabaseResearchRepo } from "../research/repository.ts";
import { ResearchService } from "../research/service.ts";
import { cloudClient } from "./client.ts";
import { launchResearchFlow } from "./flows/handler.ts";
import type { Analytics, OrchestratorDeps } from "./orchestrator.ts";
import { supabaseWhatsAppRepo } from "./repository.ts";

/** Wires production dependencies once per isolate. Tests build their own deps with fakes. */

/** Analytics never receives message contents, phone numbers or raw user ids. */
export const analytics: Analytics = async (event, userId, props = {}) => {
  await capture(event, await userRef(userId), { ...props, channel: "whatsapp" }).catch(() => undefined);
};

export function productionDeps(): OrchestratorDeps | null {
  const rest = serviceRest();
  if (!rest) return null;
  const repo = supabaseWhatsAppRepo(rest);
  const intel = edgeIntelligence();
  const research = new ResearchService({ repo: supabaseResearchRepo(rest), intel });
  const client = cloudClient();
  const flowId = env("WHATSAPP_FLOW_RESEARCH_ID");
  return {
    repo,
    research,
    intel,
    client,
    limiter: redisRateLimiter(),
    analytics,
    researchEnabled: flags.whatsappResearch,
    launchFlow: flags.whatsappFlows && flowId ? (conn, mode, cardId) => launchResearchFlow({ repo, client, flowId }, conn, mode, cardId) : null,
  };
}

/** Fire-and-forget worker kick so queued jobs start immediately (a cron should also call the worker). */
export function kickWorker(): Promise<void> {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return Promise.resolve();
  return fetch(`${url}/functions/v1/whatsapp-worker`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: "{}" })
    .then((r) => void r.body?.cancel())
    .catch(() => undefined);
}

type EdgeRuntimeLike = { waitUntil(p: Promise<unknown>): void };
export function background(p: Promise<unknown>): void {
  const rt = (globalThis as { EdgeRuntime?: EdgeRuntimeLike }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
  else void p;
}

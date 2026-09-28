// Background worker for WhatsApp/Research jobs (integration_jobs).
// Service-role only. Claims jobs with SKIP LOCKED, processes them within a time budget,
// retries with exponential backoff and dead-letters after max attempts.
import { isServiceCall } from "../_shared/core/auth.ts";
import { json } from "../_shared/core/http.ts";
import { captureError, log } from "../_shared/core/observability.ts";
import { productionDeps } from "../_shared/whatsapp/runtime.ts";
import { processJob } from "../_shared/whatsapp/worker.ts";

const BUDGET_MS = 110_000;
const BATCH = 4;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isServiceCall(req)) return json({ error: "forbidden" }, 403);
  const deps = productionDeps();
  if (!deps) return json({ error: "not_configured" }, 503);

  const worker = `w_${crypto.randomUUID().slice(0, 8)}`;
  const started = Date.now();
  const tally = { done: 0, retry: 0, dead: 0 };
  try {
    while (Date.now() - started < BUDGET_MS) {
      const jobs = await deps.repo.claimJobs(worker, BATCH);
      if (!jobs.length) break;
      const results = await Promise.all(jobs.map((job) => processJob(job, deps)));
      for (const r of results) tally[r]++;
    }
  } catch (err) {
    await captureError(err, { area: "whatsapp_worker_loop" });
    return json({ error: "worker_failed", ...tally }, 500);
  }
  log("whatsapp_worker_run", { ...tally, ms: Date.now() - started });
  return json({ ok: true, ...tally });
});

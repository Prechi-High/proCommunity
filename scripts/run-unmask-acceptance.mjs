/**
 * Smoke timing for preview + background Unmask (requires Supabase env + deployed function).
 *
 *   node scripts/run-unmask-acceptance.mjs
 */
import { loadProjectEnv } from "./load-env-file.mjs";

const env = loadProjectEnv();
for (const [k, v] of Object.entries(env)) {
  if (process.env[k] === undefined) process.env[k] = v;
}

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

const CASES = [
  { label: "smartphone", query: "Samsung Galaxy S24", id: "samsung-galaxy-s24" },
  { label: "foundation", query: "Fenty Pro Filt'r Soft Matte Foundation", id: "fenty-pro-filt-r-soft-matte-foundation" },
  { label: "moisturizer", query: "CeraVe Daily Moisturizing Lotion", id: "cerave-daily-moisturizing-lotion" },
  { label: "appliance", query: "Dyson V15 Detect", id: "dyson-v15-detect" },
];

async function post(body) {
  const t0 = Date.now();
  const res = await fetch(`${url}/functions/v1/product-intelligence`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
    body: JSON.stringify({ country: "ng", ...body }),
  });
  const json = await res.json().catch(() => ({}));
  return { ms: Date.now() - t0, ok: res.ok, json };
}

async function pollStatus(productId, timeoutMs = 180_000) {
  const start = Date.now();
  let firstProgressMs = null;
  while (Date.now() - start < timeoutMs) {
    const { json } = await post({ action: "unmask_status", productId });
    const state = json?.job?.progress?.state;
    if (state && state !== "queued" && firstProgressMs === null) firstProgressMs = Date.now() - start;
    if (state === "ready" || state === "failed") {
      return { readyMs: Date.now() - start, firstProgressMs, state, job: json.job };
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return { readyMs: null, firstProgressMs, state: "timeout", job: null };
}

const results = [];
for (const c of CASES) {
  const preview = await post({ action: "preview", productId: c.id, query: c.query });
  const start = await post({ action: "start_unmask", productId: c.id, query: c.query });
  const polled = await pollStatus(c.id);
  results.push({
    case: c.label,
    previewMs: preview.ms,
    startMs: start.ms,
    timeToFirstProgressMs: polled.firstProgressMs,
    timeToReadyMs: polled.readyMs,
    finalState: polled.state,
    timings: polled.job?.timings,
  });
}

console.log(JSON.stringify({ url, results }, null, 2));

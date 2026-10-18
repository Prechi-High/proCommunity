import { redisService } from "../redis/service.ts";
import { unmaskJobKey } from "../redis/keys.ts";
import { CACHE_TTL } from "../redis/ttl.ts";
import type { UnmaskJobProgress, UnmaskJobRecord, UnmaskJobState, UnmaskJobTimings } from "./types.ts";

type Db = {
  upsert(table: string, row: Record<string, unknown>): Promise<unknown>;
  select(table: string, filter: string): Promise<Record<string, unknown> | null>;
};

const ACTIVE: UnmaskJobState[] = ["queued", "identified", "researching", "mapping", "scoring"];

export function isActiveJobState(state: UnmaskJobState): boolean {
  return ACTIVE.includes(state);
}

// Workers have a finite lifetime; an abandoned job must not lock a product forever.
export function isStaleUnmaskJob(record: UnmaskJobRecord, now = Date.now()): boolean {
  const updated = Date.parse(record.progress.updatedAt);
  return isActiveJobState(record.progress.state) && (!Number.isFinite(updated) || now - updated > 120_000);
}

function defaultProgress(state: UnmaskJobState = "queued"): UnmaskJobProgress {
  const now = new Date().toISOString();
  return {
    state,
    progressPercent: state === "ready" ? 100 : state === "failed" ? 0 : 5,
    completedStages: [],
    activeStages: state === "queued" ? ["preview"] : [],
    startedAt: now,
    updatedAt: now,
  };
}

export async function readUnmaskJob(productId: string, store?: Db | null): Promise<UnmaskJobRecord | null> {
  const key = unmaskJobKey(productId);
  const hot = await redisService.getJson<UnmaskJobRecord>(key);
  if (hot.ok && hot.value) return hot.value;

  if (!store) return null;
  const row = await store.select("unmask_jobs", `product_id=eq.${encodeURIComponent(productId)}`);
  if (!row?.progress) return null;
  return {
    productId,
    progress: row.progress as UnmaskJobProgress,
    timings: row.timings as UnmaskJobTimings | undefined,
    error: typeof row.error === "string" ? row.error : undefined,
  };
}

export async function writeUnmaskJob(
  productId: string,
  patch: Partial<UnmaskJobRecord> & { progress?: Partial<UnmaskJobProgress> },
  store?: Db | null,
): Promise<UnmaskJobRecord> {
  const prev = (await readUnmaskJob(productId, store)) ?? {
    productId,
    progress: defaultProgress("queued"),
  };
  const progress: UnmaskJobProgress = {
    ...prev.progress,
    ...patch.progress,
    milestones: { ...prev.progress.milestones, ...patch.progress?.milestones },
    updatedAt: new Date().toISOString(),
  };
  const record: UnmaskJobRecord = {
    productId,
    progress,
    timings: { ...prev.timings, ...patch.timings },
    error: patch.error ?? prev.error,
  };

  await redisService.setJson(unmaskJobKey(productId), record, CACHE_TTL.unmaskJob());

  if (store) {
    await store.upsert("unmask_jobs", {
      product_id: productId,
      state: progress.state,
      progress,
      timings: record.timings ?? null,
      error: record.error ?? null,
      updated_at: progress.updatedAt,
    });
  }
  return record;
}

export async function acquireUnmaskJob(
  productId: string,
  store?: Db | null,
  opts?: { force?: boolean },
): Promise<"attach" | "start"> {
  const existing = await readUnmaskJob(productId, store);
  if (existing && isActiveJobState(existing.progress.state) && !isStaleUnmaskJob(existing)) return "attach";
  if (!opts?.force && existing?.progress.state === "ready") return "attach";
  await writeUnmaskJob(productId, { progress: defaultProgress("queued") }, store);
  return "start";
}

export function progressForState(
  state: UnmaskJobState,
  completed: string[],
  active: string[],
  percent?: number,
): Partial<UnmaskJobProgress> {
  const pct =
    percent ??
    ({
      queued: 8,
      identified: 18,
      researching: 45,
      mapping: 72,
      scoring: 90,
      ready: 100,
      failed: 0,
    }[state] ?? 10);
  return { state, completedStages: completed, activeStages: active, progressPercent: pct };
}

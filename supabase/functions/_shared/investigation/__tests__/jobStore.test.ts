import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { acquireUnmaskJob, isStaleUnmaskJob } from "../jobStore.ts";
import type { UnmaskJobRecord } from "../types.ts";

(globalThis as any).Deno = { env: { get: () => undefined } };
const now = Date.now();
function job(age: number, state: UnmaskJobRecord["progress"]["state"] = "scoring"): UnmaskJobRecord {
  return { productId: "cream", progress: { state, progressPercent: 90, completedStages: [], activeStages: ["scoring"], startedAt: new Date(now - age).toISOString(), updatedAt: new Date(now - age).toISOString() } };
}
function storeFor(record: UnmaskJobRecord) {
  const writes: any[] = [];
  return { writes, select: async () => ({ progress: record.progress }), upsert: async (_: string, row: any) => { writes.push(row); } };
}
describe("unmask job recovery", () => {
  it("does not duplicate a healthy worker even when force is requested", async () => {
    const store = storeFor(job(1000));
    assert.equal(await acquireUnmaskJob("cream", store, { force: true }), "attach");
    assert.equal(store.writes.length, 0);
  });
  it("restarts an abandoned scoring job instead of attaching forever", async () => {
    const store = storeFor(job(300_000));
    assert.equal(await acquireUnmaskJob("cream", store), "start");
    assert.equal(store.writes[0].state, "queued");
  });
  it("recognizes invalid timestamps but never expires completed jobs as active", () => {
    const broken = job(1000); broken.progress.updatedAt = "invalid";
    assert.equal(isStaleUnmaskJob(broken, now), true);
    assert.equal(isStaleUnmaskJob(job(300_000, "ready"), now), false);
    assert.equal(isStaleUnmaskJob(job(120_000), now), false);
    assert.equal(isStaleUnmaskJob(job(120_001), now), true);
  });
});

import { it } from "node:test";
import assert from "node:assert/strict";
import { persistDimensionEvidence } from "../persist.ts";

it("batches evidence writes, deduplicates conflict keys, and writes links after evidence", async () => {
  const batches: any[][] = []; const events: string[] = [];
  const store = {
    remove: async () => {},
    upsert: async () => { throw new Error("unexpected_single_write"); },
    upsertMany: async (_: string, rows: any[]) => { batches.push(rows); events.push("evidence"); },
    insertMany: async () => { events.push("links"); },
  };
  const row = (i: number) => ({ evidenceId: `e${i}`, text: `Experience ${i}`, platform: "youtube", productMatch: { level: "exact", confidence: 1, affectsScore: true }, dimensionLinks: [{ dimensionKey: "hydration", stance: "positive", strength: 1, relevanceConfidence: 1, affectsScore: true }] });
  const rows = Array.from({ length: 450 }, (_, i) => row(i)); rows.push(row(0));
  await persistDimensionEvidence(store, "cream", "bp", ["hydration"], {} as any, rows as any);
  assert.deepEqual(batches.map(b => b.length), [200, 200, 50]);
  assert.equal(new Set(batches.flat().map(r => r.id)).size, 450);
  assert.equal(events.at(-1), "links");
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { persistDimensionEvidence } from '../persist.ts';

test('bulk evidence storage preserves all rows without one database request per record', async () => {
  const batches: Record<string, unknown>[][] = [];
  const rows = Array.from({ length: 255 }, (_, n) => ({
    evidenceId: `e${n}`, text: `record ${n}`, extractedStatement: `record ${n}`, platform: 'youtube',
    productMatch: { level: 'exact', confidence: 1, affectsScore: true }, dimensionLinks: [],
  }));
  await persistDimensionEvidence({
    upsert: async () => { throw new Error('sequential write must not be used'); },
    upsertMany: async (_table, batch) => { batches.push(batch); },
    remove: async () => undefined,
    insertMany: async () => undefined,
  }, 'product', 'blueprint', [], {} as any, rows as any);
  assert.deepEqual(batches.map((batch) => batch.length), [100, 100, 55]);
  assert.equal(new Set(batches.flat().map((row) => row.id)).size, 255);
});

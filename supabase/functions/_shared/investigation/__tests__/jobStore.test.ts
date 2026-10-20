import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acquireUnmaskJob, writeUnmaskJob, isStaleJob } from '../jobStore.ts';

(globalThis as any).Deno = { env: { get: () => undefined } };
function store(initial: Record<string, any>) {
  let row = initial;
  return { select: async () => row, upsert: async (_table: string, value: Record<string, unknown>) => { row = value; }, read: () => row };
}
function progress(state: string, age = 0) {
  return { state, updatedAt: new Date(Date.now() - age).toISOString(), startedAt: new Date().toISOString(), milestones: { scorecardComplete: true }, completedStages: ['scoring'], activeStages: [], progressPercent: 90 };
}

test('reclaims abandoned scoring jobs and clears previous milestones and errors', async () => {
  const db = store({ progress: progress('scoring', 240_000), error: 'old_failure', timings: { totalReadyMs: 9999 } });
  assert.equal(await acquireUnmaskJob('test', db), 'start');
  assert.equal(db.read().state, 'queued');
  assert.deepEqual(db.read().progress.milestones, {});
  assert.deepEqual(db.read().timings, {});
  assert.equal(db.read().error, null);
});

test('attaches to a healthy running job without restarting it', async () => {
  const db = store({ progress: progress('researching') });
  assert.equal(await acquireUnmaskJob('test', db, { force: true }), 'attach');
  assert.equal(db.read().progress.state, 'researching');
});

test('a successful retry clears the old failure', async () => {
  const db = store({ progress: progress('scoring'), error: 'old_failure' });
  await writeUnmaskJob('test', { progress: progress('ready') as any }, db);
  assert.equal(db.read().error, null);
  assert.equal(isStaleJob(progress('ready', 999999) as any), false);
});

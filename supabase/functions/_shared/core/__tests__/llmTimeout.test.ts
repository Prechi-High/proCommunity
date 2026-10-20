import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestLlmJson } from '../llmChat.ts';

test('timeout covers a stalled response body and aborts upstream', async () => {
  const original = globalThis.fetch;
  let aborted = false;
  globalThis.fetch = async (_url, init) => ({
    ok: true, status: 200,
    json: () => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => {
      aborted = true;
      reject(new Error('aborted'));
    })),
  }) as Response;
  try {
    const started = Date.now();
    assert.equal(await requestLlmJson('https://test.invalid', {}, 25), null);
    assert.equal(aborted, true);
    assert.ok(Date.now() - started < 500);
  } finally { globalThis.fetch = original; }
});

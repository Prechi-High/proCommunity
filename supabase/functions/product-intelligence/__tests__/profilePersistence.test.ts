import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';

// Exercise the real handler without Deno's type-only runtime import or real providers.
test('sourced fallback is persisted when AI is unavailable; get performs no research', async () => {
  const originalFetch = globalThis.fetch;
  const originalDeno = (globalThis as any).Deno;
  const modulePath = new URL('../.persistence-test-runtime.ts', import.meta.url);
  let handler: (req: Request) => Promise<Response>;
  let payload: Record<string, any> | null = null;
  let providerCalls = 0;
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'test', SERPER_API_KEY: 'test',
    EVIDENCE_YOUTUBE_ENABLED: 'false', EVIDENCE_WEB_ENABLED: 'false',
  };
  (globalThis as any).Deno = { env: { get: (key: string) => env[key] }, serve: (fn: typeof handler) => { handler = fn; } };
  globalThis.fetch = async (url, init) => {
    const address = String(url);
    if (address.startsWith('https://google.serper.dev/')) {
      providerCalls++;
      if (address.endsWith('/images')) return Response.json({ images: [{ imageUrl: 'https://images.test/lotion.png', title: 'Test Lotion' }] });
      if (address.endsWith('/shopping')) return Response.json({ shopping: [] });
      return Response.json({ organic: [{ title: 'Test Lotion', link: 'https://brand.test/lotion', snippet: 'Test Lotion is sold in a 100 ml bottle. Read the product label for usage instructions.' }] });
    }
    if (address.startsWith('https://db.test/rest/v1/')) {
      if (init?.method === 'POST') {
        const row = JSON.parse(String(init.body));
        if (address.endsWith('/product_intel')) payload = row.payload;
        return new Response(null, { status: 201 });
      }
      return Response.json(address.includes('/product_intel?') && payload ? [{ payload }] : []);
    }
    throw new Error(`Unexpected network request: ${address}`);
  };
  try {
    const source = (await readFile(new URL('../index.ts', import.meta.url), 'utf8')).replace(/^import "jsr:[^\n]+\n/, '');
    await writeFile(modulePath, source);
    await import(modulePath.href);
    const request = (body: Record<string, unknown>) => handler(new Request('https://edge.test', { method: 'POST', body: JSON.stringify(body) }));
    const result = await (await request({ action: 'investigate', productId: 'test-lotion', query: 'Test Lotion', force: true })).json();
    assert.equal(result.success, true);
    assert.equal(result.profile.researchStatus, 'limited');
    assert.ok(result.profile.findings);
    assert.ok(payload, 'a successful response must have a persisted profile');
    const before = providerCalls;
    const loaded = await (await request({ action: 'get', productId: 'test-lotion' })).json();
    assert.equal(loaded.profile.id, 'test-lotion');
    assert.equal(providerCalls, before, 'cached get must not trigger additional research');
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).Deno = originalDeno;
    await unlink(modulePath).catch(() => undefined);
  }
});

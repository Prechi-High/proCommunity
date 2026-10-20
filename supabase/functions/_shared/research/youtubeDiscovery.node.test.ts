import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverYoutubeCandidates, youtubeVideoId } from './youtubeDiscovery.js';
import { commentPageTaskKey } from './logic.js';

const id = 'AAAAAAAAAAA';
test('opaque pagination cursors never become oversized indexed task keys', async () => {
  const token = 'opaque-cursor'.repeat(5000);
  const key = await commentPageTaskKey(id, 'threads', undefined, token);
  assert.ok(key.length < 150);
  assert.equal(key, await commentPageTaskKey(id, 'threads', undefined, token));
  assert.notEqual(key, await commentPageTaskKey(id, 'threads', undefined, token + 'next'));
});
function memoryCache() {
  const values = new Map();
  return { async getJson(key: string) { return { ok: true, value: values.get(key) }; },
    async setJson(key: string, value: unknown) { values.set(key, value); } };
}
test('accepts only real YouTube video URL forms', () => {
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=' + id), id);
  assert.equal(youtubeVideoId('https://youtu.be/' + id), id);
  assert.equal(youtubeVideoId('https://www.youtube.com/shorts/' + id), id);
  assert.equal(youtubeVideoId('https://youtube.com.evil.example/watch?v=' + id), null);
  assert.equal(youtubeVideoId('https://example.com/watch?v=' + id), null);
});
test('exhausted search quota still discovers videos and verifies canonical YouTube metadata', async () => {
  let searches = 0, metadata = 0, web = 0;
  const cache = memoryCache();
  const youtube = async (resource: string) => {
    if (resource === 'search') { searches++; throw Error('youtube_rateLimitExceeded: Search Queries per day'); }
    metadata++;
    return { items: [{ id, snippet: { title: 'Exact cream review', description: 'Canonical description' }, statistics: { commentCount: '500' } }] };
  };
  const webSearch = async () => { web++; return { organic: [{ link: 'https://youtube.com/watch?v=' + id, title: 'Search snippet' }] }; };
  const input = { name: 'Exact cream', dimensions: [{ key: 'hydration', label: 'Hydration' }], youtube, webSearch, cache };
  const result = await discoverYoutubeCandidates(input);
  assert.equal(result.videos.length, 1);
  assert.equal(result.videos[0].title, 'Exact cream review');
  assert.equal(result.videos[0].commentCount, 500);
  assert.ok(searches <= 2, 'circuit breaker stops remaining quota-exhausted searches');
  assert.equal(metadata, 1);
  assert.equal(web, 3);
  assert.ok(result.routes.every(r => r.source === 'serper-discovery'));
  const before = { searches, web };
  const again = await discoverYoutubeCandidates(input);
  assert.equal(again.videos.length, 1);
  assert.deepEqual({ searches, web }, before, 'cached routes do not consume more searches');
});
test('a failed route cannot discard successful routes', async () => {
  let searches = 0;
  const result = await discoverYoutubeCandidates({ name: 'Exact cream', dimensions: [],
    youtube: async (resource: string) => {
      if (resource === 'search') {
        if (++searches === 1) throw Error('youtube_backendError');
        return { items: [{ id: { videoId: id }, snippet: { title: 'Review' } }] };
      }
      return { items: [{ id, snippet: { title: 'Canonical review' } }] };
    }, webSearch: async () => { throw Error('serper_503'); }, cache: memoryCache() });
  assert.equal(result.videos.length, 1);
  assert.equal(result.failures.length, 1);
});
test('does not claim successful discovery when all discovery providers fail', async () => {
  await assert.rejects(discoverYoutubeCandidates({ name: 'Exact cream', dimensions: [],
    youtube: async () => { throw Error('youtube_quotaExceeded'); },
    webSearch: async () => { throw Error('serper_402'); }, cache: memoryCache() }), /video_discovery_unavailable/);
});

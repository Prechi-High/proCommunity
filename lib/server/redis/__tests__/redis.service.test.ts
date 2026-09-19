import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { Redis } from '@upstash/redis';

import {
  CACHE_TTL,
  cacheAside,
  cacheInvalidation,
  productKey,
  productVideosKey,
  redisService,
  resetRedisClientForTests,
  setRedisClientForTests,
  videoCommentsKey,
} from '../index';

type StoreEntry = { value: unknown; expiresAt: number | null };

class FakeRedis {
  store = new Map<string, StoreEntry>();
  fail = false;
  lastSetEx: number | null = null;

  private assertOk() {
    if (this.fail) throw new Error('redis_unavailable');
  }

  async get<T>(key: string): Promise<T | null> {
    this.assertOk();
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt != null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, opts?: { ex?: number }): Promise<'OK'> {
    this.assertOk();
    this.lastSetEx = opts?.ex ?? null;
    const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : null;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    this.assertOk();
    let n = 0;
    for (const key of keys) {
      if (this.store.delete(key)) n += 1;
    }
    return n;
  }

  async exists(key: string): Promise<number> {
    this.assertOk();
    return this.store.has(key) ? 1 : 0;
  }

  async expire(key: string, ttlSec: number): Promise<number> {
    this.assertOk();
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + ttlSec * 1000;
    return 1;
  }
}

afterEach(() => {
  resetRedisClientForTests();
});

describe('cache keys', () => {
  it('keeps pagination keys independent', () => {
    assert.notEqual(
      productVideosKey('p1', 'how_to_use', 1, 20),
      productVideosKey('p1', 'how_to_use', 2, 20),
    );
    assert.notEqual(
      videoCommentsKey('yt1', 1, 20),
      videoCommentsKey('yt1', 2, 20),
    );
    assert.equal(productKey('abc'), 'cache:product:abc');
  });
});

describe('cacheAside', () => {
  it('returns cached data on hit without calling loader', async () => {
    const fake = new FakeRedis();
    setRedisClientForTests(fake as unknown as Redis);
    await redisService.setJson('cache:product:p1', { id: 'p1' }, 60);

    let loads = 0;
    const value = await cacheAside({
      key: 'cache:product:p1',
      ttlSec: 60,
      loader: async () => {
        loads += 1;
        return { id: 'from-loader' };
      },
    });

    assert.deepEqual(value, { id: 'p1' });
    assert.equal(loads, 0);
  });

  it('loads from source on miss and stores result', async () => {
    const fake = new FakeRedis();
    setRedisClientForTests(fake as unknown as Redis);

    let loads = 0;
    const value = await cacheAside({
      key: 'cache:product:p2',
      ttlSec: 120,
      loader: async () => {
        loads += 1;
        return { id: 'p2', name: 'Serum' };
      },
    });

    assert.deepEqual(value, { id: 'p2', name: 'Serum' });
    assert.equal(loads, 1);
    assert.equal(fake.lastSetEx, 120);
    const cached = await redisService.getJson<{ id: string }>('cache:product:p2');
    assert.equal(cached.ok, true);
    if (cached.ok) assert.equal(cached.value?.id, 'p2');
  });

  it('falls back to loader when Redis is unavailable', async () => {
    const fake = new FakeRedis();
    fake.fail = true;
    setRedisClientForTests(fake as unknown as Redis);

    const value = await cacheAside({
      key: 'cache:product:p3',
      ttlSec: 60,
      loader: async () => ({ id: 'supabase' }),
    });

    assert.deepEqual(value, { id: 'supabase' });
  });

  it('falls back when Redis is unconfigured', async () => {
    setRedisClientForTests(null);
    const value = await cacheAside({
      key: 'cache:product:p4',
      ttlSec: 60,
      loader: async () => ({ id: 'direct' }),
    });
    assert.deepEqual(value, { id: 'direct' });
  });
});

describe('cacheInvalidation', () => {
  it('deletes product and related video keys', async () => {
    const fake = new FakeRedis();
    setRedisClientForTests(fake as unknown as Redis);
    const product = productKey('prod');
    const videos = productVideosKey('prod', 'how_to_use', 1, 20);
    await redisService.setJson(product, { id: 'prod' }, 60);
    await redisService.setJson(videos, { clips: [] }, 60);

    await cacheInvalidation.invalidateProduct('prod');

    const p = await redisService.getJson(product);
    const v = await redisService.getJson(videos);
    assert.equal(p.ok && p.value, null);
    assert.equal(v.ok && v.value, null);
  });

  it('invalidates comment pages for a video', async () => {
    const fake = new FakeRedis();
    setRedisClientForTests(fake as unknown as Redis);
    const key = videoCommentsKey('yt99', 1, 20);
    await redisService.setJson(key, [{ id: 'c1' }], 60);
    await cacheInvalidation.invalidateVideoComments('yt99');
    const got = await redisService.getJson(key);
    assert.equal(got.ok && got.value, null);
  });
});

describe('TTL', () => {
  it('uses configured product TTL default', () => {
    delete process.env.CACHE_TTL_PRODUCT_SEC;
    assert.equal(CACHE_TTL.product(), 30 * 60);
  });

  it('respects env override', () => {
    process.env.CACHE_TTL_PRODUCT_SEC = '90';
    assert.equal(CACHE_TTL.product(), 90);
    delete process.env.CACHE_TTL_PRODUCT_SEC;
  });

  it('expire refreshes TTL without deleting', async () => {
    const fake = new FakeRedis();
    setRedisClientForTests(fake as unknown as Redis);
    await redisService.setJson('cache:taxonomy:skincare', [{ tagKey: 'how_to_use' }], 10);
    const expired = await redisService.expire('cache:taxonomy:skincare', 600);
    assert.equal(expired.ok, true);
    const exists = await redisService.exists('cache:taxonomy:skincare');
    assert.equal(exists.ok && exists.value, true);
  });
});

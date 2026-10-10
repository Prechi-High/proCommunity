import { nicheOf, type NicheId } from '@/lib/community';
import type { TrendingProduct } from '@/lib/types';

function heat(t: TrendingProduct) {
  return t.views ?? t.heat ?? t.asks ?? 0;
}

/** Diverse trending row: max 3 per niche, no adjacent same niche, up to `limit` items. */
export function buildMixedTrendingFeed(items: TrendingProduct[], limit = 12): TrendingProduct[] {
  if (!items.length) return [];

  const sorted = [...items].sort((a, b) => heat(b) - heat(a));
  const pools = new Map<NicheId | 'other', TrendingProduct[]>();

  for (const t of sorted) {
    const niche = nicheOf(t.category);
    const pool = pools.get(niche) ?? [];
    if (pool.length < 3) {
      pool.push(t);
      pools.set(niche, pool);
    }
  }

  const niches = [...pools.keys()].sort((a, b) => {
    const ba = pools.get(b)?.[0];
    const aa = pools.get(a)?.[0];
    return heat(ba ?? sorted[0]) - heat(aa ?? sorted[0]);
  });
  const cursor = new Map<NicheId | 'other', number>();
  const out: TrendingProduct[] = [];
  const used = new Set<string>();

  const tryPush = (t: TrendingProduct) => {
    if (used.has(t.id)) return false;
    const n = nicheOf(t.category);
    const prev = out.length ? nicheOf(out[out.length - 1].category) : null;
    if (prev === n) return false;
    used.add(t.id);
    out.push(t);
    return true;
  };

  let guard = 0;
  while (out.length < limit && guard < 200) {
    guard += 1;
    let progressed = false;
    for (const niche of niches) {
      const pool = pools.get(niche) ?? [];
      const i = cursor.get(niche) ?? 0;
      if (i >= pool.length) continue;
      const item = pool[i];
      cursor.set(niche, i + 1);
      if (tryPush(item)) {
        progressed = true;
        if (out.length >= limit) break;
      }
    }
    if (!progressed) {
      for (const t of sorted) {
        if (used.has(t.id)) continue;
        const n = nicheOf(t.category);
        const count = out.filter((x) => nicheOf(x.category) === n).length;
        if (count >= 3) continue;
        if (tryPush(t)) progressed = true;
        if (out.length >= limit) break;
      }
    }
    if (!progressed) {
      for (const t of sorted) {
        if (!used.has(t.id)) {
          used.add(t.id);
          out.push(t);
          if (out.length >= limit) break;
        }
      }
      break;
    }
  }

  return out.slice(0, limit);
}

function envSec(name: string, fallback: number): number {
  const raw = Deno.env.get(name)?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const CACHE_TTL = {
  product: () => envSec("CACHE_TTL_PRODUCT_SEC", 30 * 60),
  videos: () => envSec("CACHE_TTL_VIDEOS_SEC", 10 * 60),
  comments: () => envSec("CACHE_TTL_COMMENTS_SEC", 10 * 60),
  taxonomy: () => envSec("CACHE_TTL_TAXONOMY_SEC", 60 * 60),
  search: () => envSec("CACHE_TTL_SEARCH_SEC", 24 * 60 * 60),
  blueprint: () => envSec("CACHE_TTL_BLUEPRINT_SEC", 6 * 60 * 60),
  overview: () => envSec("CACHE_TTL_OVERVIEW_SEC", 60 * 60),
  factSection: () => envSec("CACHE_TTL_FACT_SEC", 6 * 60 * 60),
  dimension: () => envSec("CACHE_TTL_DIMENSION_SEC", 60 * 60),
  evidence: () => envSec("CACHE_TTL_EVIDENCE_SEC", 30 * 60),
  ask: () => envSec("CACHE_TTL_ASK_SEC", 15 * 60),
} as const;

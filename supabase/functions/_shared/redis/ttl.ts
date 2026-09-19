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
} as const;

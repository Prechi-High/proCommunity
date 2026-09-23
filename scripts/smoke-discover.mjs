import { readFileSync } from 'node:fs';

function loadEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i < 1) continue;
      out[trimmed.slice(0, i)] = trimmed.slice(i + 1).trim();
    }
  } catch {
    // optional
  }
  return out;
}

const env = { ...loadEnv('.env.local'), ...loadEnv('.env') };
const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const headers = { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' };

const products = [
  { id: 'gentle-foaming-cleanser', name: 'Gentle Foaming Cleanser', brand: 'CeraVe', ingredients: ['ceramides', 'niacinamide'] },
  { id: 'vitamin-c-15', name: 'Vitamin C Serum 15%', brand: 'Glow Depot', ingredients: ['ascorbic_acid'] },
];

const cache = await (await fetch(
  `${supabaseUrl}/rest/v1/video_cache?select=catalog_product_id,source_platform&pending_review=eq.false&source_platform=neq.youtube&limit=80`,
  { headers },
)).json();
const by = {};
for (const row of Array.isArray(cache) ? cache : []) {
  const key = row.catalog_product_id || 'none';
  by[key] = by[key] || {};
  by[key][row.source_platform] = (by[key][row.source_platform] || 0) + 1;
}
console.log('before', JSON.stringify(by));

for (const product of products) {
  const t0 = Date.now();
  const res = await fetch(`${supabaseUrl}/functions/v1/discover-video-content`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'discover',
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      ingredients: product.ingredients,
    }),
  });
  const body = await res.text();
  console.log(product.id, res.status, Date.now() - t0, body.slice(0, 400));
}

const after = await (await fetch(
  `${supabaseUrl}/rest/v1/video_cache?select=catalog_product_id,source_platform,source_url,title&pending_review=eq.false&source_platform=neq.youtube&order=fetched_at.desc&limit=80`,
  { headers },
)).json();
const afterBy = {};
for (const row of Array.isArray(after) ? after : []) {
  const key = row.catalog_product_id || 'none';
  afterBy[key] = afterBy[key] || {};
  afterBy[key][row.source_platform] = (afterBy[key][row.source_platform] || 0) + 1;
}
console.log('after', JSON.stringify(afterBy));
console.log(
  'samples',
  JSON.stringify(
    (Array.isArray(after) ? after : []).slice(0, 8).map((row) => ({
      p: row.catalog_product_id,
      plat: row.source_platform,
      url: String(row.source_url).slice(0, 70),
    })),
  ),
);

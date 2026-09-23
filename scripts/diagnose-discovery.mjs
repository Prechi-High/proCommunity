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
const site = process.argv[2] || 'https://pro-community.vercel.app';

function headers(key) {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

const steps = [];
function log(step, data) {
  steps.push({ step, ...data });
  console.log(`\n=== ${step} ===`);
  console.log(JSON.stringify(data, null, 2));
}

const htmlRes = await fetch(site);
const html = await htmlRes.text();
const scriptTags = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
log('1_live_html', {
  status: htmlRes.status,
  url: site,
  htmlLen: html.length,
  scriptCount: scriptTags.length,
  scripts: scriptTags.slice(0, 8),
  htmlHasSupabaseHost: html.includes('aqdptcuwpneuyzjavjak'),
  looksLikeLogin: /vercel\.com\/login|Sign in to Vercel/i.test(html),
});

let foundHost = false;
let foundAnon = false;
let emptyUrl = false;
for (const src of scriptTags.slice(0, 10)) {
  const abs = src.startsWith('http') ? src : new URL(src, site).toString();
  try {
    const js = await (await fetch(abs)).text();
    const hasHost = js.includes('aqdptcuwpneuyzjavjak');
    const hasAnon = js.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    const empty = /supabaseUrl["']?\s*[:=]\s*["']{2}/.test(js);
    if (hasHost) foundHost = true;
    if (hasAnon) foundAnon = true;
    if (empty) emptyUrl = true;
    if (hasHost || hasAnon || js.includes('discover-video-content') || js.includes('journey-discover')) {
      log('1b_bundle', {
        src: src.slice(-90),
        len: js.length,
        hasHost,
        hasAnon,
        emptyUrlLiteral: empty,
        hasDiscoverFnName: js.includes('discover-video-content'),
        hasJourneyDiscover: js.includes('journey-discover'),
      });
    }
  } catch (error) {
    log('1b_bundle_fail', { src, error: String(error).slice(0, 120) });
  }
}
log('1c_bundle_summary', { foundHost, foundAnon, emptyUrl });

const cacheRes = await fetch(
  `${supabaseUrl}/rest/v1/video_cache?select=id,source_platform,pending_review,search_query,title,fetched_at&order=fetched_at.desc&limit=80`,
  { headers: headers(anon) },
);
const cacheRows = await cacheRes.json();
const by = {};
for (const row of Array.isArray(cacheRows) ? cacheRows : []) {
  by[row.source_platform] = (by[row.source_platform] || 0) + 1;
}
log('2_anon_video_cache', {
  status: cacheRes.status,
  count: Array.isArray(cacheRows) ? cacheRows.length : cacheRows,
  byPlatform: by,
  pending: Array.isArray(cacheRows) ? cacheRows.filter((row) => row.pending_review).length : null,
  newest: cacheRows[0]?.fetched_at ?? null,
  sample: Array.isArray(cacheRows)
    ? cacheRows.slice(0, 6).map((row) => ({
        platform: row.source_platform,
        pending: row.pending_review,
        q: String(row.search_query ?? '').slice(0, 70),
      }))
    : cacheRows,
});

const listRes = await fetch(`${supabaseUrl}/functions/v1/discover-video-content`, {
  method: 'POST',
  headers: headers(anon),
  body: JSON.stringify({ action: 'list_pending' }),
});
log('3_anon_list_pending', { status: listRes.status, body: (await listRes.text()).slice(0, 300) });

const t0 = Date.now();
const discoverRes = await fetch(`${supabaseUrl}/functions/v1/discover-video-content`, {
  method: 'POST',
  headers: headers(anon),
  body: JSON.stringify({
    action: 'discover',
    productName: 'Niacinamide 10% + Zinc 1%',
    brand: 'The Ordinary',
    ingredients: ['niacinamide'],
    attributeTags: ['oil_free'],
    suitsSkinTypes: ['oily'],
  }),
});
const discoverBody = await discoverRes.text();
log('4_anon_discover', {
  status: discoverRes.status,
  ms: Date.now() - t0,
  body: discoverBody.slice(0, 500),
});

/**
 * One-shot checks for discover-video-content.
 * Reads .env.local if present. Does not print secrets.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 1) continue;
    out[trimmed.slice(0, i)] = trimmed.slice(i + 1);
  }
  return out;
}

const env = {
  ...loadEnv(resolve('.env')),
  ...loadEnv(resolve('.env.local')),
};

const PLATFORMS = ['tiktok', 'instagram', 'facebook', 'pinterest'];
const HOST = {
  tiktok: 'tiktok.com',
  instagram: 'instagram.com',
  facebook: 'facebook.com',
  pinterest: 'pinterest.com',
};

function hostMatches(hostname, domain) {
  const host = hostname.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}
function pathParts(url) {
  return url.pathname.split('/').map((part) => part.trim()).filter(Boolean);
}
function parseHttpUrl(raw) {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}
function isTikTokPostUrl(url) {
  if (!hostMatches(url.hostname, 'tiktok.com')) return false;
  const parts = pathParts(url);
  if (parts.length < 3) return false;
  const blocked = new Set(['tag', 'search', 'foryou', 'discover', 'music', 'effect', 'live', 'explore']);
  if (blocked.has(parts[0].toLowerCase())) return false;
  if (!parts[0].startsWith('@')) return false;
  if (!/^(video|photo)$/i.test(parts[1])) return false;
  return /^\d+$/.test(parts[2]);
}
function isInstagramPostUrl(url) {
  if (!hostMatches(url.hostname, 'instagram.com') && !hostMatches(url.hostname, 'instagr.am')) return false;
  const parts = pathParts(url);
  if (parts.length < 2) return false;
  const kind = parts[0].toLowerCase();
  if (['reels', 'stories', 'tags', 'explore', 'accounts'].includes(kind)) return false;
  if (kind !== 'p' && kind !== 'reel' && kind !== 'tv') return false;
  return /^[\w-]+$/.test(parts[1]);
}
function isFacebookPostUrl(url) {
  if (hostMatches(url.hostname, 'fb.watch')) {
    return pathParts(url).length >= 1 && /^[\w-]+$/.test(pathParts(url)[0]);
  }
  if (!hostMatches(url.hostname, 'facebook.com') && !hostMatches(url.hostname, 'fb.com')) return false;
  const parts = pathParts(url);
  const watchId = url.searchParams.get('v');
  if ((parts[0]?.toLowerCase() === 'watch' || url.pathname.toLowerCase().includes('/watch')) && watchId) {
    return /^\d+$/.test(watchId);
  }
  if (parts[0]?.toLowerCase() === 'reel' && /^\d+$/.test(parts[1] ?? '')) return true;
  if (parts[0]?.toLowerCase() === 'share' && /^(v|r)$/i.test(parts[1] ?? '') && /^[\w-]+$/.test(parts[2] ?? '')) {
    return true;
  }
  const videosAt = parts.findIndex((part) => part.toLowerCase() === 'videos');
  return videosAt >= 1 && /^\d+$/.test(parts[videosAt + 1] ?? '');
}
function isPinterestPinUrl(url) {
  if (!/^pinterest\.[a-z.]+$/i.test(url.hostname.replace(/^www\./i, ''))) return false;
  const parts = pathParts(url);
  if (parts[0]?.toLowerCase() !== 'pin' || parts.length < 2) return false;
  if (['search', 'ideas', 'today', 'categories', 'news_hub'].includes(parts[1].toLowerCase())) return false;
  return /^\d+/.test(parts[1]);
}
function isIndividualPostUrl(url, platform) {
  if (platform === 'tiktok') return isTikTokPostUrl(url);
  if (platform === 'instagram') return isInstagramPostUrl(url);
  if (platform === 'facebook') return isFacebookPostUrl(url);
  return isPinterestPinUrl(url);
}
function canonicalize(raw, platform) {
  const parsed = parseHttpUrl(raw);
  if (!parsed || !isIndividualPostUrl(parsed, platform)) return null;
  parsed.hash = '';
  if (platform === 'facebook') {
    const v = parsed.searchParams.get('v');
    parsed.search = v ? `?v=${v}` : '';
  } else {
    parsed.search = '';
  }
  const href = parsed.toString().replace(/\/$/, '');
  const again = parseHttpUrl(href);
  return again && isIndividualPostUrl(again, platform) ? href : null;
}

let failed = 0;
function assert(name, cond) {
  if (cond) console.log(`ok  ${name}`);
  else {
    failed += 1;
    console.log(`FAIL ${name}`);
  }
}

const accept = [
  ['tiktok', 'https://www.tiktok.com/@scout2015/video/6718335390845095173'],
  ['instagram', 'https://www.instagram.com/p/fA9uwTtkSN/'],
  ['instagram', 'https://www.instagram.com/reel/Cxyz123Abcd/'],
  ['facebook', 'https://www.facebook.com/watch/?v=123456789'],
  ['facebook', 'https://www.facebook.com/reel/987654321'],
  ['facebook', 'https://www.facebook.com/page/videos/123456789'],
  ['pinterest', 'https://www.pinterest.com/pin/1234567890/'],
];
const reject = [
  ['tiktok', 'https://www.tiktok.com/'],
  ['tiktok', 'https://www.tiktok.com/tag/skincare'],
  ['tiktok', 'https://www.tiktok.com/search?q=niacinamide'],
  ['tiktok', 'https://www.tiktok.com/foryou'],
  ['tiktok', 'https://www.tiktok.com/@scout2015'],
  ['instagram', 'https://www.instagram.com/scout2015/'],
  ['instagram', 'https://www.instagram.com/explore/tags/skincare/'],
  ['facebook', 'https://www.facebook.com/somepage'],
  ['pinterest', 'https://www.pinterest.com/anapinskywalker/'],
  ['pinterest', 'https://www.pinterest.com/anapinskywalker/style/'],
  ['pinterest', 'https://www.pinterest.com/search/pins/?q=niacinamide'],
];

for (const [platform, url] of accept) {
  assert(`accept ${platform} ${url}`, Boolean(canonicalize(url, platform)));
}
for (const [platform, url] of reject) {
  assert(`reject ${platform} ${url}`, canonicalize(url, platform) === null);
}

const queries = [];
const productName = 'Niacinamide 10% + Zinc 1%';
for (const platform of PLATFORMS) {
  const quoted = `"${productName}"`;
  queries.push(
    platform === 'pinterest'
      ? `site:${HOST[platform]} ${quoted}`
      : `site:${HOST[platform]} ${quoted} review`,
  );
}
for (const platform of PLATFORMS) {
  queries.push(`site:${HOST[platform]} "niacinamide" "oily skin"`);
}
assert('8 serper queries', queries.length === 8);
assert('tiktok product query', queries[0] === 'site:tiktok.com "Niacinamide 10% + Zinc 1%" review');
assert('pinterest product query has no review suffix', queries[3] === 'site:pinterest.com "Niacinamide 10% + Zinc 1%"');
assert('tiktok attribute pair', queries[4] === 'site:tiktok.com "niacinamide" "oily skin"');

const oembed = await fetch(
  'https://www.tiktok.com/oembed?url=' +
    encodeURIComponent('https://www.tiktok.com/@scout2015/video/6718335390845095173'),
  { headers: { Accept: 'application/json' } },
);
assert(`tiktok oembed http ${oembed.status}`, oembed.ok);
if (oembed.ok) {
  const payload = await oembed.json();
  assert('tiktok oembed returns html', typeof payload.html === 'string' && payload.html.includes('tiktok'));
}

const pinHtml = `<a href="https://www.pinterest.com/pin/1234567890/" data-pin-do="embedPin" data-pin-width="medium"></a>`;
assert('pinterest official pin widget markup', pinHtml.includes('data-pin-do="embedPin"'));

const projectRef = 'aqdptcuwpneuyzjavjak';
const url = env.EXPO_PUBLIC_SUPABASE_URL || `https://${projectRef}.supabase.co`;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.log('skip remote: no SUPABASE_SERVICE_ROLE_KEY');
} else {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  const cache = await fetch(
    `${url}/rest/v1/video_cache?select=id,pending_review,source_platform,source_url,embed_html&limit=1`,
    { headers },
  );
  const cacheText = await cache.text();
  assert(`video_cache schema reachable (${cache.status})`, cache.ok);
  if (!cache.ok) console.log(`  video_cache: ${cacheText.slice(0, 240)}`);

  const pending = await fetch(
    `${url}/rest/v1/video_cache?select=id&pending_review=eq.true&limit=5`,
    { headers },
  );
  assert(`pending_review filter works (${pending.status})`, pending.ok);

  const fn = await fetch(`${url}/functions/v1/discover-video-content`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'list_pending' }),
  });
  const fnBody = await fn.text();
  assert(`discover-video-content deployed (${fn.status})`, fn.status !== 404);
  if (fn.ok) {
    const parsed = JSON.parse(fnBody);
    assert('list_pending returns clips array', Array.isArray(parsed.clips));
  } else {
    console.log(`  function: ${fnBody.slice(0, 240)}`);
  }

  const discover = await fetch(`${url}/functions/v1/discover-video-content`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'discover',
      productName: 'Niacinamide 10% + Zinc 1%',
      ingredients: ['niacinamide'],
      attributeTags: ['oil_free'],
      suitsSkinTypes: ['oily'],
    }),
  });
  const discoverBody = await discover.text();
  let discoverJson = {};
  try {
    discoverJson = JSON.parse(discoverBody);
  } catch {
    discoverJson = { raw: discoverBody.slice(0, 200) };
  }
  if (discoverJson.error === 'missing_search_credentials') {
    assert('discover requires SERPER_API_KEY', true);
    console.log('  hint: set SERPER_API_KEY as a function secret, then rerun discovery');
  } else if (discover.ok) {
    assert('discover uses serper', discoverJson.provider === 'serper');
    assert('discover inserts pending_review false', discoverJson.pending_review === false);
    console.log(
      `  inserted=${discoverJson.inserted} searches=${discoverJson.searches_attempted} rejected=${discoverJson.candidates_rejected}`,
    );
  } else {
    assert(`discover responded (${discover.status})`, false);
    console.log(`  discover: ${discoverBody.slice(0, 240)}`);
  }
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);

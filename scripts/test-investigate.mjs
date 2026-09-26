import { readFileSync } from 'node:fs';

function loadEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i < 1) continue;
      out[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // optional
  }
  return out;
}

const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };
for (const [k, v] of Object.entries(loadEnv('.env'))) {
  if (!env[k]) env[k] = v;
}

const url = (env.EXPO_PUBLIC_SUPABASE_URL || 'https://aqdptcuwpneuyzjavjak.supabase.co').replace(/\/$/, '');
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!anon) {
  console.error('missing anon');
  process.exit(1);
}

const query = process.argv[2] || 'CeraVe Hydrating Cleanser';
const started = Date.now();
const res = await fetch(`${url}/functions/v1/product-intelligence`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anon}`,
    apikey: anon,
  },
  body: JSON.stringify({ action: 'investigate', query }),
});
const text = await res.text();
console.log('status', res.status, 'ms', Date.now() - started);
try {
  const j = JSON.parse(text);
  console.log(JSON.stringify({
    success: j.success,
    error: j.error,
    confidence: j.confidence,
    keys: j.intelligence ? Object.keys(j.intelligence) : [],
    praise: j.intelligence?.common_praise,
    complaints: j.intelligence?.common_complaints,
    images: (j.images || []).length,
    top: j.searchResults?.topMatches?.slice(0, 2),
  }, null, 2));
} catch {
  console.log(text.slice(0, 500));
}

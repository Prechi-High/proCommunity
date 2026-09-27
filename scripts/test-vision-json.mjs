import { existsSync, readFileSync } from 'node:fs';

// usage: node scripts/test-vision-json.mjs <image url | local path>
function loadEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i < 1) continue;
      const v = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if (v) out[trimmed.slice(0, i).trim()] = v;
    }
  } catch {
    // optional
  }
  return out;
}

const env = { ...loadEnv('.env.local'), ...loadEnv('.env') };
const url = (env.EXPO_PUBLIC_SUPABASE_URL || 'https://aqdptcuwpneuyzjavjak.supabase.co').replace(/\/$/, '');
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const src = process.argv[2] || 'tmp/probe-product.jpg';

const buf = existsSync(src)
  ? readFileSync(src)
  : Buffer.from(await (await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0 SourcedTest' } })).arrayBuffer());
console.log('bytes', buf.length);

const started = Date.now();
const res = await fetch(`${url}/functions/v1/product-vision`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anon}`, apikey: anon },
  body: JSON.stringify({ imageBase64: buf.toString('base64'), mimeType: 'image/jpeg', format: 'json' }),
});
console.log('status', res.status, 'ms', Date.now() - started);
console.log((await res.text()).slice(0, 1200));

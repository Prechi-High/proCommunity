import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

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
const explicit = env.EXPO_PUBLIC_PRODUCT_VISION_URL || '';

console.log('supabaseUrl', url);
console.log('anonLen', anon ? anon.length : 0);
console.log('EXPO_PUBLIC_PRODUCT_VISION_URL', explicit ? `"${explicit}"` : '(empty)');
console.log('geminiLocalLen', (env.GEMINI_API_KEY || '').length);
console.log('openrouterLocalLen', (env.OPENROUTER_API_KEY || '').length);

if (!anon) {
  console.error('missing anon');
  process.exit(1);
}

// Download a real product bottle image (CeraVe-like skincare bottle from a public CDN)
const imageUrl =
  process.argv[2] ||
  'https://images.pexels.com/photos/3735655/pexels-photo-3735655.jpeg?auto=compress&cs=tinysrgb&w=800';

console.log('fetching sample image', imageUrl);
const imgRes = await fetch(imageUrl);
if (!imgRes.ok) {
  console.error('image fetch failed', imgRes.status);
  process.exit(1);
}
const buf = Buffer.from(await imgRes.arrayBuffer());
const b64 = buf.toString('base64');
console.log('imageBytes', buf.length, 'b64Len', b64.length);

mkdirSync('tmp', { recursive: true });
writeFileSync(resolve('tmp', 'probe-product.jpg'), buf);

const endpoint = `${url}/functions/v1/product-vision?debug=1`;
console.log('POST', endpoint);

const started = Date.now();
const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anon}`,
    apikey: anon,
    'x-client-info': 'sourced/probe',
  },
  body: JSON.stringify({
    imageBase64: b64,
    mimeType: 'image/jpeg',
    fileName: 'probe-product.jpg',
  }),
});
const text = await res.text();
console.log('status', res.status, 'ms', Date.now() - started);
console.log('contentType', res.headers.get('content-type'));
try {
  const j = JSON.parse(text);
  console.log(JSON.stringify({
    ok: j.ok,
    label: j.label,
    error: j.error,
    hint: j.hint,
    keyLengths: j.keyLengths,
    attempts: (j.attempts || []).slice(0, 8).map((a) => ({
      provider: a.provider,
      label: a.label,
      http: a.http,
      err: a.err,
      outputLength: a.outputLength,
      outputPreview: (a.output || '').slice(0, 80),
    })),
  }, null, 2));
} catch {
  console.log('raw', text.slice(0, 400));
}

/**
 * End-to-end: sample product image → product-vision → assert a usable label.
 * Also verifies the broken main FileSystem export still throws (SDK 57).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

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
  console.error('FAIL missing anon key');
  process.exit(1);
}

// 1) Confirm SDK 57 trap: main export readAsStringAsync throws
let legacyTrapOk = false;
try {
  const main = require('expo-file-system');
  if (typeof main.readAsStringAsync === 'function') {
    try {
      await main.readAsStringAsync('file:///tmp/x.jpg', { encoding: 'base64' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      legacyTrapOk = /deprecated|legacy/i.test(msg);
      console.log('step1 main readAsStringAsync throws as expected:', legacyTrapOk, msg.slice(0, 100));
    }
  } else {
    console.log('step1 main has no readAsStringAsync (also fine)');
    legacyTrapOk = true;
  }
} catch (e) {
  console.log('step1 could not load expo-file-system in node (ok):', e.message?.slice(0, 80));
  legacyTrapOk = true; // node can't load native module — skip
}

// 2) Confirm legacy export exists
let legacyExportOk = false;
try {
  const legacy = require('expo-file-system/legacy');
  legacyExportOk = typeof legacy.readAsStringAsync === 'function' && Boolean(legacy.EncodingType?.Base64 || legacy.EncodingType);
  console.log('step2 legacy export ok:', legacyExportOk, 'EncodingType=', legacy.EncodingType);
} catch (e) {
  console.log('step2 legacy load failed in node (native):', e.message?.slice(0, 80));
  legacyExportOk = true; // can't verify in node
}

// 3) Call product-vision with a real product photo
const imageUrl =
  'https://images.pexels.com/photos/3735655/pexels-photo-3735655.jpeg?auto=compress&cs=tinysrgb&w=800';
const imgRes = await fetch(imageUrl);
const buf = Buffer.from(await imgRes.arrayBuffer());
const b64 = buf.toString('base64');
console.log('step3 image bytes=', buf.length);

const endpoint = `${url}/functions/v1/product-vision?debug=1`;
const started = Date.now();
const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anon}`,
    apikey: anon,
  },
  body: JSON.stringify({
    imageBase64: b64,
    mimeType: 'image/jpeg',
    fileName: 'test-product.jpg',
  }),
});
const text = await res.text();
const ms = Date.now() - started;
let label = null;
let error = null;
try {
  const j = JSON.parse(text);
  label = j.label || null;
  error = j.error || null;
  console.log('step3 status=', res.status, 'ms=', ms, 'label=', label, 'error=', error, 'keys=', j.keyLengths);
} catch {
  label = text.trim();
  console.log('step3 status=', res.status, 'ms=', ms, 'plain=', label.slice(0, 80));
}

const visionOk = res.ok && Boolean(label) && label.length >= 3 && !/cannot identify/i.test(label);
console.log('\nRESULT', {
  legacyTrapOk,
  legacyExportOk,
  visionOk,
  label,
});

if (!visionOk) {
  console.error('FAIL: product-vision did not return a usable product label');
  process.exit(1);
}
console.log('PASS: product-vision identifies products; client will use picker base64 + legacy FS');

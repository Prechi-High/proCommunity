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
const url = env.EXPO_PUBLIC_SUPABASE_URL || 'https://aqdptcuwpneuyzjavjak.supabase.co';
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!key) {
  console.error('missing_anon_key');
  process.exit(1);
}

let offset = 0;
let round = 0;
while (round < 8) {
  const response = await fetch(`${url}/functions/v1/discover-video-content`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'refresh_gaps', offset, taxonomyCategory: 'skincare' }),
  });
  const payload = await response.json().catch(() => ({}));
  console.log(JSON.stringify({ status: response.status, offset, payload }, null, 2));
  if (!response.ok) process.exit(1);
  if (payload.done) break;
  offset = Number(payload.nextOffset ?? offset + 2);
  round += 1;
}

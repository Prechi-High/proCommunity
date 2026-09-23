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
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = 'aqdptcuwpneuyzjavjak';
const sql = readFileSync('supabase/migrations/0006_catalog_product_videos.sql', 'utf8');

if (!token) {
  console.error('missing_token');
  process.exit(1);
}

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});
const text = await response.text();
console.log(JSON.stringify({ status: response.status, ok: response.ok, body: text.slice(0, 500) }));
if (!response.ok) process.exit(1);

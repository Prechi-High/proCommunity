import { readFileSync } from 'node:fs';

function loadEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i < 1) continue;
      const value = trimmed.slice(i + 1).trim();
      if (value) out[trimmed.slice(0, i)] = value;
    }
  } catch {
    // optional
  }
  return out;
}

const env = { ...loadEnv('.env.local'), ...loadEnv('.env') };
const token = env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node scripts/run-sql.mjs <file.sql | "select ...">');
  process.exit(1);
}
const sql = arg.trim().toLowerCase().endsWith('.sql') ? readFileSync(arg, 'utf8') : arg;

const res = await fetch('https://api.supabase.com/v1/projects/aqdptcuwpneuyzjavjak/database/query', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
console.log(res.status, text.slice(0, 3000));

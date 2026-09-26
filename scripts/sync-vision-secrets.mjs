import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

function loadEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i < 1) continue;
      out[trimmed.slice(0, i)] = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // optional
  }
  return out;
}

const fromEnv = loadEnv('.env');
const fromLocal = loadEnv('.env.local');
const env = { ...fromEnv, ...fromLocal };
// Prefer non-empty values when both files define the same key.
for (const key of Object.keys(fromEnv)) {
  if (!env[key] && fromEnv[key]) env[key] = fromEnv[key];
}
const token = env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const pairs = [];
for (const key of ['GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'NVIDIA_API_KEY', 'OPENROUTER_MODEL', 'GEMINI_MODEL', 'NVIDIA_MODEL']) {
  if (env[key]) {
    pairs.push(`${key}=${env[key]}`);
    console.log(`will set ${key} (len=${env[key].length})`);
  } else {
    console.log(`skip ${key} (missing locally)`);
  }
}

if (!pairs.length) {
  console.error('no vision keys found in .env.local');
  process.exit(1);
}

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['supabase', 'secrets', 'set', ...pairs, '--project-ref', 'aqdptcuwpneuyzjavjak'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token, DO_NOT_TRACK: '1', CI: '1' },
  },
);
child.on('exit', (code) => process.exit(code ?? 1));

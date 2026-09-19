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
      out[trimmed.slice(0, i)] = trimmed.slice(i + 1).trim();
    }
  } catch {
    // optional
  }
  return out;
}

const fileEnv = { ...loadEnv('.env.local'), ...loadEnv('.env') };
const token = fileEnv.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('missing_token');
  process.exit(1);
}

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['supabase', 'functions', 'deploy', 'youtube-fetch', '--project-ref', 'aqdptcuwpneuyzjavjak', '--use-api'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      SUPABASE_ACCESS_TOKEN: token,
      DO_NOT_TRACK: '1',
      CI: '1',
    },
  },
);
child.on('exit', (code) => process.exit(code ?? 1));

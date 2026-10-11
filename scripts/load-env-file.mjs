import { readFileSync } from 'node:fs';

/** Parse KEY=value lines from a dotenv file (no expansion). */
export function loadEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i < 1) continue;
      const key = trimmed.slice(0, i).trim();
      let val = trimmed.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
  } catch {
    // optional file
  }
  return out;
}

export function loadProjectEnv() {
  return { ...loadEnv('.env'), ...loadEnv('.env.local') };
}

export const SUPABASE_PROJECT_REF = 'aqdptcuwpneuyzjavjak';

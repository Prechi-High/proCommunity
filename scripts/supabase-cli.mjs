/**
 * Run Supabase CLI with SUPABASE_ACCESS_TOKEN from .env.local (then .env).
 * Usage: node scripts/supabase-cli.mjs functions deploy product-intelligence --use-api
 */
import { spawn } from 'node:child_process';

import { loadProjectEnv, SUPABASE_PROJECT_REF } from './load-env-file.mjs';

const fileEnv = loadProjectEnv();
const token = fileEnv.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error('missing_token: set SUPABASE_ACCESS_TOKEN in .env.local');
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node scripts/supabase-cli.mjs <supabase-cli-args...>');
  console.error('example: node scripts/supabase-cli.mjs functions deploy product-intelligence --project-ref', SUPABASE_PROJECT_REF, '--use-api');
  process.exit(1);
}

const needsProjectRef =
  !args.includes('--project-ref') &&
  (args[0] === 'functions' || args[0] === 'secrets' || args[0] === 'migration');
const cliArgs = needsProjectRef
  ? ['supabase', ...args, '--project-ref', SUPABASE_PROJECT_REF]
  : ['supabase', ...args];

const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', cliArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: token, DO_NOT_TRACK: '1' },
});
child.on('exit', (code) => process.exit(code ?? 1));

import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['scripts/supabase-cli.mjs', 'functions', 'deploy', 'product-intelligence', '--project-ref', 'aqdptcuwpneuyzjavjak', '--use-api'], {
  stdio: 'inherit',
  shell: false,
});
child.on('exit', (code) => process.exit(code ?? 1));

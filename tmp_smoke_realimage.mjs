import { readFileSync } from 'node:fs';
import path from 'node:path';

const imgPath = path.join(process.cwd(), 'project info', 'download.jfif');
const buf = readFileSync(imgPath);
const b64 = buf.toString('base64');
const kb = Math.round(buf.length / 1024);
console.log(`image: ${imgPath}  size=${buf.length} bytes (${kb} KB)  b64_len=${b64.length}`);
console.log(`base64 starts with: ${b64.slice(0, 40)}…`);

const payload = {
  imageBase64: b64,
  mimeType: 'image/jpeg',
  fileName: 'download.jfif',
};

const TOK =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxZHB0Y3V3cG5ldXl6amF2amFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NjQzNjYsImV4cCI6MjEwNTA0MDM2Nn0.' +
  'jbIzvkqQ7qnYhH45uvIwDI97-tjdHsPY4S-0yv9XBXg';

async function run(label, url) {
  console.log('\n========= ', label, ' → ', url, ' =========');
  const t0 = Date.now();
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOK}`,
      apikey: TOK,
    },
    body: JSON.stringify(payload),
  });
  const body = await r.text();
  const ms = Date.now() - t0;
  console.log(`${label}: HTTP ${r.status}  in ${ms}ms  body_len=${body.length}`);
  try {
    const j = JSON.parse(body);
    if (j.attempts && Array.isArray(j.attempts)) {
      console.log('attempts:');
      for (const a of j.attempts) {
        const output = (a.output || '').slice(0, 80).replace(/\n/g, '\\n');
        const outL = a.outputLength;
        console.log(
          '  · provider=%s  label=%s  http=%s  err=%s  outputLength=%s  output=%s',
          a.provider ?? '?',
          a.label ?? '?',
          a.http ?? '?',
          a.err ? String(a.err).slice(0, 60) : '-',
          outL,
          output ? `«${output}»` : '-',
        );
      }
      delete j.attempts;
    }
    console.log('clean body:', JSON.stringify(j, null, 2).slice(0, 600));
  } catch {
    console.log('TEXT body:', body.slice(0, 400));
  }
}

await run('direct-no-debug', 'https://aqdptcuwpneuyzjavjak.supabase.co/functions/v1/product-vision');
await run('direct-debug-1', 'https://aqdptcuwpneuyzjavjak.supabase.co/functions/v1/product-vision?debug=1');

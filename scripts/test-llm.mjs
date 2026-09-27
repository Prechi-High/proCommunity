import { readFileSync } from 'node:fs';

function loadEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 1) continue;
      out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // optional
  }
  return out;
}

const env = { ...loadEnv('.env') };
for (const [k, v] of Object.entries(loadEnv('.env.local'))) if (v) env[k] = v;
const prompt = 'Reply with JSON {"ok":true}';

async function probe(label, fn) {
  const t = Date.now();
  try {
    const out = await fn();
    console.log(label, Date.now() - t, 'ms', String(out).slice(0, 160));
  } catch (e) {
    console.log(label, 'ERR', e.message);
  }
}

await probe('gemini models', async () => {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}&pageSize=100`);
  const j = await r.json();
  if (!r.ok) return `${r.status} ${JSON.stringify(j).slice(0, 200)}`;
  return (j.models || []).map((m) => m.name.replace('models/', '')).filter((n) => /flash|pro/.test(n)).join(', ');
});

for (const model of [env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-3-flash-preview'].filter(Boolean)) {
  await probe(`gemini ${model}`, async () => {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
    });
    const j = await r.json();
    return `${r.status} ${r.ok ? j.candidates?.[0]?.content?.parts?.[0]?.text : JSON.stringify(j.error?.message ?? j).slice(0, 150)}`;
  });
}

await probe('openrouter credits', async () => {
  const r = await fetch('https://openrouter.ai/api/v1/credits', { headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` } });
  return `${r.status} ${await r.text()}`;
});

for (const model of [env.OPENROUTER_MODEL, 'anthropic/claude-haiku-4.5'].filter(Boolean)) {
  await probe(`openrouter ${model}`, async () => {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      body: JSON.stringify({ model, max_tokens: 30, messages: [{ role: 'user', content: prompt }] }),
    });
    return `${r.status} ${(await r.text()).slice(0, 150)}`;
  });
}

for (const model of [env.NVIDIA_MODEL, 'meta/llama-3.3-70b-instruct'].filter(Boolean)) {
  await probe(`nvidia ${model}`, async () => {
    const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.NVIDIA_API_KEY}` },
      body: JSON.stringify({ model, max_tokens: 40, messages: [{ role: 'user', content: prompt }] }),
    });
    const j = await r.json().catch(() => ({}));
    return `${r.status} ${r.ok ? j.choices?.[0]?.message?.content : JSON.stringify(j).slice(0, 150)}`;
  });
}
console.log('models configured:', { GEMINI_MODEL: env.GEMINI_MODEL, OPENROUTER_MODEL: env.OPENROUTER_MODEL, NVIDIA_MODEL: env.NVIDIA_MODEL });

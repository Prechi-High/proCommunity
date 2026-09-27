import { readFileSync } from 'node:fs';

function loadEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i < 1) continue;
      out[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // optional
  }
  return out;
}

const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };
for (const [k, v] of Object.entries(loadEnv('.env'))) {
  if (!env[k]) env[k] = v;
}

const url = (env.EXPO_PUBLIC_SUPABASE_URL || 'https://aqdptcuwpneuyzjavjak.supabase.co').replace(/\/$/, '');
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!anon) {
  console.error('missing anon');
  process.exit(1);
}

// usage: node scripts/test-investigate.mjs "query" [search|investigate] [force]
//        node scripts/test-investigate.mjs '{"action":"ask",...}' raw
const arg = process.argv[2] || 'Anker 20W USB-C charger';
const query = arg.startsWith('@') ? readFileSync(arg.slice(1), 'utf8') : arg;
const action = process.argv[3] || 'investigate';
const force = process.argv[4] === 'force';
const started = Date.now();
const res = await fetch(`${url}/functions/v1/product-intelligence`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anon}`,
    apikey: anon,
  },
  body: action === 'raw' ? query : JSON.stringify({ action, query, force }),
});
const text = await res.text();
console.log('status', res.status, 'ms', Date.now() - started);
try {
  const j = JSON.parse(text);
  if (action === 'raw') {
    console.log(JSON.stringify(j, null, 2).slice(0, 4000));
  } else if (action === 'search') {
    console.log(JSON.stringify({
      cached: j.cached,
      llm: j.llm,
      errors: j.errors,
      knowledge: j.knowledge,
      products: (j.products || []).map((p) => `${p.id} | ${p.brand} | ${p.name} | ${p.category} | ${p.price?.display ?? '-'} | ${p.rating ?? '-'} (${p.ratingCount ?? 0}) | offers ${p.offers} | img ${p.image ? 'y' : 'n'}`),
    }, null, 2));
  } else {
    const p = j.profile || {};
    console.log(JSON.stringify({
      error: j.error,
      cached: j.cached,
      errors: j.errors,
      llm: p.llm,
      identity: p.identity,
      summary: p.summary,
      verdict: p.verdict,
      consensus: p.consensus,
      people: p.people,
      voices: (p.voices || []).map((v) => `${v.stance} | ${v.platform} | ${v.author} | mark="${v.mark}" | ${v.text.slice(0, 110)}`),
      reveals: p.reveals,
      specs: p.specs,
      praise: p.praise,
      complaints: p.complaints,
      bestFor: p.bestFor,
      notFor: p.notFor,
      alternatives: p.alternatives,
      offers: (p.offers || []).length,
      priceRange: p.priceRange,
      rating: p.rating,
      ratingCount: p.ratingCount,
      score: p.score,
      confidence: p.confidence,
      band: p.band,
      images: (p.images || []).length,
      sources: (p.sources || []).length,
    }, null, 2));
  }
} catch {
  console.log(text.slice(0, 800));
}

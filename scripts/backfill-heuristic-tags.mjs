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

const RULES = [
  { tag: 'how_to_use', pattern: /\b(how to|how i|tutorial|routine|apply|application|layer|use this|using|cleanse|wash|steps?)\b/i },
  { tag: 'how_it_works', pattern: /\b(how it works|science|mechanism|barrier|ceramide|explains?|dermatologist|why it)\b/i },
  { tag: 'composition', pattern: /\b(ingredient|composition|formula|formulati|what.?s in|niacinamide|retinol|salicylic|zinc)\b/i },
  { tag: 'who_its_for', pattern: /\b(oily|dry|sensitive|acne|combination|skin type|who (it'?s|is) for|good for)\b/i },
  { tag: 'results_over_time', pattern: /\b(before\s*after|results?|week|month|progress|transform|journey|glow|healing)\b/i },
  { tag: 'precautions', pattern: /\b(irritat|sting|burn|side effect|patch test|caution|warning|purge|react)\b/i },
  { tag: 'comparisons', pattern: /\b(vs\.?|versus|compare|comparison|dupe|alternative|better than)\b/i },
];

function heuristic(title, author) {
  const hay = `${title || ''} ${author || ''}`.trim();
  const tags = [];
  if (hay && !/^(instagram|facebook|tiktok|pinterest|youtube)\s*video$/i.test(hay)) {
    for (const rule of RULES) {
      if (rule.pattern.test(hay) && !tags.includes(rule.tag)) tags.push(rule.tag);
    }
  }
  if (!tags.length) tags.push('who_its_for');
  return {
    content_tags: tags.slice(0, 3),
    classification_confidence: tags[0] === 'who_its_for' && tags.length === 1 ? 0.71 : 0.78,
    classification_method: 'title_description',
    classification_justification: `heuristic:${tags.join(',')}`,
    pending_review: false,
  };
}

const env = { ...loadEnv('.env.local'), ...loadEnv('.env') };
const url = env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('missing_service_role');
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

let updated = 0;
let pages = 0;
while (pages < 20) {
  pages += 1;
  const rows = await fetch(
    `${url}/rest/v1/video_cache?select=id,title,channel_or_author,channel_title&content_tags=eq.{}&order=fetched_at.desc&limit=100`,
    { headers },
  ).then((r) => r.json());
  if (!Array.isArray(rows) || !rows.length) break;
  for (const row of rows) {
    const patch = heuristic(row.title, row.channel_or_author || row.channel_title || '');
    const res = await fetch(`${url}/rest/v1/video_cache?id=eq.${row.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    });
    if (res.ok) updated += 1;
  }
  if (rows.length < 100) break;
}

const sample = await fetch(
  `${url}/rest/v1/rpc/list_tagged_videos`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_catalog: 'gentle-foaming-cleanser', p_tag: 'who_its_for', p_limit: 8 }),
  },
).then((r) => r.json());

console.log(
  JSON.stringify({
    updated,
    rpc_who_its_for: Array.isArray(sample) ? sample.length : sample,
    sample_titles: Array.isArray(sample) ? sample.slice(0, 3).map((r) => r.title?.slice?.(0, 50)) : [],
  }),
);

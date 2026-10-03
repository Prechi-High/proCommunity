/**
 * GET /r/:token  (rewritten to /api/r/:token)
 *
 * Public, read-only page for a shared Research Card, server-rendered so link previews
 * (WhatsApp, iMessage, X) get real Open Graph tags. Data comes from the Supabase
 * `research-public` function, which only returns share-safe fields.
 */

type Req = { method?: string; query?: Record<string, string | string[] | undefined>; url?: string };
type Res = {
  status: (code: number) => { send: (body: string) => void };
  setHeader: (name: string, value: string) => void;
};

type J = Record<string, unknown>;
type Section = { key: string; title: string; content: J };
type Card = {
  reference: string;
  title: string;
  status: string;
  imageUrl: string | null;
  createdAt: string | null;
  products: Array<{ name: string; brand: string; category: string; image: string | null; role: string }>;
  sections: Section[];
  comparisons: Array<{ snapshot: J | null }>;
  sources: Array<{ name: string; url: string | null; type: string }>;
};

const env = (name: string) => (process.env[name] ?? '').trim().replace(/^["']|["']$/g, '');

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeUrl = (v: unknown) => (typeof v === 'string' && /^https:\/\//i.test(v) ? v : null);
const list = (v: unknown): J[] => (Array.isArray(v) ? (v as J[]) : []);
const text = (v: unknown) => (typeof v === 'string' ? v : '');

function sectionHtml(s: Section): string {
  const c = s.content ?? {};
  const bullets = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
  let body = '';
  switch (s.key) {
    case 'summary':
      body = [text(c.verdict) && `<p class="lead">${esc(c.verdict)}</p>`, text(c.summary) && `<p>${esc(c.summary)}</p>`].filter(Boolean).join('');
      break;
    case 'confidence':
      body = `${c.score != null ? `<p class="score"><b>${esc(c.score)}</b>/100 owner score</p>` : ''}${bullets(list(c.drivers).map(String))}${
        list(c.uncertainty).length ? `<p class="muted">Still uncertain:</p>${bullets(list(c.uncertainty).map(String))}` : ''
      }<p class="note">${esc(c.note)}</p>`;
      break;
    case 'key_facts':
      body = bullets(list(c.facts).map(String));
      break;
    case 'ingredients_or_specs':
      body = `<dl>${list(c.rows)
        .slice(0, 20)
        .map((r) => `<dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd>`)
        .join('')}</dl>`;
      break;
    case 'community':
      body = `${text(c.consensus) ? `<p>${esc(c.consensus)}</p>` : ''}${list(c.voices)
        .slice(0, 5)
        .map((v) => `<blockquote>“${esc(v.text)}”<cite>${esc(v.platform)}</cite></blockquote>`)
        .join('')}`;
      break;
    case 'pros_cons':
      body = `<div class="cols"><div><h4>Praise</h4>${bullets(list(c.praise).slice(0, 5).map((x) => text(x.text)))}</div><div><h4>Complaints</h4>${bullets(
        list(c.complaints).slice(0, 5).map((x) => text(x.text)),
      )}</div></div>`;
      break;
    case 'pricing': {
      const r = (c.range ?? null) as J | null;
      body = r ? `<p>Seen from <b>${esc(r.currency)} ${esc(r.min)}</b> to <b>${esc(r.currency)} ${esc(r.max)}</b> across ${esc(r.count)} listings.</p><p class="note">Prices change — check before paying.</p>` : '';
      break;
    }
    case 'stores':
      body = bullets(list(c.offers).slice(0, 6).map((o) => `${text(o.seller)}${(o.price as J | null)?.display ? ` — ${text((o.price as J).display)}` : ''}`));
      break;
    case 'alternatives':
      body = bullets(list(c.items).map((a) => `${text(a.name)} — ${text(a.reason)}`));
      break;
    default:
      return '';
  }
  return body ? `<section><h3>${esc(s.title)}</h3>${body}</section>` : '';
}

function page(card: Card, og: { title: string; description: string; image: string | null }, url: string, appUrl: string): string {
  const image = safeUrl(og.image);
  const primary = card.products.find((p) => p.role === 'primary') ?? card.products[0];
  const sections = card.sections.filter((s) => !['identity', 'sources'].includes(s.key)).map(sectionHtml).join('');
  const sources = card.sources
    .slice(0, 12)
    .map((s) => {
      const href = safeUrl(s.url);
      return `<li>${href ? `<a href="${esc(href)}" rel="nofollow noopener" target="_blank">${esc(s.name || href)}</a>` : esc(s.name)}</li>`;
    })
    .join('');
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(og.title)}</title>
<meta name="description" content="${esc(og.description)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Unmask">
<meta property="og:title" content="${esc(og.title)}"><meta property="og:description" content="${esc(og.description)}">
<meta property="og:url" content="${esc(url)}">${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="robots" content="noindex">
<style>
:root{--ink:#161616;--muted:#595959;--line:#DDDAD4;--bg:#F6F4EF;--card:#fff;--accent:#2457FF}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
main{max-width:680px;margin:0 auto;padding:28px 18px 64px}.brand{font-weight:700;letter-spacing:.02em;color:var(--accent);text-decoration:none}
.hero{display:flex;gap:16px;align-items:center;margin:22px 0 8px}.hero img{width:96px;height:96px;object-fit:contain;border-radius:14px;background:var(--card);border:1px solid var(--line)}
h1{font-size:26px;line-height:1.2;margin:0}h3{font-size:17px;margin:0 0 10px}h4{margin:0 0 6px;font-size:14px}.ref{color:var(--muted);font-size:13px;margin-top:4px}
section{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;margin-top:14px}.lead{font-weight:600}.muted,.note{color:var(--muted);font-size:13px}
ul{padding-left:18px;margin:6px 0}dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 14px;margin:0}dt{color:var(--muted)}dd{margin:0}
blockquote{margin:10px 0;padding-left:12px;border-left:3px solid var(--line)}cite{display:block;color:var(--muted);font-size:12px;font-style:normal;text-transform:capitalize}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:520px){.cols{grid-template-columns:1fr}}.score b{font-size:22px}
.cta{display:block;text-align:center;margin-top:22px;padding:14px;border-radius:999px;background:var(--ink);color:#fff;text-decoration:none;font-weight:600}a{color:var(--accent)}
footer{color:var(--muted);font-size:12px;margin-top:22px;text-align:center}
</style></head><body><main>
<a class="brand" href="${esc(appUrl)}">Unmask</a>
<div class="hero">${safeUrl(card.imageUrl ?? primary?.image) ? `<img src="${esc(safeUrl(card.imageUrl ?? primary?.image))}" alt="">` : ''}
<div><h1>${esc(card.title || primary?.name || 'Product research')}</h1><div class="ref">${esc([primary?.brand, primary?.category].filter(Boolean).join(' · '))}</div><div class="ref">Research Card ${esc(card.reference)}</div></div></div>
${sections || '<section><p>This research is still being prepared.</p></section>'}
${sources ? `<section><h3>Sources</h3><ul>${sources}</ul></section>` : ''}
<a class="cta" href="${esc(appUrl)}">Research your own products on Unmask</a>
<footer>Shared research summary. Personal details are never included.</footer>
</main></body></html>`;
}

function notFound(appUrl: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Research not available · Unmask</title><meta name="robots" content="noindex">
<style>body{margin:0;font:16px/1.5 -apple-system,Segoe UI,Inter,sans-serif;background:#F6F4EF;color:#161616;display:grid;place-items:center;min-height:100vh;padding:20px;text-align:center}a{color:#2457FF}</style></head>
<body><div><h1>This research isn't available</h1><p>The link may have been revoked or expired.</p><p><a href="${esc(appUrl)}">Go to Unmask</a></p></div></body></html>`;
}

export default async function handler(req: Req, res: Res) {
  const appUrl = env('SOURCED_PUBLIC_URL') || 'https://sourced.app';
  const raw = req.query?.token;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!/^[A-Za-z0-9]{8,64}$/.test(token)) {
    res.status(404).send(notFound(appUrl));
    return;
  }
  const supabaseUrl = (env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL') || 'https://aqdptcuwpneuyzjavjak.supabase.co').replace(/\/$/, '');
  const anon = env('EXPO_PUBLIC_SUPABASE_ANON_KEY') || env('SUPABASE_ANON_KEY');
  try {
    const upstream = await fetch(`${supabaseUrl}/functions/v1/research-public?token=${encodeURIComponent(token)}`, {
      headers: { ...(anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {}), 'x-forwarded-for': String((req as { headers?: Record<string, string> }).headers?.['x-forwarded-for'] ?? '') },
    });
    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(upstream.status === 429 ? 429 : 404).send(notFound(appUrl));
      return;
    }
    const data = (await upstream.json()) as { card: Card; og: { title: string; description: string; image: string | null } };
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.status(200).send(page(data.card, data.og, `${appUrl.replace(/\/$/, '')}/r/${token}`, appUrl));
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).send(notFound(appUrl));
  }
}

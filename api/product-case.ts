/**
 * POST /api/product-case
 * LLM Product Score from YouTube + owner comments (not a skin-fit score).
 */

type ReqReq = {
  method?: string;
  body?: {
    product?: { id: string; name: string; brand: string; ingredients?: string[] };
    ytComments?: string[];
    ownerComments?: string[];
  };
};
type ReqRes = { status: (code: number) => { json: (body: unknown) => void } };

function secret(name: string): string {
  return (process.env[name] ?? '').trim().replace(/^["']|["']$/g, '');
}

async function callGemini(prompt: string): Promise<string> {
  const key = secret('GEMINI_API_KEY') || secret('GOOGLE_API_KEY');
  if (!key) return '';
  const models = [...new Set([secret('GEMINI_MODEL'), 'gemini-2.5-flash', 'gemini-2.0-flash'].filter(Boolean))];
  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1200,
            responseMimeType: 'application/json',
          },
        }),
      },
    );
    if (!response.ok) {
      if (response.status === 404) continue;
      return '';
    }
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n') ?? '';
    if (text) return text;
  }
  return '';
}

async function callOpenRouter(prompt: string): Promise<string> {
  const key = secret('OPENROUTER_API_KEY');
  if (!key) return '';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': secret('PUBLIC_SITE_ORIGIN') || 'https://pro-community.vercel.app',
      'X-Title': 'Sourced',
    },
    body: JSON.stringify({
      model: secret('OPENROUTER_MODEL') || 'openai/gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) return '';
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content ?? '';
}

async function callLlm(prompt: string): Promise<string> {
  return (await callGemini(prompt)) || (await callOpenRouter(prompt));
}

function parseJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default async function handler(req: ReqReq, res: ReqRes) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const product = req.body?.product;
  if (!product?.id || !product?.name) {
    return res.status(400).json({ error: 'missing_product' });
  }

  const yt = (req.body?.ytComments ?? []).filter((c) => typeof c === 'string' && c.trim()).slice(0, 80);
  const own = (req.body?.ownerComments ?? []).filter((c) => typeof c === 'string' && c.trim()).slice(0, 40);
  const total = yt.length + own.length;

  if (total < 3) {
    return res.status(200).json({
      analysis: {
        productId: product.id,
        productScore: null,
        tooFew: true,
        split: { positive: 0, mixed: 0, negative: 0 },
        verdict: 'Not enough lived comments yet for a Product Score.',
        verdictMarks: [],
        frags: [...yt, ...own].slice(0, 6).map((text) => ({
          text: text.slice(0, 92),
          mark: text.split(/\s+/).slice(0, 3).join(' '),
          source: yt.includes(text) ? 'yt' : 'own',
        })),
        clusters: [],
        counts: { yt: yt.length, rd: 0, own: own.length, ig: product.ingredients?.length ?? 0 },
        basis: `Only ${total} comments found. A score would mislead.`,
        source: 'llm',
        analyzedAt: new Date().toISOString(),
      },
    });
  }

  const prompt = `You are scoring a skincare product from REAL user comments only.
Product: ${product.brand} — ${product.name}
Ingredients listed: ${(product.ingredients ?? []).slice(0, 12).join(', ') || 'unknown'}

YouTube comments (${yt.length}):
${yt.map((c, i) => `${i + 1}. ${c.slice(0, 280)}`).join('\n')}

Verified / owner-style Sourced posts (${own.length}):
${own.map((c, i) => `${i + 1}. ${c.slice(0, 280)}`).join('\n')}

Rules:
- Product Score is ONLY from what people who used it said (praise vs complaints). NOT a skin-type match score.
- If fewer than 5 usable lived-experience comments, set productScore null and tooFew true.
- score ≈ positive% + mixed%/2, integer 1–99 when scoring.
- frags: 4–6 short quotes COPIED/lightly trimmed from the comments (not invented). Each has mark = a short phrase inside the quote to highlight.
- verdict: one or two sentences; put the key claim phrase also in verdictMarks.
- clusters: 2–4 themes with percent share and 1–2 real quotes each.
- Reddit is not available; counts.rd = 0.

Return ONLY JSON:
{
  "productId": "${product.id}",
  "productScore": 74,
  "tooFew": false,
  "split": { "positive": 63, "mixed": 21, "negative": 16 },
  "verdict": "Mostly liked. Strongest for oily skin in these comments.",
  "verdictMarks": ["Strongest for oily skin"],
  "frags": [{ "text": "…", "mark": "…", "source": "yt"|"own" }],
  "clusters": [{ "title": "…", "who": "…", "percent": 40, "tone": "sage"|"honey"|"coral", "quotes": [{ "source": "yt", "text": "…", "mark": "…" }] }],
  "counts": { "yt": ${yt.length}, "rd": 0, "own": ${own.length}, "ig": ${product.ingredients?.length ?? 0} },
  "basis": "Read from N comments…"
}`;

  const raw = await callLlm(prompt);
  if (!raw) {
    return res.status(503).json({ error: 'no_llm' });
  }

  const parsed = parseJson(raw);
  if (!parsed) {
    return res.status(502).json({ error: 'llm_unparsed', raw: raw.slice(0, 400) });
  }

  const split = (parsed.split as { positive?: number; mixed?: number; negative?: number }) ?? {};
  const analysis = {
    productId: product.id,
    productScore:
      parsed.tooFew || parsed.productScore == null
        ? null
        : Math.max(1, Math.min(99, Math.round(Number(parsed.productScore)))),
    tooFew: Boolean(parsed.tooFew) || total < 5,
    split: {
      positive: Math.round(Number(split.positive) || 0),
      mixed: Math.round(Number(split.mixed) || 0),
      negative: Math.round(Number(split.negative) || 0),
    },
    verdict: String(parsed.verdict ?? ''),
    verdictMarks: Array.isArray(parsed.verdictMarks)
      ? (parsed.verdictMarks as string[]).map(String)
      : [],
    frags: Array.isArray(parsed.frags) ? parsed.frags : [],
    clusters: Array.isArray(parsed.clusters) ? parsed.clusters : [],
    counts: {
      yt: yt.length,
      rd: 0,
      own: own.length,
      ig: product.ingredients?.length ?? 0,
    },
    basis: String(parsed.basis ?? ''),
    source: 'llm' as const,
    analyzedAt: new Date().toISOString(),
  };

  return res.status(200).json({ analysis });
}

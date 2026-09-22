type RequestBody = {
  imageBase64?: string;
  mimeType?: string;
  prompt?: string;
};
type Request = { method?: string; body?: RequestBody };
type Response = { status: (code: number) => { json: (body: unknown) => void } };

const secret = (name: string) => (process.env[name] ?? '').trim().replace(/^['"]|['"]$/g, '');
const prompt = (value?: string) => value || 'Identify the product brand and product name from this image. Return only a clean product query string, no extra explanation, no JSON.';

async function gemini(imageBase64: string, mimeType: string, instruction: string) {
  const key = secret('GEMINI_API_KEY') || secret('GOOGLE_API_KEY');
  if (!key) return '';
  const models = [...new Set([secret('GEMINI_MODEL'), 'gemini-2.5-flash', 'gemini-2.0-flash'].filter(Boolean))];
  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: instruction }, { inlineData: { mimeType, data: imageBase64 } }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 80 } }),
    });
    if (response.status === 404) continue;
    if (!response.ok) return '';
    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join(' ').trim() || '';
  }
  return '';
}

async function openRouter(imageBase64: string, mimeType: string, instruction: string) {
  const key = secret('OPENROUTER_API_KEY');
  if (!key) return '';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: secret('OPENROUTER_VISION_MODEL') || secret('OPENROUTER_MODEL') || 'google/gemini-2.0-flash-001', temperature: 0.1, max_tokens: 80, messages: [{ role: 'user', content: [{ type: 'text', text: instruction }, { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }] }] }),
  });
  if (!response.ok) return '';
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const image = req.body?.imageBase64?.replace(/^data:[^;]+;base64,/, '').trim();
  if (!image) return res.status(400).json({ error: 'missing_image' });
  const mimeType = req.body?.mimeType?.startsWith('image/') ? req.body.mimeType : 'image/jpeg';
  try {
    const result = (await gemini(image, mimeType, prompt(req.body?.prompt))) || (await openRouter(image, mimeType, prompt(req.body?.prompt)));
    if (!result) return res.status(503).json({ error: 'no_vision_model' });
    return res.status(200).json({ query: result.replace(/\s+/g, ' ').trim() });
  } catch {
    return res.status(502).json({ error: 'vision_request_failed' });
  }
}

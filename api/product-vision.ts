/**
 * POST /api/product-vision  (Vercel route — EXPO_PUBLIC default: "/api/product-vision")
 *
 * THIN PROXY to the Supabase Edge Function "product-vision" which is the real
 * classifier. All LLM keys live in Supabase Edge Function secrets:
 *   GEMINI_API_KEY / GOOGLE_API_KEY → OPENROUTER_API_KEY → NVIDIA_API_KEY
 * (same secrets chain as discover-video-content uses for comment analysis.)
 *
 * This file only forwards the body, forwards auth via service role, then echoes
 * back the exact response text/status/headers from Supabase. The client never
 * needs any EXPO_PUBLIC_* LLM key — only the anon key it already has for app
 * access, and the Edge Function is locked down with service-role in this route.
 */

type ReqRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  url?: string;
};

type ReqResponse = {
  status: (code: number) => {
    json: (body: unknown) => void;
    send: (body: string | Buffer) => void;
    setHeader?: (name: string, value: string | string[]) => void;
  };
  setHeader?: (name: string, value: string | string[]) => void;
};

function first(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function secret(name: string): string {
  return (process.env[name] ?? '').trim().replace(/^["']|["']$/g, '');
}

function errorJson(res: ReqResponse, status: number, payload: unknown) {
  res.status(status).json(payload);
}

export default async function handler(req: ReqRequest, res: ReqResponse) {
  const method = (req.method ?? 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    res.status(200).send('ok');
    return;
  }
  if (method !== 'POST') {
    errorJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const supabaseUrl =
    secret('SUPABASE_URL') || secret('EXPO_PUBLIC_SUPABASE_URL') || 'https://aqdptcuwpneuyzjavjak.supabase.co';
  const edgeBearer =
    secret('SUPABASE_SERVICE_ROLE_KEY') || secret('EXPO_PUBLIC_SUPABASE_ANON_KEY') || '';

  if (!edgeBearer) {
    errorJson(res, 500, {
      error: 'missing_supabase_bearer',
      hint: 'Set SUPABASE_SERVICE_ROLE_KEY in .env.local (server-only).',
    });
    return;
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/product-vision`;

  const body = req.body ?? null;
  let serialized: string;
  try {
    serialized = JSON.stringify(body);
  } catch {
    errorJson(res, 400, { error: 'invalid_body_json' });
    return;
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${edgeBearer}`,
        'x-client-info': 'sourced/vercel-proxy',
        // Pass a region hint if set
        ...(secret('SB_REGION') ? { 'x-region': secret('SB_REGION') } : {}),
      },
      body: serialized,
    });

    const upstreamStatus = upstream.status;
    const upstreamBody = await upstream.text();
    const upstreamContentType = upstream.headers.get('content-type') || 'text/plain; charset=utf-8';

    try {
      const setter = res.setHeader ?? res.status(upstreamStatus).setHeader;
      if (setter && typeof setter === 'function') {
        setter.call(res, 'Content-Type', upstreamContentType);
        setter.call(res, 'X-Vercel-Proxy', 'product-vision→supabase-edge');
        upstream.headers.forEach((value, name) => {
          const lower = name.toLowerCase();
          if (lower === 'content-type' || lower === 'content-length' || lower === 'connection') return;
          setter.call(res, name, value);
        });
      }
    } catch {
      /* ignore header errors */
    }

    if (upstreamContentType.includes('application/json')) {
      try {
        res.status(upstreamStatus).send(upstreamBody);
      } catch {
        res.status(upstreamStatus).send(upstreamBody);
      }
    } else {
      res.status(upstreamStatus).send(upstreamBody);
    }
    return;
  } catch (err) {
    errorJson(res, 502, {
      error: 'edge_product_vision_proxy_failed',
      message: err instanceof Error ? err.message : String(err ?? ''),
    });
  }
}

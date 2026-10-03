/**
 * POST /api/auth/request-email-code — SERVER ONLY (Vercel).
 * Generates Supabase email OTP and sends branded code via Gmail/Nodemailer.
 */
import { handleRequestEmailCode } from '../../lib/server/auth/requestEmailCodeHandler';

type Req = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

type Res = {
  status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void };
  setHeader?: (name: string, value: string) => void;
};

const DEFAULT_ORIGINS = ['http://localhost:8081', 'http://localhost:19006', 'http://localhost:3000', 'http://127.0.0.1:8081'];

function applyCors(req: Req, res: Res): void {
  const configured =
    process.env.AUTH_CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? DEFAULT_ORIGINS;
  const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : undefined;
  if (origin && configured.includes(origin)) {
    res.setHeader?.('Access-Control-Allow-Origin', origin);
  }
  res.setHeader?.('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader?.('Vary', 'Origin');
}

function rawBody(req: Req): string {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return '';
}

export default async function handler(req: Req, res: Res) {
  applyCors(req, res);
  const method = (req.method ?? 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    res.status(200).send('ok');
    return;
  }
  if (method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const result = await handleRequestEmailCode(rawBody(req), req.headers ?? {});
  res.status(result.status).json(result.body);
}

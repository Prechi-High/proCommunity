import { createClient } from '@supabase/supabase-js';

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

export type ApiResponse = {
  status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void };
};

function env(name: string): string {
  return (process.env[name]?.trim() ?? '').replace(/^["']|["']$/g, '');
}

export function coreSupabase() {
  const url = env('CORE_SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
  const key = env('CORE_SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !key) throw new Error('Core Supabase server configuration is missing');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function commerceSupabase() {
  const url = env('COMMERCE_SUPABASE_URL');
  const key = env('COMMERCE_SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Commerce Supabase server configuration is missing');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function bearer(req: RequestLike): string | null {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith('Bearer ')) return null;
  return value.slice(7).trim() || null;
}

export async function requireUser(req: RequestLike) {
  const token = bearer(req);
  if (!token) return null;
  const { data, error } = await coreSupabase().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export function json(res: ApiResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function storeHostname(slug: string): string {
  const base = env('STORE_BASE_DOMAIN') || 'unmask.app';
  return `${slug}.store.${base.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
}

export function webhookSecret(req: RequestLike): boolean {
  const expected = env('STORE_PAYMENT_WEBHOOK_SECRET');
  if (!expected) return false;
  const raw = req.headers?.['x-store-webhook-secret'];
  const received = Array.isArray(raw) ? raw[0] : raw;
  return received === expected;
}

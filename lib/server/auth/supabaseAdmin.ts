/**
 * SERVER ONLY — Supabase service-role client. Never import from Expo client code.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let admin: SupabaseClient | null = null;

function secret(name: string): string {
  return (process.env[name] ?? '').trim().replace(/^["']|["']$/g, '');
}

export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = secret('SUPABASE_URL') || secret('EXPO_PUBLIC_SUPABASE_URL');
  const key = secret('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('supabase_admin_unconfigured');
  }
  admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

import { env } from "./env.ts";

export type AuthUser = { id: string; email: string | null };

/**
 * Resolves the signed-in Sourced user from the request's Supabase access token.
 * Returns null for the anon key, expired tokens or missing headers — never trusts ids in the body.
 */
export async function userFromRequest(req: Request, fetcher: typeof fetch = fetch): Promise<AuthUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token || token.split(".").length !== 3) return null;
  const url = env("SUPABASE_URL");
  const apikey = env("SUPABASE_ANON_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !apikey) return null;
  try {
    const res = await fetcher(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey } });
    if (!res.ok) return null;
    const u = (await res.json()) as { id?: string; email?: string | null; role?: string };
    if (!u.id || u.role !== "authenticated") return null;
    return { id: u.id, email: u.email ?? null };
  } catch {
    return null;
  }
}

/** True when the request carries the service-role key (internal calls such as webhook → worker). */
export function isServiceCall(req: Request): boolean {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const header = req.headers.get("authorization") ?? "";
  return Boolean(key) && header === `Bearer ${key}`;
}

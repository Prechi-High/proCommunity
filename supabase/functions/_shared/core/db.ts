import { env } from "./env.ts";

/** Minimal PostgREST client using the service role. Repositories are the only callers. */
export interface Rest {
  select<T>(table: string, query: string): Promise<T[]>;
  one<T>(table: string, query: string): Promise<T | null>;
  insert<T>(table: string, rows: object | object[], opts?: { onConflict?: string; ignoreDuplicates?: boolean; upsert?: boolean }): Promise<T[]>;
  update<T>(table: string, filter: string, patch: object): Promise<T[]>;
  remove(table: string, filter: string): Promise<void>;
  rpc<T>(fn: string, args: object): Promise<T>;
}

export class RestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function serviceRest(fetcher: typeof fetch = fetch): Rest | null {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const base = `${url}/rest/v1`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const call = async <T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> => {
    const res = await fetcher(`${base}/${path}`, {
      ...init,
      headers: { ...headers, ...(init.prefer ? { Prefer: init.prefer } : {}) },
    });
    const text = await res.text();
    if (!res.ok) {
      let code = `http_${res.status}`;
      let message = text.slice(0, 300);
      try {
        const j = JSON.parse(text) as { code?: string; message?: string };
        code = j.code || code;
        message = j.message || message;
      } catch {
        // non-JSON error body
      }
      throw new RestError(res.status, code, message);
    }
    return (text ? JSON.parse(text) : null) as T;
  };

  return {
    select: (table, query) => call(`${table}?${query}`),
    async one(table, query) {
      const rows = await call<unknown[]>(`${table}?${query}${query.includes("limit=") ? "" : "&limit=1"}`);
      return (rows?.[0] ?? null) as never;
    },
    insert(table, rows, opts = {}) {
      const resolution = opts.upsert ? "resolution=merge-duplicates" : opts.ignoreDuplicates ? "resolution=ignore-duplicates" : "";
      const conflict = opts.onConflict ? `?on_conflict=${encodeURIComponent(opts.onConflict)}` : "";
      return call(`${table}${conflict}`, {
        method: "POST",
        body: JSON.stringify(rows),
        prefer: ["return=representation", resolution].filter(Boolean).join(","),
      });
    },
    update: (table, filter, patch) =>
      call(`${table}?${filter}`, { method: "PATCH", body: JSON.stringify(patch), prefer: "return=representation" }),
    async remove(table, filter) {
      await call(`${table}?${filter}`, { method: "DELETE" });
    },
    rpc: (fn, args) => call(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) }),
  };
}

export const q = (v: string) => encodeURIComponent(v);

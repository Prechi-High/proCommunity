import { env } from "./env.ts";

/**
 * Adapter over the EXISTING Sourced Product Intelligence edge functions.
 * Research Cards and WhatsApp never re-implement search, identification or answers — they call these.
 */

export type ProductCandidate = {
  productId: string;
  name: string;
  brand: string;
  category: string;
  image: string | null;
  variant?: string;
  confidence: number;
};

export type Identification = {
  confidence: number;
  label: string;
  searchQuery: string;
  candidates: ProductCandidate[];
  looksLikePerson: boolean;
};

// deno-lint-ignore no-explicit-any
export type ProductProfile = Record<string, any>;

export type AskAnswer = { answer: string; mark: string; enough: boolean; cites: Array<Record<string, unknown>>; basedOn: number; followups: string[] };

export interface Intelligence {
  search(query: string, region?: string): Promise<ProductCandidate[]>;
  investigate(input: { productId?: string; query: string; region?: string; force?: boolean }): Promise<ProductProfile | null>;
  get(productId: string): Promise<ProductProfile | null>;
  ask(input: { productId: string; question: string; compareId?: string }): Promise<AskAnswer | null>;
  identifyImage(input: { base64: string; mimeType: string }): Promise<Identification>;
}

export class IntelligenceError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function edgeIntelligence(fetcher: typeof fetch = fetch): Intelligence {
  const base = `${env("SUPABASE_URL")}/functions/v1`;
  const key = env("SUPABASE_SERVICE_ROLE_KEY");

  const call = async <T>(fn: string, body: object, timeoutMs: number): Promise<T> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetcher(`${base}/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const data = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) throw new IntelligenceError(data?.error || `http_${res.status}`, res.status >= 500 || res.status === 429);
      return data;
    } catch (err) {
      if (err instanceof IntelligenceError) throw err;
      throw new IntelligenceError(ctrl.signal.aborted ? "timeout" : "network", true);
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async search(query, region = "ng") {
      const r = await call<{ products?: Array<Record<string, unknown>> }>("product-intelligence", { action: "search", query, country: region }, 30000);
      return (r.products ?? []).slice(0, 8).map((p, i) => ({
        productId: str(p.id, 100),
        name: str(p.name, 140),
        brand: str(p.brand, 80),
        category: str(p.category, 60),
        image: (p.image as string | null) ?? null,
        confidence: Math.max(0.3, 0.9 - i * 0.1),
      }));
    },
    async investigate({ productId, query, region = "ng", force }) {
      const r = await call<{ profile?: ProductProfile }>("product-intelligence", { action: "investigate", productId, query, country: region, force: force === true }, 110000);
      return r.profile ?? null;
    },
    async get(productId) {
      const r = await call<{ profile?: ProductProfile | null }>("product-intelligence", { action: "get", productId }, 15000);
      return r.profile ?? null;
    },
    async ask(input) {
      const r = await call<AskAnswer & { error?: string }>("product-intelligence", { action: "ask", ...input }, 40000);
      return r.answer ? r : null;
    },
    async identifyImage({ base64, mimeType }) {
      const r = await call<Record<string, unknown>>("product-vision", { imageBase64: base64, mimeType, format: "json" }, 60000);
      const label = str(r.label, 140);
      const confidence = typeof r.confidence === "number" ? r.confidence : 0;
      const category = str(r.category, 60);
      const main: ProductCandidate | null = label
        ? { productId: slugify(label), name: str(r.name, 140) || label, brand: str(r.brand, 80), category, image: null, variant: str(r.variant, 80) || undefined, confidence }
        : null;
      const alternatives = (Array.isArray(r.alternatives) ? r.alternatives : [])
        .map((a) => str(a, 140))
        .filter(Boolean)
        .slice(0, 3)
        .map((alt): ProductCandidate => ({ productId: slugify(alt), name: alt, brand: "", category, image: null, confidence: Math.min(confidence, 0.5) }));
      return {
        confidence,
        label,
        searchQuery: str(r.searchQuery, 160) || label,
        candidates: [...(main ? [main] : []), ...alternatives],
        looksLikePerson: /\b(face|skin|selfie|person|portrait|body|hand|arm)\b/i.test(`${category} ${label}`) && confidence < 0.6,
      };
    },
  };
}

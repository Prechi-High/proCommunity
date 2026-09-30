import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { userFromRequest } from "../_shared/core/auth.ts";
import { flags, publicUrl } from "../_shared/core/env.ts";

/**
 * product-intelligence — Sourced's universal Product Intelligence service.
 *
 * actions
 *   search       { query, country? }                 → ranked product candidates (identity + image + price)
 *   investigate  { query, productId?, name?, brand?, force? } → full intelligence profile
 *   get          { productId }                       → cached profile only
 *
 * Evidence comes from Serper (web, reviews, Reddit, shopping, images). An LLM organises the
 * evidence into the universal template; every praise/complaint/spec keeps its source index.
 * Profiles are remembered in public.product_intel (7-day freshness) and searches in
 * public.search_intel (24h).
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMMUNITY_ACTIONS = new Set(["threads", "thread", "post", "reply", "ownership_note", "helpful", "feed", "vote", "follow", "notifications", "notifications_read", "following", "upload", "room", "member"]);
const MEMBER_ONLY_ACTIONS = new Set(["post", "reply", "ownership_note", "helpful", "vote", "follow", "notifications", "notifications_read", "following", "upload"]);

const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const PROFILE_VERSION = 4;

type Json = Record<string, unknown>;

function secret(name: string): string {
  return (Deno.env.get(name) ?? "").trim().replace(/^["']|["']$/g, "");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function queryKey(q: string, country: string): string {
  return `${country}:${q.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let id: number | undefined;
  const t = new Promise<null>((r) => {
    id = setTimeout(() => r(null), ms) as unknown as number;
  });
  const out = await Promise.race([p.catch(() => null), t]);
  if (id !== undefined) clearTimeout(id);
  return out as T | null;
}

// ---------------------------------------------------------------------------
// Database memory (service role)

function db() {
  const url = secret("SUPABASE_URL");
  const key = secret("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  return {
    async select(table: string, filter: string): Promise<Json | null> {
      const r = await fetch(`${url}/rest/v1/${table}?${filter}&limit=1`, { headers });
      if (!r.ok) return null;
      const rows = (await r.json()) as Json[];
      return rows[0] ?? null;
    },
    async upsert(table: string, row: Json): Promise<void> {
      await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(row),
      }).catch(() => undefined);
    },
    async rows(path: string): Promise<Json[]> {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers }).catch(() => null);
      if (!r?.ok) return [];
      return ((await r.json().catch(() => [])) as Json[]) ?? [];
    },
    async insert(table: string, row: Json): Promise<Json | null> {
      const r = await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(row),
      }).catch(() => null);
      if (!r?.ok) return null;
      const out = (await r.json().catch(() => [])) as Json[];
      return out[0] ?? null;
    },
    async patch(table: string, filter: string, row: Json): Promise<void> {
      await fetch(`${url}/rest/v1/${table}?${filter}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(row),
      }).catch(() => undefined);
    },
    async rpc(fn: string, args: Json): Promise<Json[]> {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) }).catch(() => null);
      if (!r?.ok) return [];
      return ((await r.json().catch(() => [])) as Json[]) ?? [];
    },
    async insertMany(table: string, rows: Json[]): Promise<void> {
      if (!rows.length) return;
      await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      }).catch(() => undefined);
    },
    async remove(table: string, filter: string): Promise<void> {
      await fetch(`${url}/rest/v1/${table}?${filter}`, { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } }).catch(() => undefined);
    },
    async upload(bucket: string, b64: string, mime: string): Promise<string | null> {
      try {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
        const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
        const r = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
          method: "POST",
          headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": mime, "x-upsert": "true" },
          body: bytes,
        });
        return r.ok ? `${url}/storage/v1/object/public/${bucket}/${path}` : null;
      } catch {
        return null;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// YouTube owner comments — real people, verbatim.

type OwnerComment = {
  id: string;
  author: string;
  avatar: string | null;
  text: string;
  likes: number;
  videoId: string;
  videoTitle: string;
  publishedAt: string;
};

const FIRST_PERSON = /\b(i|i'm|i've|i'd|my|mine|we|our|bought|own|owned|had|using|used|returned|months?|weeks?|years?|daily)\b/i;
const ENGLISH_WORDS = /\b(the|and|is|it|this|that|for|with|but|was|of|my|have|not|very|so|i|in|on|you|after|works?|had)\b/g;
const LIVED = /\b(bought|using|used|had|have had|owned|months?|weeks?|years?|daily|every day|since|stopped|died|broke|lasted|returned|mine)\b/i;
const COMMENT_SPAM = /https?:\/\/|subscribe|giveaway|whatsapp|telegram|promo code|discount code|check out my|dm me/i;

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function youtubeComments(q: string): Promise<OwnerComment[]> {
  const key = secret("YOUTUBE_DATA_API_KEY");
  if (!key) return [];
  type SearchRes = { items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string } }> };
  const search = await withTimeout(
    fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=4&relevanceLanguage=en&q=${encodeURIComponent(`${q} review`)}&key=${key}`,
    ).then((r) => (r.ok ? (r.json() as Promise<SearchRes>) : null)),
    6000,
  );
  const videos = (search?.items ?? [])
    .map((i) => ({ id: i.id?.videoId ?? "", title: decodeHtml(i.snippet?.title ?? "") }))
    .filter((v) => v.id)
    .slice(0, 4);
  type ThreadRes = {
    items?: Array<{
      id?: string;
      snippet?: {
        topLevelComment?: {
          id?: string;
          snippet?: {
            authorDisplayName?: string;
            authorProfileImageUrl?: string;
            textOriginal?: string;
            textDisplay?: string;
            likeCount?: number;
            publishedAt?: string;
          };
        };
      };
    }>;
  };
  const lists = await Promise.all(
    videos.map(async (v) => {
      const res = await withTimeout(
        fetch(
          `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${v.id}&maxResults=100&order=relevance&textFormat=plainText&key=${key}`,
        ).then((r) => (r.ok ? (r.json() as Promise<ThreadRes>) : null)),
        6000,
      );
      return { v, items: res?.items ?? [] };
    }),
  );
  const out: OwnerComment[] = [];
  const seen = new Set<string>();
  for (const { v, items } of lists) {
    for (const it of items) {
      const top = it.snippet?.topLevelComment;
      const sn = top?.snippet;
      if (!sn || !top?.id) continue;
      const text = decodeHtml(String(sn.textOriginal ?? sn.textDisplay ?? "")).replace(/\s+/g, " ").trim();
      if (text.length < 45 || text.length > 700) continue;
      if (COMMENT_SPAM.test(text) || !FIRST_PERSON.test(text)) continue;
      const words = text.split(/\s+/).length;
      const english = (text.toLowerCase().match(ENGLISH_WORDS) ?? []).length;
      if (english < 4 || english / words < 0.18) continue;
      const k = text.slice(0, 60).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        id: top.id,
        author: str(sn.authorDisplayName, 60).replace(/^@/, "") || "YouTube viewer",
        avatar: sn.authorProfileImageUrl ?? null,
        text,
        likes: Number(sn.likeCount ?? 0),
        videoId: v.id,
        videoTitle: v.title,
        publishedAt: sn.publishedAt ?? "",
      });
    }
  }
  return out.sort((a, b) => b.likes - a.likes).slice(0, 24);
}

function redditSub(url: string): string {
  const m = url.match(/reddit\.com\/r\/([^/]+)/i);
  return m ? m[1] : "";
}

// ---------------------------------------------------------------------------
// Serper

type SerperOrganic = { title?: string; link?: string; snippet?: string; date?: string };
type SerperShopping = {
  title?: string;
  source?: string;
  link?: string;
  price?: string;
  imageUrl?: string;
  rating?: number;
  ratingCount?: number;
  productId?: string;
};
type SerperImage = { title?: string; imageUrl?: string; link?: string; source?: string; imageWidth?: number; imageHeight?: number; thumbnailUrl?: string };

async function serper<T>(endpoint: "search" | "shopping" | "images", body: Json): Promise<T | null> {
  const key = secret("SERPER_API_KEY");
  if (!key) return null;
  return withTimeout(
    fetch(`https://google.serper.dev/${endpoint}`, {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => (r.ok ? (r.json() as Promise<T>) : null)),
    9000,
  );
}

async function shopping(q: string, country: string): Promise<SerperShopping[]> {
  const local = await serper<{ shopping?: SerperShopping[] }>("shopping", { q, gl: country, num: 20 });
  const rows = local?.shopping ?? [];
  if (rows.length >= 3 || country === "us") return rows;
  const global = await serper<{ shopping?: SerperShopping[] }>("shopping", { q, gl: "us", num: 20 });
  return [...rows, ...(global?.shopping ?? [])];
}

// ---------------------------------------------------------------------------
// Prices

const CURRENCY_SIGNS: Array<[RegExp, string]> = [
  [/₦|NGN/i, "NGN"],
  [/US\$|\$|USD/i, "USD"],
  [/£|GBP/i, "GBP"],
  [/€|EUR/i, "EUR"],
  [/₹|INR/i, "INR"],
  [/KSh|KES/i, "KES"],
  [/R\s?\d|ZAR/i, "ZAR"],
];

function parsePrice(raw?: string): { amount: number; currency: string; display: string } | null {
  if (!raw) return null;
  const num = raw.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!num) return null;
  const amount = Number(num[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const currency = CURRENCY_SIGNS.find(([re]) => re.test(raw))?.[1] ?? "USD";
  return { amount, currency, display: raw.replace(/\s+/g, " ").trim() };
}

// ---------------------------------------------------------------------------
// LLM

type LlmResult = { data: Json | null; model: string | null; errors: string[] };

function parseJsonLoose(text: string): Json | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as Json;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Json;
    } catch {
      return null;
    }
  }
}

const RETIRED_GEMINI = /^gemini-(1\.|2\.0|2\.5)/;

function geminiModels(): string[] {
  const pref = secret("GEMINI_MODEL");
  return Array.from(
    new Set([pref && !RETIRED_GEMINI.test(pref) ? pref : "", "gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-flash-latest"].filter(Boolean)),
  );
}

async function callGemini(gKey: string, prompt: string, maxTokens: number, deadline: number, errors: string[]): Promise<LlmResult | null> {
  for (const model of geminiModels()) {
    const left = deadline - Date.now();
    if (left < 2500) break;
    const res = await withTimeout(
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": gKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens * 2 + 4096, responseMimeType: "application/json" },
        }),
      }),
      left,
    );
    if (!res) {
      errors.push(`${model}:timeout`);
      continue;
    }
    if (!res.ok) {
      errors.push(`${model}:http_${res.status}`);
      continue;
    }
    const body = (await res.json().catch(() => null)) as {
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
    } | null;
    const candidate = body?.candidates?.[0];
    const text = candidate?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
    const data = parseJsonLoose(text);
    if (data) return { data, model, errors };
    errors.push(`${model}:unparseable:${candidate?.finishReason ?? "none"}`);
  }
  return null;
}

async function callLlm(prompt: string, maxTokens: number, timeoutMs: number): Promise<LlmResult> {
  const errors: string[] = [];
  const orKey = secret("OPENROUTER_API_KEY");
  const gKey = secret("GEMINI_API_KEY") || secret("GOOGLE_API_KEY");
  const deadline = Date.now() + timeoutMs;

  if (gKey) {
    const out = await callGemini(gKey, prompt, maxTokens, deadline, errors);
    if (out) return out;
  }

  if (orKey) {
    const models = Array.from(
      new Set(
        [secret("OPENROUTER_TEXT_MODEL"), "anthropic/claude-haiku-4.5"].filter(
          Boolean,
        ),
      ),
    );
    for (const model of models) {
      const left = deadline - Date.now();
      if (left < 2500) break;
      const res = await withTimeout(
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${orKey}`,
            "HTTP-Referer": secret("PUBLIC_SITE_ORIGIN") || "https://pro-community.vercel.app",
            "X-Title": "Sourced",
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: maxTokens,
            messages: [
              { role: "system", content: "You are a precise product analyst. Reply with one valid JSON object only." },
              { role: "user", content: prompt },
            ],
          }),
        }),
        left,
      );
      if (!res) {
        errors.push(`${model}:timeout`);
        continue;
      }
      if (!res.ok) {
        errors.push(`${model}:http_${res.status}`);
        continue;
      }
      const body = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null;
      const data = parseJsonLoose(body?.choices?.[0]?.message?.content ?? "");
      if (data) return { data, model, errors };
      errors.push(`${model}:unparseable`);
    }
  }

  return { data: null, model: null, errors };
}

// ---------------------------------------------------------------------------
// Helpers

const STOP = new Set(["the", "and", "for", "with", "new", "pack", "of", "in", "a", "an", "by", "to", "ml", "oz", "g", "kg"]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function overlap(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = tokens(b);
  if (!ta.size || !tb.length) return 0;
  let hit = 0;
  for (const t of tb) if (ta.has(t)) hit += 1;
  return hit / Math.min(ta.size, tb.length);
}

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function strList(v: unknown, max: number, len = 160): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : str((x as Json)?.text ?? (x as Json)?.name, len))).map((x) => str(x, len)).filter(Boolean).slice(0, max);
}

function sourced(v: unknown, max: number, sourceCount: number): Array<{ text: string; source: number | null }> {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (typeof x === "string") return { text: str(x, 180), source: null };
      const row = x as Json;
      const n = Number(row.source);
      return {
        text: str(row.text, 180),
        source: Number.isInteger(n) && n >= 1 && n <= sourceCount ? n : null,
      };
    })
    .filter((x) => x.text)
    .slice(0, max);
}

// ---------------------------------------------------------------------------
// search

type Candidate = {
  id: string;
  name: string;
  brand: string;
  category: string;
  image: string | null;
  price: { amount: number; currency: string; display: string } | null;
  rating: number | null;
  ratingCount: number | null;
  offers: number;
  source: string | null;
  link: string | null;
};

async function runSearch(query: string, country: string) {
  const store = db();
  const key = queryKey(query, country);
  if (store) {
    const hit = await store.select("search_intel", `query_key=eq.${encodeURIComponent(key)}`);
    if (hit && Date.now() - +new Date(String(hit.fetched_at)) < SEARCH_TTL_MS) {
      return { cached: true, ...(hit.results as Json) };
    }
  }

  const [shop, web, imgs] = await Promise.all([
    shopping(query, country),
    serper<{ organic?: SerperOrganic[]; knowledgeGraph?: Json }>("search", { q: query, num: 10 }),
    serper<{ images?: SerperImage[] }>("images", { q: `${query} product`, num: 10 }),
  ]);

  type Raw = { title: string; image: string | null; price: string | undefined; rating?: number; ratingCount?: number; source?: string; link?: string };
  const raw: Raw[] = shop
    .filter((s) => s.title)
    .map((s) => ({
      title: String(s.title),
      image: s.imageUrl ?? null,
      price: s.price,
      rating: s.rating,
      ratingCount: s.ratingCount,
      source: s.source,
      link: s.link,
    }));

  if (raw.length < 4) {
    const images = imgs?.images ?? [];
    for (const [i, o] of (web?.organic ?? []).slice(0, 8).entries()) {
      if (!o.title) continue;
      raw.push({ title: o.title.split(/ [-|–—] /)[0], image: images[i]?.imageUrl ?? null, price: undefined, source: domainOf(o.link ?? ""), link: o.link });
    }
  }

  const list = raw.slice(0, 24);
  const prompt = `A shopper searched for: "${query}".
Below are raw listing titles (index: title). Clean them into real products.
For each index return the canonical product name (without seller noise, pack counts or marketing),
the brand, a short general category (e.g. "Phone charger", "Running shoes", "Blender", "Face cleanser", "Laptop"),
and dup_of = index of an earlier item that is the same product (same brand+model+variant), else null.
Drop items that are accessories/unrelated to the search intent by setting "drop": true.

${list.map((r, i) => `${i}: ${r.title}`).join("\n")}

Return JSON: {"items":[{"i":0,"name":"","brand":"","category":"","dup_of":null,"drop":false}]}`;

  const llm = list.length ? await callLlm(prompt, 1800, 12000) : { data: null, model: null, errors: [] };
  const cleaned = new Map<number, { name: string; brand: string; category: string; dup: number | null; drop: boolean }>();
  const items = Array.isArray(llm.data?.items) ? (llm.data!.items as Json[]) : [];
  for (const it of items) {
    const i = Number(it.i);
    if (!Number.isInteger(i) || i < 0 || i >= list.length) continue;
    const dup = it.dup_of == null ? null : Number(it.dup_of);
    cleaned.set(i, {
      name: str(it.name, 120),
      brand: str(it.brand, 60),
      category: str(it.category, 40),
      dup: Number.isInteger(dup) && (dup as number) < i ? (dup as number) : null,
      drop: it.drop === true,
    });
  }

  const byIndex = new Map<number, Candidate>();
  const order: number[] = [];
  for (const [i, r] of list.entries()) {
    const c = cleaned.get(i);
    if (c?.drop) continue;
    const price = parsePrice(r.price);
    if (c?.dup != null && byIndex.has(c.dup)) {
      const base = byIndex.get(c.dup)!;
      base.offers += 1;
      if (!base.image && r.image) base.image = r.image;
      if (price && base.price && price.currency === base.price.currency && price.amount < base.price.amount) base.price = price;
      if (!base.price && price) base.price = price;
      if (r.rating && (r.ratingCount ?? 0) > (base.ratingCount ?? 0)) {
        base.rating = r.rating;
        base.ratingCount = r.ratingCount ?? null;
      }
      continue;
    }
    const name = c?.name || r.title.slice(0, 100);
    const brand = c?.brand || "";
    const display = brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name;
    const id = slugify(display);
    if (!id || order.some((o) => byIndex.get(o)?.id === id)) {
      const existing = order.map((o) => byIndex.get(o)!).find((x) => x.id === id);
      if (existing) existing.offers += 1;
      continue;
    }
    byIndex.set(i, {
      id,
      name,
      brand,
      category: c?.category || "Product",
      image: r.image,
      price,
      rating: r.rating ?? null,
      ratingCount: r.ratingCount ?? null,
      offers: 1,
      source: r.source ?? null,
      link: r.link ?? null,
    });
    order.push(i);
  }

  const products = order
    .map((i) => byIndex.get(i)!)
    .map((c) => ({ c, s: overlap(query, `${c.brand} ${c.name}`) * 3 + Math.min(c.offers, 5) * 0.3 + (c.ratingCount ? Math.log10(c.ratingCount + 1) * 0.4 : 0) + (c.image ? 0.3 : 0) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)
    .slice(0, 16);

  const kg = web?.knowledgeGraph as Json | undefined;
  const results = {
    query,
    products,
    knowledge: kg
      ? { title: str(kg.title, 120), type: str(kg.type, 80), description: str(kg.description, 400), image: str(kg.imageUrl, 400) || null }
      : null,
    llm: llm.model,
  };
  if (store && products.length) {
    await store.upsert("search_intel", { query_key: key, results, fetched_at: new Date().toISOString() });
  }
  return { cached: false, ...results, errors: llm.errors };
}

// ---------------------------------------------------------------------------
// investigate

async function runInvestigate(input: { query: string; productId?: string; force?: boolean; country: string }) {
  const store = db();
  const id = input.productId || slugify(input.query);
  if (store && !input.force) {
    const hit = await store.select("product_intel", `id=eq.${encodeURIComponent(id)}`);
    const payload = hit?.payload as Json | undefined;
    if (hit && payload?.version === PROFILE_VERSION && +new Date(String(hit.refresh_after)) > Date.now()) {
      return { cached: true, profile: payload };
    }
  }

  const q = input.query;
  const [overview, reviews, reddit, owners, shop, imgs, comments] = await Promise.all([
    serper<{ organic?: SerperOrganic[]; knowledgeGraph?: Json }>("search", { q: `${q} specifications features`, num: 8 }),
    serper<{ organic?: SerperOrganic[] }>("search", { q: `${q} review pros cons problems`, num: 8 }),
    serper<{ organic?: SerperOrganic[] }>("search", { q: `${q} reddit owners experience`, num: 8 }),
    serper<{ organic?: SerperOrganic[] }>("search", { q: `${q} customer reviews "I bought" OR "I've been using" OR "after months"`, num: 8 }),
    shopping(q, input.country),
    serper<{ images?: SerperImage[] }>("images", { q: `${q}`, num: 20 }),
    youtubeComments(q).catch(() => [] as OwnerComment[]),
  ]);

  const seen = new Set<string>();
  const sources: Array<{ n: number; title: string; url: string; domain: string; snippet: string; kind: string }> = [];
  const push = (rows: SerperOrganic[] | undefined, kind: string) => {
    for (const r of rows ?? []) {
      if (!r.link || seen.has(r.link) || !r.snippet) continue;
      seen.add(r.link);
      sources.push({ n: sources.length + 1, title: str(r.title, 140), url: r.link, domain: domainOf(r.link), snippet: str(r.snippet, 320), kind });
    }
  };
  push(overview?.organic, "web");
  push(reviews?.organic, "review");
  push(reddit?.organic, "community");
  push(owners?.organic, "community");
  const evidence = sources.slice(0, 26);

  const offers = shop
    .filter((s) => s.title && overlap(q, s.title) >= 0.5)
    .map((s) => ({
      seller: str(s.source, 60) || domainOf(s.link ?? ""),
      title: str(s.title, 140),
      price: parsePrice(s.price),
      link: s.link ?? null,
      rating: s.rating ?? null,
      ratingCount: s.ratingCount ?? null,
      image: s.imageUrl ?? null,
    }))
    .filter((o) => o.price);

  const kg = overview?.knowledgeGraph as Json | undefined;
  const prompt = `Build a buyer intelligence profile for the product: "${q}".
${kg ? `Knowledge panel: ${JSON.stringify(kg).slice(0, 800)}\n` : ""}
Evidence (numbered sources):
${evidence.map((s) => `[${s.n}] (${s.kind}, ${s.domain}) ${s.title}: ${s.snippet}`).join("\n")}
${offers.length ? `\nListings: ${offers.slice(0, 6).map((o) => `${o.title} — ${o.price?.display}`).join("; ")}` : ""}
${comments.length ? `\nOwner comments (real people, verbatim, C-numbered):\n${comments.map((c, i) => `[C${i + 1}] (${c.author}, ${c.likes} likes) ${c.text.slice(0, 360)}`).join("\n")}` : ""}

Rules: use only the evidence and well-established public facts about this exact product. Never invent numbers.
Each praise/complaint/spec should cite the source number it came from when possible. Keep phrases short and plain.
Work for ANY product type (electronics, appliances, clothing, food, tools, cosmetics, vehicles, software...).
Voices: you MUST return 6-10 voices whenever owner comments or first-person snippets exist — the most useful
first-person statements from real users about THIS product (skip off-topic questions and other products). Use "C<n>" refs for owner comments and
"S<n>" refs only for sources whose snippet is clearly a person describing their own use. "mark" MUST be copied exactly
from that text (3-9 words) — the part a smart friend would underline. Prefer a mix of love, mixed and warn.
Reveals: 3-5 non-obvious things people only learn after owning or researching it (good or bad), each ≤ 18 words,
backed by refs. "mark" is 2-6 words copied from your own reveal text.

Return JSON:
{
 "identity": {"name":"","brand":"","manufacturer":"","model":"","category":"","subcategory":"","variant":"","size":""},
 "summary": "one plain sentence: what it is and what it does",
 "verdict": "one balanced sentence a smart friend would say before you buy",
 "specs": [{"label":"","value":"","source":1}],
 "praise": [{"text":"","source":1}],
 "complaints": [{"text":"","source":1}],
 "best_for": [""],
 "not_for": [""],
 "uses": [""],
 "how_to_use": "",
 "compatibility": "",
 "alternatives": [{"name":"","reason":""}],
 "consensus": "one sentence on what people who actually used it keep saying, e.g. 'Most owners say…'",
 "consensus_mark": "3-8 words copied exactly from consensus — the part that matters most before buying",
 "voices": [{"ref":"C1","mark":"","stance":"love|mixed|warn","topic":"2-3 words"}],
 "reveals": [{"text":"","mark":"","refs":["C2","S4"]}],
 "variants": [{"label":"e.g. 45W, 256GB, Black, 50 ml, Size 10","kind":"size|color|capacity|model|flavor|pack","query":"full search query for that exact variant"}],
 "identity_confidence": 0.0
}
Limits: specs ≤ 8, praise ≤ 5, complaints ≤ 5, best_for ≤ 4, not_for ≤ 3, uses ≤ 4, alternatives ≤ 3, voices ≤ 10, reveals ≤ 5, variants ≤ 8 (real variations this exact product is sold in — sizes, colours, capacities, sibling models; [] if none).`;

  const llm = evidence.length || comments.length ? await callLlm(prompt, 3400, 32000) : { data: null, model: null, errors: ["no_evidence"] };
  const d = (llm.data ?? {}) as Json;
  const identityRaw = (d.identity ?? {}) as Json;

  const identity = {
    name: str(identityRaw.name, 140) || str(kg?.title, 140) || q,
    brand: str(identityRaw.brand, 80),
    manufacturer: str(identityRaw.manufacturer, 80),
    model: str(identityRaw.model, 80),
    category: str(identityRaw.category, 60) || str(kg?.type, 60) || "Product",
    subcategory: str(identityRaw.subcategory, 60),
    variant: str(identityRaw.variant, 80),
    size: str(identityRaw.size, 60),
  };

  const praise = sourced(d.praise, 5, evidence.length);
  const complaints = sourced(d.complaints, 5, evidence.length);
  const specs = Array.isArray(d.specs)
    ? (d.specs as Json[])
        .map((s) => ({ label: str(s.label, 40), value: str(s.value, 120), source: Number.isInteger(Number(s.source)) ? Number(s.source) : null }))
        .filter((s) => s.label && s.value && !/price|cost/i.test(s.label))
        .slice(0, 8)
    : [];

  if (!praise.length && !complaints.length) {
    for (const s of evidence.filter((e) => e.kind !== "web").slice(0, 3)) praise.push({ text: s.snippet.slice(0, 160), source: s.n });
  }

  const rated = offers.filter((o) => o.rating && o.ratingCount);
  const ratingCount = rated.reduce((a, o) => a + (o.ratingCount ?? 0), 0);
  const rating = ratingCount ? rated.reduce((a, o) => a + (o.rating ?? 0) * (o.ratingCount ?? 0), 0) / ratingCount : null;

  const byCurrency = new Map<string, typeof offers>();
  for (const o of offers) {
    const c = o.price!.currency;
    byCurrency.set(c, [...(byCurrency.get(c) ?? []), o]);
  }
  const mainCurrency = [...byCurrency.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const sortedMain = (mainCurrency?.[1] ?? []).sort((a, b) => a.price!.amount - b.price!.amount);
  const median = sortedMain.length ? sortedMain[Math.floor(sortedMain.length / 2)].price!.amount : 0;
  const priced = sortedMain.filter((o) => o.price!.amount >= median * 0.45 && o.price!.amount <= median * 2.2);
  const priceRange = priced.length
    ? { min: priced[0].price!.amount, max: priced[priced.length - 1].price!.amount, currency: mainCurrency![0], count: priced.length }
    : null;

  const ratingScore = rating ? (rating / 5) * 100 : null;
  const sentimentScore = praise.length + complaints.length ? (praise.length / (praise.length + complaints.length)) * 100 : null;
  const score =
    ratingScore != null && sentimentScore != null
      ? Math.round(ratingScore * 0.65 + sentimentScore * 0.35)
      : ratingScore != null
        ? Math.round(ratingScore)
        : sentimentScore != null
          ? Math.round(sentimentScore)
          : null;

  const idConf = Math.max(0, Math.min(1, Number(d.identity_confidence) || (llm.data ? 0.7 : 0.4)));
  const citedShare = [...praise, ...complaints, ...specs].filter((x) => x.source != null).length / Math.max(1, praise.length + complaints.length + specs.length);
  const confidence = Math.round(
    Math.min(1, idConf * 0.45 + Math.min(evidence.length, 15) / 15 * 0.3 + citedShare * 0.15 + (offers.length ? 0.1 : 0)) * 100,
  ) / 100;
  const band = confidence >= 0.75 ? "High" : confidence >= 0.5 ? "Likely" : "Uncertain";

  type Voice = {
    id: string;
    platform: "youtube" | "reddit" | "review" | "forum";
    author: string;
    avatar: string | null;
    text: string;
    mark: string;
    stance: "love" | "mixed" | "warn";
    topic: string;
    likes: number;
    url: string;
    where: string;
    date: string;
  };
  const refToVoice = (ref: string): Omit<Voice, "mark" | "stance" | "topic"> | null => {
    const m = ref.trim().toUpperCase().match(/^([CS])(\d+)$/);
    if (!m) return null;
    const n = Number(m[2]);
    if (m[1] === "C") {
      const c = comments[n - 1];
      if (!c) return null;
      return {
        id: `yt-${c.id}`,
        platform: "youtube",
        author: c.author,
        avatar: c.avatar,
        text: c.text,
        likes: c.likes,
        url: `https://www.youtube.com/watch?v=${c.videoId}&lc=${c.id}`,
        where: c.videoTitle ? `on “${c.videoTitle.slice(0, 70)}”` : "on YouTube",
        date: c.publishedAt,
      };
    }
    const s = evidence[n - 1];
    if (!s) return null;
    const sub = redditSub(s.url);
    const isReddit = s.domain.includes("reddit.com");
    const isYoutube = s.domain.includes("youtube.com");
    return {
      id: `src-${s.n}`,
      platform: isReddit ? "reddit" : isYoutube ? "youtube" : s.kind === "community" ? "forum" : "review",
      author: isReddit ? (sub ? `r/${sub} member` : "Reddit member") : isYoutube ? "YouTube viewer" : `${s.domain.split(".")[0]} reviewer`,
      avatar: null,
      text: s.snippet,
      likes: 0,
      url: s.url,
      where: isReddit ? (sub ? `in r/${sub}` : "on Reddit") : `on ${s.domain}`,
      date: "",
    };
  };
  const exactMark = (text: string, mark: string) => {
    const mk = str(mark, 90);
    return mk && text.toLowerCase().includes(mk.toLowerCase()) ? mk : "";
  };
  const asksFirst = (text: string) => /^[^.!]{0,140}\?/.test(text.trim());
  const voices: Voice[] = [];
  for (const raw of Array.isArray(d.voices) ? (d.voices as Json[]) : []) {
    const base = refToVoice(str(raw.ref, 8));
    if (!base || voices.some((v) => v.id === base.id)) continue;
    const stance = str(raw.stance, 8);
    const mark = exactMark(base.text, str(raw.mark, 90));
    if ((!mark && !LIVED.test(base.text)) || asksFirst(base.text)) continue;
    voices.push({
      ...base,
      mark,
      stance: stance === "love" || stance === "warn" ? stance : "mixed",
      topic: str(raw.topic, 30),
    });
    if (voices.length >= 10) break;
  }
  const guessStance = (text: string): Voice["stance"] =>
    /\b(stopp\w*|broke|died|dead|return\w*|worst|problem|issue|disappoint\w*|overheat\w*|fake|waste)\b/i.test(text)
      ? "warn"
      : /\b(love|great|best|amazing|perfect|excellent|recommend\w*|happy|solid|reliable)\b/i.test(text)
        ? "love"
        : "mixed";
  const named = new Set(tokens(q).filter((t) => t.length > 2));
  const mentions = (text: string) => tokens(text).some((t) => named.has(t));
  const lived = (text: string, comment = false) =>
    LIVED.test(text) && !/\?\s*$/.test(text) && !asksFirst(text) && (comment ? mentions(text) : overlap(q, text) >= 0.25);
  const padRefs = [
    ...comments.map((c, i) => (lived(c.text, true) ? `C${i + 1}` : "")),
    ...evidence.filter((e) => e.kind !== "web" && lived(e.snippet)).map((e) => `S${e.n}`),
  ].filter(Boolean);
  for (const ref of padRefs) {
    if (voices.length >= 8) break;
    const base = refToVoice(ref);
    if (!base || voices.some((v) => v.id === base.id)) continue;
    voices.push({ ...base, mark: "", stance: guessStance(base.text), topic: "" });
  }
  const reveals = (Array.isArray(d.reveals) ? (d.reveals as Json[]) : [])
    .map((r) => {
      const text = str(r.text, 160);
      const refs = Array.isArray(r.refs) ? (r.refs as unknown[]).map((x) => str(x, 8)) : [];
      const voiceIds = refs.map((x) => refToVoice(x)?.id).filter((x): x is string => Boolean(x));
      return { text, mark: exactMark(text, str(r.mark, 60)), voiceIds };
    })
    .filter((r) => r.text)
    .slice(0, 5);
  const people = {
    voices: voices.length,
    commenters: comments.length,
    ratings: ratingCount || 0,
    discussions: evidence.filter((e) => e.kind === "community").length,
  };

  const images = Array.from(
    new Set(
      [str(kg?.imageUrl, 500), ...offers.map((o) => o.image ?? ""), ...(imgs?.images ?? []).map((i) => i.imageUrl ?? "")].filter((u) =>
        /^https?:\/\//.test(u),
      ),
    ),
  ).slice(0, 8);

  const nameForImages = [identity.brand, identity.name].filter(Boolean).join(" ") || q;
  const gallerySeen = new Set<string>();
  const gallery: Array<{ url: string; title: string; source: string; width: number | null; height: number | null }> = [];
  const addImage = (url: string, title: string, source: string, width?: number, height?: number) => {
    if (!/^https?:\/\//.test(url) || gallerySeen.has(url) || gallery.length >= 14) return;
    gallerySeen.add(url);
    gallery.push({ url, title: str(title, 120), source: str(source, 60), width: width ?? null, height: height ?? null });
  };
  if (kg?.imageUrl) addImage(str(kg.imageUrl, 500), identity.name, "Google");
  for (const im of imgs?.images ?? []) {
    if (!im.imageUrl || (im.title && overlap(nameForImages, im.title) < 0.34)) continue;
    addImage(im.imageUrl, im.title ?? "", im.source ?? domainOf(im.link ?? ""), im.imageWidth, im.imageHeight);
  }
  for (const o of offers) if (o.image) addImage(o.image, o.title, o.seller);

  const variants = (Array.isArray(d.variants) ? (d.variants as Json[]) : [])
    .map((v) => ({ label: str(v.label, 40), kind: str(v.kind, 12) || "model", query: str(v.query, 140) }))
    .filter((v) => v.label && v.query)
    .slice(0, 8);

  const profile = {
    version: PROFILE_VERSION,
    id,
    query: q,
    identity,
    summary: str(d.summary, 300) || evidence[0]?.snippet || "",
    verdict: str(d.verdict, 300),
    consensus: str(d.consensus, 260),
    consensusMark: exactMark(str(d.consensus, 260), str(d.consensus_mark, 90)),
    voices,
    reveals,
    people,
    specs,
    praise,
    complaints,
    bestFor: strList(d.best_for, 4, 90),
    notFor: strList(d.not_for, 3, 90),
    uses: strList(d.uses, 4, 80),
    howToUse: str(d.how_to_use, 400),
    compatibility: str(d.compatibility, 300),
    alternatives: Array.isArray(d.alternatives)
      ? (d.alternatives as Json[]).map((a) => ({ name: str(a.name, 100), reason: str(a.reason, 140) })).filter((a) => a.name).slice(0, 3)
      : [],
    offers: priced.slice(0, 8).map((o) => ({ seller: o.seller, price: o.price, link: o.link, rating: o.rating })),
    priceRange,
    rating: rating ? Math.round(rating * 10) / 10 : null,
    ratingCount: ratingCount || null,
    score,
    confidence,
    band,
    images: images.length ? images : gallery.map((g) => g.url).slice(0, 8),
    gallery,
    variants,
    sources: evidence.map(({ n, title, url, domain, kind }) => ({ n, title, url, domain, kind })),
    verifiedAt: new Date().toISOString(),
    llm: llm.model,
  };

  if (store && llm.data) {
    await store.upsert("product_intel", {
      id,
      query: q,
      name: identity.name,
      brand: identity.brand || null,
      category: identity.category,
      hero_image_url: images[0] ?? null,
      payload: profile,
      confidence,
      verified_at: profile.verifiedAt,
      refresh_after: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  return { cached: false, profile, errors: llm.errors };
}

// ---------------------------------------------------------------------------
// ask — answers only from what real people said about the product(s)

type Db = NonNullable<ReturnType<typeof db>>;

function inList(ids: string[]): string {
  return ids.map((i) => `"${i.replace(/"/g, "")}"`).join(",");
}

async function threadsFor(store: Db, ids: string[], limit: number): Promise<Json[]> {
  const list = inList(ids);
  return store.rows(
    `community_threads?select=*,community_replies(id,author_id,author_name,is_owner,owner_product_id,owner_product_name,body,helpful,created_at)&or=(product_id.in.(${encodeURIComponent(list)}),compare_id.in.(${encodeURIComponent(list)}))&order=last_activity_at.desc&limit=${limit}`,
  );
}

async function runAsk(store: Db, input: { productId: string; compareId?: string; compareIds?: string[]; question: string }) {
  const ids = [...new Set([input.productId, input.compareId, ...(input.compareIds ?? [])].filter(Boolean) as string[])].slice(0, 3);
  const profiles = await Promise.all(ids.map((id) => store.select("product_intel", `id=eq.${encodeURIComponent(id)}`)));
  const payloads = profiles.map((p) => p?.payload as Json | undefined).filter(Boolean) as Json[];

  type Item = { ref: string; author: string; avatar: string | null; platform: string; text: string; product: string; url: string | null };
  const items: Item[] = [];
  const noteRows = ids.length
    ? await store.rows(
        `ownership_notes?select=*&product_id=in.(${encodeURIComponent(inList(ids))})&order=created_at.desc&limit=50`,
      )
    : [];
  for (const n of noteRows) {
    const details = [
      str(n.used_for, 120) ? `used for ${str(n.used_for, 120)}` : "",
      str(n.used_duration, 80) ? `used ${str(n.used_duration, 80)}` : "",
      Number(n.times_bought) > 0 ? `bought/used ${Number(n.times_bought)} time(s)` : "",
      str(n.time_to_problem, 80) ? `problem after ${str(n.time_to_problem, 80)}` : "",
      str(n.time_to_results, 80) ? `results after ${str(n.time_to_results, 80)}` : "",
      Array.isArray(n.issue_tags) && n.issue_tags.length ? `issues: ${(n.issue_tags as string[]).slice(0, 5).join(", ")}` : "",
    ].filter(Boolean).join("; ");
    items.push({
      ref: `N${items.length + 1}`,
      author: `${str(n.author_name, 40)} (verified owner)`,
      avatar: null,
      platform: "sourced",
      text: `Ownership Note “${str(n.title, 120)}”${details ? ` (${details})` : ""}: ${str(n.body, 520)}`,
      product: str(n.product_name, 80),
      url: null,
    });
  }
  for (const p of payloads) {
    const pname = str((p.identity as Json | undefined)?.name, 80) || str(p.query, 80);
    for (const v of (Array.isArray(p.voices) ? p.voices : []) as Json[]) {
      items.push({
        ref: `V${items.length + 1}`,
        author: str(v.author, 60),
        avatar: (v.avatar as string | null) ?? null,
        platform: str(v.platform, 12),
        text: str(v.text, 420),
        product: pname,
        url: (v.url as string | null) ?? null,
      });
    }
    const sources = (Array.isArray(p.sources) ? p.sources : []) as Json[];
    for (const kind of ["praise", "complaints"] as const) {
      for (const c of (Array.isArray(p[kind]) ? p[kind] : []) as Json[]) {
        const src = sources.find((s) => Number(s.n) === Number(c.source));
        items.push({
          ref: `V${items.length + 1}`,
          author: src ? `${str(src.domain, 40)} reviewers` : "Reviewers",
          avatar: null,
          platform: "review",
          text: `${kind === "praise" ? "Praised" : "Complaint"}: ${str(c.text, 200)}`,
          product: pname,
          url: src ? str(src.url, 400) : null,
        });
      }
    }
  }
  const threads = await threadsFor(store, ids, 20);
  for (const t of threads) {
    const pname = str(t.product_name, 80);
    if (str(t.title, 120) || str(t.body, 800)) {
      items.push({
        ref: `M${items.length + 1}`,
        author: `${str(t.author_name, 40)}${t.owner_product_id ? " (verified owner)" : ""}`,
        avatar: null,
        platform: "sourced",
        text: `Post: “${str(t.title, 160)}”${str(t.body, 800) ? ` — ${str(t.body, 800)}` : ""}`,
        product: pname,
        url: null,
      });
    }
    const replies = (Array.isArray(t.community_replies) ? t.community_replies : []) as Json[];
    for (const r of replies.slice(0, 12)) {
      items.push({
        ref: `M${items.length + 1}`,
        author: `${str(r.author_name, 40)}${r.owner_product_id ? " (verified owner)" : r.is_owner ? " (owner)" : ""}`,
        avatar: null,
        platform: "sourced",
        text: `Re “${str(t.title, 120)}”: ${str(r.body, 360)}`,
        product: pname,
        url: null,
      });
    }
  }

  const compare = payloads.length > 1;
  const prompt = `You are Sourced, a community of product owners. Answer the shopper like a well-informed friend,
using ONLY what real people said below. No outside knowledge, no marketing, no guessing.
If the voices don't cover the question, say so plainly and set "enough": false — e.g. "No owner has mentioned heat yet", then share the closest thing people did say, if any.
Talk about "owners" or "people", never "the voices", "the data" or "the provided text".
When possible say how many people back a point ("3 owners mention…"). Keep it to 2-4 short sentences.
${compare ? `The shopper is comparing ${payloads.length} products — be clear which product each point is about.` : ""}

Question: "${input.question}"

What people said (ref | who | product | words):
${items.slice(0, 70).map((i) => `${i.ref} | ${i.author} | ${i.product} | ${i.text}`).join("\n")}

Return JSON:
{"answer":"","mark":"3-9 words copied exactly from your answer — the key takeaway","cites":["V1"],"enough":true,"followups":["",""]}`;

  if (!items.length) return { error: payloads.length ? "no_voices" : "not_investigated" };
  const llm = await callLlm(prompt, 700, 20000);
  const d = (llm.data ?? {}) as Json;
  const answer = str(d.answer, 900);
  const mark = str(d.mark, 90);
  const cites = (Array.isArray(d.cites) ? d.cites : [])
    .map((r) => items.find((i) => i.ref === str(r, 6)))
    .filter((x): x is Item => Boolean(x))
    .slice(0, 6)
    .map(({ ref, ...rest }) => ({ id: ref, ...rest, text: rest.text.slice(0, 240) }));
  const enough = d.enough !== false && Boolean(answer) && cites.length > 0;

  const main = payloads[0] ?? ({ identity: { name: ids[0] }, query: ids[0] } as Json);
  await store.upsert("community_asks", {
    product_id: input.productId,
    product_name: str((main.identity as Json | undefined)?.name, 120),
    compare_id: input.compareId ?? null,
    question: input.question,
    answered: enough,
  });
  await store.upsert("product_events", {
    product_id: input.productId,
    name: str((main.identity as Json | undefined)?.name, 120),
    brand: str((main.identity as Json | undefined)?.brand, 60),
    category: str((main.identity as Json | undefined)?.category, 60),
    image: Array.isArray(main.images) ? str(main.images[0], 500) : null,
    event: "ask",
  });

  return {
    answer: answer || "Nobody has talked about that yet. Ask the community — owners get notified.",
    mark: mark && answer.toLowerCase().includes(mark.toLowerCase()) ? mark : "",
    cites,
    enough,
    basedOn: items.length,
    followups: strList(d.followups, 3, 90),
  };
}

// ---------------------------------------------------------------------------
// compare — what people compare these products for, then a focused, sourced comparison

type CompareItem = { id: string; name: string; category: string };

function compareItems(v: unknown): CompareItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => ({ id: str((x as Json)?.id, 100), name: str((x as Json)?.name, 120), category: str((x as Json)?.category, 60) }))
    .filter((x) => x.name)
    .slice(0, 3);
}

const aspectCache = new Map<string, { at: number; aspects: Json[] }>();

async function runCompareAspects(items: CompareItem[]) {
  const key = items.map((i) => i.name.toLowerCase()).sort().join("|");
  const hit = aspectCache.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return { aspects: hit.aspects, cached: true };

  const vs = items.map((i) => i.name).join(" vs ");
  const web = await serper<{ relatedSearches?: Array<{ query?: string }>; peopleAlsoAsk?: Array<{ question?: string }>; organic?: SerperOrganic[] }>(
    "search",
    { q: vs, num: 8 },
  );
  const signals = [
    ...(web?.relatedSearches ?? []).map((r) => str(r.query, 120)),
    ...(web?.peopleAlsoAsk ?? []).map((r) => str(r.question, 160)),
    ...(web?.organic ?? []).map((o) => str(o.title, 140)),
  ].filter(Boolean);

  const prompt = `A shopper wants to compare: ${items.map((i) => `${i.name}${i.category ? ` (${i.category})` : ""}`).join("; ")}.
First understand what kind of products these are. Then list the things people most often compare THESE products on —
concrete, decision-relevant aspects specific to this product type (e.g. phones: "Battery life", "Camera in low light", "Browsing & app speed";
skincare: "Oily skin", "Fragrance", "Price per ml"; shoes: "Cushioning for long runs", "Durability", "Fit & sizing").
Use what people actually search for below when it's relevant. 6 to 8 aspects, most popular first, no duplicates, no generic "Overall quality".

What people search and ask:
${signals.slice(0, 30).map((s) => `- ${s}`).join("\n") || "- (none found)"}

Return JSON: {"kind":"short product type","aspects":[{"label":"2-4 words","why":"one short line on what it decides"}]}`;

  const llm = await callLlm(prompt, 1500, 24000);
  const d = (llm.data ?? {}) as Json;
  const aspects = (Array.isArray(d.aspects) ? d.aspects : [])
    .map((a) => ({ label: str((a as Json)?.label, 40), why: str((a as Json)?.why, 120) }))
    .filter((a) => a.label)
    .slice(0, 8);
  if (aspects.length) aspectCache.set(key, { at: Date.now(), aspects });
  return { kind: str(d.kind, 40), aspects, cached: false, ...(aspects.length ? {} : { errors: llm.errors.slice(0, 4) }) };
}

async function runCompareFocus(store: Db | null, items: CompareItem[], aspect: string) {
  const profiles = store
    ? await Promise.all(items.map((i) => (i.id ? store.select("product_intel", `id=eq.${encodeURIComponent(i.id)}`) : Promise.resolve(null))))
    : items.map(() => null);
  const vs = items.map((i) => i.name).join(" vs ");
  const web = await serper<{ organic?: SerperOrganic[] }>("search", { q: `${vs} ${aspect}`, num: 10 });
  const sources = (web?.organic ?? [])
    .filter((o) => o.link && o.snippet)
    .slice(0, 8)
    .map((o, i) => ({ n: i + 1, title: str(o.title, 140), url: str(o.link, 500), domain: domainOf(String(o.link)), snippet: str(o.snippet, 320) }));

  const known = items.map((item, i) => {
    const p = (profiles[i]?.payload ?? null) as Json | null;
    if (!p) return `${item.name}: (no saved research yet)`;
    const list = (v: unknown, n: number) => (Array.isArray(v) ? (v as Json[]).slice(0, n).map((x) => str(x.text ?? `${str(x.label, 40)}: ${str(x.value, 80)}`, 160)) : []);
    return `${item.name}:
  specs: ${list(p.specs, 14).join(" | ")}
  owners praise: ${list(p.praise, 5).join(" | ")}
  owners complain: ${list(p.complaints, 5).join(" | ")}`;
  });

  const prompt = `Compare these products specifically on "${aspect}": ${items.map((i) => i.name).join(", ")}.
Use ONLY the evidence below. Cite web results by their number. If the evidence doesn't settle it, say so — never invent numbers.
Be concrete (e.g. benchmark results, hours, measurements, what owners report). Plain words, no marketing.

What Sourced already knows:
${known.join("\n")}

Web results for "${vs} ${aspect}":
${sources.map((s) => `[${s.n}] ${s.title} — ${s.snippet}`).join("\n") || "(no web results)"}

Return JSON:
{"summary":"2-3 sentences answering which is better for ${aspect} and why",
"winner":"the exact name of the better product, copied from this list: ${items.map((i) => JSON.stringify(i.name)).join(", ")} — or null if it's a tie or unclear",
"products":[{"verdict":"one short line for this product on ${aspect}","points":["up to 3 short evidence points"],"cites":[1]}],
"enough":true}
"products" must follow the order given.`;

  const llm = await callLlm(prompt, 2000, 28000);
  const d = (llm.data ?? {}) as Json;
  const rows = Array.isArray(d.products) ? (d.products as Json[]) : [];
  const winnerName = str(d.winner, 160).toLowerCase();
  const winnerAt = winnerName ? items.findIndex((i) => i.name.toLowerCase() === winnerName) : -1;
  const winner = winnerAt >= 0 ? winnerAt : winnerName ? items.findIndex((i) => winnerName.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(winnerName)) : -1;
  return {
    aspect,
    summary: str(d.summary, 600) || "There isn’t enough published on this yet to call it.",
    winner: winner >= 0 ? winner : null,
    enough: d.enough !== false && Boolean(str(d.summary, 10)),
    products: items.map((item, i) => {
      const r = (rows[i] ?? {}) as Json;
      return {
        id: item.id,
        name: item.name,
        verdict: str(r.verdict, 200),
        points: strList(r.points, 3, 180),
        cites: (Array.isArray(r.cites) ? r.cites : []).map(Number).filter((n) => sources.some((s) => s.n === n)).slice(0, 4),
      };
    }),
    sources: sources.map(({ snippet: _s, ...rest }) => rest),
  };
}

// ---------------------------------------------------------------------------
// community

type Author = { id: string; name: string };

function authorOf(body: Json): Author | null {
  const a = (body.author ?? {}) as Json;
  const id = str(a.id, 60);
  const name = str(a.name, 40);
  return id && name ? { id, name } : null;
}

type Owned = { product_id: string; product_name: string; product_image: string | null };

function slugTokens(id: string): string[] {
  return id.toLowerCase().split("-").filter((t) => t.length > 0);
}

/** Same product under a slightly different slug (e.g. with or without the brand prefix). */
function sameProduct(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 8) return false;
  const s = slugTokens(short);
  const l = slugTokens(long);
  return s.every((t) => l.includes(t)) && l.length - s.length <= 1;
}

/** The member's verified ownership of any of these products — the only source of "verified owner". */
async function ownedAmong(store: Db, memberId: string, productIds: string[]): Promise<Owned | null> {
  const ids = productIds.filter(Boolean);
  if (!memberId || !ids.length) return null;
  const rows = await store.rows(
    `owner_verifications?select=id,product_id,product_name,product_image&user_id=eq.${encodeURIComponent(memberId)}&status=eq.verified&limit=200`,
  );
  for (const id of ids) {
    const hit = rows.find((r) => sameProduct(String(r.product_id), id));
    if (hit) return { product_id: String(hit.product_id), product_name: String(hit.product_name), product_image: (hit.product_image as string) ?? null };
  }
  return null;
}

async function verificationFor(store: Db, memberId: string, productId: string): Promise<Json | null> {
  if (!memberId || !productId) return null;
  const rows = await store.rows(
    `owner_verifications?select=id,product_id,product_name,product_image,brand,category&user_id=eq.${encodeURIComponent(memberId)}&status=eq.verified&limit=200`,
  );
  return rows.find((r) => sameProduct(String(r.product_id), productId)) ?? null;
}

function ownerMark(owned: Owned | null): Json {
  return {
    is_owner: Boolean(owned),
    owner_product_id: owned?.product_id ?? null,
    owner_product_name: owned?.product_name ?? null,
    owner_product_image: owned?.product_image ?? null,
  };
}

function tooSpammy(text: string): boolean {
  return (text.match(/https?:\/\//g) ?? []).length > 1;
}

const KINDS = ["question", "worry", "experience", "compare", "tip", "review"];

function hotScore(t: Json): number {
  const hours = (Date.now() - +new Date(String(t.created_at))) / 3600_000;
  const lastHours = (Date.now() - +new Date(String(t.last_activity_at ?? t.created_at))) / 3600_000;
  const signal = Number(t.votes ?? 0) * 2 + Number(t.reply_count ?? 0) * 3 + Number(t.follower_count ?? 0) + 1;
  return signal / Math.pow(Math.min(hours, lastHours * 1.5) + 2, 1.35);
}

function searchTerm(raw: unknown): string {
  return str(raw, 60).replace(/[^\p{L}\p{N} '-]+/gu, " ").replace(/\s+/g, " ").trim();
}

async function withFlags(store: Db, threads: Json[], memberId: string): Promise<Json[]> {
  if (!memberId || !threads.length) return threads;
  const ids = threads.map((t) => String(t.id)).join(",");
  const m = encodeURIComponent(memberId);
  const [votes, follows] = await Promise.all([
    store.rows(`community_votes?select=thread_id&member_id=eq.${m}&thread_id=in.(${ids})`),
    store.rows(`community_follows?select=thread_id&member_id=eq.${m}&thread_id=in.(${ids})`),
  ]);
  const voted = new Set(votes.map((v) => String(v.thread_id)));
  const followed = new Set(follows.map((f) => String(f.thread_id)));
  return threads.map((t) => ({ ...t, voted: voted.has(String(t.id)), following: followed.has(String(t.id)) }));
}

async function follow(store: Db, threadId: string, memberId: string, on: boolean): Promise<number> {
  const filter = `thread_id=eq.${encodeURIComponent(threadId)}&member_id=eq.${encodeURIComponent(memberId)}`;
  if (on) await store.insertMany("community_follows", [{ thread_id: threadId, member_id: memberId }]);
  else await store.remove("community_follows", filter);
  const all = await store.rows(`community_follows?select=member_id&thread_id=eq.${encodeURIComponent(threadId)}`);
  await store.patch("community_threads", `id=eq.${encodeURIComponent(threadId)}`, { follower_count: all.length });
  return all.length;
}

async function runSocial(store: Db, action: string, body: Json) {
  const memberId = str(body.memberId, 60) || str(((body.author ?? {}) as Json).id, 60);

  if (action === "feed") {
    const sort = str(body.sort, 8) || "hot";
    const kind = str(body.kind, 12);
    const productId = str(body.productId, 100);
    const q = searchTerm(body.q);
    const limit = Math.min(Number(body.limit) || 30, 60);
    const filters: string[] = [];
    if (KINDS.includes(kind)) filters.push(`kind=eq.${kind}`);
    if (productId) filters.push(`or=(product_id.eq.${encodeURIComponent(productId)},compare_id.eq.${encodeURIComponent(productId)})`);
    if (q) {
      const like = encodeURIComponent(`*${q}*`);
      filters.push(`or=(title.ilike.${like},body.ilike.${like},product_name.ilike.${like},compare_name.ilike.${like},brand.ilike.${like})`);
    }
    const order = sort === "new" ? "created_at.desc" : sort === "top" ? "votes.desc,reply_count.desc" : "last_activity_at.desc";
    const fetchN = sort === "hot" ? 150 : limit;
    let rows = await store.rows(`community_threads?select=*&${filters.join("&")}${filters.length ? "&" : ""}order=${order}&limit=${fetchN}`);
    if (sort === "hot") rows = rows.sort((a, b) => hotScore(b) - hotScore(a)).slice(0, limit);
    return { threads: await withFlags(store, rows, memberId) };
  }

  if (action === "vote") {
    const threadId = str(body.threadId, 60);
    if (!threadId || !memberId) return { error: "missing_vote" };
    const filter = `thread_id=eq.${encodeURIComponent(threadId)}&member_id=eq.${encodeURIComponent(memberId)}`;
    if (body.on === false) await store.remove("community_votes", filter);
    else await store.insertMany("community_votes", [{ thread_id: threadId, member_id: memberId }]);
    const all = await store.rows(`community_votes?select=member_id&thread_id=eq.${encodeURIComponent(threadId)}`);
    await store.patch("community_threads", `id=eq.${encodeURIComponent(threadId)}`, { votes: all.length });
    return { votes: all.length, voted: body.on !== false };
  }

  if (action === "follow") {
    const threadId = str(body.threadId, 60);
    if (!threadId || !memberId) return { error: "missing_follow" };
    const count = await follow(store, threadId, memberId, body.on !== false);
    return { following: body.on !== false, followers: count };
  }

  if (action === "notifications") {
    if (!memberId) return { notifications: [], unread: 0 };
    const rows = await store.rows(
      `community_notifications?select=*&member_id=eq.${encodeURIComponent(memberId)}&order=created_at.desc&limit=50`,
    );
    return { notifications: rows, unread: rows.filter((r) => !r.read).length };
  }

  if (action === "notifications_read") {
    if (!memberId) return { ok: false };
    await store.patch("community_notifications", `member_id=eq.${encodeURIComponent(memberId)}&read=eq.false`, { read: true });
    return { ok: true };
  }

  if (action === "following") {
    if (!memberId) return { threads: [] };
    const follows = await store.rows(`community_follows?select=thread_id&member_id=eq.${encodeURIComponent(memberId)}&order=created_at.desc&limit=60`);
    if (!follows.length) return { threads: [] };
    const rows = await store.rows(`community_threads?select=*&id=in.(${follows.map((f) => f.thread_id).join(",")})&order=last_activity_at.desc`);
    return { threads: await withFlags(store, rows, memberId) };
  }

  if (action === "upload") {
    const b64 = str(body.imageBase64, 9_000_000).replace(/^data:[^,]+,/, "");
    const mime = str(body.mimeType, 30) || "image/jpeg";
    if (!b64 || b64.length > 8_500_000 || !/^image\/(jpeg|png|webp)$/.test(mime)) return { error: "invalid_image" };
    const url = await store.upload("community", b64, mime);
    return url ? { url } : { error: "upload_failed" };
  }

  if (action === "room") {
    const productId = str(body.productId, 100);
    if (!productId) return { error: "missing_product" };
    const pid = encodeURIComponent(productId);
    const [threads, intel, events, owners, notes] = await Promise.all([
      store.rows(`community_threads?select=kind,rating,votes,reply_count,follower_count,created_at&or=(product_id.eq.${pid},compare_id.eq.${pid})&limit=500`),
      store.select("product_intel", `id=eq.${pid}`),
      store.rows(`product_events?select=event,created_at&product_id=eq.${pid}&created_at=gte.${encodeURIComponent(new Date(Date.now() - 30 * 86400_000).toISOString())}&limit=5000`),
      store.rows(`owner_verifications?select=user_id,verified_at&product_id=eq.${pid}&status=eq.verified&order=verified_at.desc&limit=200`),
      store.rows(`ownership_notes?select=*&product_id=eq.${pid}&order=created_at.desc&limit=8`),
    ]);
    const ownerIds = owners.slice(0, 5).map((o) => String(o.user_id));
    const ownerProfiles = ownerIds.length ? await store.rows(`profiles?select=id,display_name&id=in.(${ownerIds.join(",")})`) : [];
    const byKind: Record<string, number> = {};
    for (const t of threads) byKind[String(t.kind)] = (byKind[String(t.kind)] ?? 0) + 1;
    const rated = threads.filter((t) => Number(t.rating) > 0);
    const payload = (intel?.payload ?? null) as Json | null;
    const week = Date.now() - 7 * 86400_000;
    return {
      room: {
        posts: threads.length,
        byKind,
        replies: threads.reduce((a, t) => a + Number(t.reply_count ?? 0), 0),
        followers: threads.reduce((a, t) => a + Number(t.follower_count ?? 0), 0),
        memberRating: rated.length ? Math.round((rated.reduce((a, t) => a + Number(t.rating), 0) / rated.length) * 10) / 10 : null,
        ratedBy: rated.length,
        views30d: events.filter((e) => e.event === "view").length,
        viewsThisWeek: events.filter((e) => e.event === "view" && +new Date(String(e.created_at)) > week).length,
        compares30d: events.filter((e) => e.event === "compare").length,
        verifiedOwners: owners.length,
        owners: ownerIds.map((id) => ({ id, name: str(ownerProfiles.find((p) => String(p.id) === id)?.display_name, 40) || "Member" })),
        ownershipNotes: notes.length,
        notes,
        score: payload?.score ?? null,
        consensus: payload?.consensus ?? null,
        praise: Array.isArray(payload?.praise) ? (payload!.praise as Json[]).slice(0, 3).map((p) => p.text) : [],
        complaints: Array.isArray(payload?.complaints) ? (payload!.complaints as Json[]).slice(0, 3).map((p) => p.text) : [],
      },
    };
  }

  if (action === "member") {
    const id = str(body.profileId, 60);
    if (!id) return { error: "missing_member" };
    const m = encodeURIComponent(id);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const [profile, owned, notes, replies, threads] = await Promise.all([
      uuid ? store.select("profiles", `id=eq.${m}`) : Promise.resolve(null),
      store.rows(`owner_verifications?select=product_id,product_name,brand,category,product_image,verified_at&user_id=eq.${m}&status=eq.verified&order=verified_at.desc&limit=100`),
      store.rows(`ownership_notes?select=*&user_id=eq.${m}&order=created_at.desc&limit=80`),
      store.rows(
        `community_replies?select=id,body,helpful,created_at,is_owner,owner_product_id,owner_product_name,owner_product_image,thread_id,author_name,community_threads(id,title,product_id,product_name,product_image,compare_name)&author_id=eq.${m}&order=created_at.desc&limit=40`,
      ),
      store.rows(
        `community_threads?select=id,title,kind,product_id,product_name,product_image,compare_name,reply_count,votes,created_at,author_name,is_owner,owner_product_id,owner_product_name&author_id=eq.${m}&order=created_at.desc&limit=40`,
      ),
    ]);
    const name = str(profile?.display_name, 40) || str(notes[0]?.author_name, 40) || str(replies[0]?.author_name, 40) || str(threads[0]?.author_name, 40);
    if (!name && !owned.length && !notes.length) return { error: "member_not_found" };
    return {
      member: {
        id,
        name: name || "Member",
        joinedAt: profile?.created_at ?? null,
        owned: owned.map((o) => ({
          productId: o.product_id,
          productName: o.product_name,
          brand: o.brand ?? null,
          category: o.category ?? null,
          productImage: o.product_image ?? null,
          verifiedAt: o.verified_at ?? null,
        })),
        notes,
        replies: replies.map(({ author_name: _a, ...r }) => r),
        threads: threads.map(({ author_name: _a, ...t }) => t),
        stats: {
          answers: replies.length,
          posts: threads.length,
          helpful: replies.reduce((a, r) => a + Number(r.helpful ?? 0), 0) + notes.reduce((a, n) => a + Number(n.helpful ?? 0), 0),
          verified: owned.length,
          notes: notes.length,
        },
      },
    };
  }

  return { error: "unknown_action" };
}

async function runCommunity(store: Db, action: string, body: Json) {
  if (action === "threads") {
    const productId = str(body.productId, 100);
    if (productId) {
      const rows = await threadsFor(store, [productId], 50);
      return { threads: rows };
    }
    const rows = await store.rows(`community_threads?select=*&order=last_activity_at.desc&limit=${Math.min(Number(body.limit) || 20, 50)}`);
    return { threads: rows };
  }

  if (action === "thread") {
    const id = str(body.threadId, 60);
    if (!id) return { error: "missing_thread" };
    const rows = await store.rows(`community_threads?id=eq.${encodeURIComponent(id)}&select=*,community_replies(*)`);
    const [flagged] = await withFlags(store, rows.slice(0, 1), str(body.memberId, 60));
    return { thread: flagged ?? null };
  }

  if (action === "post") {
    const author = authorOf(body);
    const title = str(body.title, 280);
    const productId = str(body.productId, 100);
    const productName = str(body.productName, 160);
    const kind = str(body.kind, 12);
    if (!author) return { error: "missing_author" };
    if (!productId || !productName || title.length < 4) return { error: "invalid_thread" };
    if (tooSpammy(title) || tooSpammy(str(body.body, 2000))) return { error: "links_not_allowed" };
    const owned = await ownedAmong(store, author.id, [productId, str(body.compareId, 100)]);
    const row = await store.insert("community_threads", {
      ...ownerMark(owned),
      product_id: productId,
      product_name: productName,
      product_image: str(body.productImage, 500) || null,
      category: str(body.category, 60) || null,
      kind: KINDS.includes(kind) ? kind : "question",
      title,
      body: str(body.body, 2000) || null,
      compare_id: str(body.compareId, 100) || null,
      compare_name: str(body.compareName, 160) || null,
      compare_image: str(body.compareImage, 500) || null,
      author_id: author.id,
      author_name: author.name,
      image_url: /^https:\/\//.test(str(body.imageUrl, 500)) ? str(body.imageUrl, 500) : null,
      rating: Number(body.rating) >= 1 && Number(body.rating) <= 5 ? Math.round(Number(body.rating)) : null,
      brand: str(body.brand, 60) || null,
      follower_count: 1,
    });
    if (!row) return { error: "post_failed" };
    await store.insertMany("community_follows", [{ thread_id: row.id, member_id: author.id }]);
    await store.upsert("product_events", {
      product_id: productId,
      name: productName,
      category: str(body.category, 60) || null,
      image: str(body.productImage, 500) || null,
      event: "thread",
    });
    return { thread: { ...row, community_replies: [] } };
  }

  if (action === "ownership_note") {
    const author = authorOf(body);
    const productId = str(body.productId, 100);
    const productName = str(body.productName, 160);
    const title = str(body.title, 160);
    const text = str(body.body, 2400);
    if (!author) return { error: "missing_author" };
    if (!productId || !productName || title.length < 4 || text.length < 8) return { error: "invalid_note" };
    if (tooSpammy(title) || tooSpammy(text)) return { error: "links_not_allowed" };
    const verification = await verificationFor(store, author.id, productId);
    if (!verification) return { error: "verification_required" };
    const milestone = str(body.milestone, 20);
    const row = await store.insert("ownership_notes", {
      user_id: author.id,
      author_name: author.name,
      product_id: productId,
      product_name: productName,
      product_image: str(body.productImage, 500) || verification.product_image || null,
      brand: str(body.brand, 60) || verification.brand || null,
      category: str(body.category, 60) || verification.category || null,
      verification_id: verification.id,
      milestone: ["first_note", "one_week", "one_month", "three_months", "six_months", "one_year", "after_problem", "update"].includes(milestone) ? milestone : "first_note",
      title,
      body: text,
      used_for: str(body.usedFor, 200) || null,
      used_duration: str(body.usedDuration, 80) || null,
      times_bought: Number(body.timesBought) >= 0 ? Math.min(999, Math.round(Number(body.timesBought))) : null,
      rating: Number(body.rating) >= 1 && Number(body.rating) <= 5 ? Math.round(Number(body.rating)) : null,
      would_rebuy: typeof body.wouldRebuy === "boolean" ? body.wouldRebuy : null,
      time_to_problem: str(body.timeToProblem, 80) || null,
      time_to_results: str(body.timeToResults, 80) || null,
      positive_tags: strList(body.positiveTags, 8, 40),
      issue_tags: strList(body.issueTags, 8, 40),
      context_tags: strList(body.contextTags, 8, 40),
    });
    if (!row) return { error: "note_failed" };
    await store.upsert("product_events", {
      product_id: productId,
      name: productName,
      category: str(body.category, 60) || null,
      image: str(body.productImage, 500) || null,
      event: "thread",
    });
    return { note: row };
  }

  if (action === "reply") {
    const author = authorOf(body);
    const threadId = str(body.threadId, 60);
    const text = str(body.body, 2000);
    if (!author) return { error: "missing_author" };
    if (!threadId || text.length < 2) return { error: "invalid_reply" };
    if (tooSpammy(text)) return { error: "links_not_allowed" };
    const thread = await store.select("community_threads", `id=eq.${encodeURIComponent(threadId)}`);
    if (!thread) return { error: "thread_not_found" };
    const owned = await ownedAmong(store, author.id, [str(thread.product_id, 100), str(thread.compare_id, 100)]);
    const reply = await store.insert("community_replies", {
      thread_id: threadId,
      author_id: author.id,
      author_name: author.name,
      ...ownerMark(owned),
      body: text,
    });
    if (!reply) return { error: "reply_failed" };
    await store.patch("community_threads", `id=eq.${encodeURIComponent(threadId)}`, {
      reply_count: Number(thread.reply_count ?? 0) + 1,
      last_activity_at: new Date().toISOString(),
    });
    const followers = await store.rows(`community_follows?select=member_id&thread_id=eq.${encodeURIComponent(threadId)}`);
    await store.insertMany(
      "community_notifications",
      followers
        .map((f) => String(f.member_id))
        .filter((m) => m && m !== author.id)
        .map((m) => ({
          member_id: m,
          thread_id: threadId,
          actor_name: author.name,
          kind: owned ? "owner_reply" : "reply",
          snippet: text.slice(0, 140),
          thread_title: str(thread.title, 140),
          product_name: str(thread.product_name, 120),
        })),
    );
    await follow(store, threadId, author.id, true);
    if (flags.whatsappNotifications) {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const jobs = followers
        .map((f) => String(f.member_id))
        .filter((m) => uuid.test(m) && m !== author.id)
        .map((m) => ({
          kind: "notify",
          idempotency_key: `reply:${reply.id}:${m}`,
          payload: {
            userId: m,
            type: "community_reply",
            entityId: threadId,
            payload: { actor: author.name, product: str(thread.product_name, 120), threadUrl: `${publicUrl()}/thread/${threadId}`, threadPath: `thread/${threadId}` },
          },
        }));
      if (jobs.length) await store.insertMany("integration_jobs", jobs).catch(() => undefined);
    }
    return { reply };
  }

  if (action === "helpful") {
    const replyId = str(body.replyId, 60);
    const row = await store.select("community_replies", `id=eq.${encodeURIComponent(replyId)}`);
    if (!row) return { error: "reply_not_found" };
    await store.patch("community_replies", `id=eq.${encodeURIComponent(replyId)}`, { helpful: Number(row.helpful ?? 0) + 1 });
    return { ok: true };
  }

  return { error: "unknown_action" };
}

async function runPulse(store: Db, category: string) {
  const since = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const [trending, recentProfiles, asks, threads, notes, events] = await Promise.all([
    store.rpc("trending_products", { days: 14, cat: category || null, lim: 30 }),
    store.rows(`product_intel?select=id,name,brand,category,hero_image_url,verified_at,payload->voices,payload->score&order=verified_at.desc&limit=40`),
    store.rows(`community_asks?select=product_id,product_name,compare_id,question,answered,created_at&order=created_at.desc&limit=20`),
    store.rows(`community_threads?select=*&order=last_activity_at.desc&limit=40`),
    store.rows(`ownership_notes?select=*&order=created_at.desc&limit=20`),
    store.rows(`product_events?select=product_id,event&created_at=gte.${encodeURIComponent(since(24 * 7))}&limit=2000`),
  ]);
  const list = trending.map((t) => ({
    id: str(t.product_id, 100),
    name: str(t.name, 140),
    brand: str(t.brand, 60),
    category: str(t.category, 60),
    image: str(t.image, 500) || null,
    views: Number(t.views ?? 0),
    asks: Number(t.asks ?? 0),
    threads: Number(t.threads ?? 0),
    compares: Number(t.compares ?? 0),
    heat: Number(t.heat ?? 0),
  }));
  for (const p of recentProfiles) {
    if (list.length >= 30) break;
    const id = str(p.id, 100);
    if (!id || list.some((x) => x.id === id)) continue;
    if (category && str(p.category, 60).toLowerCase() !== category.toLowerCase()) continue;
    list.push({
      id,
      name: str(p.name, 140),
      brand: str(p.brand, 60),
      category: str(p.category, 60),
      image: str(p.hero_image_url, 500) || null,
      views: 0,
      asks: 0,
      threads: 0,
      compares: 0,
      heat: 0,
    });
  }
  const people = new Set(events.map((e) => e.product_id)).size;
  const voices: Json[] = [];
  for (const p of recentProfiles) {
    const vs = (Array.isArray(p.voices) ? (p.voices as Json[]) : [])
      .filter((v) => str(v.text, 600).length > 40)
      .sort((a, b) => Number(b.likes ?? 0) - Number(a.likes ?? 0))
      .slice(0, 2);
    for (const v of vs) {
      voices.push({
        ...v,
        text: str(v.text, 600),
        product_id: str(p.id, 100),
        product_name: str(p.name, 140),
        product_image: str(p.hero_image_url, 500) || null,
        category: str(p.category, 60),
        score: p.score ?? null,
      });
    }
  }
  voices.sort((a, b) => Number(b.likes ?? 0) - Number(a.likes ?? 0));
  return {
    voices: voices.slice(0, 40),
    trending: list,
    asks,
    threads,
    notes: category ? notes.filter((n) => str(n.category, 60).toLowerCase() === category.toLowerCase()) : notes,
    stats: {
      productsResearched: people,
      actionsThisWeek: events.length,
      questionsAsked: asks.length,
    },
  };
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Json | null = null;
  try {
    body = (await req.json()) as Json;
  } catch {
    body = null;
  }
  if (!body) return json({ error: "missing_body" }, 400);
  if (!secret("SERPER_API_KEY")) return json({ error: "missing_serper_key" }, 503);

  const action = str(body.action, 20);
  const query = str(body.query, 160);
  const country = (str(body.country, 4) || "ng").toLowerCase();

  if (action === "health") {
    const gKey = secret("GEMINI_API_KEY") || secret("GOOGLE_API_KEY");
    const orKey = secret("OPENROUTER_API_KEY");
    const gemini = gKey
      ? await withTimeout(
          fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200`, { headers: { "x-goog-api-key": gKey } }).then(async (r) => {
            const j = (await r.json().catch(() => ({}))) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
            return {
              status: r.status,
              models: (j.models ?? [])
                .filter((m) => m.supportedGenerationMethods?.includes("generateContent") && /flash|pro/.test(m.name))
                .map((m) => m.name.replace("models/", "")),
            };
          }),
          8000,
        )
      : null;
    const openrouter = orKey
      ? await withTimeout(
          fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${orKey}` } }).then(async (r) => ({
            status: r.status,
            body: ((await r.json().catch(() => ({}))) as Json).data ?? null,
          })),
          8000,
        )
      : null;
    return json({
      gemini: gemini ?? "no_key",
      openrouter: openrouter ?? "no_key",
      youtube: Boolean(secret("YOUTUBE_DATA_API_KEY")),
      nvidia: Boolean(secret("NVIDIA_API_KEY")),
      geminiModel: secret("GEMINI_MODEL") || null,
      openrouterModel: secret("OPENROUTER_TEXT_MODEL") || null,
      probes: gKey && Array.isArray(body.probe)
        ? await Promise.all(
            (body.probe as unknown[]).slice(0, 6).map(async (m) => {
              const model = str(m, 60);
              const t = Date.now();
              const r = await withTimeout(
                fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "x-goog-api-key": gKey },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Reply with JSON {"ok":true}' }] }],
                    generationConfig: { responseMimeType: "application/json" },
                  }),
                }).then(async (res) => ({ status: res.status, body: (await res.text()).slice(0, 160) })),
                15000,
              );
              return { model, ms: Date.now() - t, ...(r ?? { status: 0, body: "timeout" }) };
            }),
          )
        : null,
    });
  }

  try {
    if (action === "search") {
      if (!query) return json({ error: "missing_query" }, 400);
      return json({ success: true, ...(await runSearch(query, country)) });
    }

    if (action === "investigate") {
      const productId = str(body.productId, 100) || undefined;
      const name = str(body.name, 140);
      const brand = str(body.brand, 80);
      const q = query || [brand, name].filter(Boolean).join(" ");
      if (!q) return json({ error: "missing_query" }, 400);
      return json({ success: true, ...(await runInvestigate({ query: q, productId, force: body.force === true, country })) });
    }

    if (action === "get") {
      const productId = str(body.productId, 100);
      const store = db();
      if (!productId || !store) return json({ error: "missing_product" }, 400);
      const hit = await store.select("product_intel", `id=eq.${encodeURIComponent(productId)}`);
      return json({ success: Boolean(hit), profile: hit?.payload ?? null });
    }

    if (action === "compare_aspects" || action === "compare_focus") {
      const items = compareItems(body.products);
      if (items.length < 2) return json({ error: "need_two_products" }, 400);
      if (action === "compare_aspects") return json({ success: true, ...(await runCompareAspects(items)) });
      const aspect = str(body.aspect, 60);
      if (aspect.length < 2) return json({ error: "missing_aspect" }, 400);
      return json({ success: true, ...(await runCompareFocus(db(), items, aspect)) });
    }

    const store = db();
    if (!store) return json({ error: "storage_unavailable" }, 503);

    // Community identity comes only from the verified Supabase session, never from the body.
    if (COMMUNITY_ACTIONS.has(action)) {
      delete body.memberId;
      delete body.author;
      const user = await userFromRequest(req);
      if (user) {
        const profile = await store.select("profiles", `id=eq.${encodeURIComponent(user.id)}`);
        const name = str(profile?.display_name, 40) || str(user.email?.split("@")[0], 40) || "Member";
        body.memberId = user.id;
        body.author = { id: user.id, name };
      } else if (MEMBER_ONLY_ACTIONS.has(action)) {
        return json({ error: "sign_in_required" }, 401);
      }
    }

    if (action === "ask") {
      const productId = str(body.productId, 100);
      const question = str(body.question, 400);
      if (!productId || question.length < 3) return json({ error: "missing_question" }, 400);
      const out = await runAsk(store, { productId, question, compareId: str(body.compareId, 100) || undefined, compareIds: strList(body.compareIds, 2, 100) });
      return json({ success: !("error" in out), ...out });
    }

    if (["threads", "thread", "post", "reply", "ownership_note", "helpful"].includes(action)) {
      const out = (await runCommunity(store, action, body)) as Json;
      return json({ success: !out.error, ...out }, out.error ? 400 : 200);
    }

    if (["feed", "vote", "follow", "notifications", "notifications_read", "following", "upload", "room", "member"].includes(action)) {
      const out = (await runSocial(store, action, body)) as Json;
      return json({ success: !out.error, ...out }, out.error ? 400 : 200);
    }

    if (action === "track") {
      const productId = str(body.productId, 100);
      const event = str(body.event, 12);
      if (!productId || !["view", "compare", "save"].includes(event)) return json({ error: "invalid_event" }, 400);
      await store.upsert("product_events", {
        product_id: productId,
        name: str(body.name, 140) || null,
        brand: str(body.brand, 60) || null,
        category: str(body.category, 60) || null,
        image: str(body.image, 500) || null,
        event,
      });
      return json({ success: true });
    }

    if (action === "pulse") {
      return json({ success: true, ...(await runPulse(store, str(body.category, 60))) });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    return json({ error: "internal_error", message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

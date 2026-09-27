import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const PROFILE_VERSION = 3;

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
type SerperImage = { title?: string; imageUrl?: string; link?: string; source?: string };

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
    serper<{ images?: SerperImage[] }>("images", { q: `${q}`, num: 10 }),
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
 "identity_confidence": 0.0
}
Limits: specs ≤ 8, praise ≤ 5, complaints ≤ 5, best_for ≤ 4, not_for ≤ 3, uses ≤ 4, alternatives ≤ 3, voices ≤ 10, reveals ≤ 5.`;

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
    images,
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
    `community_threads?select=*,community_replies(id,author_name,is_owner,body,helpful,created_at)&or=(product_id.in.(${encodeURIComponent(list)}),compare_id.in.(${encodeURIComponent(list)}))&order=last_activity_at.desc&limit=${limit}`,
  );
}

async function runAsk(store: Db, input: { productId: string; compareId?: string; question: string }) {
  const ids = [input.productId, input.compareId].filter(Boolean) as string[];
  const profiles = await Promise.all(ids.map((id) => store.select("product_intel", `id=eq.${encodeURIComponent(id)}`)));
  const payloads = profiles.map((p) => p?.payload as Json | undefined).filter(Boolean) as Json[];
  if (!payloads.length) return { error: "not_investigated" };

  type Item = { ref: string; author: string; avatar: string | null; platform: string; text: string; product: string; url: string | null };
  const items: Item[] = [];
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
    const replies = (Array.isArray(t.community_replies) ? t.community_replies : []) as Json[];
    for (const r of replies.slice(0, 12)) {
      items.push({
        ref: `M${items.length + 1}`,
        author: `${str(r.author_name, 40)}${r.is_owner ? " (owner)" : ""}`,
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
${compare ? "The shopper is comparing two products — be clear which product each point is about." : ""}

Question: "${input.question}"

What people said (ref | who | product | words):
${items.slice(0, 70).map((i) => `${i.ref} | ${i.author} | ${i.product} | ${i.text}`).join("\n")}

Return JSON:
{"answer":"","mark":"3-9 words copied exactly from your answer — the key takeaway","cites":["V1"],"enough":true,"followups":["",""]}`;

  const llm = items.length ? await callLlm(prompt, 700, 20000) : { data: null, model: null, errors: ["no_voices"] };
  const d = (llm.data ?? {}) as Json;
  const answer = str(d.answer, 900);
  const mark = str(d.mark, 90);
  const cites = (Array.isArray(d.cites) ? d.cites : [])
    .map((r) => items.find((i) => i.ref === str(r, 6)))
    .filter((x): x is Item => Boolean(x))
    .slice(0, 6)
    .map(({ ref, ...rest }) => ({ id: ref, ...rest, text: rest.text.slice(0, 240) }));
  const enough = d.enough !== false && Boolean(answer) && cites.length > 0;

  const main = payloads[0];
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
// community

type Author = { id: string; name: string };

function authorOf(body: Json): Author | null {
  const a = (body.author ?? {}) as Json;
  const id = str(a.id, 60);
  const name = str(a.name, 40);
  return id && name ? { id, name } : null;
}

function tooSpammy(text: string): boolean {
  return (text.match(/https?:\/\//g) ?? []).length > 1;
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
    return { thread: rows[0] ?? null };
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
    const row = await store.insert("community_threads", {
      product_id: productId,
      product_name: productName,
      product_image: str(body.productImage, 500) || null,
      category: str(body.category, 60) || null,
      kind: ["question", "worry", "experience", "compare"].includes(kind) ? kind : "question",
      title,
      body: str(body.body, 2000) || null,
      compare_id: str(body.compareId, 100) || null,
      compare_name: str(body.compareName, 160) || null,
      compare_image: str(body.compareImage, 500) || null,
      author_id: author.id,
      author_name: author.name,
    });
    if (!row) return { error: "post_failed" };
    await store.upsert("product_events", {
      product_id: productId,
      name: productName,
      category: str(body.category, 60) || null,
      image: str(body.productImage, 500) || null,
      event: "thread",
    });
    return { thread: { ...row, community_replies: [] } };
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
    const reply = await store.insert("community_replies", {
      thread_id: threadId,
      author_id: author.id,
      author_name: author.name,
      is_owner: body.isOwner === true,
      body: text,
    });
    if (!reply) return { error: "reply_failed" };
    await store.patch("community_threads", `id=eq.${encodeURIComponent(threadId)}`, {
      reply_count: Number(thread.reply_count ?? 0) + 1,
      last_activity_at: new Date().toISOString(),
    });
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
  const [trending, recentProfiles, asks, threads, events] = await Promise.all([
    store.rpc("trending_products", { days: 14, cat: category || null, lim: 30 }),
    store.rows(`product_intel?select=id,name,brand,category,hero_image_url,verified_at&order=verified_at.desc&limit=40`),
    store.rows(`community_asks?select=product_id,product_name,compare_id,question,answered,created_at&order=created_at.desc&limit=20`),
    store.rows(`community_threads?select=id,product_id,product_name,product_image,kind,title,author_name,reply_count,compare_name,created_at,last_activity_at&order=last_activity_at.desc&limit=12`),
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
  return {
    trending: list,
    asks,
    threads,
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

    const store = db();
    if (!store) return json({ error: "storage_unavailable" }, 503);

    if (action === "ask") {
      const productId = str(body.productId, 100);
      const question = str(body.question, 400);
      if (!productId || question.length < 3) return json({ error: "missing_question" }, 400);
      const out = await runAsk(store, { productId, question, compareId: str(body.compareId, 100) || undefined });
      return json({ success: !("error" in out), ...out });
    }

    if (["threads", "thread", "post", "reply", "helpful"].includes(action)) {
      const out = (await runCommunity(store, action, body)) as Json;
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

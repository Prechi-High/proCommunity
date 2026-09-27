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
const PROFILE_VERSION = 2;

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
  };
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

async function callLlm(prompt: string, maxTokens: number, timeoutMs: number): Promise<LlmResult> {
  const errors: string[] = [];
  const orKey = secret("OPENROUTER_API_KEY");
  const gKey = secret("GEMINI_API_KEY") || secret("GOOGLE_API_KEY");
  const deadline = Date.now() + timeoutMs;

  if (orKey) {
    const models = Array.from(
      new Set(
        [secret("OPENROUTER_TEXT_MODEL"), "anthropic/claude-haiku-4.5", "openai/gpt-4.1-mini", "google/gemini-2.5-flash"].filter(
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

  if (gKey) {
    const left = deadline - Date.now();
    if (left > 2500) {
      const res = await withTimeout(
        fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": gKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: maxTokens,
              responseMimeType: "application/json",
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }),
        left,
      );
      if (!res) errors.push("gemini:timeout");
      else if (!res.ok) errors.push(`gemini:http_${res.status}`);
      else {
        const body = (await res.json().catch(() => null)) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        } | null;
        const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        const data = parseJsonLoose(text);
        if (data) return { data, model: "gemini-2.5-flash", errors };
        errors.push("gemini:unparseable");
      }
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
  const [overview, reviews, reddit, shop, imgs] = await Promise.all([
    serper<{ organic?: SerperOrganic[]; knowledgeGraph?: Json }>("search", { q: `${q} specifications features`, num: 8 }),
    serper<{ organic?: SerperOrganic[] }>("search", { q: `${q} review pros cons problems`, num: 8 }),
    serper<{ organic?: SerperOrganic[] }>("search", { q: `${q} reddit experience`, num: 6 }),
    shopping(q, input.country),
    serper<{ images?: SerperImage[] }>("images", { q: `${q}`, num: 10 }),
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
  const evidence = sources.slice(0, 20);

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

Rules: use only the evidence and well-established public facts about this exact product. Never invent numbers.
Each praise/complaint/spec should cite the source number it came from when possible. Keep phrases short and plain.
Work for ANY product type (electronics, appliances, clothing, food, tools, cosmetics, vehicles, software...).

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
 "identity_confidence": 0.0
}
Limits: specs ≤ 8, praise ≤ 5, complaints ≤ 5, best_for ≤ 4, not_for ≤ 3, uses ≤ 4, alternatives ≤ 3.`;

  const llm = evidence.length ? await callLlm(prompt, 2200, 28000) : { data: null, model: null, errors: ["no_evidence"] };
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

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    return json({ error: "internal_error", message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

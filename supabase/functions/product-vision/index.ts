import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { verifyOwner } from "./verify.ts";

/**
 * product-vision
 *
 * Identifies any product (brand + name + category) from a photo via a multimodal LLM.
 * Send `format: "json"` to receive { label, brand, name, category }; otherwise plain text.
 * Provider order: OPENROUTER (gateway with many vision models) → GEMINI native → NVIDIA NIM.
 * All keys live in Supabase Edge secrets — never EXPO_PUBLIC_*.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PROMPT =
  "Identify the product brand and specific product name shown in this image. " +
  "Works for any product type (electronics, appliances, food, drinks, tools, clothing, toys, cosmetics, etc.). " +
  "Read any visible text on the packaging or device. " +
  "Return only a clean search-ready query string with no explanation, no commentary, no JSON, no markdown. " +
  "Format example: Anker Nano 20W USB-C Charger";

const JSON_PROMPT =
  "You are identifying a physical product in a photo so a shopper can research it. " +
  "Read all visible text, logos, model numbers and packaging. Works for any product type " +
  "(electronics, appliances, food, drinks, tools, clothing, toys, vehicles parts, cosmetics...). " +
  'Reply with JSON only: {"brand":"","name":"","model":"","category":"","confidence":0.0}. ' +
  '"name" is the specific product name without the brand; "category" is a short general type like "Wireless earbuds" or "Blender". ' +
  'If no product is visible, reply {"brand":"","name":"","category":"","confidence":0}.';

const PER_CALL_TIMEOUT_MS = 14000;
const GLOBAL_TIMEOUT_MS = 45000;

const TEXT_ONLY_MODELS = new Set([
  "meta/llama-3.1-8b-instruct",
  "meta/llama-3.1-70b-instruct",
  "meta/llama-3.1-405b-instruct",
  "meta/llama-3-8b-instruct",
  "meta/llama-3-70b-instruct",
  "meta/llama-2-70b-chat",
  "mistralai/mistral-7b-instruct",
  "mistralai/mixtral-8x7b-instruct",
  "mistralai/mixtral-8x22b-instruct",
  "anthropic/claude-3-opus",
  "anthropic/claude-3-sonnet",
  "gpt-3.5-turbo",
  "gpt-4",
  "gpt-4-turbo",
]);

function isLikelyVisionModel(model: string): boolean {
  const m = model.toLowerCase();
  if (TEXT_ONLY_MODELS.has(m) || TEXT_ONLY_MODELS.has(model)) return false;
  if (m.includes("vision") || m.includes("neva") || m.includes("llava") || m.includes("glyph")) return true;
  if (m.includes("gemini") || m.includes("gpt-4o") || m.includes("gpt-4.1") || m.includes("gpt-5")) return true;
  if (m.startsWith("claude-4.") || m.startsWith("claude-5") || m.includes("claude-4.5") || m.includes("claude-3.5")) return true;
  if (m.includes("phi-3.5") || m.includes("phi-3-vision") || m.includes("minicpm")) return true;
  if (m.includes("qwen") && m.includes("vl")) return true;
  if (m.includes("deepseek") && (m.includes("v4.1") || m.includes("vision"))) return true;
  return true;
}

function secretValue(name: string): string {
  return (Deno.env.get(name) ?? "").trim().replace(/^["']|["']$/g, "");
}

function inferMime(fileName?: string, fallback = "image/jpeg"): string {
  const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "gif": return "image/gif";
    default: return fallback;
  }
}

function parseDataUri(uri: string): { b64: string; mime: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(uri);
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

function cleanLabel(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim();
  text = text.replace(/^["'`]+|["'`]+$/g, "");
  text = text.replace(/^(brand|product|name|result|answer)\s*[:\-]\s*/i, "");
  text = text.replace(/\.$/, "");
  const lowered = text.toLowerCase();
  if (looksLikeJson(text)) return "";
  if (!text || lowered === "null" || lowered === "unknown" || lowered === "n/a" || text.length < 3) return "";
  // Reject model refusals / hedges that are not product names.
  if (
    /\b(cannot|can't|unable|could not|couldn'?t|not able)\b.*\b(identify|determine|tell|recognize|read)\b/i.test(text) ||
    /\bno (clear |visible )?(product|brand|label)\b/i.test(text) ||
    /\bi('m| am) (not )?(sure|unable|sorry)\b/i.test(text) ||
    /\bas an ai\b/i.test(text)
  ) {
    return "";
  }
  return text.slice(0, 140);
}

function extractErrCode(body: string, status: number, prefix: string): string {
  const code =
    body.match(/"code"\s*:\s*"([^"]+)"/)?.[1] ??
    body.match(/"status"\s*:\s*"([^"]+)"/)?.[1] ??
    body.match(/"type"\s*:\s*"([^"]+)"/)?.[1] ??
    body.match(/error["']?\s*[:=]\s*["']([^"'\n]{1,80})/)?.[1] ??
    "";
  return `${prefix}_http_${status}${code ? `:${code}` : ""}`.slice(0, 160);
}

type Attempt = {
  provider: "openrouter" | "gemini" | "nvidia";
  label: string;
  http?: number;
  output: string;
  outputLength: number;
  err?: string;
};

async function withTimeout<T>(p: Promise<T>, ms: number, tag: string): Promise<{ ok: true; val: T } | { ok: false; tag: string }> {
  let id: number | undefined;
  const tp = new Promise<{ ok: false; tag: string }>((r) => {
    id = setTimeout(() => r({ ok: false, tag }), ms) as unknown as number;
  });
  const r = await Promise.race([
    p.then((v) => ({ ok: true as const, val: v })),
    tp,
  ]);
  if (id !== undefined) clearTimeout(id);
  return r;
}

async function tryOpenRouter(
  b64: string,
  mime: string,
  prompt: string,
  model: string,
  key: string,
  label: string,
): Promise<Attempt> {
  const dataUri = `data:${mime};base64,${b64}`;
  const r = await withTimeout(
    fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": Deno.env.get("PUBLIC_SITE_ORIGIN")?.trim() || "https://pro-community.vercel.app",
        "X-Title": "Sourced",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUri, detail: "auto" } },
            ],
          },
        ],
      }),
    }),
    PER_CALL_TIMEOUT_MS,
    label,
  );
  if (!r.ok) return { provider: "openrouter", label, output: "", outputLength: 0, err: `${label}_timeout` };
  try {
    if (!r.val.ok) {
      const txt = await r.val.text().catch(() => "");
      return { provider: "openrouter", label, http: r.val.status, output: "", outputLength: 0, err: extractErrCode(txt, r.val.status, label) };
    }
    const j = (await r.val.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const txt = j.choices?.[0]?.message?.content ?? "";
    return { provider: "openrouter", label, http: r.val.status, output: txt, outputLength: txt.length, err: txt ? undefined : `${label}_empty` };
  } catch (e) {
    return { provider: "openrouter", label, output: "", outputLength: 0, err: `${label}_ex:${e instanceof Error ? e.message : String(e)}`.slice(0, 160) };
  }
}

async function tryGeminiVariant(
  b64: string,
  mime: string,
  prompt: string,
  variant: { api: "v1" | "v1beta"; model: string; style: "camel" | "snake" },
  key: string,
  label: string,
): Promise<Attempt> {
  const part = variant.style === "camel"
    ? { inlineData: { mimeType: mime, data: b64 } }
    : { inline_data: { mime_type: mime, data: b64 } };
  const url = `https://generativelanguage.googleapis.com/${variant.api}/models/${encodeURIComponent(variant.model)}:generateContent`;
  const r = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              part,
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 3072 },
      }),
    }),
    PER_CALL_TIMEOUT_MS,
    label,
  );
  if (!r.ok) return { provider: "gemini", label, output: "", outputLength: 0, err: `${label}_timeout` };
  try {
    if (!r.val.ok) {
      const txt = await r.val.text().catch(() => "");
      return { provider: "gemini", label, http: r.val.status, output: "", outputLength: 0, err: extractErrCode(txt, r.val.status, label) };
    }
    const j = (await r.val.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
    };
    const out = j.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join(" ").trim() ?? "";
    return { provider: "gemini", label, http: r.val.status, output: out, outputLength: out.length, err: out ? undefined : `${label}_empty` };
  } catch (e) {
    return { provider: "gemini", label, output: "", outputLength: 0, err: `${label}_ex:${e instanceof Error ? e.message : String(e)}`.slice(0, 160) };
  }
}

async function tryNvidiaVariant(
  b64: string,
  mime: string,
  prompt: string,
  url: string,
  model: string,
  key: string,
  label: string,
): Promise<Attempt> {
  const dataUri = `data:${mime};base64,${b64}`;
  const r = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 120,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUri, detail: "low" } },
            ],
          },
        ],
      }),
    }),
    PER_CALL_TIMEOUT_MS,
    label,
  );
  if (!r.ok) return { provider: "nvidia", label, output: "", outputLength: 0, err: `${label}_timeout` };
  try {
    if (!r.val.ok) {
      const txt = await r.val.text().catch(() => "");
      return { provider: "nvidia", label, http: r.val.status, output: "", outputLength: 0, err: extractErrCode(txt, r.val.status, label) };
    }
    const j = (await r.val.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const txt = j.choices?.[0]?.message?.content ?? "";
    return { provider: "nvidia", label, http: r.val.status, output: txt, outputLength: txt.length, err: txt ? undefined : `${label}_empty` };
  } catch (e) {
    return { provider: "nvidia", label, output: "", outputLength: 0, err: `${label}_ex:${e instanceof Error ? e.message : String(e)}`.slice(0, 160) };
  }
}

type VisionResult = {
  label: string;
  attempts: Attempt[];
  keyLengths: { or: number; g: number; nv: number };
  noVisionKey?: boolean;
};

async function runVisionPipeline(b64: string, mime: string, prompt: string, debug: boolean): Promise<VisionResult> {
  const attempts: Attempt[] = [];
  let labelOut = "";
  const openRouterKey = secretValue("OPENROUTER_API_KEY");
  const geminiKey = secretValue("GEMINI_API_KEY") || secretValue("GOOGLE_API_KEY");
  const nvidiaKey = secretValue("NVIDIA_API_KEY") || secretValue("NGC_API_KEY");

  // Check if no vision keys are configured
  if (!openRouterKey && !geminiKey && !nvidiaKey) {
    return { label: "", attempts, keyLengths: { or: 0, g: 0, nv: 0 }, noVisionKey: true };
  }

  if (geminiKey) {
    const gPref = Deno.env.get("GEMINI_MODEL")?.trim();
    // gemini-1.x / 2.0 / 2.5 are retired for this project and return 404.
    const rawG = [
      gPref && !/^gemini-(1\.|2\.0|2\.5)/.test(gPref) ? gPref : null,
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
    ].filter(Boolean) as string[];
    for (const m of Array.from(new Set(rawG))) {
      const v = { api: "v1beta" as const, model: m, style: "camel" as const };
      const a = await tryGeminiVariant(b64, mime, prompt, v, geminiKey, `g_${m.replace(/[^a-z0-9_-]/gi, "_")}`);
      attempts.push(a);
      if (a.outputLength > 0 && !a.err) {
        labelOut = a.output;
        break;
      }
    }
  }

  if (!labelOut && openRouterKey) {
    const pref = Deno.env.get("OPENROUTER_MODEL")?.trim();
    const rawModels = [pref && !/gemini-2\.5/i.test(pref) ? pref : null, "anthropic/claude-haiku-4.5"].filter(Boolean) as string[];
    const orModels = Array.from(new Set(rawModels.filter((m) => isLikelyVisionModel(m)))).slice(0, 2);
    for (const model of orModels) {
      const a = await tryOpenRouter(b64, mime, prompt, model, openRouterKey, `or_${model.replace(/[^a-z0-9_-]/gi, "_")}`);
      attempts.push(a);
      if (a.outputLength > 0 && !a.err) {
        labelOut = a.output;
        break;
      }
    }
  }

  if (!labelOut && nvidiaKey) {
    const pref = Deno.env.get("NVIDIA_MODEL")?.trim();
    const rawNv = [pref, "microsoft/phi-3.5-vision-instruct", "nvidia/neva-22b"].filter(Boolean) as string[];
    const nvModels = Array.from(new Set(rawNv.filter((m) => isLikelyVisionModel(m)))).slice(0, 2);
    const nvUrls: Array<{ tag: string; url: string }> = [
      { tag: "int", url: "https://integrate.api.nvidia.com/v1/chat/completions" },
      { tag: "ai", url: "https://ai.api.nvidia.com/v1/chat/completions" },
    ];
    for (const u of nvUrls) {
      for (const model of nvModels) {
        const label = `nv_${u.tag}_${model.replace(/[^a-z0-9_-]/gi, "_")}`;
        const a = await tryNvidiaVariant(b64, mime, prompt, u.url, model, nvidiaKey, label);
        attempts.push(a);
        if (a.outputLength > 0 && !a.err) {
          labelOut = a.output;
          break;
        }
      }
      if (labelOut) break;
    }
  }

  void debug;
  return { label: labelOut, attempts, keyLengths: { or: openRouterKey.length, g: geminiKey.length, nv: nvidiaKey.length } };
}

// ---------------------------------------------------------------------------
// Exact identification: photo → storage → (Gemini read ∥ Google Lens visual matches) → reconcile.

const EXACT_PROMPT = `You are an expert product identifier — part Google Lens, part veteran store clerk.
Identify the EXACT product in this photo so a shopper can find that precise item.
Use every cue, not only printed labels: logos, product shape and silhouette, materials, textures, buttons, ports,
stitching, sole pattern, cap/nozzle shape, packaging layout and colours, colourway, size markings, model numbers.
If text is partly hidden, infer from distinctive design. Name the specific model/generation and variant
(size, capacity, volume, colour, flavour, scent, storage) whenever visible or inferable.
Return JSON only:
{"brand":"","name":"product line + model, without the brand","model":"model number/code if known","variant":"size/colour/capacity etc","category":"short general type e.g. Wireless earbuds, Running shoes, Face serum","visible_text":[""],"features":["short distinguishing visual cues"],"search_query":"the most specific shopping query for this exact item","alternatives":["up to 3 other exact products it could be"],"confidence":0.0,"products":[]}
The top-level fields describe the most prominent product.
ALWAYS fill "products" with EVERY distinct product visible in the photo, most prominent first, at most 6 — including the main one.
Count different items (e.g. a phone, earbuds and a perfume on a table are 3 products); do not count several units of the
same item, parts or accessories of one product, or furniture/background. If an item has no visible brand, still include it
with a descriptive "name" (e.g. "Stainless steel water bottle"):
[{"brand":"","name":"","model":"","category":"","search_query":"","box_2d":[ymin,xmin,ymax,xmax],"confidence":0.0}] with box_2d on a 0-1000 scale.
If no product is visible return {"brand":"","name":"","confidence":0}.`;

const DETECT_PROMPT = `List EVERY distinct product visible in this photo, most prominent first, at most 6.
Count different items (a phone, earbuds and a perfume on a table are 3 products). Do not count several units of the same item,
parts or accessories of one product, or furniture/background. Unbranded items still count — give a descriptive name.
Return JSON only:
{"products":[{"brand":"","name":"product line + model, without brand","model":"","category":"short general type","search_query":"most specific shopping query","box_2d":[ymin,xmin,ymax,xmax],"confidence":0.0}]}
box_2d is on a 0-1000 scale. If there is no product return {"products":[]}.`;

type Detected = { label: string; brand: string; name: string; model: string; category: string; searchQuery: string; box: number[] | null; confidence: number };

function toDetected(v: unknown): Detected[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: Detected[] = [];
  for (const raw of v.slice(0, 8)) {
    const j = (raw ?? {}) as Record<string, unknown>;
    const brand = str(j.brand, 60);
    let name = str(j.name, 120);
    if (brand && name.toLowerCase().startsWith(brand.toLowerCase() + " ")) name = name.slice(brand.length).trim();
    const label = [brand, name || str(j.model, 60) || str(j.category, 50)].filter(Boolean).join(" ");
    const key = label.toLowerCase();
    if (!label || looksLikeJson(label) || seen.has(key)) continue;
    seen.add(key);
    const box = Array.isArray(j.box_2d) && j.box_2d.length === 4 ? j.box_2d.map((n) => Math.max(0, Math.min(1000, Number(n) || 0))) : null;
    out.push({
      label,
      brand,
      name: name || label,
      model: str(j.model, 60),
      category: str(j.category, 50),
      searchQuery: str(j.search_query, 140) || label,
      box: box && box[2] > box[0] && box[3] > box[1] ? box : null,
      confidence: Math.max(0, Math.min(1, Number(j.confidence) || 0.6)),
    });
  }
  return out.slice(0, 6);
}

type Lens = { title: string; source: string; link: string; image: string };
type Exact = {
  brand: string;
  name: string;
  model: string;
  variant: string;
  category: string;
  searchQuery: string;
  features: string[];
  alternatives: string[];
  confidence: number;
  matchIndexes: number[];
};

function str(v: unknown, max = 160): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function looksLikeJson(text: string): boolean {
  return /[{}]|"\s*:/.test(text);
}

/** Tolerates code fences, truncation and prose around the object; never hands raw JSON back as a label. */
function looseObject(raw: string): Record<string, unknown> | null {
  const stripped = raw.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  if (start < 0) return null;
  const body = stripped.slice(start);
  const end = body.lastIndexOf("}");
  if (end > 0) {
    try {
      return JSON.parse(body.slice(0, end + 1)) as Record<string, unknown>;
    } catch {
      // fall through to field extraction
    }
  }
  const out: Record<string, unknown> = {};
  for (const m of body.matchAll(/"([a-z_]+)"\s*:\s*("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?)/gi)) {
    try {
      out[m[1]] = JSON.parse(m[2]);
    } catch {
      // skip
    }
  }
  return Object.keys(out).length ? out : null;
}

function toExact(j: Record<string, unknown> | null): Exact | null {
  if (!j) return null;
  const list = (v: unknown, n: number) => (Array.isArray(v) ? v.map((x) => str(x, 90)).filter(Boolean).slice(0, n) : []);
  const brand = str(j.brand, 60);
  let name = str(j.name, 120);
  if (brand && name.toLowerCase().startsWith(brand.toLowerCase() + " ")) name = name.slice(brand.length).trim();
  if (!brand && !name) return null;
  return {
    brand,
    name,
    model: str(j.model, 60),
    variant: str(j.variant, 60),
    category: str(j.category, 50),
    searchQuery: str(j.search_query, 140),
    features: list(j.features, 5),
    alternatives: list(j.alternatives, 3),
    confidence: Math.max(0, Math.min(1, Number(j.confidence) || 0.6)),
    matchIndexes: Array.isArray(j.match_indexes) ? j.match_indexes.map(Number).filter((n) => Number.isInteger(n) && n >= 0) : [],
  };
}

function geminiOrder(): string[] {
  const pref = Deno.env.get("GEMINI_MODEL")?.trim();
  return Array.from(
    new Set([pref && !/^gemini-(1\.|2\.0|2\.5)/.test(pref) ? pref : "", "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"].filter(Boolean)),
  );
}

async function geminiJson(key: string, parts: unknown[], budgetMs: number): Promise<{ data: Record<string, unknown> | null; model: string; errors: string[] }> {
  const errors: string[] = [];
  const deadline = Date.now() + budgetMs;
  for (const model of geminiOrder()) {
    const left = deadline - Date.now();
    if (left < 2000) break;
    const r = await withTimeout(
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: "application/json" },
        }),
      }),
      Math.min(left, 16000),
      model,
    );
    if (!r.ok) {
      errors.push(`${model}:timeout`);
      continue;
    }
    if (!r.val.ok) {
      errors.push(`${model}:http_${r.val.status}`);
      continue;
    }
    const j = (await r.val.json().catch(() => null)) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
    } | null;
    const text = j?.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
    const data = looseObject(text);
    if (data) return { data, model, errors };
    errors.push(`${model}:unparseable`);
  }
  return { data: null, model: "", errors };
}

async function uploadScan(b64: string, mime: string): Promise<string | null> {
  const base = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key) return null;
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
    const r = await fetch(`${base}/storage/v1/object/scans/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": mime, "x-upsert": "true" },
      body: bytes,
    });
    return r.ok ? `${base}/storage/v1/object/public/scans/${path}` : null;
  } catch {
    return null;
  }
}

async function lens(url: string): Promise<Lens[]> {
  const key = secretValue("SERPER_API_KEY");
  if (!key) return [];
  const r = await withTimeout(
    fetch("https://google.serper.dev/lens", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ url, gl: "us", hl: "en" }),
    }),
    12000,
    "lens",
  );
  if (!r.ok || !r.val.ok) return [];
  const j = (await r.val.json().catch(() => null)) as Record<string, unknown> | null;
  const rows = (j?.organic ?? j?.visual_matches ?? j?.visualMatches ?? []) as Array<Record<string, unknown>>;
  return rows
    .map((o) => ({
      title: str(o.title, 140),
      source: str(o.source, 60),
      link: str(o.link, 500),
      image: str(o.imageUrl ?? o.thumbnailUrl ?? o.thumbnail, 500),
    }))
    .filter((o) => o.title)
    .slice(0, 16);
}

async function identifyExact(b64: string, mime: string, gKey: string) {
  const image = { inlineData: { mimeType: mime, data: b64 } };
  const upload = uploadScan(b64, mime);
  const [first, detect, matches] = await Promise.all([
    geminiJson(gKey, [{ text: EXACT_PROMPT }, image], 20000),
    geminiJson(gKey, [{ text: DETECT_PROMPT }, image], 16000),
    upload.then((u) => (u ? lens(u) : [])),
  ]);
  const imageUrl = await upload;
  let exact = toExact(first.data);
  const errors = [...first.errors];
  let model = first.model;
  // Single reads miss items now and then; a dedicated listing pass runs alongside and the fuller list wins.
  const fromExact = toDetected(first.data?.products);
  const fromDetect = toDetected(detect.data?.products);
  const withBoxes = (l: Detected[]) => l.filter((d) => d.box).length;
  const detected =
    fromDetect.length > fromExact.length || (fromDetect.length === fromExact.length && withBoxes(fromDetect) > withBoxes(fromExact)) ? fromDetect : fromExact;
  console.log(JSON.stringify({ ev: "vision_exact", model, detected: detected.length, exactList: fromExact.length, detectList: fromDetect.length, lens: matches.length, errors }));
  if (detected.length > 1) return { exact, matches, imageUrl, errors, model, detected };

  if (matches.length) {
    const reconcile = `You identified a product from this photo. Your first read: ${JSON.stringify(first.data ?? {}).slice(0, 900)}
Google Lens visual matches for the same photo (index: title — source):
${matches.map((m, i) => `${i}: ${m.title} — ${m.source}`).join("\n")}

Decide the EXACT product in the photo. Trust what is visibly printed on the item first, then names repeated across several
visual matches, then design cues. Ignore matches that are accessories, lookalikes or different generations unless they
match the photo. Return JSON only:
{"brand":"","name":"product line + model, without brand","model":"","variant":"","category":"","search_query":"most specific shopping query","alternatives":[""],"confidence":0.0,"match_indexes":[indices of matches that show this exact product]}`;
    const second = await geminiJson(gKey, [{ text: reconcile }, image], 16000);
    errors.push(...second.errors);
    const refined = toExact(second.data);
    if (refined) {
      exact = { ...refined, features: exact?.features ?? [] };
      model = second.model || model;
    }
  }
  return { exact, matches, imageUrl, errors, model, detected: [] as Detected[] };
}

function exactLabel(e: Exact): string {
  const label = cleanLabel([e.brand, e.name || e.model].filter(Boolean).join(" "));
  return label && !looksLikeJson(label) ? label : "";
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  let body:
    | { imageBase64?: string; imageDataUri?: string; mimeType?: string; fileName?: string; prompt?: string; format?: string; action?: string; source?: string; product?: Record<string, unknown> }
    | null = null;
  try { body = (await req.json()) as typeof body; } catch { body = null; }
  if (!body) return json({ error: "missing_body" }, 400);

  let b64 = "";
  let mime = inferMime(body.fileName, body.mimeType ?? "image/jpeg");
  if (body.imageDataUri) {
    const parsed = parseDataUri(body.imageDataUri);
    if (!parsed) return json({ error: "invalid_image_data_uri" }, 400);
    b64 = parsed.b64; mime = parsed.mime;
  } else if (body.imageBase64) {
    b64 = body.imageBase64;
  } else {
    return json({ error: "missing_image" }, 400);
  }
  if (!b64) return json({ error: "empty_image" }, 400);

  if (body.action === "verify_owner") {
    const out = await verifyOwner(req, body as Record<string, unknown>, b64, mime, geminiJson, secretValue("GEMINI_API_KEY") || secretValue("GOOGLE_API_KEY"));
    return json(out.body, out.status);
  }

  const wantsJson = body.format === "json";
  const prompt = (body.prompt?.trim() && body.prompt.length >= 8) ? body.prompt : wantsJson ? JSON_PROMPT : DEFAULT_PROMPT;

  const gKey = secretValue("GEMINI_API_KEY") || secretValue("GOOGLE_API_KEY");
  if (wantsJson && gKey && !body.prompt) {
    const out = await withTimeout(identifyExact(b64, mime, gKey), GLOBAL_TIMEOUT_MS, "exact");
    if (out.ok && out.val.detected.length > 1 && !(out.val.exact && exactLabel(out.val.exact))) {
      const top = out.val.detected[0];
      return json({
        label: top.label,
        brand: top.brand,
        name: top.name,
        model: top.model,
        category: top.category,
        confidence: top.confidence,
        searchQuery: top.searchQuery,
        imageUrl: out.val.imageUrl,
        matches: [],
        products: out.val.detected,
      });
    }
    if (!out.ok || !out.val.exact) console.log(JSON.stringify({ ev: "vision_exact_failed", timeout: !out.ok, errors: out.ok ? out.val.errors : [] }));
    if (out.ok && out.val.exact) {
      const e = out.val.exact;
      const label = exactLabel(e);
      if (label) {
        const picked = e.matchIndexes.map((i) => out.val.matches[i]).filter(Boolean);
        const rest = out.val.matches.filter((m) => !picked.includes(m));
        return json({
          label,
          brand: e.brand,
          name: e.name || label,
          model: e.model,
          variant: e.variant,
          category: e.category,
          confidence: e.confidence,
          searchQuery: e.searchQuery && !looksLikeJson(e.searchQuery) ? e.searchQuery : label,
          features: e.features,
          alternatives: e.alternatives,
          imageUrl: out.val.imageUrl,
          matches: [...picked, ...rest].slice(0, 12).map((m) => ({ ...m, exact: picked.includes(m) })),
          products: out.val.detected,
          ...(debug ? { errors: out.val.errors, llm: out.val.model, build: "detect-pass-2" } : {}),
        });
      }
    }
  }

  let timedOut = false;
  let timeoutId: number | undefined;
  const timeoutP = new Promise<{ timedOut: true }>((r) => {
    timeoutId = setTimeout(() => r({ timedOut: true }), GLOBAL_TIMEOUT_MS) as unknown as number;
  });
  const runP = runVisionPipeline(b64, mime, prompt, debug).then((x) => ({ ...x, timedOut: false }));
  const res = await Promise.race([runP, timeoutP]);
  if (timeoutId !== undefined) clearTimeout(timeoutId);
  timedOut = "timedOut" in res && res.timedOut === true;

  if (timedOut) {
    return json({ error: "vision_timeout", hint: "Vision providers took too long. Try the photo again." }, 503);
  }

  const { label, attempts, keyLengths, noVisionKey } = res as Awaited<ReturnType<typeof runVisionPipeline>>;

  const structured = wantsJson ? parseStructured(label) : null;
  const cleaned = structured ? structured.label : cleanLabel(label);
  const failed = !cleaned;
  
  // Return no_vision_llm if no keys are configured
  if (noVisionKey) {
    return json({
      error: "no_vision_llm",
      hint: "No vision LLM keys configured. Set GEMINI_API_KEY, OPENROUTER_API_KEY, or NVIDIA_API_KEY in Supabase Edge secrets.",
      attempts: [],
      keyLengths: { or: 0, g: 0, nv: 0 },
    }, 503);
  }
  
  if (debug) {
    return json({
      label: cleaned || null,
      ok: !failed,
      attempts,
      keyLengths,
      error: failed ? "vision_empty_output" : undefined,
      hint: failed ? "Providers returned no usable label. Try a clearer photo." : undefined,
    }, failed ? 503 : 200);
  }
  if (failed) {
    return json({
      error: "vision_empty_output",
      hint: "Could not identify a clear product in this photo. Try a closer, well-lit shot.",
      attempts: attempts.slice(0, 8),
    }, 503);
  }
  if (wantsJson) {
    return json({
      label: cleaned,
      brand: structured?.brand ?? "",
      name: structured?.name ?? cleaned,
      model: structured?.model ?? "",
      category: structured?.category ?? "",
      confidence: structured?.confidence ?? 0.6,
    });
  }
  return text(cleaned, 200);
});

function parseStructured(raw: string): { label: string; brand: string; name: string; model: string; category: string; confidence: number } | null {
  const obj = looseObject(raw);
  if (!obj) {
    const fallback = cleanLabel(raw);
    return fallback ? { label: fallback, brand: "", name: fallback, model: "", category: "", confidence: 0.5 } : null;
  }
  try {
    const j = obj;
    const s = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
    const brand = s(j.brand);
    const name = s(j.name);
    const model = s(j.model);
    const joined = [brand, name && name.toLowerCase().startsWith(brand.toLowerCase()) ? name.slice(brand.length).trim() : name]
      .filter(Boolean)
      .join(" ");
    const label = cleanLabel(joined || model);
    if (!label) return null;
    return { label, brand, name: name || label, model, category: s(j.category), confidence: Number(j.confidence) || 0.6 };
  } catch {
    const fallback = cleanLabel(raw);
    return fallback ? { label: fallback, brand: "", name: fallback, model: "", category: "", confidence: 0.5 } : null;
  }
}

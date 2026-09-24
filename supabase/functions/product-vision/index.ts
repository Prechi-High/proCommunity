import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * product-vision
 *
 * Identifies a skincare product brand + name from a photo via a multimodal LLM.
 * Provider order: OPENROUTER (gateway with many vision models) → GEMINI native → NVIDIA NIM.
 * All keys live in Supabase Edge secrets — never EXPO_PUBLIC_*.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PROMPT =
  "Identify the skincare product brand and specific product name shown in this image. " +
  "Return only a clean search-ready query string with no explanation, no commentary, no JSON, no markdown. " +
  "Format example: CeraVe Foaming Facial Cleanser";

const PER_CALL_TIMEOUT_MS = 7000;
const GLOBAL_TIMEOUT_MS = 28000;

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
  text = text.replace(/^(brand|product|name|result|answer|skincare)\s*[:\-]\s*/i, "");
  text = text.replace(/\.$/, "");
  const lowered = text.toLowerCase();
  if (!text || lowered === "null" || lowered === "unknown" || lowered === "n/a" || text.length < 3) return "";
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
        generationConfig: { temperature: 0.1, maxOutputTokens: 120 },
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
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    };
    const out = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join(" ") ?? "";
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

  if (openRouterKey) {
    const pref = Deno.env.get("OPENROUTER_MODEL")?.trim();
    const rawModels = [pref, "google/gemini-2.5-flash", "deepseek/deepseek-v4.1-flash", "anthropic/claude-4.5-haiku-20251001"].filter(Boolean) as string[];
    const orModels = Array.from(new Set(rawModels.filter((m) => isLikelyVisionModel(m)))).slice(0, 4);
    for (const model of orModels) {
      const a = await tryOpenRouter(b64, mime, prompt, model, openRouterKey, `or_${model.replace(/[^a-z0-9_-]/gi, "_")}`);
      attempts.push(a);
      if (a.outputLength > 0 && !a.err) {
        labelOut = a.output;
        break;
      }
    }
  }

  if (!labelOut && geminiKey) {
    const variants: Array<{ api: "v1" | "v1beta"; model: string; style: "camel" | "snake" }> = [];
    const gPref = Deno.env.get("GEMINI_MODEL")?.trim();
    const rawG = [gPref, "gemini-2.5-flash", "gemini-3.5-flash", "gemini-3-flash-preview"].filter(Boolean) as string[];
    const gModels = Array.from(new Set(rawG.filter((m) => isLikelyVisionModel(m)))).slice(0, 3);
    for (const m of gModels) {
      variants.push({ api: "v1", model: m, style: "camel" });
      variants.push({ api: "v1beta", model: m, style: "snake" });
    }
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const a = await tryGeminiVariant(b64, mime, prompt, v, geminiKey, `g_${v.api}_${v.model.replace(/[^a-z0-9_-]/gi, "_")}_${v.style}`);
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
    | { imageBase64?: string; imageDataUri?: string; mimeType?: string; fileName?: string; prompt?: string }
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

  const prompt = (body.prompt?.trim() && body.prompt.length >= 8) ? body.prompt : DEFAULT_PROMPT;

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

  const cleaned = cleanLabel(label);
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
  return text(cleaned, 200);
});

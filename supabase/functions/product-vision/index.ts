import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * product-vision
 *
 * Identifies a skincare product brand + name from a photo via a multimodal LLM.
 * Uses the EXACT SAME secrets chain as discover-video-content:
 *   GEMINI_API_KEY (or GOOGLE_API_KEY) → OPENROUTER_API_KEY → NVIDIA_API_KEY.
 * All of those live as Supabase Edge Function secrets — never EXPO_PUBLIC_*.
 *
 * Input JSON (POST):
 *   { imageBase64: string; mimeType?: string; fileName?: string; prompt?: string }
 *   or { imageDataUri: string; prompt?: string }
 *
 * Output (text/plain):
 *   Clean "Brand Product Name" search string.
 *   On error: 5xx JSON { error, hint? }.
 *
 * Called by:
 *   - Expo app's /api/product-vision Vercel proxy (default)
 *   - or directly: POST https://<project-ref>.supabase.co/functions/v1/product-vision
 *       (with Authorization: Bearer <anon key>)
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PROMPT =
  "Identify the skincare product brand and specific product name shown in this image. " +
  "Return only a clean search-ready query string with no explanation, no commentary, no JSON, no markdown. " +
  "Format example: CeraVe Foaming Facial Cleanser";

function secretValue(name: string): string {
  return (Deno.env.get(name) ?? "").trim().replace(/^["']|["']$/g, "");
}

function inferMime(fileName?: string, fallback = "image/jpeg"): string {
  const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "heic":
    case "heif":
      return fallback;
    case "jpg":
    case "jpeg":
    default:
      return fallback;
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

function llmErrorCode(body: string, status: number, prefix: string): string {
  const code =
    body.match(/"code"\s*:\s*"([^"]+)"/)?.[1] ??
    body.match(/"status"\s*:\s*"([^"]+)"/)?.[1] ??
    body.match(/"type"\s*:\s*"([^"]+)"/)?.[1] ??
    "";
  return `${prefix}_http_${status}${code ? `:${code}` : ""}`.slice(0, 120);
}

async function callGeminiVision(b64: string, mime: string, prompt: string): Promise<string> {
  const key = secretValue("GEMINI_API_KEY") || secretValue("GOOGLE_API_KEY");
  if (!key) return "";
  const preferred = Deno.env.get("GEMINI_MODEL")?.trim();
  const models = [...new Set([preferred, "gemini-2.5-flash", "gemini-2.0-flash"].filter(Boolean))] as string[];
  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
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
                  { inline_data: { mime_type: mime, data: b64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 120,
            },
          }),
        },
      );
      if (!response.ok) {
        const errTxt = await response.text().catch(() => "");
        if (response.status === 404 || response.status === 400) continue;
        throw new Error(llmErrorCode(errTxt, response.status, "gemini_vision"));
      }
      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
      if (text) return text;
    } catch {
      /* try next model */
    }
  }
  return "";
}

async function callOpenAiVisionCompatible(
  b64: string,
  mime: string,
  prompt: string,
  opts: {
    name: string;
    url: string;
    key: string;
    model: string;
    extraHeaders?: Record<string, string>;
  },
): Promise<string> {
  if (!opts.key) return "";
  try {
    const dataUri = `data:${mime};base64,${b64}`;
    const response = await fetch(opts.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.key}`,
        ...(opts.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: opts.model,
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
    });
    if (!response.ok) {
      throw new Error(llmErrorCode(await response.text().catch(() => ""), response.status, opts.name));
    }
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}

/**
 * Providers in order, exactly the same chain as discover-video-content:
 *   Gemini (native vision) → OpenRouter (any vision model) → NVIDIA NIM.
 * Any one of these secrets set = works.
 */
async function callVision(b64: string, mime: string, prompt: string): Promise<string> {
  const attempts: Array<() => Promise<string>> = [
    () => callGeminiVision(b64, mime, prompt),
    () =>
      callOpenAiVisionCompatible(b64, mime, prompt, {
        name: "openrouter_vision",
        url: "https://openrouter.ai/api/v1/chat/completions",
        key: secretValue("OPENROUTER_API_KEY"),
        model: Deno.env.get("OPENROUTER_MODEL")?.trim() || "openai/gpt-4o-mini",
        extraHeaders: {
          "HTTP-Referer": Deno.env.get("PUBLIC_SITE_ORIGIN")?.trim() || "https://pro-community.vercel.app",
          "X-Title": "Sourced",
        },
      }),
    () =>
      callOpenAiVisionCompatible(b64, mime, prompt, {
        name: "nvidia_vision",
        url: "https://integrate.api.nvidia.com/v1/chat/completions",
        key: secretValue("NVIDIA_API_KEY") || secretValue("NGC_API_KEY"),
        model: Deno.env.get("NVIDIA_MODEL")?.trim() || "meta/llama-3.1-8b-instruct",
      }),
  ];

  for (const attempt of attempts) {
    const text = await attempt();
    if (text) return text;
  }
  return "";
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let body:
    | { imageBase64?: string; imageDataUri?: string; mimeType?: string; fileName?: string; prompt?: string }
    | null = null;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = null;
  }

  if (!body) return json({ error: "missing_body" }, 400);

  let b64 = "";
  let mime = "image/jpeg";
  if (body.imageDataUri) {
    const parsed = parseDataUri(body.imageDataUri);
    if (!parsed) return json({ error: "invalid_image_data_uri" }, 400);
    b64 = parsed.b64;
    mime = parsed.mime;
  } else if (body.imageBase64) {
    b64 = body.imageBase64;
    mime = body.mimeType || inferMime(body.fileName);
  } else {
    return json({ error: "missing_image" }, 400);
  }

  if (!b64) return json({ error: "empty_image" }, 400);

  const prompt = (body.prompt && body.prompt.trim()) || DEFAULT_PROMPT;

  const raw = await callVision(b64, mime, prompt);
  if (!raw) {
    return json(
      {
        error: "no_vision_llm",
        hint: "Set GEMINI_API_KEY or OPENROUTER_API_KEY or NVIDIA_API_KEY in Supabase Edge Function secrets (same secrets as discover-video-content).",
      },
      503,
    );
  }

  const cleaned = cleanLabel(raw);
  if (!cleaned) {
    return json({ error: "vision_empty_output", raw: raw.slice(0, 200) }, 502);
  }

  return text(cleaned, 200);
});

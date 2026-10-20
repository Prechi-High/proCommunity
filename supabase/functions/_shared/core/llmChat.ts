type Json = Record<string, unknown>;

export type LlmUsage = { inputTokens: number; outputTokens: number; thinkingTokens: number };
export type LlmResult = { data: Json | null; model: string | null; errors: string[]; usage?: LlmUsage };
export function readLlmUsage(body: Json | null): LlmUsage | undefined {
  const u = (body?.usageMetadata ?? body?.usage) as Json | undefined;
  if (!u) return undefined;
  const n = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;
  return { inputTokens: n(u.promptTokenCount ?? u.prompt_tokens),
    outputTokens: n(u.candidatesTokenCount ?? u.completion_tokens),
    thinkingTokens: n(u.thoughtsTokenCount) };
}

function secret(name: string): string {
  return (Deno.env.get(name) ?? "").trim().replace(/^["']|["']$/g, "");
}

export function parseJsonLoose(text: string): Json | null {
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

/** Bound both response headers and body; abort upstream work on timeout. */
export async function requestLlmJson(url: string, init: RequestInit, ms: number): Promise<{ ok: boolean; status: number; body: Json | null } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, ms));
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = response.ok ? await response.json() as Json : null;
    const usage = readLlmUsage(body);
    console.info(JSON.stringify({ event: "llm_request_usage", status: response.status,
      model: body?.modelVersion ?? body?.model ?? null, usage: usage ?? null }));
    return { ok: response.ok, status: response.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let geminiBackoffUntil = 0;
let openRouterBackoffUntil = 0;

const RETIRED_GEMINI = /^gemini-(1\.|2\.0|2\.5)/;

function geminiModels(): string[] {
  const pref = secret("GEMINI_MODEL");
  return Array.from(
    new Set(
      [
        pref && !RETIRED_GEMINI.test(pref) ? pref : "",
        "gemini-3-flash-preview",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash",
        "gemini-flash-latest",
      ].filter(Boolean),
    ),
  );
}

function nvidiaModels(): string[] {
  return Array.from(
    new Set(
      [secret("NVIDIA_TEXT_MODEL"), secret("NVIDIA_MODEL"), "nvidia/nemotron-3.5-lightning-30b-a3b"].filter(model => Boolean(model) && !["meta/llama-3.1-8b-instruct", "meta/llama-3.3-70b-instruct"].includes(model)),
    ),
  );
}

async function callGemini(
  apiKey: string,
  prompt: string,
  maxTokens: number,
  deadline: number,
  errors: string[],
): Promise<LlmResult | null> {
  for (const model of geminiModels()) {
    const left = deadline - Date.now();
    if (left < 2500) break;
    const res = await requestLlmJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: maxTokens + 2048,
            ...(/^gemini-3/.test(model) ? { thinkingConfig: { thinkingLevel: /flash-lite|^gemini-3-flash-preview$/.test(model) ? "minimal" : "low" } } : {}),
            responseMimeType: "application/json",
          },
        }),
      },
      Math.min(left, Math.max(4000, Math.min(12000, Math.floor(left * 0.6)))),
    );
    if (!res) {
      errors.push(`${model}:timeout`);
      geminiBackoffUntil = Date.now() + 60000;
      if (secret("OPENROUTER_API_KEY") || secret("NVIDIA_API_KEY") || secret("NGC_API_KEY")) break;
      continue;
    }
    if (!res.ok) {
      errors.push(`${model}:http_${res.status}`);
      if ([429, 500, 502, 503, 504].includes(res.status)) { geminiBackoffUntil = Date.now() + 60000; break; }
      continue;
    }
    const body = res.body as {
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
    } | null;
    const candidate = body?.candidates?.[0];
    const text = candidate?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
    const data = parseJsonLoose(text);
    if (data) return { data, model, errors, usage: readLlmUsage(res.body) };
    errors.push(`${model}:unparseable:${candidate?.finishReason ?? "none"}`);
  }
  return null;
}

async function callNvidia(
  apiKey: string,
  prompt: string,
  maxTokens: number,
  deadline: number,
  errors: string[],
): Promise<LlmResult | null> {
  for (const model of nvidiaModels()) {
    const left = deadline - Date.now();
    if (left < 2500) break;
    const res = await requestLlmJson("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: maxTokens,
          ...(model.includes("nemotron-3.5-lightning") ? { chat_template_kwargs: { enable_thinking: false } } : {}),
          messages: [
            { role: "system", content: "Reply with one valid JSON object only. No markdown." },
            { role: "user", content: prompt },
          ],
        }),
      },
      Math.min(left, 18000),
    );
    if (!res) {
      errors.push(`nvidia/${model}:timeout`);
      continue;
    }
    if (!res.ok) {
      errors.push(`nvidia/${model}:http_${res.status}`);
      continue;
    }
    const body = res.body as { choices?: Array<{ message?: { content?: string } }> } | null;
    const data = parseJsonLoose(body?.choices?.[0]?.message?.content ?? "");
    if (data) return { data, model: `nvidia/${model}`, errors, usage: readLlmUsage(res.body) };
    errors.push(`nvidia/${model}:unparseable`);
  }
  return null;
}

/** Shared JSON-only LLM call for edge intelligence modules. NVIDIA NIM → Gemini → OpenRouter. Each route retains the shared deadline. */
export async function callLlmJson(prompt: string, maxTokens: number, timeoutMs: number): Promise<LlmResult> {
  const errors: string[] = [];
  const orKey = secret("OPENROUTER_API_KEY");
  const gKey = secret("GEMINI_API_KEY") || secret("GOOGLE_API_KEY");
  const nvKey = secret("NVIDIA_API_KEY") || secret("NGC_API_KEY");
  const deadline = Date.now() + timeoutMs;

  if (nvKey) {
    const out = await callNvidia(nvKey, prompt, maxTokens, deadline, errors);
    if (out?.data) return out;
  }

  if (gKey && (Date.now() >= geminiBackoffUntil || (!orKey && !nvKey))) {
    const out = await callGemini(gKey, prompt, maxTokens, deadline, errors);
    if (out?.data) return out;
  }

  if (orKey && Date.now() >= openRouterBackoffUntil) {
    const models = Array.from(new Set([secret("OPENROUTER_TEXT_MODEL"), "anthropic/claude-haiku-4.5"].filter(Boolean)));
    for (const model of models) {
      const left = deadline - Date.now();
      if (left < 2500) break;
      const res = await requestLlmJson("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${orKey}`,
            "HTTP-Referer": secret("PUBLIC_SITE_ORIGIN") || "https://pro-community.vercel.app",
            "X-Title": "Unmask",
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: maxTokens,
            messages: [
              { role: "system", content: "Reply with one valid JSON object only. No markdown." },
              { role: "user", content: prompt },
            ],
          }),
        },
        Math.min(left, 18000),
      );
      if (!res) {
        errors.push(`${model}:timeout`);
        continue;
      }
      if (!res.ok) {
        errors.push(`${model}:http_${res?.status ?? "timeout"}`);
        if ([401, 402, 403].includes(res.status)) { openRouterBackoffUntil = Date.now() + 300000; break; }
        continue;
      }
      const body = res.body as { choices?: Array<{ message?: { content?: string } }> } | null;
      const data = parseJsonLoose(body?.choices?.[0]?.message?.content ?? "");
      if (data) return { data, model, errors, usage: readLlmUsage(res.body) };
      errors.push(`${model}:unparseable`);
    }
  }


  return { data: null, model: null, errors };
}

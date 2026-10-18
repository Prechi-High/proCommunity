type Json = Record<string, unknown>;

export type LlmResult = { data: Json | null; model: string | null; errors: string[] };

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

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let id: number | undefined;
  const t = new Promise<null>((r) => {
    id = setTimeout(() => r(null), ms) as unknown as number;
  });
  const out = await Promise.race([p.catch(() => null), t]);
  if (id !== undefined) clearTimeout(id);
  return out as T | null;
}

const RETIRED_GEMINI = /^gemini-(1\.|2\.0|2\.5)/;

function geminiModels(): string[] {
  const pref = secret("GEMINI_MODEL");
  return Array.from(
    new Set(
      [
        pref && !RETIRED_GEMINI.test(pref) ? pref : "",
        "gemini-3.8-flash",
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-flash-latest",
      ].filter(Boolean),
    ),
  );
}

function nvidiaModels(): string[] {
  return Array.from(
    new Set(
      [secret("NVIDIA_TEXT_MODEL"), secret("NVIDIA_MODEL"), "meta/llama-3.3-70b-instruct", "meta/llama-3.1-8b-instruct"].filter(
        Boolean,
      ),
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
    const res = await withTimeout(
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(Math.max(1, left)),
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: maxTokens * 2 + 4096,
            responseMimeType: "application/json",
            ...(/^gemini-3.*flash/.test(model) ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}),
          },
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
    const res = await withTimeout(
      fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(Math.max(1, left)),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
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
      }),
      left,
    );
    if (!res) {
      errors.push(`nvidia/${model}:timeout`);
      continue;
    }
    if (!res.ok) {
      errors.push(`nvidia/${model}:http_${res.status}`);
      continue;
    }
    const body = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null;
    const data = parseJsonLoose(body?.choices?.[0]?.message?.content ?? "");
    if (data) return { data, model: `nvidia/${model}`, errors };
    errors.push(`nvidia/${model}:unparseable`);
  }
  return null;
}

/** Shared JSON-only LLM call for edge intelligence modules. Gemini → OpenRouter → NVIDIA NIM. */
export async function callLlmJson(prompt: string, maxTokens: number, timeoutMs: number): Promise<LlmResult> {
  const errors: string[] = [];
  const orKey = secret("OPENROUTER_API_KEY");
  const gKey = secret("GEMINI_API_KEY") || secret("GOOGLE_API_KEY");
  const nvKey = secret("NVIDIA_API_KEY") || secret("NGC_API_KEY");
  const deadline = Date.now() + timeoutMs;

  if (gKey) {
    const out = await callGemini(gKey, prompt, maxTokens, deadline, errors);
    if (out?.data) return out;
  }

  if (orKey) {
    const models = Array.from(new Set([secret("OPENROUTER_TEXT_MODEL"), "anthropic/claude-haiku-4.5"].filter(Boolean)));
    for (const model of models) {
      const left = deadline - Date.now();
      if (left < 2500) break;
      const res = await withTimeout(
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
        signal: AbortSignal.timeout(Math.max(1, left)),
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
        }),
        left,
      );
      if (!res) {
        errors.push(`${model}:timeout`);
        continue;
      }
      if (!res.ok) {
        errors.push(`${model}:http_${res?.status ?? "timeout"}`);
        continue;
      }
      const body = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null;
      const data = parseJsonLoose(body?.choices?.[0]?.message?.content ?? "");
      if (data) return { data, model, errors };
      errors.push(`${model}:unparseable`);
    }
  }

  if (nvKey) {
    const out = await callNvidia(nvKey, prompt, maxTokens, deadline, errors);
    if (out?.data) return out;
  }

  return { data: null, model: null, errors };
}

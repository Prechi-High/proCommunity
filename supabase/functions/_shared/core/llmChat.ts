type Json = Record<string, unknown>;

export type LlmResult = { data: Json | null; model: string | null; errors: string[] };

function secret(name: string): string {
  return (Deno.env.get(name) ?? "").trim().replace(/^["']|["']$/g, "");
}

export function parseJsonLoose(text: string): Json | null {
  const t = text.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as Json;
  } catch {
    return null;
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

async function callGemini(
  apiKey: string,
  prompt: string,
  maxTokens: number,
  deadline: number,
  errors: string[],
): Promise<LlmResult | null> {
  const model = secret("GEMINI_MODEL") || "gemini-2.0-flash";
  const left = deadline - Date.now();
  if (left < 2500) return null;
  const res = await withTimeout(
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens },
        }),
      },
    ),
    left,
  );
  if (!res?.ok) {
    errors.push(`${model}:http_${res?.status ?? "timeout"}`);
    return null;
  }
  const body = (await res.json().catch(() => null)) as {
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
  } | null;
  const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const data = parseJsonLoose(text);
  if (data) return { data, model, errors };
  errors.push(`${model}:unparseable`);
  return null;
}

/** Shared JSON-only LLM call for edge intelligence modules. */
export async function callLlmJson(prompt: string, maxTokens: number, timeoutMs: number): Promise<LlmResult> {
  const errors: string[] = [];
  const orKey = secret("OPENROUTER_API_KEY");
  const gKey = secret("GEMINI_API_KEY") || secret("GOOGLE_API_KEY");
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
      if (!res?.ok) {
        errors.push(`${model}:http_${res?.status ?? "timeout"}`);
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

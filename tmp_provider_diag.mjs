const JPEG_B64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwC9P8A5Nv/AL6T/wDso/8AooA//Z";
const JPEG_URI = `data:image/jpeg;base64,${JPEG_B64}`;
const PROMPT = "Identify the skincare product brand and name in this image.";

const KEYS = {
  // These are EXPOSED ONLY for diagnostic. TODO: clear after.
  // Will be read from env file:
};

const fs = require("fs");
const path = require("path");
for (const f of [".env", ".env.local"]) {
  const p = path.join(process.cwd(), f);
  try {
    const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
    for (const ln of lines) {
      if (!ln || ln.startsWith("#")) continue;
      const eq = ln.indexOf("=");
      if (eq < 0) continue;
      const k = ln.slice(0, eq).trim();
      let v = ln.slice(eq + 1).trim();
      if (/^["']/.test(v) && v.length >= 2 && v.endsWith(v[0])) v = v.slice(1, -1);
      if (k in KEYS) continue;
      KEYS[k] = v;
    }
  } catch {}
}

const GEMINI_KEY = KEYS.GEMINI_API_KEY || KEYS.GOOGLE_API_KEY || "";
const OR_KEY = KEYS.OPENROUTER_API_KEY || "";
const NV_KEY = KEYS.NVIDIA_API_KEY || KEYS.NGC_API_KEY || "";
console.log("KEY_LENGTHS", { g: GEMINI_KEY.length, or: OR_KEY.length, nv: NV_KEY.length });

async function tryOnce(label, url, headers, body, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const txt = await r.text();
    clearTimeout(t);
    const code = r.status;
    const first = txt.slice(0, 500).replace(/\s+/g, " ");
    console.log(`[${label}] HTTP=${code} t=${Date.now() - t0}ms HEAD=${first}`);
    return { ok: r.ok, code, label };
  } catch (e) {
    clearTimeout(t);
    console.log(`[${label}] EXC t=${Date.now() - t0}ms name=${e.name} msg=${e.message}`);
    return { ok: false, code: 0, label };
  }
}

(async () => {
  // Gemini: test v1 vs v1beta, inlineData vs inline_data, various model slugs
  if (GEMINI_KEY) {
    const variants = [
      // [apiVersion, modelSlug, fieldStyle (inlineData vs inline_data)]
      ["v1", "gemini-1.5-flash", "inlineData_camel"],
      ["v1", "gemini-1.5-flash", "inline_data_snake"],
      ["v1beta", "gemini-1.5-flash", "inlineData_camel"],
      ["v1beta", "gemini-1.5-flash", "inline_data_snake"],
      ["v1", "gemini-1.5-flash-002", "inlineData_camel"],
      ["v1", "gemini-2.0-flash", "inlineData_camel"],
      ["v1beta", "gemini-2.0-flash", "inline_data_snake"],
    ];
    for (const [ver, model, style] of variants) {
      const partImage = style === "inlineData_camel"
        ? { inlineData: { mimeType: "image/jpeg", data: JPEG_B64 } }
        : { inline_data: { mime_type: "image/jpeg", data: JPEG_B64 } };
      const body = {
        contents: [{ parts: [{ text: PROMPT }, partImage] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 64 },
      };
      await tryOnce(
        `g:${ver}:${model}:${style}`,
        `https://generativelanguage.googleapis.com/${ver}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
        { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body,
      );
    }
  }

  // OpenRouter: text-only (to confirm key+endpoint alive) then vision variants
  if (OR_KEY) {
    await tryOnce(
      "or:text:openai/gpt-4o-mini",
      "https://openrouter.ai/api/v1/chat/completions",
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OR_KEY}`,
        "HTTP-Referer": "https://pro-community.vercel.app",
        "X-Title": "Sourced",
      },
      {
        model: "openai/gpt-4o-mini",
        max_tokens: 16,
        temperature: 0,
        messages: [{ role: "user", content: "Reply with ONLY the word 'pong'." }],
      },
    );
    const orVisionModels = [
      "google/gemini-flash-1.5",
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-haiku",
      "liquid/lfm-7b",
      "microsoft/phi-3.5-vision-instruct",
    ];
    for (const m of orVisionModels) {
      await tryOnce(
        `or:vis:${m}`,
        "https://openrouter.ai/api/v1/chat/completions",
        {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OR_KEY}`,
          "HTTP-Referer": "https://pro-community.vercel.app",
          "X-Title": "Sourced",
        },
        {
          model: m,
          max_tokens: 64,
          temperature: 0.1,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: PROMPT },
                { type: "image_url", image_url: { url: JPEG_URI, detail: "low" } },
              ],
            },
          ],
        },
      );
    }
  }

  // NVIDIA: text-only (key/url alive) + vision variants + alternate URLs
  if (NV_KEY) {
    const nvUrls = [
      ["integrate_url", "https://integrate.api.nvidia.com/v1/chat/completions"],
      ["ai_url", "https://ai.api.nvidia.com/v1/chat/completions"],
    ];
    for (const [tag, url] of nvUrls) {
      await tryOnce(
        `nv:text:meta/llama-3.1-8b-instruct:${tag}`,
        url,
        { "Content-Type": "application/json", Authorization: `Bearer ${NV_KEY}` },
        {
          model: "meta/llama-3.1-8b-instruct",
          max_tokens: 16,
          temperature: 0,
          messages: [{ role: "user", content: "Reply with ONLY the word 'pong'." }],
        },
      );
    }
    const nvVisionModels = ["microsoft/phi-3.5-vision-instruct", "nvidia/neva-22b"];
    for (const [tag, url] of nvUrls) {
      for (const m of nvVisionModels) {
        await tryOnce(
          `nv:vis:${m}:${tag}`,
          url,
          { "Content-Type": "application/json", Authorization: `Bearer ${NV_KEY}` },
          {
            model: m,
            max_tokens: 64,
            temperature: 0.1,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: PROMPT },
                  { type: "image_url", image_url: { url: JPEG_URI, detail: "low" } },
                ],
              },
            ],
          },
        );
      }
    }
  }
  console.log("DIAG_DONE");
})();

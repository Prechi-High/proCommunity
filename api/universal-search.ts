/**
 * POST /api/universal-search
 * Universal product search from image using LLM
 * Works with ANY product type (electronics, food, household items, cosmetics, etc.)
 * Uses OpenRouter or Gemini to identify products from images
 */

type ReqRequest = {
  method?: string;
  body?: {
    imageBase64?: string;
    mimeType?: string;
    fileName?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
};

type ReqResponse = {
  status: (code: number) => {
    json: (body: unknown) => void;
    send: (body: string | Buffer) => void;
  };
};

function secret(name: string): string {
  return (process.env[name]?.trim() ?? '').replace(/^["']|["']$/g, '');
}

function errorJson(res: ReqResponse, status: number, payload: unknown) {
  res.status(status).json(payload);
}

export default async function handler(req: ReqRequest, res: ReqResponse) {
  const method = (req.method ?? 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    res.status(200).send('ok');
    return;
  }
  if (method !== 'POST') {
    errorJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const imageBase64 = req.body?.imageBase64;
  const mimeType = req.body?.mimeType || 'image/jpeg';
  const fileName = req.body?.fileName || 'upload.jpg';

  if (!imageBase64 || !imageBase64.trim()) {
    errorJson(res, 400, { error: 'missing_image', message: 'No image data provided' });
    return;
  }

  // Try OpenRouter first, then Gemini
  const openRouterKey = secret('OPENROUTER_API_KEY');
  const geminiKey = secret('GEMINI_API_KEY') || secret('GOOGLE_API_KEY');

  if (!openRouterKey && !geminiKey) {
    errorJson(res, 500, {
      error: 'no_llm_key',
      message: 'No LLM API key configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY in environment variables.',
      hint: 'Add one of these keys to your .env.local file.',
    });
    return;
  }

  // Check image size (max 20MB base64 encoded)
  const maxImageSize = 20 * 1024 * 1024; // 20MB
  const imageBytes = Math.ceil((imageBase64.length * 3) / 4);
  if (imageBytes > maxImageSize) {
    errorJson(res, 400, {
      error: 'image_too_large',
      message: 'Image is too large. Please use a smaller image.',
      maxBytes: maxImageSize,
      actualBytes: imageBytes,
    });
    return;
  }

  // Detect if it's a data URI and extract base64
  let base64Data = imageBase64;
  if (imageBase64.startsWith('data:')) {
    const commaIndex = imageBase64.indexOf(',');
    if (commaIndex > 0) {
      base64Data = imageBase64.substring(commaIndex + 1);
    }
  }

  // Try OpenRouter with multimodal support
  if (openRouterKey) {
    const result = await tryOpenRouter(base64Data, mimeType, fileName, openRouterKey);
    if (result.success) {
      return res.status(200).json(result.data);
    }
    // If OpenRouter fails, fall back to Gemini
    if (result.error !== 'no_multimodal' && result.error !== 'model_not_supported') {
      return res.status(500).json(result.data);
    }
  }

  // Try Gemini if OpenRouter failed or key not available
  if (geminiKey) {
    const result = await tryGemini(base64Data, mimeType, fileName, geminiKey);
    if (result.success) {
      return res.status(200).json(result.data);
    }
    return res.status(500).json(result.data);
  }

  // No LLM available
  errorJson(res, 500, {
    error: 'no_llm_available',
    message: 'No LLM API keys available. Please configure OPENROUTER_API_KEY or GEMINI_API_KEY.',
  });
}

async function tryOpenRouter(
  base64Data: string,
  mimeType: string,
  fileName: string,
  apiKey: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const model = secret('OPENROUTER_MODEL') || 'openai/gpt-4o-mini';

    // Check if the model supports multimodal
    const supportedModels = ['gpt-4o', 'gpt-4o-mini', 'claude-3', 'claude-3.5', 'llama-3.2-vision'];
    const modelLower = model.toLowerCase();
    const supportsMultimodal = supportedModels.some((m) => modelLower.includes(m));

    if (!supportsMultimodal) {
      return { success: false, error: 'no_multimodal' };
    }

    const prompt = `You are a product identification expert. Analyze this product image and identify:
1. The product name
2. The brand
3. The product category (e.g., electronics, food, cosmetic, household item, etc.)
4. Any key distinguishing features

Respond with a JSON object with these exact keys: name, brand, category, description, confidence (0-1), and keyFeatures (array of strings).`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': secret('PUBLIC_SITE_ORIGIN') || 'https://pro-community.vercel.app',
        'X-Title': 'Sourced Universal Search',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'You are a product identification expert. Identify products from images and provide structured data.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorJson = JSON.parse(errorText);
      return { success: false, data: errorJson, error: errorJson.error?.type || 'api_error' };
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, data: { error: 'no_response', message: 'No response from LLM' } };
    }

    // Parse the JSON response
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        return { success: false, data: { error: 'invalid_json', message: 'Could not parse LLM response as JSON' } };
      }
    }

    return {
      success: true,
      data: {
        name: result.name,
        brand: result.brand,
        category: result.category,
        description: result.description || '',
        confidence: result.confidence ?? 0.5,
        keyFeatures: result.keyFeatures || [],
        provider: 'openrouter',
        model,
        rawData: result,
      },
    };
  } catch (err) {
    return {
      success: false,
      data: {
        error: 'openrouter_error',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

async function tryGemini(
  base64Data: string,
  mimeType: string,
  fileName: string,
  apiKey: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const model = secret('GEMINI_MODEL') || 'gemini-2.5-flash';

    const prompt = `You are a product identification expert. Analyze this product image and identify:
1. The product name
2. The brand
3. The product category (e.g., electronics, food, cosmetic, household item, etc.)
4. Any key distinguishing features

Respond with a JSON object with these exact keys: name, brand, category, description, confidence (0-1), and keyFeatures (array of strings).`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            response_mime_type: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, data: JSON.parse(errorText), error: 'gemini_error' };
    }

    const payload = await response.json();
    const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return { success: false, data: { error: 'no_response', message: 'No response from Gemini' } };
    }

    // Parse the JSON response
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        return { success: false, data: { error: 'invalid_json', message: 'Could not parse Gemini response as JSON' } };
      }
    }

    return {
      success: true,
      data: {
        name: result.name,
        brand: result.brand,
        category: result.category,
        description: result.description || '',
        confidence: result.confidence ?? 0.5,
        keyFeatures: result.keyFeatures || [],
        provider: 'gemini',
        model,
        rawData: result,
      },
    };
  } catch (err) {
    return {
      success: false,
      data: {
        error: 'gemini_error',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * LLM Extraction Service
 * Extracts structured product intelligence from unstructured content
 * using OpenRouter and Gemini APIs.
 */

type LLMProvider = 'openrouter' | 'gemini' | 'nvidia';

interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

interface ExtractionField {
  key: string;
  label: string;
  description: string;
  dataType: 'text' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'url' | 'image';
  unit?: string;
  required?: boolean;
  extractionInstruction?: string;
}

interface ExtractionResult {
  field: string;
  value: unknown;
  normalizedValue?: string;
  confidence: number;
  evidenceIds?: string[];
  provider?: LLMProvider;
  model?: string;
}

export class LLMExtractionService {
  private readonly openRouterKey: string;
  private readonly geminiKey: string;
  private readonly nvidiaKey: string;

  constructor() {
    this.openRouterKey = this.getSecret('OPENROUTER_API_KEY');
    this.geminiKey = this.getSecret('GEMINI_API_KEY') || this.getSecret('GOOGLE_API_KEY');
    this.nvidiaKey = this.getSecret('NVIDIA_API_KEY') || this.getSecret('NGC_API_KEY');
  }

  private getSecret(name: string): string {
    return (process.env[name]?.trim() ?? '').replace(/^["']|["']$/g, '');
  }

  private async callOpenRouter(
    prompt: string,
    fields: ExtractionField[],
    options: LLMOptions = {}
  ): Promise<string | null> {
    if (!this.openRouterKey) return null;

    const model = this.getSecret('OPENROUTER_MODEL') || 'openai/gpt-4o-mini';

    const schema = {
      type: 'object',
      properties: Object.fromEntries(
        fields.map((f) => [
          f.key,
          {
            type: f.dataType === 'array' ? 'array' : f.dataType === 'boolean' ? 'boolean' : 'string',
            description: `${f.label}: ${f.description}`,
            ...(f.dataType === 'array' && { items: { type: 'string' } }),
          },
        ])
      ),
      required: fields.filter((f) => f.required).map((f) => f.key),
    };

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openRouterKey}`,
          'HTTP-Referer': this.getSecret('PUBLIC_SITE_ORIGIN') || 'https://pro-community.vercel.app',
          'X-Title': 'Sourced',
        },
        body: JSON.stringify({
          model,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 2000,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `Extract product intelligence from the provided content.
Follow these instructions precisely:

${fields.map((f) => `- ${f.label} (${f.key}): ${f.extractionInstruction || f.description}`).join('\n')}

Return ONLY a JSON object with the specified structure. Do not include markdown formatting or explanation.`,
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) return null;

      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return payload.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  }

  private async callGemini(
    prompt: string,
    fields: ExtractionField[],
    options: LLMOptions = {}
  ): Promise<string | null> {
    if (!this.geminiKey) return null;

    const models = [...new Set([this.getSecret('GEMINI_MODEL'), 'gemini-2.5-flash', 'gemini-3.5-flash'].filter(Boolean))];

    const schema = {
      type: 'object',
      properties: Object.fromEntries(
        fields.map((f) => [
          f.key,
          {
            type: f.dataType === 'array' ? 'ARRAY' : f.dataType === 'boolean' ? 'BOOLEAN' : 'STRING',
            description: `${f.label}: ${f.extractionInstruction || f.description}`,
          },
        ])
      ),
      required: fields.filter((f) => f.required).map((f) => f.key),
    };

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.geminiKey },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Extract product intelligence from the provided content.
Follow these instructions precisely:

${fields.map((f) => `- ${f.label} (${f.key}): ${f.extractionInstruction || f.description}`).join('\n')}

Return ONLY a JSON object with the specified structure. Do not include markdown formatting or explanation.
Schema: ${JSON.stringify(schema)}`,
                    },
                    { text: prompt },
                  ],
                },
              ],
              generationConfig: {
                temperature: options.temperature ?? 0.2,
                maxOutputTokens: options.maxTokens ?? 2000,
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        if (!response.ok) {
          if (response.status === 404) continue;
          return null;
        }

        const payload = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n') ?? '';
        if (text) return text;
      } catch {
        continue;
      }
    }
    return null;
  }

  private async callNvidia(
    prompt: string,
    fields: ExtractionField[],
    options: LLMOptions = {}
  ): Promise<string | null> {
    if (!this.nvidiaKey) return null;

    const models = [...new Set([this.getSecret('NVIDIA_MODEL'), 'microsoft/phi-3.5-vision-instruct', 'nvidia/neva-22b'].filter(Boolean))];

    const schema = {
      type: 'object',
      properties: Object.fromEntries(
        fields.map((f) => [
          f.key,
          {
            type: f.dataType === 'array' ? 'array' : f.dataType === 'boolean' ? 'boolean' : 'string',
            description: `${f.label}: ${f.extractionInstruction || f.description}`,
          },
        ])
      ),
      required: fields.filter((f) => f.required).map((f) => f.key),
    };

    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.nvidiaKey}`,
        },
        body: JSON.stringify({
          model: models[0],
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 2000,
          messages: [
            {
              role: 'system',
              content: `Extract product intelligence from the provided content.
Follow these instructions precisely:

${fields.map((f) => `- ${f.label} (${f.key}): ${f.extractionInstruction || f.description}`).join('\n')}

Return ONLY a JSON object with the specified structure. Do not include markdown formatting or explanation.
Schema: ${JSON.stringify(schema)}`,
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) return null;

      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return payload.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  }

  async extract(
    content: string,
    fields: ExtractionField[],
    options: LLMOptions = {}
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];

    // Try OpenRouter first, then Gemini, then NVIDIA
    const raw = (await this.callOpenRouter(content, fields, options)) ||
                (await this.callGemini(content, fields, options)) ||
                (await this.callNvidia(content, fields, options));

    if (!raw) {
      return results;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      for (const field of fields) {
        const value = parsed[field.key];
        if (value !== undefined && value !== null && value !== '') {
          results.push({
            field: field.key,
            value: value,
            normalizedValue: String(value).trim(),
            confidence: this.calculateConfidence(field, value, content),
            provider: 'openrouter',
          });
        }
      }
    } catch {
      // Fallback: try to extract fields from raw text
      for (const field of fields) {
        const regex = new RegExp(`${field.label}\\s*[:\\-]?\\s*([^\\n]+)`, 'i');
        const match = content.match(regex);
        if (match) {
          results.push({
            field: field.key,
            value: match[1].trim(),
            normalizedValue: match[1].trim(),
            confidence: 0.5,
            provider: 'fallback',
          });
        }
      }
    }

    return results;
  }

  private calculateConfidence(field: ExtractionField, value: unknown, content: string): number {
    let confidence = 0.7;

    // Increase confidence based on evidence quality
    if (content.length > 1000) confidence += 0.1;
    if (content.includes('manufacturer') || content.includes('official')) confidence += 0.15;
    if (content.includes('specification') || content.includes('technical')) confidence += 0.1;

    // Decrease confidence for uncertain patterns
    if (String(value).includes('approx') || String(value).includes('about')) confidence -= 0.2;
    if (String(value).includes('?') || String(value).includes('unknown')) confidence -= 0.3;

    return Math.max(0.1, Math.min(0.99, confidence));
  }

  /**
   * Extract structured product intelligence for a specific template
   */
  async extractForTemplate(
    content: string,
    fields: ExtractionField[],
    productId: string,
    evidenceId?: string
  ): Promise<{ results: ExtractionResult[]; productId: string; evidenceId?: string }> {
    const results = await this.extract(content, fields);

    // Link evidence to results if provided
    if (evidenceId && results.length > 0) {
      for (const result of results) {
        result.evidenceIds = [evidenceId];
      }
    }

    return { results, productId, evidenceId };
  }

  /**
   * Verify extraction results against source content
   */
  verifyExtraction(result: ExtractionResult, sourceContent: string): boolean {
    const value = String(result.value).toLowerCase();
    const source = sourceContent.toLowerCase();

    // Check if the extracted value appears in the source
    if (source.includes(value)) return true;

    // For numbers, check for similar patterns
    const numberRegex = /\d+/g;
    const sourceNumbers = source.match(numberRegex) || [];
    const valueNumbers = value.match(numberRegex) || [];

    if (valueNumbers.length > 0 && valueNumbers.some((n) => sourceNumbers.includes(n))) return true;

    return false;
  }
}

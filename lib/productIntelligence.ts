/**
 * Product Intelligence from Photo
 * Uses the new Product Intelligence Organisation to investigate products from images
 */

import * as FileSystem from 'expo-file-system';

export interface ProductIntelligenceResult {
  label: string | null;
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  hint?: string;
  confidence?: number;
  category?: string;
  intelligence?: Record<string, unknown>;
}

async function assetToBase64(asset: {
  uri: string;
  fileName?: string | null;
}): Promise<{ base64: string; mime: string } | { error: string; message?: string }> {
  const mime = inferMime(asset);

  try {
    const mod = FileSystem as any;
    if (typeof mod?.readAsStringAsync === 'function' && mod?.EncodingType?.Base64 != null) {
      try {
        const s = await mod.readAsStringAsync(asset.uri, { encoding: mod.EncodingType.Base64 });
        if (s && typeof s === 'string' && s.length > 10) {
          return { base64: s, mime };
        }
      } catch {
        /* fallthrough */
      }
    }
  } catch {
    /* fallthrough */
  }

  return { error: 'image_read_failed', message: 'Could not read image data' };
}

function inferMime(asset: {
  uri: string;
  fileName?: string | null;
  type?: string | null;
  mimeType?: string | null;
}): string {
  const raw = (asset.mimeType ?? asset.type ?? '').toLowerCase().trim();
  if (raw.startsWith('image/')) return raw;
  const name = asset.fileName ?? asset.uri.split('/').pop() ?? '';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'heic': case 'heif': return 'image/jpeg';
    case 'jpg': case 'jpeg': case 'jfif': case 'pjpeg': case 'pjp': return 'image/jpeg';
    default: return 'image/jpeg';
  }
}

export async function extractProductFromPhoto(asset: {
  uri: string;
  fileName?: string | null;
}): Promise<ProductIntelligenceResult> {
  const fallbackLabel = asset?.fileName ?? asset?.uri?.split('/').pop() ?? 'product';

  const base64Result = await assetToBase64(asset);

  if ('error' in base64Result) {
    return {
      label: fallbackLabel,
      ok: false,
      errorCode: base64Result.error,
      errorMessage: base64Result.message,
    };
  }

  const { base64: b64, mime } = base64Result;

  // Call the product-intelligence edge function
  const endpoint = 'https://aqdptcuwpneuyzjavjak.supabase.co/functions/v1/product-intelligence';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxZHB0Y3V3cG5ldXl6amF2amFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NjQzNjYsImV4cCI6MjEwNTA0MDM2Nn0.jbIzvkqQ7qnYhH45uvIwDI97-tjdHsPY4S-0yv9XBXg`,
        'x-client-info': 'sourced/app',
      },
      body: JSON.stringify({
        action: 'investigate',
        query: fallbackLabel,
        imageBase64: b64,
        mimeType: mime,
        fileName: asset.fileName ?? asset.uri.split('/').pop() ?? 'upload.jpg',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      let errorInfo: { error?: string; message?: string } = {};
      try {
        errorInfo = JSON.parse(text);
      } catch {
        // Ignore
      }

      return {
        label: fallbackLabel,
        ok: false,
        errorCode: errorInfo.error || 'api_error',
        errorMessage: errorInfo.message || text,
      };
    }

    const result = await response.json();

    return {
      label: result.intelligence?.product_name || result.intelligence?.name || fallbackLabel,
      ok: true,
      confidence: result.intelligence?.confidence,
      category: result.intelligence?.category,
      intelligence: result.intelligence,
    };
  } catch (err) {
    return {
      label: fallbackLabel,
      ok: false,
      errorCode: 'network_error',
      errorMessage: err instanceof Error ? err.message : String(err ?? ''),
    };
  }
}

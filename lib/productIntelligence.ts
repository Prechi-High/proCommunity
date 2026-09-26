/**
 * Product Intelligence from Photo
 * Uses the new Product Intelligence Organisation to investigate products from images
 */

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

async function extractProductFromPhoto(asset: {
  uri: string;
  fileName?: string | null;
}): Promise<ProductIntelligenceResult> {
  const fallbackLabel = asset?.fileName ?? asset?.uri?.split('/').pop() ?? 'product';

  // Get base64 from asset
  const FileSystem = (await import('expo-file-system')).default as any;
  let b64: string | null = null;

  try {
    b64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (err) {
    return {
      label: fallbackLabel,
      ok: false,
      errorCode: 'image_read_failed',
      errorMessage: err instanceof Error ? err.message : String(err ?? ''),
    };
  }

  if (!b64) {
    return {
      label: fallbackLabel,
      ok: false,
      errorCode: 'image_read_failed',
      errorMessage: 'Could not read image data',
    };
  }

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
        imageUrl: asset.uri,
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

export { extractProductFromPhoto };

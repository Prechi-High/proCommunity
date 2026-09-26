/**
 * Product Intelligence from Photo
 * Universal product identification from images using LLM
 * Works with ANY product type (electronics, food, household items, cosmetics, etc.)
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const PUBLIC_SUPABASE_URL_FALLBACK = 'https://aqdptcuwpneuyzjavjak.supabase.co';

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

function resolveEndpoint(): { endpoint: string; mode: 'vercel-proxy' } {
  const isWeb = Platform.OS === 'web';
  const baseUrl = (
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
  ).trim().replace(/\/$/, '');

  // Always use Vercel proxy for universal search
  return { endpoint: '/api/universal-search', mode: 'vercel-proxy' };
}

export interface UniversalProductResult {
  name: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
  confidence: number | null;
  keyFeatures: string[];
  provider?: string;
  model?: string;
  rawData?: Record<string, unknown>;
}

export interface ProductIntelligenceResult {
  label: string | null;
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  hint?: string;
  confidence?: number;
  category?: string;
  intelligence?: Record<string, unknown>;
  productName?: string;
  productBrand?: string;
  productCategory?: string;
  productDescription?: string;
  productImage?: string;
  universalResult?: UniversalProductResult;
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

export async function extractProductFromPhoto(asset: {
  uri: string;
  fileName?: string | null;
}): Promise<ProductIntelligenceResult> {
  console.log('[ProductIntelligence] Starting extraction for:', asset.uri);
  const fallbackLabel = asset?.fileName ?? asset?.uri?.split('/').pop() ?? 'product';

  const base64Result = await assetToBase64(asset);

  if ('error' in base64Result) {
    console.log('[ProductIntelligence] Failed to convert to base64:', base64Result.error);
    return {
      label: fallbackLabel,
      ok: false,
      errorCode: base64Result.error,
      errorMessage: base64Result.message,
    };
  }

  const { base64: b64, mime } = base64Result;
  const { endpoint, mode } = resolveEndpoint();
  
  console.log('[ProductIntelligence] Sending request to:', endpoint, 'mode:', mode);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-info': 'sourced/app/universal',
      },
      body: JSON.stringify({
        imageBase64: b64,
        mimeType: mime,
        fileName: asset.fileName ?? asset.uri.split('/').pop() ?? 'upload.jpg',
      }),
    });

    console.log('[ProductIntelligence] Response status:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.log('[ProductIntelligence] Error response:', text);
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
    console.log('[ProductIntelligence] Success response:', result);

    // Extract product information from universal search result
    const productName = result.name || result.productName || fallbackLabel;
    const productBrand = result.brand || result.productBrand || 'Unknown';
    const productCategory = result.category || result.productCategory || 'general';
    const productDescription = result.description || '';
    const confidence = result.confidence ?? 0;

    return {
      label: productName,
      ok: true,
      errorCode: undefined,
      errorMessage: undefined,
      confidence,
      category: productCategory,
      intelligence: {
        name: productName,
        brand: productBrand,
        category: productCategory,
        description: productDescription,
        confidence,
        keyFeatures: result.keyFeatures || [],
        provider: result.provider,
        model: result.model,
      },
      productName,
      productBrand,
      productCategory,
      productDescription,
      universalResult: result as UniversalProductResult,
    };
  } catch (err) {
    console.log('[ProductIntelligence] Exception:', err);
    return {
      label: fallbackLabel,
      ok: false,
      errorCode: 'network_error',
      errorMessage: err instanceof Error ? err.message : String(err ?? ''),
    };
  }
}

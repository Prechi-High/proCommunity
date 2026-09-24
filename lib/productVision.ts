import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

const DEFAULT_WEB_ENDPOINT = '/api/product-vision';

function filenameFallback(asset: { uri: string; fileName?: string | null }): string {
  const d = asset?.fileName ?? asset?.uri?.split('/').pop() ?? '';
  const fallback = d
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return fallback || 'skincare product';
}

function inferMime(asset: { uri: string; fileName?: string | null }): string {
  const name = asset.fileName ?? asset.uri.split('/').pop() ?? '';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
    case 'heif':
      return 'image/jpeg';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

export type VisionErrorCode =
  | 'no_asset'
  | 'no_asset_uri'
  | 'image_read_failed'
  | 'endpoint_missing'
  | 'network_error'
  | 'http_error'
  | 'empty_response'
  | 'no_vision_llm'
  | 'vision_empty_output'
  | 'missing_image'
  | 'invalid_body_json'
  | 'missing_body'
  | 'invalid_image_data_uri'
  | 'empty_image'
  | 'missing_supabase_bearer'
  | 'edge_product_vision_proxy_failed'
  | 'method_not_allowed'
  | 'unknown';

export interface VisionResult {
  label: string | null;
  ok: boolean;
  errorCode?: VisionErrorCode;
  errorMessage?: string;
  hint?: string;
  source: 'edge-direct' | 'vercel-proxy' | 'fallback';
  attempts?: unknown[];
}

const WEB_PLATFORMS = new Set(['web']);

function resolveEndpoint(): { endpoint: string; mode: 'edge-direct' | 'vercel-proxy' } {
  const explicit = (
    process.env.EXPO_PUBLIC_PRODUCT_VISION_URL ||
    process.env.EXPO_PUBLIC_LLM_URL ||
    process.env.EXPO_PUBLIC_AI_VISION_URL ||
    ''
  ).trim();

  if (explicit) {
    if (explicit.startsWith('/')) {
      return { endpoint: explicit, mode: 'vercel-proxy' };
    }
    return { endpoint: explicit, mode: explicit.includes('/functions/v1/product-vision') ? 'edge-direct' : 'vercel-proxy' };
  }

  const isWeb = WEB_PLATFORMS.has(String(Platform.OS ?? ''));
  const baseUrl = supabaseUrl.trim().replace(/\/$/, '');
  const hasBase = Boolean(baseUrl && supabaseAnonKey);

  if (!isWeb) {
    return {
      endpoint: hasBase
        ? `${baseUrl}/functions/v1/product-vision`
        : `${(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '') || PUBLIC_SUPABASE_URL_FALLBACK}/functions/v1/product-vision`,
      mode: 'edge-direct',
    };
  }

  if (hasBase) {
    return { endpoint: `${baseUrl}/functions/v1/product-vision`, mode: 'edge-direct' };
  }

  return { endpoint: DEFAULT_WEB_ENDPOINT, mode: 'vercel-proxy' };
}

const PUBLIC_SUPABASE_URL_FALLBACK = 'https://aqdptcuwpneuyzjavjak.supabase.co';

function authHeaders(mode: 'edge-direct' | 'vercel-proxy'): Record<string, string> {
  if (mode !== 'edge-direct') return {};
  const anon = supabaseAnonKey?.trim() || (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (!anon && supabase) {
    try {
      const anySupabase = supabase as unknown as { anonKey?: string };
      if (anySupabase.anonKey) return { Authorization: `Bearer ${anySupabase.anonKey}`, apikey: anySupabase.anonKey };
    } catch {
      /* ignore */
    }
  }
  if (!anon) return {};
  return { Authorization: `Bearer ${anon}`, apikey: anon };
}

function codeFromBody(body: string): VisionErrorCode {
  const match = body.match(/"error"\s*:\s*"([^"]+)"/)?.[1] ?? '';
  const known = new Set<string>([
    'no_vision_llm',
    'vision_empty_output',
    'missing_image',
    'invalid_body_json',
    'missing_body',
    'invalid_image_data_uri',
    'empty_image',
    'missing_supabase_bearer',
    'edge_product_vision_proxy_failed',
    'method_not_allowed',
  ]);
  if (known.has(match)) return match as VisionErrorCode;
  return 'http_error';
}

function hintFromBody(body: string): string | undefined {
  return body.match(/"hint"\s*:\s*"([^"]+)"/)?.[1];
}

function attemptsFromBody(body: string): unknown[] | undefined {
  try {
    const parsed = JSON.parse(body) as { attempts?: unknown[] };
    return Array.isArray(parsed.attempts) ? parsed.attempts.slice(0, 12) : undefined;
  } catch {
    return undefined;
  }
}

export async function extractProductFromPhoto(asset: {
  uri: string;
  fileName?: string | null;
  width?: number;
  height?: number;
}): Promise<VisionResult> {
  const fallbackLabel = filenameFallback(asset);

  if (!asset) return { label: fallbackLabel, ok: false, errorCode: 'no_asset', source: 'fallback' };
  if (!asset?.uri) return { label: fallbackLabel, ok: false, errorCode: 'no_asset_uri', source: 'fallback' };

  const { endpoint, mode } = resolveEndpoint();
  if (!endpoint) return { label: fallbackLabel, ok: false, errorCode: 'endpoint_missing', source: 'fallback' };

  let b64: string | null = null;
  const mime = inferMime(asset);

  try {
    if (typeof FileSystem?.readAsStringAsync === 'function') {
      b64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
  } catch (err) {
    return {
      label: fallbackLabel,
      ok: false,
      errorCode: 'image_read_failed',
      errorMessage: err instanceof Error ? err.message : String(err ?? ''),
      source: 'fallback',
    };
  }

  if (!b64) {
    return { label: fallbackLabel, ok: false, errorCode: 'image_read_failed', source: 'fallback' };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-info': 'sourced/app',
        ...authHeaders(mode),
      },
      body: JSON.stringify({
        imageBase64: b64,
        mimeType: mime,
        fileName: asset.fileName ?? asset.uri.split('/').pop() ?? 'upload.jpg',
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      const code = codeFromBody(text);
      const hint = hintFromBody(text);
      const attempts = attemptsFromBody(text);
      let message = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(text) as { message?: string; error?: string };
        if (parsed.message) message = parsed.message;
        else if (parsed.error) message = parsed.error;
      } catch {
        /* ignore */
      }
      return {
        label: code === 'no_vision_llm' ? null : fallbackLabel,
        ok: false,
        errorCode: code,
        errorMessage: message,
        hint,
        source: mode,
        attempts,
      };
    }

    const cleaned = text.replace(/\s+/g, ' ').trim();
    const lowered = cleaned.toLowerCase();
    if (!cleaned || lowered === 'null' || lowered === 'unknown' || cleaned.length < 3) {
      return {
        label: fallbackLabel,
        ok: false,
        errorCode: 'empty_response',
        errorMessage: 'Vision returned an empty label',
        source: mode,
      };
    }

    return { label: cleaned, ok: true, source: mode };
  } catch (err) {
    return {
      label: fallbackLabel,
      ok: false,
      errorCode: 'network_error',
      errorMessage: err instanceof Error ? err.message : String(err ?? ''),
      source: 'fallback',
    };
  }
}

import { File } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

const DEFAULT_WEB_ENDPOINT = '/api/product-vision';
const PUBLIC_SUPABASE_URL_FALLBACK = 'https://aqdptcuwpneuyzjavjak.supabase.co';

function filenameFallback(asset: { uri: string; fileName?: string | null }): string {
  const d = asset?.fileName ?? asset?.uri?.split('/').pop() ?? '';
  const fallback = d
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return fallback || 'skincare product';
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
    case 'jfif':
    case 'pjpeg':
    case 'pjp':
      return 'image/jpeg';
    default:
      return 'image/jpeg';
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).Buffer !== 'undefined') {
    return (globalThis as any).Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  const CHUNK = 0x8000;
  const n = bytes.length;
  let out = '';
  for (let i = 0; i < n; i += CHUNK) {
    const end = Math.min(i + CHUNK, n);
    const slice = bytes.subarray(i, end);
    out += String.fromCharCode(...(slice as unknown as number[]));
  }
  return typeof btoa === 'function' ? btoa(out) : out;
}

function dataUriToBase64Payload(dataUri: string): { base64: string; mime: string } | null {
  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:')) return null;
  const comma = dataUri.indexOf(',');
  if (comma < 0) return null;
  const header = dataUri.slice(0, comma);
  const payload = dataUri.slice(comma + 1);
  const mime = (header.match(/data:([^;,]+)/i)?.[1] || '').toLowerCase() || 'image/jpeg';
  if (header.includes(';base64')) return { base64: payload, mime };
  try {
    const decoded = typeof atob === 'function' ? atob(decodeURIComponent(payload)) : decodeURIComponent(payload);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    return { base64: bytesToBase64(bytes), mime };
  } catch {
    return null;
  }
}

async function assetToBase64(asset: {
  uri: string;
  fileName?: string | null;
  base64?: string | null;
}): Promise<{ base64: string; mime: string; from: string } | { error: VisionErrorCode; message?: string }> {
  const mime = inferMime(asset);
  const readErrors: string[] = [];

  if (asset.base64 && typeof asset.base64 === 'string' && asset.base64.length > 10) {
    return { base64: asset.base64, mime, from: 'picker-base64' };
  }

  if (asset.uri && asset.uri.startsWith('data:')) {
    const parsed = dataUriToBase64Payload(asset.uri);
    if (parsed) return { base64: parsed.base64, mime: parsed.mime || mime, from: 'data-uri' };
  }

  const uri = asset.uri;
  if (!uri || typeof uri !== 'string') return { error: 'no_asset_uri' };

  // Expo SDK 54+: modern File.base64() API
  try {
    const file = new File(uri);
    if (typeof file.base64 === 'function') {
      const s = await file.base64();
      if (s && typeof s === 'string' && s.length > 10) {
        return { base64: s, mime, from: 'fs-file-base64' };
      }
    }
  } catch (err) {
    readErrors.push(`file.base64: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Legacy API — must import from expo-file-system/legacy (main export throws)
  try {
    const encoding = FileSystemLegacy.EncodingType?.Base64 ?? 'base64';
    const s = await FileSystemLegacy.readAsStringAsync(uri, { encoding });
    if (s && typeof s === 'string' && s.length > 10) {
      return { base64: s, mime, from: 'fs-legacy-readAsString' };
    }
  } catch (err) {
    readErrors.push(`legacy: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const webGlobal = globalThis as any;
    const canFetch = typeof fetch === 'function' && typeof (globalThis as any).FileReader === 'function';
    const uriIsBlobUrl = /^blob:https?:/i.test(uri) || uri.startsWith('blob:');
    if (canFetch && (uriIsBlobUrl || /^https?:/i.test(uri) || uri.startsWith('file://') || /^[a-z][a-z0-9+.-]*:/.test(uri))) {
      try {
        const res = await fetch(uri);
        if (res.ok) {
          const blob = await res.blob();
          if (blob && blob.size > 0) {
            const { base64, mime: detectedMime }: { base64: string; mime: string } = await new Promise((resolve, reject) => {
              const reader = new (webGlobal.FileReader)();
              reader.onerror = () => reject(new Error('FileReader failed'));
              reader.onload = () => {
                const r = reader.result as string;
                const parsed = dataUriToBase64Payload(r);
                if (parsed) resolve(parsed);
                else reject(new Error('FileReader produced invalid data uri'));
              };
              reader.readAsDataURL(blob);
            });
            return { base64, mime: /^image\//i.test(detectedMime || '') ? detectedMime : mime, from: 'fetch-FileReader' };
          }
        }
      } catch (err) {
        readErrors.push(`fetch-FileReader: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    readErrors.push(`fetch-wrap: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    if (typeof fetch === 'function') {
      const res = await fetch(uri);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf && buf.byteLength > 0) {
          const bytes = new Uint8Array(buf);
          return { base64: bytesToBase64(bytes), mime, from: 'fetch-arrayBuffer-bytesToBase64' };
        }
      }
    }
  } catch (err) {
    readErrors.push(`fetch-arrayBuffer: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    error: 'image_read_failed',
    message:
      readErrors.length > 0
        ? `Could not decode image (${readErrors.slice(0, 2).join(' | ')})`
        : 'No available read strategy could decode this image. Try a different file.',
  };
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
  const baseUrl = (
    supabaseUrl?.trim() ||
    (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim() ||
    PUBLIC_SUPABASE_URL_FALLBACK
  ).replace(/\/$/, '');
  const hasBase = Boolean(baseUrl) && Boolean(supabaseAnonKey?.trim() || (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim());

  if (!isWeb || hasBase) {
    return {
      endpoint: `${baseUrl}/functions/v1/product-vision`,
      mode: 'edge-direct',
    };
  }

  return { endpoint: DEFAULT_WEB_ENDPOINT, mode: 'vercel-proxy' };
}

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
  base64?: string | null;
}): Promise<VisionResult> {
  const fallbackLabel = filenameFallback(asset);

  if (!asset) return { label: fallbackLabel, ok: false, errorCode: 'no_asset', source: 'fallback' };
  if (!asset?.uri) return { label: fallbackLabel, ok: false, errorCode: 'no_asset_uri', source: 'fallback' };

  const { endpoint, mode } = resolveEndpoint();
  if (!endpoint) return { label: fallbackLabel, ok: false, errorCode: 'endpoint_missing', source: 'fallback' };

  console.log('[ProductVision] endpoint=', endpoint, 'mode=', mode, 'hasPickerBase64=', Boolean(asset.base64));
  const base64Result = await assetToBase64(asset);

  if ('error' in base64Result) {
    console.log('[ProductVision] image read failed:', base64Result.error, base64Result.message);
    return {
      label: fallbackLabel,
      ok: false,
      errorCode: base64Result.error,
      errorMessage: base64Result.message,
      source: 'fallback',
    };
  }

  console.log('[ProductVision] image encoded via', base64Result.from, 'b64Len=', base64Result.base64.length);
  const { base64: b64, mime } = base64Result;

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

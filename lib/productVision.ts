import { File } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { supabaseAnonKey, supabaseUrl } from './supabase';
import type { VisualMatch } from './types';

const MAX_EDGE = 1024;
const REQUEST_TIMEOUT_MS = 50000;

export type VisionErrorCode =
  | 'no_asset'
  | 'image_read_failed'
  | 'network_error'
  | 'timeout'
  | 'no_vision_llm'
  | 'vision_empty_output'
  | 'vision_timeout'
  | 'http_error';

/** One of several products spotted in the same photo; `box` is [ymin, xmin, ymax, xmax] on a 0–1000 scale. */
export interface DetectedProduct {
  label: string;
  brand: string;
  name: string;
  model: string;
  category: string;
  searchQuery: string;
  box: [number, number, number, number] | null;
  confidence: number;
}

export interface VisionResult {
  ok: boolean;
  label: string | null;
  brand?: string;
  name?: string;
  model?: string;
  category?: string;
  confidence?: number;
  variant?: string;
  searchQuery?: string;
  features?: string[];
  alternatives?: string[];
  imageUrl?: string | null;
  matches?: VisualMatch[];
  products?: DetectedProduct[];
  errorCode?: VisionErrorCode;
  errorMessage?: string;
  hint?: string;
  attempts?: number;
}

export interface VisionAsset {
  uri: string;
  fileName?: string | null;
  width?: number;
  height?: number;
  base64?: string | null;
  mimeType?: string | null;
}

/** Downscale on-device so uploads stay small and providers answer within their timeouts. */
async function compress(asset: VisionAsset): Promise<{ base64: string; mime: string } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IM = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    const ctx = IM.ImageManipulator.manipulate(asset.uri);
    const w = asset.width ?? 0;
    const h = asset.height ?? 0;
    if (!w || !h || Math.max(w, h) > MAX_EDGE) {
      ctx.resize(w >= h ? { width: MAX_EDGE, height: null } : { width: null, height: MAX_EDGE });
    }
    const image = await ctx.renderAsync();
    const saved = await image.saveAsync({ base64: true, compress: 0.72, format: IM.SaveFormat.JPEG });
    if (saved.base64 && saved.base64.length > 100) {
      const payload = saved.base64.includes(',') ? saved.base64.split(',').pop()! : saved.base64;
      return { base64: payload, mime: 'image/jpeg' };
    }
  } catch (err) {
    console.log('[ProductVision] compress skipped:', err instanceof Error ? err.message : String(err));
  }
  return null;
}

async function readRaw(asset: VisionAsset): Promise<{ base64: string; mime: string } | null> {
  const mime = asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg';
  if (asset.base64 && asset.base64.length > 100) return { base64: asset.base64, mime };
  if (asset.uri.startsWith('data:')) {
    const [head, body] = asset.uri.split(',');
    if (body && head.includes(';base64')) return { base64: body, mime: head.match(/data:([^;]+)/)?.[1] ?? mime };
  }
  if (Platform.OS !== 'web') {
    try {
      const s = await new File(asset.uri).base64();
      if (s) return { base64: s, mime };
    } catch {
      // try legacy
    }
    try {
      const s = await FileSystemLegacy.readAsStringAsync(asset.uri, { encoding: FileSystemLegacy.EncodingType.Base64 });
      if (s) return { base64: s, mime };
    } catch {
      // try fetch
    }
  }
  try {
    const blob = await (await fetch(asset.uri)).blob();
    const dataUri: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('reader_failed'));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
    const body = dataUri.split(',')[1];
    if (body) return { base64: body, mime: blob.type || mime };
  } catch {
    // give up
  }
  return null;
}

/** Downscaled JPEG base64 for upload, falling back to the raw bytes. */
export async function prepareImage(asset: VisionAsset): Promise<{ base64: string; mime: string } | null> {
  return (await compress(asset)) ?? (await readRaw(asset));
}

async function postOnce(base64: string, mime: string): Promise<VisionResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/product-vision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ imageBase64: base64, mimeType: mime, format: 'json' }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !body) {
      const code = String(body?.error ?? 'http_error') as VisionErrorCode;
      return { ok: false, label: null, errorCode: code, hint: typeof body?.hint === 'string' ? body.hint : undefined };
    }
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label || /[{}]|"\s*:/.test(label)) return { ok: false, label: null, errorCode: 'vision_empty_output' };
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return {
      ok: true,
      label,
      brand: String(body.brand ?? ''),
      name: String(body.name ?? label),
      model: String(body.model ?? ''),
      category: String(body.category ?? ''),
      confidence: Number(body.confidence ?? 0.6),
      variant: String(body.variant ?? ''),
      searchQuery: typeof body.searchQuery === 'string' ? body.searchQuery : label,
      features: strings(body.features),
      alternatives: strings(body.alternatives),
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
      matches: Array.isArray(body.matches) ? (body.matches as VisualMatch[]).filter((m) => m && typeof m.title === 'string') : [],
      products: Array.isArray(body.products)
        ? (body.products as DetectedProduct[]).filter((p) => p && typeof p.label === 'string' && p.label.trim() && !/[{}]/.test(p.label))
        : [],
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      label: null,
      errorCode: aborted ? 'timeout' : 'network_error',
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

const RETRYABLE = new Set<VisionErrorCode>(['network_error', 'timeout', 'vision_timeout', 'http_error']);

export async function extractProductFromPhoto(asset: VisionAsset): Promise<VisionResult> {
  if (!asset?.uri) return { ok: false, label: null, errorCode: 'no_asset' };
  const image = (await compress(asset)) ?? (await readRaw(asset));
  if (!image) return { ok: false, label: null, errorCode: 'image_read_failed' };
  console.log('[ProductVision] uploading b64Len=', image.base64.length);

  let result = await postOnce(image.base64, image.mime);
  let attempts = 1;
  if (!result.ok && result.errorCode && RETRYABLE.has(result.errorCode)) {
    result = await postOnce(image.base64, image.mime);
    attempts = 2;
  }
  return { ...result, attempts };
}

export function visionErrorCopy(result: VisionResult): { title: string; body: string } {
  switch (result.errorCode) {
    case 'vision_empty_output':
      return {
        title: 'Couldn’t make out a product',
        body: 'Try again closer, with the brand name or label facing the camera and good light.',
      };
    case 'image_read_failed':
      return { title: 'Couldn’t read that photo', body: 'Try taking the photo again or pick another one.' };
    case 'timeout':
    case 'vision_timeout':
      return { title: 'That took too long', body: 'Your connection may be slow. Try again, or type the product name.' };
    case 'network_error':
      return { title: 'You seem to be offline', body: 'Check your connection and try again.' };
    case 'no_vision_llm':
      return { title: 'Photo search is unavailable', body: 'Type the product name instead — search works the same.' };
    default:
      return { title: 'Photo search hit a snag', body: result.hint ?? 'Try again, or type the product name.' };
  }
}

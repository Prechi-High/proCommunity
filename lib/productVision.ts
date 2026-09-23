import * as FileSystem from 'expo-file-system';

const DEFAULT_ENDPOINT = '/api/product-vision';

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

export async function extractProductFromPhoto(asset: {
  uri: string;
  fileName?: string | null;
  width?: number;
  height?: number;
}): Promise<string> {
  const fallback = filenameFallback(asset);
  if (!asset?.uri) return fallback;

  const endpoint = (
    process.env.EXPO_PUBLIC_PRODUCT_VISION_URL ||
    process.env.EXPO_PUBLIC_LLM_URL ||
    process.env.EXPO_PUBLIC_AI_VISION_URL ||
    DEFAULT_ENDPOINT
  ).trim();

  if (!endpoint) return fallback;

  let b64: string | null = null;
  const mime = inferMime(asset);

  try {
    if (typeof FileSystem?.readAsStringAsync === 'function') {
      b64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
  } catch {
    b64 = null;
  }

  if (!b64) return fallback;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: b64,
        mimeType: mime,
        fileName: asset.fileName ?? asset.uri.split('/').pop() ?? 'upload.jpg',
      }),
    });

    if (!response.ok) return fallback;

    const text = await response.text();
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned && cleaned.toLowerCase() !== 'null' && cleaned.length > 2) {
      return cleaned;
    }
  } catch {
    /* fall through */
  }

  return fallback;
}

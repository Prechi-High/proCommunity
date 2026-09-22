export async function extractProductFromPhoto(asset: { uri: string; fileName?: string | null; width?: number; height?: number }) {
  const d = asset?.fileName ?? asset?.uri?.split('/').pop() ?? '';
  const fallback = d
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  const endpoint =
    process.env.EXPO_PUBLIC_PRODUCT_VISION_URL ||
    process.env.EXPO_PUBLIC_LLM_URL ||
    process.env.EXPO_PUBLIC_AI_VISION_URL;

  if (!endpoint) {
    return fallback || 'skincare product';
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUri: asset.uri,
        fileName: asset.fileName ?? 'upload.jpg',
        prompt:
          'Identify the product brand and product name from this image. Return only a clean product query string, no extra explanation, no JSON. Example: CeraVe Foaming Cleanser',
      }),
    });

    if (!response.ok) return fallback || 'skincare product';

    const text = await response.text();
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned && cleaned.toLowerCase() !== 'null' && cleaned.length > 2) {
      return cleaned;
    }
  } catch {
    // Fall back to a filename-derived product name when the LLM endpoint is unavailable.
  }

  return fallback || 'skincare product';
}

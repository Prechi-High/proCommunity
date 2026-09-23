import * as FileSystem from 'expo-file-system/legacy';
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

export async function extractProductFromPhoto(asset: { uri: string; fileName?: string | null; mimeType?: string | null; width?: number; height?: number }) {
  const endpoint =
    process.env.EXPO_PUBLIC_PRODUCT_VISION_URL?.trim() ||
    process.env.EXPO_PUBLIC_LLM_URL?.trim() ||
    process.env.EXPO_PUBLIC_AI_VISION_URL?.trim() ||
    `${supabaseUrl}/functions/v1/product-vision`;

  try {
    const imageBase64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    const accessToken = session?.access_token ?? supabaseAnonKey;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        imageBase64,
        mimeType: asset.mimeType ?? 'image/jpeg',
        fileName: asset.fileName ?? 'upload.jpg',
        prompt:
          'Identify the product brand and product name from this image. Return only a clean product query string, no extra explanation, no JSON. Example: CeraVe Foaming Cleanser',
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision request failed (${response.status})`);
    }

    const payload = (await response.json()) as {
      query?: string;
      searchQuery?: string;
      productName?: string | null;
      brand?: string | null;
    };
    const cleaned = (payload.query ?? payload.searchQuery ?? [payload.brand, payload.productName].filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim();
    if (cleaned && cleaned.toLowerCase() !== 'null' && cleaned.length > 2) {
      return cleaned;
    }
  } catch (error) {
    console.log('[v0] Product vision request failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

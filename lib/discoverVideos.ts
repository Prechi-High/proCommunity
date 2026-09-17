import { supabase } from './supabase';
import type { Product } from './types';

export interface PendingVideo {
  id: string;
  product_id: string | null;
  attribute_tag: string | null;
  source_platform: 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'pinterest';
  source_url: string;
  embed_html: string | null;
  title: string | null;
  channel_or_author: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  search_query: string | null;
  fetched_at: string;
  pending_review: boolean;
}

async function invoke(body: Record<string, unknown>) {
  if (!supabase) return { data: null as unknown, error: 'Supabase is not configured' };
  const { data, error } = await supabase.functions.invoke('discover-video-content', { body });
  if (error) return { data: null as unknown, error: error.message };
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    return { data, error: String((data as { error: string }).error) };
  }
  return { data, error: null as string | null };
}

export async function listPendingVideos(): Promise<{ clips: PendingVideo[]; error: string | null }> {
  const { data, error } = await invoke({ action: 'list_pending' });
  const clips = (data as { clips?: PendingVideo[] } | null)?.clips ?? [];
  return { clips, error };
}

export async function approveVideo(id: string, approvedBy?: string) {
  return invoke({ action: 'approve', id, approvedBy });
}

export async function rejectVideo(id: string) {
  return invoke({ action: 'reject', id });
}

export async function discoverVideosForProduct(product: Product) {
  return invoke({
    action: 'discover',
    productId: product.id,
    productName: product.name,
    brand: product.brand,
    ingredients: product.ingredients,
    attributeTags: product.attributeTags,
    suitsSkinTypes: product.suitsSkinTypes,
  });
}

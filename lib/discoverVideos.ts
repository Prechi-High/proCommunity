import { supabase } from './supabase';
import type { Product } from './types';
import { ensureYoutubeVideosForProduct } from './youtube';

export interface PendingVideo {
  id: string;
  product_id: string | null;
  catalog_product_id?: string | null;
  attribute_tag: string | null;
  source_platform: 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'pinterest';
  source_url: string;
  embed_html: string | null;
  title: string | null;
  channel_or_author: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  youtube_video_id?: string | null;
  search_query: string | null;
  fetched_at: string;
  pending_review: boolean;
  content_tags?: string[];
  classification_confidence?: number | null;
  classification_method?: string | null;
  classification_justification?: string | null;
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
  const clips = ((data as { clips?: PendingVideo[] } | null)?.clips ?? []).filter(
    (clip) => clip.source_platform === 'youtube',
  );
  return { clips, error };
}

export async function approveVideo(id: string, approvedBy?: string) {
  return invoke({ action: 'approve', id, approvedBy });
}

export async function rejectVideo(id: string) {
  return invoke({ action: 'reject', id });
}

export async function classifyPendingVideos() {
  return invoke({ action: 'classify_pending', taxonomyCategory: 'skincare' });
}

/** Product discovery is YouTube-only. Serper is not used. */
export async function discoverVideosForProduct(product: Product) {
  const { clips, error } = await ensureYoutubeVideosForProduct(product);
  if (error) return { data: null as unknown, error };
  return {
    data: {
      provider: 'youtube',
      inserted: clips.length,
      clips: clips.length,
      pending_review: false,
    },
    error: null as string | null,
  };
}

export async function voteOnVideo(videoId: string, voterKey: string, isHelpful: boolean) {
  return invoke({
    action: 'vote',
    id: videoId,
    voterKey,
    isHelpful,
  });
}

/** Gap refresh is disabled while Serper is off; product pages use YouTube on demand. */
export async function refreshVideoDiscovery() {
  return {
    data: {
      provider: 'youtube',
      skipped: true,
      reason: 'serper_disabled_youtube_only',
    },
    error: null as string | null,
  };
}

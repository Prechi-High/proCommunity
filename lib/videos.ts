import { supabase } from './supabase';
import { tagVideo, type VideoJourneyTag } from './youtube';
import type { Product } from './types';

export type VideoPlatform = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'pinterest';

export interface JourneyClip {
  id: string;
  platform: VideoPlatform;
  sourceUrl: string;
  embedHtml: string | null;
  youtubeVideoId: string | null;
  title: string;
  author: string;
  thumbnailUrl: string;
  durationSeconds: number | null;
  tag: VideoJourneyTag;
}

const PLATFORMS: VideoPlatform[] = ['youtube', 'tiktok', 'instagram', 'facebook', 'pinterest'];

function asPlatform(value: string | null | undefined): VideoPlatform {
  return PLATFORMS.includes(value as VideoPlatform) ? (value as VideoPlatform) : 'youtube';
}

/**
 * Approved multi-platform clips only. Pending web-search discoveries never
 * leave the admin queue through this path.
 */
export async function loadApprovedJourneyClips(product: Product): Promise<JourneyClip[]> {
  if (!supabase) return [];
  const tags = [...product.ingredients, ...product.attributeTags].slice(0, 8);

  try {
    const { data, error } = await supabase
      .from('video_cache')
      .select(
        'id, source_platform, source_url, embed_html, youtube_video_id, title, channel_or_author, channel_title, thumbnail_url, duration_seconds, attribute_tag, search_query, pending_review',
      )
      .eq('pending_review', false)
      .limit(24);
    if (error || !data?.length) return [];

    const needle = product.name.toLowerCase();
    const brand = product.brand.toLowerCase();
    const relevant = data.filter((row) => {
      const hay = `${row.title ?? ''} ${row.search_query ?? ''} ${row.attribute_tag ?? ''}`.toLowerCase();
      if (hay.includes(needle) || hay.includes(brand)) return true;
      if (row.attribute_tag && tags.includes(String(row.attribute_tag))) return true;
      return false;
    });

    return relevant.map((row) => {
      const title = String(row.title ?? 'Video');
      const author = String(row.channel_or_author ?? row.channel_title ?? '');
      return {
        id: String(row.id),
        platform: asPlatform(row.source_platform as string),
        sourceUrl: String(row.source_url ?? ''),
        embedHtml: (row.embed_html as string | null) ?? null,
        youtubeVideoId: (row.youtube_video_id as string | null) ?? null,
        title,
        author,
        thumbnailUrl: String(row.thumbnail_url ?? ''),
        durationSeconds: (row.duration_seconds as number | null) ?? null,
        tag: tagVideo({
          youtubeVideoId: String(row.youtube_video_id ?? ''),
          title,
          channelTitle: author,
          thumbnailUrl: String(row.thumbnail_url ?? ''),
        }),
      };
    });
  } catch {
    return [];
  }
}

export function platformLabel(platform: VideoPlatform): string {
  return {
    youtube: 'YouTube',
    tiktok: 'TikTok',
    instagram: 'Instagram',
    facebook: 'Facebook',
    pinterest: 'Pinterest',
  }[platform];
}

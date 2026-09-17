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
function productTokens(product: Product): string[] {
  const raw = [
    product.name,
    product.brand,
    ...product.ingredients.slice(0, 4),
    ...product.attributeTags.slice(0, 4),
  ];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const value of raw) {
    const token = value.replace(/_/g, ' ').trim().toLowerCase();
    if (token.length < 4 || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

export async function loadApprovedJourneyClips(product: Product): Promise<JourneyClip[]> {
  if (!supabase) return [];
  const tokens = productTokens(product);

  try {
    const { data, error } = await supabase
      .from('video_cache')
      .select(
        'id, source_platform, source_url, embed_html, youtube_video_id, title, channel_or_author, channel_title, thumbnail_url, duration_seconds, attribute_tag, search_query, pending_review',
      )
      .eq('pending_review', false)
      .neq('source_platform', 'youtube')
      .limit(80);
    if (error || !data?.length) return [];

    const relevant = data.filter((row) => {
      const hay = `${row.title ?? ''} ${row.search_query ?? ''} ${row.attribute_tag ?? ''}`.toLowerCase();
      return tokens.some((token) => hay.includes(token));
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
          durationSeconds: (row.duration_seconds as number | null) ?? null,
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

export function mixByPlatform(clips: JourneyClip[], limit = 8): JourneyClip[] {
  const buckets = new Map<VideoPlatform, JourneyClip[]>();
  for (const clip of clips) {
    const list = buckets.get(clip.platform) ?? [];
    list.push(clip);
    buckets.set(clip.platform, list);
  }
  const order: VideoPlatform[] = ['tiktok', 'instagram', 'pinterest', 'facebook', 'youtube'];
  const mixed: JourneyClip[] = [];
  let added = true;
  while (mixed.length < limit && added) {
    added = false;
    for (const platform of order) {
      const next = buckets.get(platform)?.shift();
      if (!next) continue;
      mixed.push(next);
      added = true;
      if (mixed.length >= limit) break;
    }
  }
  return mixed;
}

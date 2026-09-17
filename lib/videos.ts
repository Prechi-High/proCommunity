import { discoverVideosForProduct } from './discoverVideos';
import { supabase } from './supabase';
import { loadProductVideos, tagVideo, type VideoJourneyTag } from './youtube';
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

export function mixByPlatform(clips: JourneyClip[], limit = 10): JourneyClip[] {
  const buckets = new Map<VideoPlatform, JourneyClip[]>();
  for (const clip of clips) {
    const list = buckets.get(clip.platform) ?? [];
    list.push(clip);
    buckets.set(clip.platform, list);
  }
  const order: VideoPlatform[] = ['tiktok', 'instagram', 'pinterest', 'facebook', 'youtube'];
  const cap: Record<VideoPlatform, number> = {
    tiktok: 3,
    instagram: 3,
    pinterest: 2,
    facebook: 2,
    youtube: 2,
  };
  const taken: Record<VideoPlatform, number> = {
    tiktok: 0,
    instagram: 0,
    pinterest: 0,
    facebook: 0,
    youtube: 0,
  };
  const mixed: JourneyClip[] = [];
  let added = true;
  while (mixed.length < limit && added) {
    added = false;
    for (const platform of order) {
      if (taken[platform] >= cap[platform]) continue;
      const next = buckets.get(platform)?.shift();
      if (!next) continue;
      mixed.push(next);
      taken[platform] += 1;
      added = true;
      if (mixed.length >= limit) break;
    }
  }
  return mixed;
}

function mergeJourney(social: JourneyClip[], youtube: JourneyClip[]): JourneyClip[] {
  const seen = new Set<string>();
  const merged: JourneyClip[] = [];
  for (const clip of [...social, ...youtube]) {
    const key = clip.youtubeVideoId || clip.sourceUrl || clip.id;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(clip);
  }
  return merged;
}

function asJourneyClipFromYoutube(
  clip: Awaited<ReturnType<typeof loadProductVideos>>[number],
): JourneyClip {
  return {
    id: `yt-${clip.youtubeVideoId}`,
    platform: 'youtube',
    sourceUrl: `https://www.youtube.com/watch?v=${clip.youtubeVideoId}`,
    embedHtml: null,
    youtubeVideoId: clip.youtubeVideoId,
    title: clip.title,
    author: clip.channelTitle,
    thumbnailUrl: clip.thumbnailUrl,
    durationSeconds: clip.durationSeconds ?? null,
    tag: tagVideo(clip),
  };
}

export async function loadCachedProductJourney(product: Product): Promise<JourneyClip[]> {
  const [youtube, social] = await Promise.all([
    loadProductVideos(product.name, product.brand),
    loadApprovedJourneyClips(product),
  ]);
  return mergeJourney(social, youtube.slice(0, 2).map(asJourneyClipFromYoutube));
}

export async function discoverProductJourney(product: Product): Promise<void> {
  const { error } = await discoverVideosForProduct(product);
  if (error) throw new Error(error);
}

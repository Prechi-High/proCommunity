import { discoverVideosForProduct, voteOnVideo } from './discoverVideos';
import { clipMatchesTag, heuristicContentTags } from './heuristicTags';
import { supabase } from './supabase';
import { CACHE_FIRST_THRESHOLD, wilsonScore, type ContentTagKey } from './taxonomy';
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
  contentTags: ContentTagKey[];
  classificationConfidence: number | null;
  classificationJustification: string | null;
  helpfulCount: number;
  notHelpfulCount: number;
  wilson: number;
}

const PLATFORMS: VideoPlatform[] = ['youtube', 'tiktok', 'instagram', 'facebook', 'pinterest'];

function asPlatform(value: string | null | undefined): VideoPlatform {
  return PLATFORMS.includes(value as VideoPlatform) ? (value as VideoPlatform) : 'youtube';
}

function asJourneyClip(row: Record<string, unknown>): JourneyClip {
  const title = String(row.title ?? 'Video');
  const author = String(row.channel_or_author ?? row.channel_title ?? '');
  const tags = Array.isArray(row.content_tags)
    ? (row.content_tags as string[]).filter((tag): tag is ContentTagKey =>
        [
          'how_it_works',
          'how_to_use',
          'composition',
          'who_its_for',
          'results_over_time',
          'precautions',
          'comparisons',
        ].includes(tag),
      )
    : [];
  const helpful = Number(row.helpful_count ?? 0);
  const notHelpful = Number(row.not_helpful_count ?? 0);
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
    contentTags: tags,
    classificationConfidence:
      row.classification_confidence == null ? null : Number(row.classification_confidence),
    classificationJustification: (row.classification_justification as string | null) ?? null,
    helpfulCount: helpful,
    notHelpfulCount: notHelpful,
    wilson: wilsonScore(helpful, notHelpful),
  };
}

const SELECT_CLIP =
  'id, source_platform, source_url, embed_html, youtube_video_id, title, channel_or_author, channel_title, thumbnail_url, duration_seconds, content_tags, classification_confidence, classification_justification, helpful_count, not_helpful_count, catalog_product_id, fetched_at';

/**
 * Cache-first: tagged, Wilson-ranked clips for one product + content tag.
 * Does not call Serper.
 * Falls back to product videos + title heuristics when content_tags are empty
 * (e.g. LLM classifier exhausted).
 */
export async function loadTaggedClips(
  product: Product,
  tag: ContentTagKey,
  limit = 40,
): Promise<JourneyClip[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc('list_tagged_videos', {
      p_catalog: product.id,
      p_tag: tag,
      p_limit: limit,
    });
    if (!error && Array.isArray(data) && data.length) {
      return diversifyTiedTop4(data.map((row) => asJourneyClip(row as Record<string, unknown>)));
    }
    const fallback = await supabase
      .from('video_cache')
      .select(SELECT_CLIP)
      .eq('catalog_product_id', product.id)
      .contains('content_tags', [tag])
      .limit(limit);
    if (!fallback.error && fallback.data?.length) {
      return diversifyTiedTop4(
        fallback.data
          .map((row) => asJourneyClip(row as Record<string, unknown>))
          .sort((a, b) => b.wilson - a.wilson),
      );
    }

    // Untagged / under-classified cache: still show product clips that match this chip.
    const any = await supabase
      .from('video_cache')
      .select(SELECT_CLIP)
      .eq('catalog_product_id', product.id)
      .order('fetched_at', { ascending: false })
      .limit(Math.max(limit, 24));
    if (any.error || !any.data?.length) return [];
    const matched = any.data
      .map((row) => asJourneyClip(row as Record<string, unknown>))
      .filter((clip) =>
        clipMatchesTag(clip.title, clip.author, tag, clip.contentTags),
      )
      .sort((a, b) => b.wilson - a.wilson);
    if (matched.length) return diversifyTiedTop4(matched);

    // Last resort: show product clips under who_its_for so the shelf is never empty.
    if (tag === 'who_its_for') {
      return diversifyTiedTop4(
        any.data
          .map((row) => {
            const clip = asJourneyClip(row as Record<string, unknown>);
            if (clip.contentTags.length) return clip;
            const guessed = heuristicContentTags(clip.title, clip.author);
            return { ...clip, contentTags: guessed.tags };
          })
          .sort((a, b) => b.wilson - a.wilson),
      );
    }
    return [];
  } catch {
    return [];
  }
}

/** Prefer a different platform in the top 4 when Wilson scores are tied. */
function diversifyTiedTop4(clips: JourneyClip[]): JourneyClip[] {
  const out = [...clips];
  for (let i = 1; i < Math.min(4, out.length); i += 1) {
    if (Math.abs(out[i].wilson - out[i - 1].wilson) > 1e-9) continue;
    if (out[i].platform === out[i - 1].platform) {
      const swap = out.findIndex(
        (clip, index) =>
          index > i &&
          Math.abs(clip.wilson - out[i].wilson) <= 1e-9 &&
          clip.platform !== out[i].platform,
      );
      if (swap > 0) {
        const current = out[i];
        out[i] = out[swap];
        out[swap] = current;
      }
    }
  }
  return out;
}

export function voterKeyFor(profileId?: string | null): string {
  if (profileId) return profileId;
  if (typeof localStorage === 'undefined') return 'anon-local';
  const existing = localStorage.getItem('sourced-voter-key');
  if (existing) return existing;
  const next = `anon-${Math.random().toString(36).slice(2, 12)}`;
  localStorage.setItem('sourced-voter-key', next);
  return next;
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

export async function loadJourneyForTag(
  product: Product,
  tag: ContentTagKey,
): Promise<{ clips: JourneyClip[]; discovered: boolean }> {
  const cached = await loadTaggedClips(product, tag);
  if (cached.length >= CACHE_FIRST_THRESHOLD) {
    return { clips: cached, discovered: false };
  }
  try {
    await discoverProductJourney(product);
  } catch {
    return { clips: cached, discovered: false };
  }
  const filled = await loadTaggedClips(product, tag);
  return { clips: filled, discovered: true };
}

export async function discoverProductJourney(product: Product): Promise<void> {
  const { error } = await discoverVideosForProduct(product);
  if (error) throw new Error(error);
}

export async function submitVideoVote(videoId: string, voterKey: string, isHelpful: boolean) {
  return voteOnVideo(videoId, voterKey, isHelpful);
}

export async function loadMyVideoVote(videoId: string, voterKey: string): Promise<boolean | null> {
  if (!supabase || !voterKey) return null;
  try {
    const { data, error } = await supabase
      .from('video_feedback')
      .select('is_helpful')
      .eq('video_id', videoId)
      .eq('voter_key', voterKey)
      .maybeSingle();
    if (error || !data) return null;
    return Boolean(data.is_helpful);
  } catch {
    return null;
  }
}

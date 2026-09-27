import { invokeCachedRead } from './cachedRead';
import { voteOnVideo } from './discoverVideos';
import { clipMatchesTag, heuristicContentTags } from './heuristicTags';
import { supabase } from './supabase';
import { CACHE_FIRST_THRESHOLD, wilsonScore, type ContentTagKey } from './taxonomy';
import type { Product } from './types';
import { ensureYoutubeVideosForProduct } from './youtube';

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
  const title = decodeEntities(String(row.title ?? 'Video'));
  const author = decodeEntities(String(row.channel_or_author ?? row.channel_title ?? ''));
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
function clipFromCachedPayload(row: Record<string, unknown>): JourneyClip {
  const helpful = Number(row.helpfulCount ?? row.helpful_count ?? 0);
  const notHelpful = Number(row.notHelpfulCount ?? row.not_helpful_count ?? 0);
  const tags = Array.isArray(row.contentTags)
    ? (row.contentTags as string[]).filter((t): t is ContentTagKey =>
        [
          'how_it_works',
          'how_to_use',
          'composition',
          'who_its_for',
          'results_over_time',
          'precautions',
          'comparisons',
        ].includes(t),
      )
    : Array.isArray(row.content_tags)
      ? (row.content_tags as string[]).filter((t): t is ContentTagKey =>
          [
            'how_it_works',
            'how_to_use',
            'composition',
            'who_its_for',
            'results_over_time',
            'precautions',
            'comparisons',
          ].includes(t),
        )
      : [];
  return {
    id: String(row.id),
    platform: asPlatform(String(row.platform ?? row.source_platform ?? 'youtube')),
    sourceUrl: String(row.sourceUrl ?? row.source_url ?? ''),
    embedHtml: (row.embedHtml as string | null) ?? (row.embed_html as string | null) ?? null,
    youtubeVideoId:
      (row.youtubeVideoId as string | null) ?? (row.youtube_video_id as string | null) ?? null,
    title: decodeEntities(String(row.title ?? 'Video')),
    author: String(row.author ?? row.channel_or_author ?? row.channel_title ?? ''),
    thumbnailUrl: String(row.thumbnailUrl ?? row.thumbnail_url ?? ''),
    durationSeconds:
      (row.durationSeconds as number | null) ?? (row.duration_seconds as number | null) ?? null,
    contentTags: tags,
    classificationConfidence:
      row.classificationConfidence == null && row.classification_confidence == null
        ? null
        : Number(row.classificationConfidence ?? row.classification_confidence),
    classificationJustification:
      (row.classificationJustification as string | null) ??
      (row.classification_justification as string | null) ??
      null,
    helpfulCount: helpful,
    notHelpfulCount: notHelpful,
    wilson: wilsonScore(helpful, notHelpful),
  };
}

export async function loadTaggedClips(
  product: Product,
  tag: ContentTagKey,
  limit = 40,
): Promise<JourneyClip[]> {
  const page = 1;
  const pageLimit = Math.min(Math.max(limit, 1), 40);
  const cached = await invokeCachedRead<{ clips?: Record<string, unknown>[] }>({
    action: 'tagged_videos',
    productId: product.id,
    tag,
    page,
    limit: pageLimit,
  });
  if (cached?.clips?.length) {
    const clips = cached.clips
      .map((row) => clipFromCachedPayload(row))
      .filter((clip) => clip.platform === 'youtube');
    if (clips.length) return diversifyTiedTop4(clips);
  }

  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc('list_tagged_videos', {
      p_catalog: product.id,
      p_tag: tag,
      p_limit: limit,
    });
    if (!error && Array.isArray(data) && data.length) {
      const youtubeOnly = data
        .map((row) => asJourneyClip(row as Record<string, unknown>))
        .filter((clip) => clip.platform === 'youtube');
      if (youtubeOnly.length) return diversifyTiedTop4(youtubeOnly);
    }
    const fallback = await supabase
      .from('video_cache')
      .select(SELECT_CLIP)
      .eq('catalog_product_id', product.id)
      .eq('source_platform', 'youtube')
      .contains('content_tags', [tag])
      .limit(limit);
    if (!fallback.error && fallback.data?.length) {
      return diversifyTiedTop4(
        fallback.data
          .map((row) => asJourneyClip(row as Record<string, unknown>))
          .sort((a, b) => b.wilson - a.wilson),
      );
    }

    // Untagged / under-classified cache: still show YouTube clips that match this chip.
    const any = await supabase
      .from('video_cache')
      .select(SELECT_CLIP)
      .eq('catalog_product_id', product.id)
      .eq('source_platform', 'youtube')
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

const TAG_LABEL: Record<ContentTagKey, string> = {
  how_it_works: 'How it works',
  how_to_use: 'How to use',
  composition: 'What’s inside',
  who_its_for: 'Worth it?',
  results_over_time: 'Long-term',
  precautions: 'Watch out',
  comparisons: 'Compared',
};

export function clipLabel(clip: JourneyClip): string {
  const tag = clip.contentTags[0] ?? heuristicContentTags(clip.title, clip.author).tags[0];
  return tag ? TAG_LABEL[tag] : 'Review';
}

async function cachedProductClips(productId: string): Promise<JourneyClip[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('video_cache')
    .select(SELECT_CLIP)
    .eq('catalog_product_id', productId)
    .eq('source_platform', 'youtube')
    .order('fetched_at', { ascending: false })
    .limit(12);
  if (error || !data) return [];
  return data.map((row) => asJourneyClip(row as Record<string, unknown>)).filter((c) => c.youtubeVideoId && c.thumbnailUrl);
}

/** Literacy clips for any product: cache first, then a YouTube fetch that fills the cache. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export async function loadProductClips(product: Pick<Product, 'id' | 'name' | 'brand'>): Promise<JourneyClip[]> {
  const cached = await cachedProductClips(product.id).catch(() => []);
  if (cached.length >= 3) return cached.slice(0, 8);
  const { clips } = await ensureYoutubeVideosForProduct(product);
  const refreshed = await cachedProductClips(product.id).catch(() => []);
  if (refreshed.length) return refreshed.slice(0, 8);
  return clips.slice(0, 8).map((clip) => ({
    id: `yt-${clip.youtubeVideoId}`,
    platform: 'youtube' as const,
    sourceUrl: `https://www.youtube.com/watch?v=${clip.youtubeVideoId}`,
    embedHtml: null,
    youtubeVideoId: clip.youtubeVideoId,
    title: decodeEntities(clip.title),
    author: decodeEntities(clip.channelTitle),
    thumbnailUrl: clip.thumbnailUrl,
    durationSeconds: clip.durationSeconds,
    contentTags: [],
    classificationConfidence: null,
    classificationJustification: null,
    helpfulCount: 0,
    notHelpfulCount: 0,
    wilson: 0,
  }));
}

const TAG_QUERY: Record<ContentTagKey, string> = {
  how_it_works: 'how it works explained',
  how_to_use: 'how to use setup guide',
  composition: 'teardown inside specs',
  who_its_for: 'is it worth it review',
  results_over_time: 'long term review months later',
  precautions: 'problems issues before you buy',
  comparisons: 'vs comparison',
};

function tagQuery(tag: ContentTagKey, category: string): string {
  if (tag === 'composition') {
    if (/skin|hair|beauty|cosmetic|serum|cream|food|drink|snack|supplement|protein|vitamin|coffee|tea/i.test(category)) return 'ingredients explained';
    if (/shoe|sneaker|cloth|shirt|dress|jacket|bag|apparel|wear/i.test(category)) return 'material quality fit sizing';
  }
  if (tag === 'results_over_time' && /skin|hair|beauty|serum|cream/i.test(category)) return 'results before after weeks';
  if (tag === 'how_to_use' && /food|drink|coffee|tea|supplement|protein/i.test(category)) return 'how to prepare';
  return TAG_QUERY[tag];
}

const tagFetched = new Set<string>();

/** Clips that teach one thing about a product: tagged cache first, then a tag-targeted YouTube search. */
export async function loadTagClips(
  product: Pick<Product, 'id' | 'name' | 'brand' | 'category'>,
  tag: ContentTagKey,
): Promise<JourneyClip[]> {
  const cached = await loadTaggedClips(product as Product, tag).catch(() => [] as JourneyClip[]);
  const key = `${product.id}|${tag}`;
  if (cached.length >= 3 || !supabase || tagFetched.has(key)) return cached;
  tagFetched.add(key);
  const name = product.brand && !product.name.toLowerCase().startsWith(product.brand.toLowerCase()) ? `${product.brand} ${product.name}` : product.name;
  await supabase.functions
    .invoke('youtube-fetch', {
      body: { query: `${name} ${tagQuery(tag, product.category ?? '')}`.slice(0, 100), catalogProductId: product.id, productName: product.name, brand: product.brand, tag },
    })
    .catch(() => null);
  const refreshed = await loadTaggedClips(product as Product, tag).catch(() => [] as JourneyClip[]);
  return refreshed.length ? refreshed : cached;
}

/** How many cached clips sit under each tag for a product. */
export async function loadTagCounts(productId: string): Promise<Partial<Record<ContentTagKey, number>>> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('video_cache')
    .select('content_tags')
    .eq('catalog_product_id', productId)
    .eq('source_platform', 'youtube')
    .limit(200);
  if (error || !data) return {};
  const counts: Partial<Record<ContentTagKey, number>> = {};
  for (const row of data) {
    for (const t of (row.content_tags as string[] | null) ?? []) {
      const k = t as ContentTagKey;
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  return counts;
}

export async function discoverProductJourney(product: Product): Promise<void> {
  // YouTube-only discovery. Serper is disabled for product search.
  const { error } = await ensureYoutubeVideosForProduct(product);
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

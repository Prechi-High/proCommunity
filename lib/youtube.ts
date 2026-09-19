import Constants from 'expo-constants';

import {
  COMMENT_REPLIES_PER_THREAD,
  COMMENT_THREADS_FETCH,
  filterMeaningfulThreads,
} from './commentQuality';
import { supabase } from './supabase';
import type { Product } from './types';
import { isShortFormYoutube, isoDurationToSeconds } from './youtubeDuration';

export interface YoutubeClip {
  youtubeVideoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSeconds: number | null;
}

const memory = new Map<string, { at: number; clips: YoutubeClip[]; empty?: boolean }>();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EMPTY_MS = 60 * 1000;

function youtubeKey(): string {
  const extra = Constants.expoConfig?.extra as { youtubeDataApiKey?: string } | undefined;
  return extra?.youtubeDataApiKey?.trim() || process.env.EXPO_PUBLIC_YOUTUBE_DATA_API_KEY?.trim() || '';
}

function searchQuery(productName: string, brand: string): string {
  return `${brand} ${productName} review skincare`.replace(/\s+/g, ' ').trim().slice(0, 80);
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' ',
};

/** YouTube returns HTML-escaped snippet text; it is rendered as plain text here. */
function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
    const named = ENTITIES[code.toLowerCase()];
    if (named) return named;
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(parseInt(code.slice(2), 16));
    }
    if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
    return match;
  });
}

function mapYoutubeItems(items: unknown): YoutubeClip[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const row = item as {
        id?: { videoId?: string };
        snippet?: {
          title?: string;
          channelTitle?: string;
          thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
        };
      };
      return {
        youtubeVideoId: row.id?.videoId ?? '',
        title: decodeEntities(row.snippet?.title ?? 'Video'),
        channelTitle: decodeEntities(row.snippet?.channelTitle ?? ''),
        thumbnailUrl:
          row.snippet?.thumbnails?.medium?.url ?? row.snippet?.thumbnails?.default?.url ?? '',
        durationSeconds: null,
      };
    })
    .filter((clip) => Boolean(clip.youtubeVideoId));
}

function remember(key: string, clips: YoutubeClip[]) {
  memory.set(key, { at: Date.now(), clips, empty: clips.length === 0 });
}

async function attachYoutubeDurations(clips: YoutubeClip[]): Promise<YoutubeClip[]> {
  const key = youtubeKey();
  const ids = clips.map((clip) => clip.youtubeVideoId).filter(Boolean);
  if (!key || !ids.length) return [];
  const params = new URLSearchParams({
    part: 'contentDetails',
    id: ids.join(','),
    key,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
  if (!response.ok) return [];
  const json = (await response.json()) as {
    items?: Array<{ id?: string; contentDetails?: { duration?: string } }>;
  };
  const durations = new Map(
    (json.items ?? []).map((item) => [item.id ?? '', isoDurationToSeconds(item.contentDetails?.duration)]),
  );
  return clips
    .map((clip) => ({
      ...clip,
      durationSeconds: durations.get(clip.youtubeVideoId) ?? clip.durationSeconds,
    }))
    .filter((clip) => isShortFormYoutube(clip.durationSeconds));
}

async function searchYoutubeDirect(query: string): Promise<YoutubeClip[]> {
  const key = youtubeKey();
  if (!key) return [];
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '15',
    q: query,
    key,
    safeSearch: 'moderate',
    videoEmbeddable: 'true',
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  if (!response.ok) return [];
  const json = (await response.json()) as { items?: unknown };
  return attachYoutubeDurations(mapYoutubeItems(json.items).slice(0, 12));
}

async function searchViaProxy(query: string): Promise<YoutubeClip[]> {
  try {
    const response = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    const json = (await response.json()) as { clips?: YoutubeClip[] };
    return (json.clips ?? [])
      .filter((clip) => clip.youtubeVideoId && isShortFormYoutube(clip.durationSeconds ?? null))
      .map((clip) => ({
        ...clip,
        title: decodeEntities(clip.title),
        channelTitle: decodeEntities(clip.channelTitle),
        durationSeconds: clip.durationSeconds ?? null,
      }));
  } catch {
    return [];
  }
}

export async function loadProductVideos(productName: string, brand: string): Promise<YoutubeClip[]> {
  return loadProductVideosForCatalog({ name: productName, brand, id: '' });
}

/** DB-first YouTube clips for a catalog product; fetches via youtube-fetch when thin. */
export async function ensureYoutubeVideosForProduct(
  product: Pick<Product, 'id' | 'name' | 'brand'>,
): Promise<{ clips: YoutubeClip[]; error: string | null }> {
  try {
    const clips = await loadProductVideosForCatalog(product);
    return { clips, error: null };
  } catch (error) {
    return { clips: [], error: error instanceof Error ? error.message : String(error) };
  }
}

async function loadProductVideosForCatalog(
  product: Pick<Product, 'id' | 'name' | 'brand'>,
): Promise<YoutubeClip[]> {
  const productName = product.name;
  const brand = product.brand;
  const cacheKey = `${product.id || brand} ${productName}`.trim().toLowerCase();
  const hit = memory.get(cacheKey);
  if (hit) {
    const maxAge = hit.empty ? EMPTY_MS : WEEK_MS;
    if (Date.now() - hit.at < maxAge) return hit.clips;
  }

  const query = searchQuery(productName, brand);

  if (supabase && product.id) {
    try {
      const { data, error } = await supabase
        .from('video_cache')
        .select(
          'youtube_video_id, title, channel_title, thumbnail_url, fetched_at, pending_review, source_platform, duration_seconds',
        )
        .eq('source_platform', 'youtube')
        .eq('catalog_product_id', product.id)
        .limit(12);
      if (!error && data?.length) {
        const fresh = data.filter((row) => Date.now() - +new Date(row.fetched_at as string) < WEEK_MS);
        const short = fresh.filter((row) => isShortFormYoutube(row.duration_seconds as number | null));
        if (short.length >= 4) {
          const clips = short.slice(0, 6).map((row) => ({
            youtubeVideoId: String(row.youtube_video_id),
            title: decodeEntities(String(row.title ?? 'Video')),
            channelTitle: decodeEntities(String(row.channel_title ?? '')),
            thumbnailUrl: String(row.thumbnail_url ?? ''),
            durationSeconds: (row.duration_seconds as number | null) ?? null,
          }));
          remember(cacheKey, clips);
          return clips;
        }
      }
    } catch {
      // table may not exist yet
    }

    try {
      const { data: invoked, error } = await supabase.functions.invoke('youtube-fetch', {
        body: {
          query,
          catalogProductId: product.id,
          productName,
          brand,
        },
      });
      if (error) {
        // fall through to proxy / direct
      } else if (invoked?.clips?.length) {
        const clips = (invoked.clips as YoutubeClip[])
          .filter((clip) => isShortFormYoutube(clip.durationSeconds ?? null))
          .map((clip) => ({
            ...clip,
            title: decodeEntities(clip.title),
            channelTitle: decodeEntities(clip.channelTitle),
            durationSeconds: clip.durationSeconds ?? null,
          }));
        if (clips.length) {
          remember(cacheKey, clips);
          return clips;
        }
      }
    } catch {
      // function may not be deployed yet
    }
  } else if (supabase) {
    // Legacy title search when no catalog id (thread bootstrap).
    try {
      const { data, error } = await supabase
        .from('video_cache')
        .select(
          'youtube_video_id, title, channel_title, thumbnail_url, fetched_at, pending_review, source_platform, duration_seconds',
        )
        .eq('source_platform', 'youtube')
        .eq('pending_review', false)
        .ilike('title', `%${productName.slice(0, 24).replace(/[%_,]/g, ' ')}%`)
        .limit(12);
      if (!error && data?.length) {
        const fresh = data.filter((row) => Date.now() - +new Date(row.fetched_at as string) < WEEK_MS);
        const short = fresh.filter((row) => isShortFormYoutube(row.duration_seconds as number | null));
        if (short.length) {
          const clips = short.slice(0, 6).map((row) => ({
            youtubeVideoId: String(row.youtube_video_id),
            title: decodeEntities(String(row.title ?? 'Video')),
            channelTitle: decodeEntities(String(row.channel_title ?? '')),
            thumbnailUrl: String(row.thumbnail_url ?? ''),
            durationSeconds: (row.duration_seconds as number | null) ?? null,
          }));
          remember(cacheKey, clips);
          return clips;
        }
      }
    } catch {
      // ignore
    }

    try {
      const { data: invoked, error } = await supabase.functions.invoke('youtube-fetch', {
        body: { query, productName, brand },
      });
      if (!error && invoked?.clips?.length) {
        const clips = (invoked.clips as YoutubeClip[])
          .filter((clip) => isShortFormYoutube(clip.durationSeconds ?? null))
          .map((clip) => ({
            ...clip,
            title: decodeEntities(clip.title),
            channelTitle: decodeEntities(clip.channelTitle),
            durationSeconds: clip.durationSeconds ?? null,
          }));
        if (clips.length) {
          remember(cacheKey, clips);
          return clips;
        }
      }
    } catch {
      // ignore
    }
  }

  const fromProxy = await searchViaProxy(query);
  if (fromProxy.length) {
    remember(cacheKey, fromProxy);
    return fromProxy;
  }

  const live = await searchYoutubeDirect(query);
  remember(cacheKey, live);
  return live;
}

export type VideoJourneyTag = 'who_this_is_for' | 'results_over_time' | 'how_to_use';

export const JOURNEY_LABELS: Record<VideoJourneyTag, string> = {
  who_this_is_for: "Who it's for",
  results_over_time: 'Results over time',
  how_to_use: 'How to use',
};

export function tagVideo(clip: YoutubeClip): VideoJourneyTag {
  const text = `${clip.title} ${clip.channelTitle}`.toLowerCase();
  if (/\bhow to\b|tutorial|routine|apply|layer|application|use this/.test(text)) return 'how_to_use';
  if (/week|result|before|after|month|progress|transform|journey/.test(text)) return 'results_over_time';
  return 'who_this_is_for';
}

export interface LiveYoutubeComment {
  id: string;
  authorDisplayName: string;
  body: string;
  youtubeVideoId: string;
  parentId: string | null;
  likeCount: number;
  evidenceScore: number;
  isMeaningful: boolean;
  replies: LiveYoutubeComment[];
}

type YoutubeThreadItem = {
  id?: string;
  snippet?: {
    topLevelComment?: {
      id?: string;
      snippet?: {
        authorDisplayName?: string;
        textDisplay?: string;
        likeCount?: number;
      };
    };
    totalReplyCount?: number;
  };
  replies?: {
    comments?: Array<{
      id?: string;
      snippet?: {
        authorDisplayName?: string;
        textDisplay?: string;
        likeCount?: number;
        parentId?: string;
      };
    }>;
  };
};

function mapThreadItems(videoId: string, items: YoutubeThreadItem[]): LiveYoutubeComment[] {
  const raw = (items ?? []).map((item) => {
    const top = item.snippet?.topLevelComment;
    const topId = top?.id ?? item.id ?? '';
    const replies = (item.replies?.comments ?? [])
      .slice(0, COMMENT_REPLIES_PER_THREAD)
      .map((reply) => ({
        id: reply.id ?? '',
        youtubeVideoId: videoId,
        authorDisplayName: decodeEntities(reply.snippet?.authorDisplayName ?? 'YouTube viewer'),
        body: decodeEntities(reply.snippet?.textDisplay ?? ''),
        parentId: topId,
        likeCount: Number(reply.snippet?.likeCount ?? 0),
      }));
    return {
      id: topId,
      youtubeVideoId: videoId,
      authorDisplayName: decodeEntities(top?.snippet?.authorDisplayName ?? 'YouTube viewer'),
      body: decodeEntities(top?.snippet?.textDisplay ?? ''),
      parentId: null as string | null,
      likeCount: Number(top?.snippet?.likeCount ?? 0),
      replies,
    };
  });

  return filterMeaningfulThreads(raw).map((thread) => ({
    id: thread.id,
    youtubeVideoId: thread.youtubeVideoId,
    authorDisplayName: thread.authorDisplayName,
    body: thread.body,
    parentId: null,
    likeCount: thread.likeCount,
    evidenceScore: thread.evidenceScore,
    isMeaningful: thread.isMeaningful,
    replies: thread.replies.map((reply) => ({
      id: reply.id,
      youtubeVideoId: reply.youtubeVideoId,
      authorDisplayName: reply.authorDisplayName,
      body: reply.body,
      parentId: thread.id,
      likeCount: reply.likeCount,
      evidenceScore: reply.evidenceScore,
      isMeaningful: true,
      replies: [],
    })),
  }));
}

export async function loadYoutubeComments(videoId: string): Promise<LiveYoutubeComment[]> {
  if (!videoId) return [];
  try {
    const response = await fetch(`/api/youtube?videoId=${encodeURIComponent(videoId)}`);
    if (response.ok) {
      const json = (await response.json()) as { comments?: LiveYoutubeComment[] };
      if (json.comments?.length) return json.comments;
    }
  } catch {
    // proxy may be missing locally
  }

  const key = youtubeKey();
  if (!key) return [];
  const params = new URLSearchParams({
    part: 'snippet,replies',
    videoId,
    maxResults: String(COMMENT_THREADS_FETCH),
    order: 'relevance',
    textFormat: 'plainText',
    key,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${params.toString()}`);
  if (!response.ok) return [];
  const json = (await response.json()) as { items?: YoutubeThreadItem[] };
  return mapThreadItems(videoId, json.items ?? []);
}

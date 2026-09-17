import Constants from 'expo-constants';

import { supabase } from './supabase';

export interface YoutubeClip {
  youtubeVideoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
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
      };
    })
    .filter((clip) => Boolean(clip.youtubeVideoId));
}

function remember(key: string, clips: YoutubeClip[]) {
  memory.set(key, { at: Date.now(), clips, empty: clips.length === 0 });
}

async function searchYoutubeDirect(query: string): Promise<YoutubeClip[]> {
  const key = youtubeKey();
  if (!key) return [];
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '6',
    q: query,
    key,
    safeSearch: 'moderate',
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  if (!response.ok) return [];
  const json = (await response.json()) as { items?: unknown };
  return mapYoutubeItems(json.items);
}

async function searchViaProxy(query: string): Promise<YoutubeClip[]> {
  try {
    const response = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    const json = (await response.json()) as { clips?: YoutubeClip[] };
    return (json.clips ?? [])
      .filter((clip) => clip.youtubeVideoId)
      .map((clip) => ({
        ...clip,
        title: decodeEntities(clip.title),
        channelTitle: decodeEntities(clip.channelTitle),
      }));
  } catch {
    return [];
  }
}

export async function loadProductVideos(productName: string, brand: string): Promise<YoutubeClip[]> {
  const cacheKey = `${brand} ${productName}`.trim().toLowerCase();
  const hit = memory.get(cacheKey);
  if (hit) {
    const maxAge = hit.empty ? EMPTY_MS : WEEK_MS;
    if (Date.now() - hit.at < maxAge) return hit.clips;
  }

  const query = searchQuery(productName, brand);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('video_cache')
        .select('youtube_video_id, title, channel_title, thumbnail_url, fetched_at, pending_review, source_platform')
        .eq('source_platform', 'youtube')
        .eq('pending_review', false)
        .ilike('title', `%${productName.slice(0, 24).replace(/[%_,]/g, ' ')}%`)
        .limit(6);
      if (!error && data?.length) {
        const fresh = data.filter((row) => Date.now() - +new Date(row.fetched_at as string) < WEEK_MS);
        if (fresh.length) {
          const clips = fresh.map((row) => ({
            youtubeVideoId: String(row.youtube_video_id),
            title: decodeEntities(String(row.title ?? 'Video')),
            channelTitle: decodeEntities(String(row.channel_title ?? '')),
            thumbnailUrl: String(row.thumbnail_url ?? ''),
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
        body: { query },
      });
      if (!error && invoked?.clips?.length) {
        const clips = (invoked.clips as YoutubeClip[]).map((clip) => ({
          ...clip,
          title: decodeEntities(clip.title),
          channelTitle: decodeEntities(clip.channelTitle),
        }));
        remember(cacheKey, clips);
        return clips;
      }
    } catch {
      // function may not be deployed yet
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
    part: 'snippet',
    videoId,
    maxResults: '5',
    textFormat: 'plainText',
    key,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${params.toString()}`);
  if (!response.ok) return [];
  const json = (await response.json()) as {
    items?: Array<{
      id?: string;
      snippet?: {
        topLevelComment?: {
          snippet?: { authorDisplayName?: string; textDisplay?: string };
        };
      };
    }>;
  };
  return (json.items ?? [])
    .map((item) => ({
      id: item.id ?? '',
      youtubeVideoId: videoId,
      authorDisplayName: decodeEntities(
        item.snippet?.topLevelComment?.snippet?.authorDisplayName ?? 'YouTube viewer',
      ),
      body: decodeEntities(item.snippet?.topLevelComment?.snippet?.textDisplay ?? ''),
    }))
    .filter((comment) => Boolean(comment.body));
}

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
        title: row.snippet?.title ?? 'Video',
        channelTitle: row.snippet?.channelTitle ?? '',
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
    return json.clips?.filter((clip) => clip.youtubeVideoId) ?? [];
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
        .select('youtube_video_id, title, channel_title, thumbnail_url, fetched_at')
        .ilike('title', `%${productName.slice(0, 24).replace(/[%_,]/g, ' ')}%`)
        .limit(6);
      if (!error && data?.length) {
        const fresh = data.filter((row) => Date.now() - +new Date(row.fetched_at as string) < WEEK_MS);
        if (fresh.length) {
          const clips = fresh.map((row) => ({
            youtubeVideoId: String(row.youtube_video_id),
            title: String(row.title ?? 'Video'),
            channelTitle: String(row.channel_title ?? ''),
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
        remember(cacheKey, invoked.clips);
        return invoked.clips as YoutubeClip[];
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

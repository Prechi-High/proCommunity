import { supabase } from './supabase';

export interface YoutubeClip {
  youtubeVideoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

const memory = new Map<string, { at: number; clips: YoutubeClip[] }>();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function loadProductVideos(productName: string, brand: string): Promise<YoutubeClip[]> {
  const key = `${brand} ${productName}`.trim().toLowerCase();
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < WEEK_MS) return hit.clips;

  if (supabase) {
    const { data } = await supabase
      .from('video_cache')
      .select('youtube_video_id, title, channel_title, thumbnail_url, fetched_at')
      .ilike('title', `%${productName.slice(0, 24).replace(/[%_,]/g, ' ')}%`)
      .limit(6);
    const fresh =
      data?.filter((row) => Date.now() - +new Date(row.fetched_at as string) < WEEK_MS) ?? [];
    if (fresh.length) {
      const clips = fresh.map((row) => ({
        youtubeVideoId: String(row.youtube_video_id),
        title: String(row.title ?? 'Video'),
        channelTitle: String(row.channel_title ?? ''),
        thumbnailUrl: String(row.thumbnail_url ?? ''),
      }));
      memory.set(key, { at: Date.now(), clips });
      return clips;
    }

    const { data: invoked, error } = await supabase.functions.invoke('youtube-fetch', {
      body: { query: `${brand} ${productName} review skincare` },
    });
    if (!error && invoked?.clips?.length) {
      memory.set(key, { at: Date.now(), clips: invoked.clips });
      return invoked.clips as YoutubeClip[];
    }
  }

  return [];
}

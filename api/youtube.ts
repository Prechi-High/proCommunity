import { createClient } from '@supabase/supabase-js';
import {
  COMMENT_REPLIES_PER_THREAD,
  COMMENT_THREADS_FETCH,
  filterMeaningfulThreads,
  type ThreadComment,
} from '../lib/commentQuality';
import { isShortFormYoutube, isoDurationToSeconds } from '../lib/youtubeDuration';

type QueryReq = {
  method?: string;
  query?: { q?: string | string[]; videoId?: string | string[] };
  body?: { query?: string; videoId?: string };
};
type QueryRes = { status: (code: number) => { json: (body: unknown) => void } };

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
  };
  replies?: {
    comments?: Array<{
      id?: string;
      snippet?: {
        authorDisplayName?: string;
        textDisplay?: string;
        likeCount?: number;
      };
    }>;
  };
};

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function mapMeaningfulThreads(videoId: string, items: YoutubeThreadItem[]): ThreadComment[] {
  const raw = (items ?? []).map((item) => {
    const top = item.snippet?.topLevelComment;
    const topId = top?.id ?? item.id ?? '';
    const replies = (item.replies?.comments ?? []).slice(0, COMMENT_REPLIES_PER_THREAD).map((reply) => ({
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
  return filterMeaningfulThreads(raw);
}

function toApiComments(threads: ThreadComment[]) {
  return threads.map((thread) => ({
    id: thread.id,
    youtubeVideoId: thread.youtubeVideoId,
    authorDisplayName: thread.authorDisplayName,
    body: thread.body,
    parentId: null as string | null,
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
      replies: [] as unknown[],
    })),
  }));
}

async function persistMeaningfulComments(videoId: string, threads: ThreadComment[]) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !threads.length) return;
  const client = createClient(url, key, { auth: { persistSession: false } });
  const parents = threads.map((thread) => ({
    id: thread.id,
    youtube_video_id: videoId,
    author_display_name: thread.authorDisplayName.slice(0, 120),
    body: thread.body.slice(0, 4000),
    parent_comment_id: null,
    like_count: thread.likeCount,
    reply_count: thread.replies.length,
    is_meaningful: true,
    evidence_score: thread.evidenceScore,
    fetched_at: new Date().toISOString(),
  }));
  const replies = threads.flatMap((thread) =>
    thread.replies.map((reply) => ({
      id: reply.id,
      youtube_video_id: videoId,
      author_display_name: reply.authorDisplayName.slice(0, 120),
      body: reply.body.slice(0, 4000),
      parent_comment_id: thread.id,
      like_count: reply.likeCount,
      reply_count: 0,
      is_meaningful: true,
      evidence_score: reply.evidenceScore,
      fetched_at: new Date().toISOString(),
    })),
  );
  await client.from('youtube_comments').upsert(parents, { onConflict: 'id' });
  if (replies.length) {
    await client.from('youtube_comments').upsert(replies, { onConflict: 'id' });
  }
}

export default async function handler(req: QueryReq, res: QueryRes) {
  const key = process.env.YOUTUBE_DATA_API_KEY;
  if (!key) {
    res.status(500).json({ clips: [], comments: [], error: 'missing_youtube_key' });
    return;
  }

  const rawVideo = req.query?.videoId ?? req.body?.videoId ?? '';
  const videoId = String(Array.isArray(rawVideo) ? rawVideo[0] : rawVideo).trim();
  if (videoId) {
    const params = new URLSearchParams({
      part: 'snippet,replies',
      videoId,
      maxResults: String(COMMENT_THREADS_FETCH),
      order: 'relevance',
      textFormat: 'plainText',
      key,
    });
    const youtube = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${params.toString()}`);
    const payload = (await youtube.json()) as { items?: YoutubeThreadItem[] };
    const threads = mapMeaningfulThreads(videoId, payload.items ?? []);
    await persistMeaningfulComments(videoId, threads).catch(() => undefined);
    res.status(200).json({ comments: toApiComments(threads) });
    return;
  }

  const raw = req.query?.q ?? req.body?.query ?? '';
  const query = String(Array.isArray(raw) ? raw[0] : raw).trim().slice(0, 80);
  if (!query) {
    res.status(200).json({ clips: [] });
    return;
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '15',
    q: query,
    key,
    safeSearch: 'moderate',
    videoEmbeddable: 'true',
  });
  const youtube = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  const payload = (await youtube.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
      };
    }>;
  };

  const found = (payload.items ?? [])
    .map((item) => ({
      youtubeVideoId: item.id?.videoId ?? '',
      title: item.snippet?.title ?? 'Video',
      channelTitle: item.snippet?.channelTitle ?? '',
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
      durationSeconds: null as number | null,
    }))
    .filter((clip) => Boolean(clip.youtubeVideoId));

  let clips = found;
  if (found.length) {
    const details = new URLSearchParams({
      part: 'contentDetails',
      id: found.map((clip) => clip.youtubeVideoId).join(','),
      key,
    });
    const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${details.toString()}`);
    const detailJson = (await detailRes.json()) as {
      items?: Array<{ id?: string; contentDetails?: { duration?: string } }>;
    };
    const durations = new Map(
      (detailJson.items ?? []).map((item) => [
        item.id ?? '',
        isoDurationToSeconds(item.contentDetails?.duration),
      ]),
    );
    clips = found
      .map((clip) => ({
        ...clip,
        durationSeconds: durations.get(clip.youtubeVideoId) ?? null,
      }))
      .filter((clip) => isShortFormYoutube(clip.durationSeconds))
      .slice(0, 6);
  }
  res.status(200).json({ clips });
}

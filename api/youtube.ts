import { createClient } from '@supabase/supabase-js';
import {
  COMMENT_REPLIES_PER_THREAD,
  COMMENT_THREADS_FETCH,
  filterMeaningfulThreads,
  type ThreadComment,
} from '../lib/commentQuality';
import {
  CACHE_TTL,
  cacheAside,
  cacheInvalidation,
  logCacheEvent,
  videoCommentsKey,
} from '../lib/server/redis';
import { isShortFormYoutube, isoDurationToSeconds } from '../lib/youtubeDuration';

type QueryReq = {
  method?: string;
  query?: {
    q?: string | string[];
    videoId?: string | string[];
    page?: string | string[];
    limit?: string | string[];
  };
  body?: { query?: string; videoId?: string; page?: number; limit?: number };
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

type ApiComment = ReturnType<typeof toApiComments>[number];

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

function serviceSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function persistMeaningfulComments(videoId: string, threads: ThreadComment[]) {
  const client = serviceSupabase();
  if (!client || !threads.length) return;
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
  await cacheInvalidation.invalidateVideoComments(videoId);
}

/** Prefer persisted meaningful parents + replies before calling YouTube. */
async function loadCommentsFromDb(
  videoId: string,
  page: number,
  limit: number,
): Promise<ApiComment[] | null> {
  const client = serviceSupabase();
  if (!client) return null;
  try {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data: parents, error } = await client
      .from('youtube_comments')
      .select(
        'id, youtube_video_id, author_display_name, body, like_count, evidence_score, is_meaningful',
      )
      .eq('youtube_video_id', videoId)
      .is('parent_comment_id', null)
      .eq('is_meaningful', true)
      .order('evidence_score', { ascending: false })
      .range(from, to);
    if (error || !parents?.length) return null;

    const parentIds = parents.map((row) => String(row.id));
    const { data: replies } = await client
      .from('youtube_comments')
      .select(
        'id, youtube_video_id, author_display_name, body, like_count, evidence_score, parent_comment_id',
      )
      .eq('youtube_video_id', videoId)
      .in('parent_comment_id', parentIds)
      .order('evidence_score', { ascending: false });

    const byParent = new Map<string, typeof replies>();
    for (const reply of replies ?? []) {
      const parentId = String(reply.parent_comment_id ?? '');
      const list = byParent.get(parentId) ?? [];
      list.push(reply);
      byParent.set(parentId, list);
    }

    return parents.map((parent) => {
      const threadReplies = (byParent.get(String(parent.id)) ?? []).slice(0, COMMENT_REPLIES_PER_THREAD);
      return {
        id: String(parent.id),
        youtubeVideoId: videoId,
        authorDisplayName: String(parent.author_display_name ?? 'YouTube viewer'),
        body: String(parent.body ?? ''),
        parentId: null as string | null,
        likeCount: Number(parent.like_count ?? 0),
        evidenceScore: Number(parent.evidence_score ?? 0),
        isMeaningful: true,
        replies: threadReplies.map((reply) => ({
          id: String(reply.id),
          youtubeVideoId: videoId,
          authorDisplayName: String(reply.author_display_name ?? 'YouTube viewer'),
          body: String(reply.body ?? ''),
          parentId: String(parent.id),
          likeCount: Number(reply.like_count ?? 0),
          evidenceScore: Number(reply.evidence_score ?? 0),
          isMeaningful: true,
          replies: [] as unknown[],
        })),
      };
    });
  } catch {
    return null;
  }
}

async function fetchCommentsFromYoutube(
  videoId: string,
  apiKey: string,
  page: number,
  limit: number,
): Promise<ApiComment[]> {
  const params = new URLSearchParams({
    part: 'snippet,replies',
    videoId,
    maxResults: String(Math.min(Math.max(limit, 1), COMMENT_THREADS_FETCH)),
    order: 'relevance',
    textFormat: 'plainText',
    key: apiKey,
  });
  const youtube = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${params.toString()}`);
  const payload = (await youtube.json()) as { items?: YoutubeThreadItem[] };
  const threads = mapMeaningfulThreads(videoId, payload.items ?? []);
  await persistMeaningfulComments(videoId, threads).catch(() => undefined);
  const all = toApiComments(threads);
  const start = (page - 1) * limit;
  return all.slice(start, start + limit);
}

function parsePageLimit(req: QueryReq): { page: number; limit: number } {
  const rawPage = req.query?.page ?? req.body?.page ?? 1;
  const rawLimit = req.query?.limit ?? req.body?.limit ?? COMMENT_THREADS_FETCH;
  const page = Math.min(50, Math.max(1, Number(Array.isArray(rawPage) ? rawPage[0] : rawPage) || 1));
  const limit = Math.min(
    40,
    Math.max(1, Number(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit) || COMMENT_THREADS_FETCH),
  );
  return { page, limit };
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
    const { page, limit } = parsePageLimit(req);
    const cacheKey = videoCommentsKey(videoId, page, limit);
    const comments = await cacheAside<ApiComment[]>({
      key: cacheKey,
      ttlSec: CACHE_TTL.comments(),
      shouldCache: (value) => Array.isArray(value) && value.length > 0,
      onEvent: logCacheEvent,
      loader: async () => {
        const fromDb = await loadCommentsFromDb(videoId, page, limit);
        if (fromDb?.length) return fromDb;
        return fetchCommentsFromYoutube(videoId, key, page, limit);
      },
    });
    res.status(200).json({ comments, page, limit });
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

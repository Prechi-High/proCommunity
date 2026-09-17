import { isShortFormYoutube, isoDurationToSeconds } from '../lib/youtubeDuration';

type QueryReq = { method?: string; query?: { q?: string | string[]; videoId?: string | string[] }; body?: { query?: string; videoId?: string } };
type QueryRes = { status: (code: number) => { json: (body: unknown) => void } };

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
      part: 'snippet',
      videoId,
      maxResults: '5',
      textFormat: 'plainText',
      key,
    });
    const youtube = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${params.toString()}`);
    const payload = (await youtube.json()) as {
      items?: Array<{
        id?: string;
        snippet?: {
          topLevelComment?: {
            snippet?: { authorDisplayName?: string; textDisplay?: string };
          };
        };
      }>;
    };
    const comments = (payload.items ?? [])
      .map((item) => ({
        id: item.id ?? '',
        youtubeVideoId: videoId,
        authorDisplayName: item.snippet?.topLevelComment?.snippet?.authorDisplayName ?? 'YouTube viewer',
        body: item.snippet?.topLevelComment?.snippet?.textDisplay ?? '',
      }))
      .filter((comment) => Boolean(comment.body));
    res.status(200).json({ comments });
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

type QueryReq = { method?: string; query?: { q?: string | string[] }; body?: { query?: string } };
type QueryRes = { status: (code: number) => { json: (body: unknown) => void } };

export default async function handler(req: QueryReq, res: QueryRes) {
  const raw = req.query?.q ?? req.body?.query ?? '';
  const query = String(Array.isArray(raw) ? raw[0] : raw).trim().slice(0, 80);
  if (!query) {
    res.status(200).json({ clips: [] });
    return;
  }

  const key = process.env.YOUTUBE_DATA_API_KEY;
  if (!key) {
    res.status(500).json({ clips: [], error: 'missing_youtube_key' });
    return;
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '6',
    q: query,
    key,
    safeSearch: 'moderate',
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

  const clips = (payload.items ?? [])
    .map((item) => ({
      youtubeVideoId: item.id?.videoId ?? '',
      title: item.snippet?.title ?? 'Video',
      channelTitle: item.snippet?.channelTitle ?? '',
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
    }))
    .filter((clip) => Boolean(clip.youtubeVideoId));

  res.status(200).json({ clips });
}

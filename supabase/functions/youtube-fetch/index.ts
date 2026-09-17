import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_YOUTUBE_SECONDS = 5 * 60;

interface YoutubeClip {
  youtubeVideoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSeconds: number | null;
}

function isoDurationToSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const iso = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!iso) return null;
  return Number(iso[1] ?? 0) * 3600 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const jsonHeaders = { ...cors, "Content-Type": "application/json" };

  try {
    const body = (await req.json()) as { query?: string };
    const query = body.query?.trim();
    if (!query) {
      return new Response(JSON.stringify({ clips: [] }), { headers: jsonHeaders });
    }

    const key = Deno.env.get("YOUTUBE_DATA_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ clips: [], error: "missing_youtube_key" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "15",
      q: query,
      key,
      safeSearch: "moderate",
      videoEmbeddable: "true",
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

    const found: YoutubeClip[] = (payload.items ?? [])
      .map((item) => ({
        youtubeVideoId: item.id?.videoId ?? "",
        title: item.snippet?.title ?? "Video",
        channelTitle: item.snippet?.channelTitle ?? "",
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
        durationSeconds: null,
      }))
      .filter((clip) => Boolean(clip.youtubeVideoId));

    let clips: YoutubeClip[] = [];
    if (found.length) {
      const details = new URLSearchParams({
        part: "contentDetails",
        id: found.map((clip) => clip.youtubeVideoId).join(","),
        key,
      });
      const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${details.toString()}`);
      const detailJson = (await detailRes.json()) as {
        items?: Array<{ id?: string; contentDetails?: { duration?: string } }>;
      };
      const durations = new Map(
        (detailJson.items ?? []).map((item) => [
          item.id ?? "",
          isoDurationToSeconds(item.contentDetails?.duration),
        ]),
      );
      clips = found
        .map((clip) => ({
          ...clip,
          durationSeconds: durations.get(clip.youtubeVideoId) ?? null,
        }))
        .filter((clip) => {
          const seconds = clip.durationSeconds;
          return typeof seconds === "number" && seconds > 0 && seconds <= MAX_YOUTUBE_SECONDS;
        })
        .slice(0, 6);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey && clips.length) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey);
        await supabase.from("video_cache").upsert(
          clips.map((clip) => ({
            youtube_video_id: clip.youtubeVideoId,
            source_platform: "youtube",
            source_url: `https://www.youtube.com/watch?v=${clip.youtubeVideoId}`,
            title: clip.title,
            channel_title: clip.channelTitle,
            channel_or_author: clip.channelTitle,
            thumbnail_url: clip.thumbnailUrl,
            duration_seconds: clip.durationSeconds,
            search_query: query,
            pending_review: false,
            fetched_at: new Date().toISOString(),
          })),
          { onConflict: "search_query,youtube_video_id" },
        );
      } catch {
        // Cache is optional. Still return clips to the app.
      }
    }

    return new Response(JSON.stringify({ clips }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ clips: [], error: String(error) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});

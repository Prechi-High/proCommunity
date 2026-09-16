import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface YoutubeClip {
  youtubeVideoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
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
      maxResults: "6",
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

    const clips: YoutubeClip[] = (payload.items ?? [])
      .map((item) => ({
        youtubeVideoId: item.id?.videoId ?? "",
        title: item.snippet?.title ?? "Video",
        channelTitle: item.snippet?.channelTitle ?? "",
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
      }))
      .filter((clip) => Boolean(clip.youtubeVideoId));

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey && clips.length) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey);
        await supabase.from("video_cache").upsert(
          clips.map((clip) => ({
            youtube_video_id: clip.youtubeVideoId,
            title: clip.title,
            channel_title: clip.channelTitle,
            thumbnail_url: clip.thumbnailUrl,
            search_query: query,
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

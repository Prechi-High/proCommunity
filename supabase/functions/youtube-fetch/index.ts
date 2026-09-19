import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { cacheInvalidation } from "../_shared/redis/invalidate.ts";

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

const HEURISTIC_RULES: Array<{ tag: string; pattern: RegExp }> = [
  { tag: "how_to_use", pattern: /\b(how to|how i|tutorial|routine|apply|application|layer|use this|using|cleanse|wash|steps?)\b/i },
  { tag: "how_it_works", pattern: /\b(how it works|science|mechanism|barrier|ceramide|explains?|dermatologist|why it)\b/i },
  { tag: "composition", pattern: /\b(ingredient|composition|formula|formulati|what.?s in|niacinamide|retinol|salicylic|zinc)\b/i },
  { tag: "who_its_for", pattern: /\b(oily|dry|sensitive|acne|combination|skin type|who (it'?s|is) for|good for)\b/i },
  { tag: "results_over_time", pattern: /\b(before\s*after|results?|week|month|progress|transform|journey|glow|healing)\b/i },
  { tag: "precautions", pattern: /\b(irritat|sting|burn|side effect|patch test|caution|warning|purge|react)\b/i },
  { tag: "comparisons", pattern: /\b(vs\.?|versus|compare|comparison|dupe|alternative|better than)\b/i },
];

function heuristicTags(title: string, author: string): { tags: string[]; confidence: number; justification: string } {
  const hay = `${title} ${author}`.trim();
  const tags: string[] = [];
  if (hay && !/^(instagram|facebook|tiktok|pinterest|youtube)\s*video$/i.test(hay)) {
    for (const rule of HEURISTIC_RULES) {
      if (rule.pattern.test(hay) && !tags.includes(rule.tag)) tags.push(rule.tag);
    }
  }
  if (!tags.length) tags.push("who_its_for");
  return {
    tags: tags.slice(0, 3),
    confidence: tags.length === 1 && tags[0] === "who_its_for" ? 0.71 : 0.78,
    justification: `heuristic:${tags.join(",")}`,
  };
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
    const body = (await req.json()) as {
      query?: string;
      catalogProductId?: string;
      productName?: string;
      brand?: string;
    };
    const catalogProductId = body.catalogProductId?.trim() || null;
    const query =
      body.query?.trim() ||
      `${body.brand ?? ""} ${body.productName ?? ""} review skincare`.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!query) {
      return new Response(JSON.stringify({ clips: [], inserted: 0 }), { headers: jsonHeaders });
    }

    const key = Deno.env.get("YOUTUBE_DATA_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ clips: [], inserted: 0, error: "missing_youtube_key" }), {
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
      error?: { message?: string };
    };

    if (!youtube.ok) {
      return new Response(
        JSON.stringify({ clips: [], inserted: 0, error: payload.error?.message ?? `youtube_http_${youtube.status}` }),
        { status: 502, headers: jsonHeaders },
      );
    }

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

    let inserted = 0;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey && clips.length) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey);
        for (const clip of clips) {
          const guessed = heuristicTags(clip.title, clip.channelTitle);
          const sourceUrl = `https://www.youtube.com/watch?v=${clip.youtubeVideoId}`;
          const row = {
            catalog_product_id: catalogProductId,
            youtube_video_id: clip.youtubeVideoId,
            source_platform: "youtube",
            source_url: sourceUrl,
            title: clip.title,
            channel_title: clip.channelTitle,
            channel_or_author: clip.channelTitle,
            thumbnail_url: clip.thumbnailUrl,
            duration_seconds: clip.durationSeconds,
            search_query: query,
            pending_review: false,
            content_tags: guessed.tags,
            classification_confidence: guessed.confidence,
            classification_method: "title_description",
            classification_justification: guessed.justification,
            fetched_at: new Date().toISOString(),
          };
          if (catalogProductId) {
            const { data: existing } = await supabase
              .from("video_cache")
              .select("id")
              .eq("catalog_product_id", catalogProductId)
              .eq("source_url", sourceUrl)
              .maybeSingle();
            if (existing?.id) {
              const { error } = await supabase.from("video_cache").update(row).eq("id", existing.id);
              if (!error) inserted += 1;
            } else {
              const { error } = await supabase.from("video_cache").insert(row);
              if (!error) inserted += 1;
            }
          } else {
            const { error } = await supabase.from("video_cache").insert(row);
            if (!error) inserted += 1;
          }
        }
        if (inserted > 0 && catalogProductId) {
          await cacheInvalidation.invalidateProductVideos(catalogProductId).catch(() => undefined);
        }
      } catch {
        // Cache is optional. Still return clips to the app.
      }
    }

    return new Response(JSON.stringify({ clips, inserted, provider: "youtube" }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ clips: [], inserted: 0, error: String(error) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});

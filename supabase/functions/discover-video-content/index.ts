import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * discover-video-content
 *
 * Search-then-embed: Serper general web search finds public post URLs,
 * then each platform's official embed mechanism supplies markup. Never scrape,
 * never download a video file, never call a platform's own search API.
 *
 * Cache-first: never Serper when a product+tag already has 4+ tagged clips.
 * No video file download/rehost. No platform search APIs. Serper only.
 * Tags are a classification; below CLASSIFICATION_CONFIDENCE_FLOOR they stay
 * off that chip. Wilson reorders visible rows; it is not the review gate.
 * VIDEO_REVIEW_ENABLED / app_flags.video_review_enabled must be true before
 * public users. pending_review=true is record-keeping; RLS hides pending only
 * when the flag is on.
 *
 * Classifier: GEMINI_API_KEY → OPENROUTER_API_KEY → NVIDIA_API_KEY (fallbacks).
 * Do not prefix these with EXPO_PUBLIC_.
 *
 * Actions:
 *   discover        — Serper + official embed + LLM classify. pending_review=true.
 *   classify_pending — classify rows that still have empty content_tags
 *   list_pending    — admin queue
 *   approve / reject
 *   vote            — helpful / not helpful (voter_key)
 *   refresh_gaps    — daily gap fill for seed catalog products
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Platform = "youtube" | "tiktok" | "instagram" | "facebook" | "pinterest";

const PLATFORMS: Platform[] = ["youtube", "tiktok", "instagram", "facebook", "pinterest"];
const HOST: Record<Platform, string> = {
  youtube: "youtube.com",
  tiktok: "tiktok.com",
  instagram: "instagram.com",
  facebook: "facebook.com",
  pinterest: "pinterest.com",
};
const META_GRAPH = "https://graph.facebook.com/v26.0";
const FACEBOOK_MAX_SECONDS = 5 * 60;
const YOUTUBE_MAX_SECONDS = 5 * 60;

function envInt(name: string, fallback: number, max: number): number {
  const raw = Number(Deno.env.get(name));
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.floor(raw), max);
}

const MAX_RESULTS_PER_QUERY = envInt("DISCOVER_MAX_RESULTS_PER_QUERY", 5, 10);
const MAX_EMBEDS_PER_PLATFORM = envInt("DISCOVER_MAX_EMBEDS_PER_PLATFORM", 4, 8);
const MAX_EMBEDS_TOTAL = envInt("DISCOVER_MAX_EMBEDS_TOTAL", 12, 20);
const MAX_QUERIES = envInt("DISCOVER_MAX_QUERIES", 10, 12);
const CLASSIFICATION_FLOOR = Number(Deno.env.get("CLASSIFICATION_CONFIDENCE_FLOOR") ?? "0.7");

interface DiscoverBody {
  action?: "discover" | "list_pending" | "approve" | "reject" | "vote" | "classify_pending" | "refresh_gaps";
  productName?: string;
  brand?: string;
  productId?: string;
  ingredients?: string[];
  attributeTags?: string[];
  suitsSkinTypes?: string[];
  taxonomyCategory?: string;
  id?: string;
  approvedBy?: string;
  voterKey?: string;
  isHelpful?: boolean;
  offset?: number;
}

interface SearchHit {
  url: string;
  title: string;
  thumbnailUrl: string;
}

interface EmbeddedClip {
  source_platform: Platform;
  source_url: string;
  embed_html: string | null;
  title: string;
  channel_or_author: string;
  thumbnail_url: string;
  duration_seconds: number | null;
  youtube_video_id: string | null;
}

interface PlannedQuery {
  q: string;
  platform: Platform;
  attributeTag: string | null;
  searchQuery: string;
}

type SearchFailure = "http_error" | "rate_limited" | "malformed" | "network" | "halted";

interface SearchResult {
  hits: SearchHit[];
  error: SearchFailure | null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}

function catalogProductId(value: string | undefined): string | null {
  const id = value?.trim() ?? "";
  if (!id || id.length > 120) return null;
  return id;
}

function redisConfigured(): boolean {
  return Boolean(
    Deno.env.get("UPSTASH_REDIS_REST_URL")?.trim() && Deno.env.get("UPSTASH_REDIS_REST_TOKEN")?.trim(),
  );
}

async function enqueueAnalysisJob(job: Record<string, unknown>): Promise<boolean> {
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL")?.trim();
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN")?.trim();
  if (!url || !token) return false;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        "LPUSH",
        Deno.env.get("ASR_QUEUE_KEY")?.trim() || "asr:jobs",
        JSON.stringify(job),
      ]),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function queueVideoAnalysis(
  client: NonNullable<ReturnType<typeof serviceClient>>,
  row: { id: string; catalog_product_id?: string | null; source_platform?: string; source_url?: string },
): Promise<boolean> {
  const payload = {
    version: 1,
    jobType: "TRANSCRIBE_VIDEO",
    jobId: crypto.randomUUID(),
    videoId: row.id,
    productId: row.catalog_product_id ?? null,
    platform: row.source_platform ?? "",
    videoUrl: row.source_url ?? "",
    createdAt: new Date().toISOString(),
    attempt: 1,
  };
  await client.from("video_analysis_jobs").upsert(
    {
      video_id: row.id,
      job_type: "TRANSCRIBE_VIDEO",
      status: "queued",
      job_payload: payload,
    },
    { onConflict: "video_id,job_type" },
  );
  await client.from("video_cache").update({ analysis_status: "queued" }).eq("id", row.id);
  return enqueueAnalysisJob(payload);
}

function humanTag(tag: string): string {
  return tag.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function uniquePhrases(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const phrase = humanTag(value);
    const key = phrase.toLowerCase();
    if (!phrase || seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
  }
  return out;
}

function skinPhrase(skin: string): string | null {
  const map: Record<string, string> = {
    oily: "oily skin",
    dry: "dry skin",
    combination: "combination skin",
    sensitive: "sensitive skin",
    normal: "normal skin",
  };
  return map[skin.trim().toLowerCase()] ?? null;
}

function parseHttpUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

function hostMatches(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}

function pathParts(url: URL): string[] {
  return url.pathname.split("/").map((part) => part.trim()).filter(Boolean);
}

function isYoutubeWatchUrl(url: URL): boolean {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host === "youtu.be") {
    const id = pathParts(url)[0] ?? "";
    return /^[\w-]{11}$/.test(id);
  }
  if (!hostMatches(url.hostname, "youtube.com") && host !== "m.youtube.com" && host !== "music.youtube.com") {
    return false;
  }
  const parts = pathParts(url);
  if (parts[0]?.toLowerCase() === "watch") {
    return /^[\w-]{11}$/.test(url.searchParams.get("v") ?? "");
  }
  if (parts[0]?.toLowerCase() === "shorts" && /^[\w-]{11}$/.test(parts[1] ?? "")) return true;
  if (parts[0]?.toLowerCase() === "embed" && /^[\w-]{11}$/.test(parts[1] ?? "")) return true;
  return false;
}

function youtubeVideoIdFromUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host === "youtu.be") {
    const id = pathParts(url)[0] ?? "";
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  const fromQuery = url.searchParams.get("v");
  if (fromQuery && /^[\w-]{11}$/.test(fromQuery)) return fromQuery;
  const parts = pathParts(url);
  if ((parts[0]?.toLowerCase() === "shorts" || parts[0]?.toLowerCase() === "embed") && /^[\w-]{11}$/.test(parts[1] ?? "")) {
    return parts[1];
  }
  return null;
}

function isTikTokPostUrl(url: URL): boolean {
  if (!hostMatches(url.hostname, "tiktok.com")) return false;
  const parts = pathParts(url);
  if (parts.length < 3) return false;
  const blocked = new Set(["tag", "search", "foryou", "discover", "music", "effect", "live", "explore"]);
  if (blocked.has(parts[0].toLowerCase())) return false;
  if (!parts[0].startsWith("@")) return false;
  if (!/^(video|photo)$/i.test(parts[1])) return false;
  return /^\d+$/.test(parts[2]);
}

function isInstagramPostUrl(url: URL): boolean {
  if (!hostMatches(url.hostname, "instagram.com") && !hostMatches(url.hostname, "instagr.am")) {
    return false;
  }
  const parts = pathParts(url);
  if (parts.length < 2) return false;
  const kind = parts[0].toLowerCase();
  if (kind === "stories" || kind === "tags" || kind === "explore" || kind === "accounts") {
    return false;
  }
  if (kind !== "p" && kind !== "reel" && kind !== "reels" && kind !== "tv") return false;
  return /^[\w-]+$/.test(parts[1]);
}

function isFacebookPostUrl(url: URL): boolean {
  if (hostMatches(url.hostname, "fb.watch")) {
    return pathParts(url).length >= 1 && /^[\w-]+$/.test(pathParts(url)[0]);
  }
  if (!hostMatches(url.hostname, "facebook.com") && !hostMatches(url.hostname, "fb.com")) {
    return false;
  }
  const parts = pathParts(url);
  if (parts.some((part) => part.toLowerCase() === "groups")) return false;
  const watchId = url.searchParams.get("v");
  if ((parts[0]?.toLowerCase() === "watch" || url.pathname.toLowerCase().includes("/watch")) && watchId) {
    return /^\d+$/.test(watchId);
  }
  if (parts[0]?.toLowerCase() === "reel" && /^\d+$/.test(parts[1] ?? "")) return true;
  if (parts[0]?.toLowerCase() === "share" && /^(v|r|p)$/i.test(parts[1] ?? "") && /^[\w-]+$/.test(parts[2] ?? "")) {
    return true;
  }
  const videosAt = parts.findIndex((part) => part.toLowerCase() === "videos");
  if (videosAt >= 0 && /^\d+$/.test(parts[videosAt + 1] ?? "")) return true;
  const postsAt = parts.findIndex((part) => part.toLowerCase() === "posts");
  if (postsAt >= 0 && Boolean(parts[postsAt + 1])) return true;
  if (url.pathname.toLowerCase().includes("permalink.php") || url.pathname.toLowerCase().includes("story.php")) {
    return Boolean(url.searchParams.get("story_fbid") || url.searchParams.get("id"));
  }
  if (parts[0]?.toLowerCase() === "video.php") return Boolean(watchId);
  return false;
}

function isFacebookVideoUrl(url: URL): boolean {
  const parts = pathParts(url);
  if (hostMatches(url.hostname, "fb.watch")) return true;
  if (parts[0]?.toLowerCase() === "watch") return true;
  if (parts[0]?.toLowerCase() === "reel") return true;
  if (parts[0]?.toLowerCase() === "share" && /^(v|r)$/i.test(parts[1] ?? "")) return true;
  if (parts.some((part) => part.toLowerCase() === "videos")) return true;
  if (url.searchParams.get("v") && /^\d+$/.test(url.searchParams.get("v") ?? "")) return true;
  return false;
}

function isPinterestPinUrl(url: URL): boolean {
  if (!/^pinterest\.[a-z.]+$/i.test(url.hostname.replace(/^www\./i, ""))) return false;
  const parts = pathParts(url);
  if (parts[0]?.toLowerCase() !== "pin") return false;
  if (parts.length < 2) return false;
  const blocked = new Set(["search", "ideas", "today", "categories", "news_hub"]);
  if (blocked.has(parts[1].toLowerCase())) return false;
  return /^\d+/.test(parts[1]);
}

function isIndividualPostUrl(url: URL, platform: Platform): boolean {
  if (platform === "youtube") return isYoutubeWatchUrl(url);
  if (platform === "tiktok") return isTikTokPostUrl(url);
  if (platform === "instagram") return isInstagramPostUrl(url);
  if (platform === "facebook") return isFacebookPostUrl(url);
  return isPinterestPinUrl(url);
}

function canonicalize(raw: string, platform: Platform): string | null {
  const parsed = parseHttpUrl(raw);
  if (!parsed || !isIndividualPostUrl(parsed, platform)) return null;
  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";
  if (platform === "instagram") {
    const parts = pathParts(parsed);
    if (parts[0]?.toLowerCase() === "reels" && parts[1]) {
      parsed.pathname = `/reel/${parts[1]}/`;
    }
  }
  if (platform === "youtube") {
    const id = youtubeVideoIdFromUrl(parsed);
    parsed.search = "";
    parsed.hostname = "www.youtube.com";
    parsed.pathname = "/watch";
    if (id) parsed.searchParams.set("v", id);
  } else if (platform === "facebook") {
    const v = parsed.searchParams.get("v");
    const story = parsed.searchParams.get("story_fbid");
    const fbId = parsed.searchParams.get("id");
    parsed.search = "";
    if (v) parsed.searchParams.set("v", v);
    if (story) parsed.searchParams.set("story_fbid", story);
    if (fbId) parsed.searchParams.set("id", fbId);
  } else if (platform !== "youtube") {
    parsed.search = "";
  }
  const href = parsed.toString().replace(/\/$/, "");
  const again = parseHttpUrl(href);
  return again && isIndividualPostUrl(again, platform) ? href : null;
}

function parseDuration(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value > 10000 ? value / 1000 : value);
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const iso = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (iso) {
    return (Number(iso[1] ?? 0) * 3600) + (Number(iso[2] ?? 0) * 60) + Number(iso[3] ?? 0);
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.round(numeric > 10000 ? numeric / 1000 : numeric);
  }
  return null;
}

function durationFromOembed(payload: Record<string, unknown>, html: string): number | null {
  const direct = parseDuration(
    payload.duration ?? payload.duration_seconds ?? payload.video_length ?? payload.length,
  );
  if (direct) return direct;
  const fromHtml = html.match(/duration(?:_seconds|_ms)?["'\s:=]+(\d+)/i);
  if (fromHtml) return parseDuration(fromHtml[1]);
  return null;
}

function serperKey(): string {
  return Deno.env.get("SERPER_API_KEY")?.trim() ?? "";
}

async function serperSearch(query: string): Promise<SearchResult> {
  const key = serperKey();
  if (!key) return { hits: [], error: "http_error" };
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: MAX_RESULTS_PER_QUERY }),
    });
    if (response.status === 429) return { hits: [], error: "rate_limited" };
    if (!response.ok) return { hits: [], error: "http_error" };
    let payload: { organic?: Array<{ link?: string; title?: string; imageUrl?: string }> };
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      return { hits: [], error: "malformed" };
    }
    if (!payload || !Array.isArray(payload.organic)) {
      return { hits: [], error: payload?.organic === undefined ? null : "malformed" };
    }
    const hits = payload.organic
      .map((item) => ({
        url: item.link ?? "",
        title: item.title ?? "",
        thumbnailUrl: item.imageUrl ?? "",
      }))
      .filter((hit) => Boolean(hit.url));
    return { hits, error: null };
  } catch {
    return { hits: [], error: "network" };
  }
}

async function oembedJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function iframeHtml(src: string, height: number): string {
  return `<iframe src="${escapeAttr(src)}" width="100%" height="${height}" style="border:0;width:100%;height:${height}px" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
}

function youtubePlayerSrc(videoId: string): string {
  const origin = Deno.env.get("PUBLIC_SITE_ORIGIN")?.trim() || "https://pro-community.vercel.app";
  const params = new URLSearchParams({
    rel: "0",
    enablejsapi: "1",
    origin,
    modestbranding: "1",
    playsinline: "1",
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function tiktokPlayerSrc(postUrl: string): string | null {
  const url = parseHttpUrl(postUrl);
  if (!url) return null;
  const parts = pathParts(url);
  const videoAt = parts.findIndex((part) => part.toLowerCase() === "video");
  const id = videoAt >= 0 ? parts[videoAt + 1] : "";
  return id && /^\d+$/.test(id) ? `https://www.tiktok.com/embed/v2/${id}` : null;
}

function instagramPlayerSrc(postUrl: string): string | null {
  const url = parseHttpUrl(postUrl);
  if (!url) return null;
  const parts = pathParts(url);
  const kind = parts[0]?.toLowerCase() === "reels" ? "reel" : parts[0]?.toLowerCase();
  const code = parts[1] ?? "";
  if ((kind !== "p" && kind !== "reel" && kind !== "tv") || !/^[\w-]+$/.test(code)) return null;
  return `https://www.instagram.com/${kind}/${code}/embed/`;
}

function pinterestPlayerSrc(postUrl: string): string | null {
  const url = parseHttpUrl(postUrl);
  if (!url) return null;
  const parts = pathParts(url);
  const id = parts[1]?.match(/^\d+/)?.[0];
  return id ? `https://assets.pinterest.com/ext/embed.html?id=${id}` : null;
}

function facebookPlayerSrc(postUrl: string): string | null {
  const url = parseHttpUrl(postUrl);
  if (!url) return null;
  const href = encodeURIComponent(postUrl);
  if (isFacebookVideoUrl(url)) {
    return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=500`;
  }
  return `https://www.facebook.com/plugins/post.php?href=${href}&show_text=false&width=500`;
}

async function embedTikTok(url: string): Promise<EmbeddedClip | null> {
  const player = tiktokPlayerSrc(url);
  const payload = await oembedJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  const html = player ? iframeHtml(player, 540) : String(payload?.html ?? "");
  if (!html) return null;
  return {
    source_platform: "tiktok",
    source_url: url,
    embed_html: html,
    title: String(payload?.title ?? "TikTok video"),
    channel_or_author: String(payload?.author_name ?? ""),
    thumbnail_url: String(payload?.thumbnail_url ?? ""),
    duration_seconds: payload ? durationFromOembed(payload, html) : null,
    youtube_video_id: null,
  };
}

async function embedYoutube(url: string, hit: SearchHit): Promise<EmbeddedClip | null> {
  const parsed = parseHttpUrl(url);
  const videoId = parsed ? youtubeVideoIdFromUrl(parsed) : null;
  if (!videoId) return null;
  const oembed = await oembedJson(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
  );
  return {
    source_platform: "youtube",
    source_url: `https://www.youtube.com/watch?v=${videoId}`,
    embed_html: iframeHtml(youtubePlayerSrc(videoId), 360),
    title: String(oembed?.title ?? hit.title ?? "YouTube video"),
    channel_or_author: String(oembed?.author_name ?? ""),
    thumbnail_url: String(oembed?.thumbnail_url ?? hit.thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`),
    duration_seconds: null,
    youtube_video_id: videoId,
  };
}

async function embedInstagram(url: string): Promise<EmbeddedClip | null> {
  const player = instagramPlayerSrc(url);
  if (!player) return null;
  const params = new URLSearchParams({ url });
  const token = Deno.env.get("META_OEMBED_TOKEN") ?? Deno.env.get("FACEBOOK_ACCESS_TOKEN") ?? "";
  if (token) params.set("access_token", token);
  const payload = await oembedJson(`${META_GRAPH}/instagram_oembed?${params.toString()}`);
  return {
    source_platform: "instagram",
    source_url: url,
    embed_html: iframeHtml(player, 540),
    title: String(payload?.title ?? payload?.author_name ?? "Instagram video"),
    channel_or_author: String(payload?.author_name ?? ""),
    thumbnail_url: String(payload?.thumbnail_url ?? ""),
    duration_seconds: payload ? durationFromOembed(payload, String(payload.html ?? "")) : null,
    youtube_video_id: null,
  };
}

async function embedFacebook(url: string): Promise<EmbeddedClip | null> {
  const player = facebookPlayerSrc(url);
  if (!player) return null;
  const token = Deno.env.get("META_OEMBED_TOKEN") ?? Deno.env.get("FACEBOOK_ACCESS_TOKEN") ?? "";
  let payload: Record<string, unknown> | null = null;
  for (const endpoint of ["oembed_video", "oembed_post"]) {
    const params = new URLSearchParams({ url });
    if (token) params.set("access_token", token);
    payload = await oembedJson(`${META_GRAPH}/${endpoint}?${params.toString()}`);
    if (payload?.html) break;
  }
  const duration = payload ? durationFromOembed(payload, String(payload.html ?? "")) : null;
  if (duration != null && duration > FACEBOOK_MAX_SECONDS) return null;
  return {
    source_platform: "facebook",
    source_url: url,
    embed_html: iframeHtml(player, 540),
    title: String(payload?.title ?? payload?.author_name ?? "Facebook video"),
    channel_or_author: String(payload?.author_name ?? ""),
    thumbnail_url: String(payload?.thumbnail_url ?? ""),
    duration_seconds: duration,
    youtube_video_id: null,
  };
}

async function embedPinterest(url: string, hit: SearchHit): Promise<EmbeddedClip | null> {
  const player = pinterestPlayerSrc(url);
  if (!player) return null;
  return {
    source_platform: "pinterest",
    source_url: url,
    embed_html: iframeHtml(player, 520),
    title: hit.title || "Pinterest pin",
    channel_or_author: "",
    thumbnail_url: hit.thumbnailUrl,
    duration_seconds: null,
    youtube_video_id: null,
  };
}

async function embedUrl(platform: Platform, hit: SearchHit): Promise<EmbeddedClip | null> {
  const url = canonicalize(hit.url, platform);
  if (!url) return null;
  try {
    if (platform === "youtube") return await embedYoutube(url, { ...hit, url });
    if (platform === "tiktok") return await embedTikTok(url);
    if (platform === "instagram") return await embedInstagram(url);
    if (platform === "facebook") return await embedFacebook(url);
    return await embedPinterest(url, { ...hit, url });
  } catch {
    return null;
  }
}

function productSiteQuery(platform: Platform, productName: string, brand?: string): string {
  const terms = [brand ? `"${brand}"` : "", `"${productName}"`].filter(Boolean).join(" ");
  if (platform === "youtube") return `site:youtube.com ${terms} (review OR how to use OR routine)`;
  if (platform === "pinterest") return `site:pinterest.com ${terms} pin`;
  if (platform === "facebook") return `site:facebook.com ${terms} (reel OR video OR watch)`;
  return `site:${HOST[platform]} ${terms} (review OR routine OR demo)`;
}

function hitMentionsProduct(hit: SearchHit, productName: string, brand: string): boolean {
  const hay = `${hit.title} ${hit.url}`.toLowerCase();
  const tokens = `${brand} ${productName}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
  if (!tokens.length) return true;
  return tokens.some((token) => hay.includes(token));
}

function tagSiteQuery(platform: Platform, ingredient: string, context?: string): string {
  const terms = context ? `"${ingredient}" "${context}"` : `"${ingredient}"`;
  return `site:${HOST[platform]} ${terms}`;
}

function buildQueries(body: DiscoverBody): PlannedQuery[] {
  const productName = body.productName?.trim() ?? "";
  const brand = body.brand?.trim() ?? "";
  const ingredients = uniquePhrases(body.ingredients ?? []);
  const attributes = uniquePhrases(body.attributeTags ?? []);
  const skins = uniquePhrases(
    (body.suitsSkinTypes ?? []).map((skin) => skinPhrase(skin) ?? "").filter(Boolean),
  );
  const queries: PlannedQuery[] = [];
  const seen = new Set<string>();

  const push = (query: PlannedQuery) => {
    const key = query.q.toLowerCase();
    if (seen.has(key) || queries.length >= MAX_QUERIES) return;
    seen.add(key);
    queries.push(query);
  };

  if (productName) {
    for (const platform of PLATFORMS) {
      push({
        q: productSiteQuery(platform, productName, brand),
        platform,
        attributeTag: null,
        searchQuery: `web:${platform}:${brand ? `${brand} ` : ""}${productName}`,
      });
    }
  }

  const ingredient = ingredients[0] ?? "";
  const context = skins[0] ?? attributes[0] ?? "";
  if (productName && (ingredient || context)) {
    const phrase = ingredient || context;
    const partner = ingredient && context ? context : "";
    const attributeTag = (ingredient || context).replace(/\s+/g, "_");
    for (const platform of PLATFORMS) {
      push({
        q: tagSiteQuery(platform, phrase, partner || undefined),
        platform,
        attributeTag,
        searchQuery: `web:${platform}:${brand ? `${brand} ` : ""}${productName}`,
      });
    }
  }

  return queries;
}

interface TaxonomyRow {
  tag_key: string;
  tag_label: string;
  description: string;
}

interface Classification {
  content_tags: string[];
  classification_confidence: number | null;
  classification_method: "title_description" | "transcript";
  classification_justification: string | null;
}

const SEED_CATALOG: Array<{
  id: string;
  name: string;
  brand: string;
  ingredients: string[];
  attributeTags: string[];
  suitsSkinTypes: string[];
}> = [
  { id: "niacinamide-10-zinc", name: "Niacinamide 10% + Zinc 1%", brand: "The Ordinary", ingredients: ["niacinamide", "zinc_pca"], attributeTags: ["fragrance_free"], suitsSkinTypes: ["oily"] },
  { id: "gentle-foaming-cleanser", name: "Gentle Foaming Cleanser", brand: "CeraVe", ingredients: ["ceramides", "niacinamide"], attributeTags: ["gentle"], suitsSkinTypes: ["oily"] },
  { id: "barrier-repair-moisturizer", name: "Barrier Repair Moisturizer", brand: "CeraVe", ingredients: ["ceramides"], attributeTags: ["barrier_repair"], suitsSkinTypes: ["dry"] },
  { id: "clarifying-niacinamide-gel", name: "Clarifying Niacinamide Gel", brand: "SkinLab", ingredients: ["niacinamide"], attributeTags: ["mattifying"], suitsSkinTypes: ["oily"] },
  { id: "balance-serum-5", name: "Balance Serum 5%", brand: "Pure Beauty Co", ingredients: ["niacinamide"], attributeTags: ["oil_free"], suitsSkinTypes: ["oily"] },
  { id: "pore-minimizing-essence", name: "Pore Minimizing Essence", brand: "The Serum Room", ingredients: ["niacinamide"], attributeTags: ["mattifying"], suitsSkinTypes: ["oily"] },
  { id: "vitamin-c-15", name: "Vitamin C Serum 15%", brand: "Glow Depot", ingredients: ["ascorbic_acid"], attributeTags: ["vitamin_c"], suitsSkinTypes: ["normal"] },
  { id: "clay-mask", name: "Clay Mask", brand: "SkinLab", ingredients: ["kaolin"], attributeTags: ["mattifying"], suitsSkinTypes: ["oily"] },
  { id: "mineral-spf-50", name: "Mineral SPF 50", brand: "Pure Beauty Co", ingredients: ["zinc_oxide"], attributeTags: ["fragrance_free"], suitsSkinTypes: ["sensitive"] },
  { id: "salicylic-cleanser", name: "Salicylic Cleanser", brand: "SkinLab", ingredients: ["salicylic_acid"], attributeTags: ["oil_free"], suitsSkinTypes: ["oily"] },
  { id: "barrier-repair-cream", name: "Barrier Repair Cream", brand: "CeraVe", ingredients: ["ceramides"], attributeTags: ["hydrating"], suitsSkinTypes: ["dry"] },
];

const EMPTY_CLASSIFICATION: Classification = {
  content_tags: [],
  classification_confidence: null,
  classification_method: "title_description",
  classification_justification: null,
};

const HEURISTIC_RULES: Array<{ tag: string; pattern: RegExp }> = [
  { tag: "how_to_use", pattern: /\b(how to|how i|tutorial|routine|apply|application|layer|use this|using|cleanse|wash|steps?)\b/i },
  { tag: "how_it_works", pattern: /\b(how it works|science|mechanism|barrier|ceramide|explains?|dermatologist|why it)\b/i },
  { tag: "composition", pattern: /\b(ingredient|composition|formula|formulati|what.?s in|niacinamide|retinol|salicylic|zinc)\b/i },
  { tag: "who_its_for", pattern: /\b(oily|dry|sensitive|acne|combination|skin type|who (it'?s|is) for|good for)\b/i },
  { tag: "results_over_time", pattern: /\b(before\s*after|results?|week|month|progress|transform|journey|glow|healing)\b/i },
  { tag: "precautions", pattern: /\b(irritat|sting|burn|side effect|patch test|caution|warning|purge|react)\b/i },
  { tag: "comparisons", pattern: /\b(vs\.?|versus|compare|comparison|dupe|alternative|better than)\b/i },
];

/** Deterministic tags when the LLM is down. Only uses the fixed taxonomy keys. */
function heuristicClassify(title: string, author: string, allowed: Set<string>): Classification {
  const hay = `${title} ${author}`.trim();
  const tags: string[] = [];
  if (hay && !/^(instagram|facebook|tiktok|pinterest|youtube)\s*video$/i.test(hay)) {
    for (const rule of HEURISTIC_RULES) {
      if (allowed.has(rule.tag) && rule.pattern.test(hay) && !tags.includes(rule.tag)) tags.push(rule.tag);
    }
  }
  if (!tags.length && allowed.has("who_its_for")) tags.push("who_its_for");
  return {
    content_tags: tags.slice(0, 3),
    classification_confidence: tags.length && tags[0] !== "who_its_for" ? 0.78 : 0.71,
    classification_method: "title_description",
    classification_justification: tags.length ? `heuristic:${tags.join(",")}` : "heuristic_empty",
  };
}

function stripXml(xml: string): string {
  return xml
    .replace(/<text[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(url: string, ms: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 SourcedBot/1.0" },
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/** Official YouTube captions XML only. Never download the video file. */
async function fetchYoutubeCaptions(videoId: string): Promise<string> {
  const tried = [
    `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=en`,
    `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=en-US`,
  ];
  for (const url of tried) {
    const xml = await fetchWithTimeout(url, 2000);
    const text = stripXml(xml);
    if (text.length > 40) return text.slice(0, 6000);
  }
  const list = await fetchWithTimeout(
    `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`,
    2000,
  );
  const lang = list.match(/lang_code="([a-zA-Z-]+)"/)?.[1];
  if (!lang) return "";
  const xml = await fetchWithTimeout(
    `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}`,
    2000,
  );
  return stripXml(xml).slice(0, 6000);
}

async function loadTaxonomy(
  client: NonNullable<ReturnType<typeof serviceClient>>,
  category: string,
): Promise<TaxonomyRow[]> {
  const { data } = await client
    .from("category_tag_taxonomy")
    .select("tag_key, tag_label, description")
    .eq("category", category)
    .order("sort_order", { ascending: true });
  return (data ?? []) as TaxonomyRow[];
}

function parseClassifierJson(raw: string): { tags: string[]; confidence: number; justification: string } | null {
  const stripped = raw
    .replace(/```(?:json)?/gi, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const candidates = [match[0], match[0].replace(/,\s*([}\]])/g, "$1")];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        tags?: unknown;
        content_tags?: unknown;
        tag?: unknown;
        confidence?: unknown;
        justification?: unknown;
        evidence?: unknown;
      };
      const rawTags = parsed.tags ?? parsed.content_tags ?? parsed.tag;
      const tags = Array.isArray(rawTags)
        ? rawTags.map((tag) => String(tag))
        : typeof rawTags === "string" && rawTags
          ? [rawTags]
          : [];
      const confidence = Number(parsed.confidence);
      return {
        tags,
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
        justification: String(parsed.justification ?? parsed.evidence ?? "").slice(0, 280),
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** Map accidental LLM aliases onto the fixed 7 taxonomy keys. Never invent new keys. */
const TAG_ALIASES: Record<string, string> = {
  HOW_TO_USE: "how_to_use",
  DEMONSTRATION: "how_to_use",
  ROUTINE: "how_to_use",
  HOW_IT_WORKS: "how_it_works",
  INGREDIENTS: "composition",
  COMPOSITION: "composition",
  WHO_ITS_FOR: "who_its_for",
  RESULTS_AFTER_USAGE: "results_over_time",
  BEFORE_AFTER: "results_over_time",
  RESULTS_OVER_TIME: "results_over_time",
  PRECAUTIONS: "precautions",
  COMPARISON: "comparisons",
  COMPARISONS: "comparisons",
  PROS_AND_CONS: "comparisons",
};

function normalizeAllowedTag(raw: string, allowed: Set<string>): string | null {
  const value = raw.trim();
  if (allowed.has(value)) return value;
  const alias = TAG_ALIASES[value.toUpperCase().replace(/\s+/g, "_")];
  if (alias && allowed.has(alias)) return alias;
  const lowered = value.toLowerCase().replace(/\s+/g, "_");
  return allowed.has(lowered) ? lowered : null;
}

function secretValue(name: string): string {
  return (Deno.env.get(name) ?? "").trim().replace(/^["']|["']$/g, "");
}

function llmErrorCode(body: string, status: number, prefix: string): string {
  const code =
    body.match(/"code"\s*:\s*"([^"]+)"/)?.[1] ??
    body.match(/"status"\s*:\s*"([^"]+)"/)?.[1] ??
    body.match(/"type"\s*:\s*"([^"]+)"/)?.[1] ??
    "";
  return `${prefix}_http_${status}${code ? `:${code}` : ""}`.slice(0, 120);
}

async function callGemini(prompt: string): Promise<{ text: string; error: string | null }> {
  const key = secretValue("GEMINI_API_KEY") || secretValue("GOOGLE_API_KEY");
  if (!key) return { text: "", error: "no_gemini_key" };
  const preferred = Deno.env.get("GEMINI_MODEL")?.trim();
  const models = [...new Set([preferred, "gemini-2.5-flash", "gemini-2.0-flash"].filter(Boolean))] as string[];
  let lastError = "gemini_empty";
  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 400,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    if (!response.ok) {
      lastError = llmErrorCode(await response.text().catch(() => ""), response.status, "gemini");
      if (response.status === 404) continue;
      return { text: "", error: lastError };
    }
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    if (text) return { text, error: null };
    lastError = "gemini_empty";
  }
  return { text: "", error: lastError };
}

async function callOpenAiCompatible(
  prompt: string,
  opts: { name: string; url: string; key: string; model: string; extraHeaders?: Record<string, string> },
): Promise<{ text: string; error: string | null }> {
  if (!opts.key) return { text: "", error: `no_${opts.name}_key` };
  const response = await fetch(opts.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.key}`,
      ...(opts.extraHeaders ?? {}),
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    return { text: "", error: llmErrorCode(await response.text().catch(() => ""), response.status, opts.name) };
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = payload.choices?.[0]?.message?.content ?? "";
  return text ? { text, error: null } : { text: "", error: `${opts.name}_empty` };
}

/**
 * Classifier providers, in order. Any one key is enough; later keys are fallbacks.
 * Gemini (native) → OpenRouter (OpenAI-compatible) → NVIDIA NIM (OpenAI-compatible).
 */
async function callLlm(prompt: string): Promise<{ text: string; error: string | null }> {
  const attempts: Array<() => Promise<{ text: string; error: string | null }>> = [
    () => callGemini(prompt),
    () =>
      callOpenAiCompatible(prompt, {
        name: "openrouter",
        url: "https://openrouter.ai/api/v1/chat/completions",
        key: secretValue("OPENROUTER_API_KEY"),
        model: Deno.env.get("OPENROUTER_MODEL")?.trim() || "openai/gpt-4o-mini",
        extraHeaders: {
          "HTTP-Referer": Deno.env.get("PUBLIC_SITE_ORIGIN")?.trim() || "https://pro-community.vercel.app",
          "X-Title": "Sourced",
        },
      }),
    () =>
      callOpenAiCompatible(prompt, {
        name: "nvidia",
        url: "https://integrate.api.nvidia.com/v1/chat/completions",
        key: secretValue("NVIDIA_API_KEY") || secretValue("NGC_API_KEY"),
        model: Deno.env.get("NVIDIA_MODEL")?.trim() || "meta/llama-3.1-8b-instruct",
      }),
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    const result = await attempt();
    if (result.text) return result;
    if (result.error && !result.error.startsWith("no_")) errors.push(result.error);
    else if (result.error) errors.push(result.error);
  }
  const useful = errors.filter((err) => !err.startsWith("no_"));
  return { text: "", error: (useful.length ? useful.join(";") : errors.join(";") || "no_llm_key").slice(0, 180) };
}

async function classifyClip(
  clip: EmbeddedClip,
  taxonomy: TaxonomyRow[],
  productName: string,
): Promise<Classification> {
  if (!taxonomy.length) return EMPTY_CLASSIFICATION;
  const allowed = new Set(taxonomy.map((row) => row.tag_key));
  const genericTitle = /^(instagram|facebook|tiktok|pinterest|youtube)\s*video$/i.test(clip.title.trim());
  // Cheap path when there is nothing for an LLM to read.
  if (genericTitle || !clip.title.trim()) {
    const fallback = heuristicClassify(clip.title, clip.channel_or_author, allowed);
    return { ...fallback, classification_method: "title_description" };
  }

  let transcript = "";
  if (clip.source_platform === "youtube" && clip.youtube_video_id) {
    transcript = await fetchYoutubeCaptions(clip.youtube_video_id);
  }
  const method: Classification["classification_method"] = transcript ? "transcript" : "title_description";
  const taxonomyBlock = taxonomy
    .map((row) => `- ${row.tag_key} (${row.tag_label}): ${row.description}`)
    .join("\n");
  const prompt = `Classify this skincare product video using ONLY the product's fixed taxonomy.
Multi-label: return only tag_key values from the Allowed tags list below.
Never invent tags, categories, or free-text labels. Unknown tags are rejected.
If none of the allowed tags clearly apply, return []. Empty is correct.
Overall confidence 0-1. One-line justification.

Product: ${productName}
Platform: ${clip.source_platform}
Title: ${clip.title}
Author: ${clip.channel_or_author}
${transcript ? `Captions (best-effort timedtext, not a downloaded file):\n${transcript.slice(0, 4000)}` : "No captions. Classify from title/author only. TikTok/Instagram/Facebook/Pinterest never have media fetched."}

Allowed tags (closed list — do not add others):
${taxonomyBlock}

Return JSON only: {"tags":["how_to_use"],"confidence":0.82,"justification":"..."}`;

  const { text: raw, error: llmError } = await callLlm(prompt);
  const parsed = parseClassifierJson(raw);
  if (!parsed) {
    const fallback = heuristicClassify(clip.title, clip.channel_or_author, allowed);
    if (fallback.content_tags.length) {
      return {
        ...fallback,
        classification_method: method,
        classification_justification:
          `${fallback.classification_justification};llm:${llmError ?? (raw ? "classifier_unparsed" : "no_llm_key")}`.slice(0, 280),
      };
    }
    return {
      ...EMPTY_CLASSIFICATION,
      classification_method: method,
      classification_justification: llmError ?? (raw ? "classifier_unparsed" : "no_llm_key"),
    };
  }
  const tags: string[] = [];
  for (const tag of parsed.tags) {
    const mapped = normalizeAllowedTag(tag, allowed);
    if (mapped && !tags.includes(mapped)) tags.push(mapped);
  }
  const floor = Number.isFinite(CLASSIFICATION_FLOOR) ? CLASSIFICATION_FLOOR : 0.7;
  if (parsed.confidence >= floor && tags.length) {
    return {
      content_tags: tags,
      classification_confidence: parsed.confidence,
      classification_method: method,
      classification_justification: parsed.justification || null,
    };
  }
  const fallback = heuristicClassify(clip.title, clip.channel_or_author, allowed);
  if (fallback.content_tags.length) {
    return {
      ...fallback,
      classification_method: method,
      classification_justification:
        `${fallback.classification_justification};llm_below_floor_or_empty`.slice(0, 280),
    };
  }
  return {
    content_tags: [],
    classification_confidence: parsed.confidence,
    classification_method: method,
    classification_justification: parsed.justification || null,
  };
}

async function productNeedsGapFill(
  client: NonNullable<ReturnType<typeof serviceClient>>,
  catalogId: string,
  tagKeys: string[],
): Promise<boolean> {
  const { data } = await client
    .from("video_cache")
    .select("content_tags")
    .eq("catalog_product_id", catalogId);
  const rows = data ?? [];
  if (!rows.length) return true;
  for (const tag of tagKeys) {
    const count = rows.filter((row) => Array.isArray(row.content_tags) && row.content_tags.includes(tag)).length;
    if (count < 4) return true;
  }
  return false;
}

async function runDiscover(
  client: NonNullable<ReturnType<typeof serviceClient>>,
  body: DiscoverBody,
  taxonomy: TaxonomyRow[],
): Promise<Record<string, unknown>> {
  if (!serperKey()) {
    return {
      inserted: 0,
      error: "missing_search_credentials",
      hint: "Set SERPER_API_KEY as a Supabase Edge Function secret.",
    };
  }
  const productName = body.productName?.trim();
  if (!productName && !(body.ingredients ?? []).length && !(body.attributeTags ?? []).length) {
    return { inserted: 0, error: "missing_query" };
  }

  const catalogId = catalogProductId(body.productId);
  const queries = buildQueries(body);
  const existingQuery = client.from("video_cache").select("source_url");
  const { data: existing } = catalogId
    ? await existingQuery.eq("catalog_product_id", catalogId)
    : await existingQuery;
  const seen = new Set(
    (existing ?? [])
      .map((row) => String(row.source_url ?? ""))
      .filter(Boolean),
  );
  const perPlatform = new Map<Platform, number>();
  const toInsert: Array<Record<string, unknown>> = [];
  let unclassified = 0;

  let searchesAttempted = 0;
  let searchesFailed = 0;
  let candidatesDiscovered = 0;
  let candidatesRejected = 0;
  let embedsSuccessful = 0;
  let embedsFailed = 0;
  let duplicatesSkipped = 0;
  let haltSearch = false;
  const searchRuns: Array<{ query: PlannedQuery; result: SearchResult }> = [];
  for (let i = 0; i < queries.length; i += 4) {
    const batch = queries.slice(i, i + 4);
    const batchResults = await Promise.all(
      batch.map(async (query) => {
        if (haltSearch) return { query, result: { hits: [] as SearchHit[], error: "halted" as SearchFailure } };
        searchesAttempted += 1;
        const result = await serperSearch(query.q);
        if (result.error === "rate_limited") haltSearch = true;
        if (result.error) searchesFailed += 1;
        return { query, result };
      }),
    );
    searchRuns.push(...batchResults);
    if (haltSearch) break;
  }

  for (const { query, result } of searchRuns) {
    if (toInsert.length >= MAX_EMBEDS_TOTAL) break;
    if ((perPlatform.get(query.platform) ?? 0) >= MAX_EMBEDS_PER_PLATFORM) continue;

    for (const hit of result.hits) {
      if (toInsert.length >= MAX_EMBEDS_TOTAL) break;
      if ((perPlatform.get(query.platform) ?? 0) >= MAX_EMBEDS_PER_PLATFORM) break;
      candidatesDiscovered += 1;
      const url = canonicalize(hit.url, query.platform);
      if (!url) {
        candidatesRejected += 1;
        continue;
      }
      if (
        query.attributeTag &&
        (body.productName || body.brand) &&
        !hitMentionsProduct(hit, body.productName?.trim() ?? "", body.brand?.trim() ?? "")
      ) {
        candidatesRejected += 1;
        continue;
      }
      if (seen.has(url)) {
        duplicatesSkipped += 1;
        continue;
      }
      seen.add(url);
      const clip = await embedUrl(query.platform, { ...hit, url });
      if (!clip) {
        embedsFailed += 1;
        continue;
      }
      if (
        clip.source_platform === "youtube" &&
        clip.duration_seconds != null &&
        clip.duration_seconds > YOUTUBE_MAX_SECONDS
      ) {
        candidatesRejected += 1;
        continue;
      }
      embedsSuccessful += 1;
      perPlatform.set(query.platform, (perPlatform.get(query.platform) ?? 0) + 1);
      const useQueue = redisConfigured();
      let classified = {
        content_tags: [] as string[],
        classification_confidence: null as number | null,
        classification_method: "title_description" as const,
        classification_justification: null as string | null,
      };
      if (!useQueue) {
        classified = await classifyClip(clip, taxonomy, productName ?? "");
        if (!classified.content_tags.length) unclassified += 1;
      } else {
        unclassified += 1;
      }
      toInsert.push({
        product_id: isUuid(body.productId) ? body.productId : null,
        catalog_product_id: catalogId,
        attribute_tag: query.attributeTag,
        source_platform: clip.source_platform,
        source_url: clip.source_url,
        embed_html: clip.embed_html,
        youtube_video_id: clip.youtube_video_id,
        title: clip.title,
        channel_title: clip.channel_or_author,
        channel_or_author: clip.channel_or_author,
        thumbnail_url: clip.thumbnail_url,
        duration_seconds: clip.duration_seconds,
        pending_review: true,
        approved_by: null,
        search_query: query.searchQuery,
        fetched_at: new Date().toISOString(),
        content_tags: classified.content_tags,
        classification_confidence: classified.classification_confidence,
        classification_method: classified.classification_method,
        classification_justification: classified.classification_justification,
        helpful_count: 0,
        not_helpful_count: 0,
        analysis_status: useQueue ? "queued" : classified.content_tags.length ? "complete" : "pending",
      });
    }
  }

    let inserted = 0;
    let queued = 0;
    if (toInsert.length) {
      const { data, error } = await client.from("video_cache").insert(toInsert).select("id, catalog_product_id, source_platform, source_url");
      if (error) {
        for (const row of toInsert) {
          const { data: one, error: rowError } = await client.from("video_cache").insert(row).select("id, catalog_product_id, source_platform, source_url").maybeSingle();
          if (rowError) duplicatesSkipped += 1;
          else {
            inserted += 1;
            if (one && redisConfigured() && (await queueVideoAnalysis(client, one))) queued += 1;
          }
        }
      } else {
        inserted = data?.length ?? toInsert.length;
        if (redisConfigured()) {
          for (const row of data ?? []) {
            if (await queueVideoAnalysis(client, row)) queued += 1;
          }
        }
      }
    }

    let classifiedExisting = 0;
    if (catalogId && taxonomy.length) {
      const { data: untagged } = await client
        .from("video_cache")
        .select("id, source_platform, source_url, embed_html, title, channel_or_author, channel_title, thumbnail_url, duration_seconds, youtube_video_id, catalog_product_id")
        .eq("catalog_product_id", catalogId)
        .eq("content_tags", "{}")
        .limit(12);
      for (const row of untagged ?? []) {
        if (redisConfigured()) {
          if (await queueVideoAnalysis(client, row)) queued += 1;
          continue;
        }
        const classified = await classifyClip(
        {
          source_platform: (row.source_platform as Platform) ?? "youtube",
          source_url: String(row.source_url ?? ""),
          embed_html: (row.embed_html as string | null) ?? null,
          title: String(row.title ?? ""),
          channel_or_author: String(row.channel_or_author ?? row.channel_title ?? ""),
          thumbnail_url: String(row.thumbnail_url ?? ""),
          duration_seconds: (row.duration_seconds as number | null) ?? null,
          youtube_video_id: (row.youtube_video_id as string | null) ?? null,
        },
        taxonomy,
        productName ?? "",
      );
      const { error: updateError } = await client
        .from("video_cache")
        .update({
          content_tags: classified.content_tags,
          classification_confidence: classified.classification_confidence,
          classification_method: classified.classification_method,
          classification_justification: classified.classification_justification,
        })
        .eq("id", row.id);
      if (!updateError && classified.content_tags.length) classifiedExisting += 1;
      else if (!classified.content_tags.length) unclassified += 1;
    }
  }

  return {
    provider: "serper",
    searches_attempted: searchesAttempted,
    searches_failed: searchesFailed,
    candidates_discovered: candidatesDiscovered,
    candidates_rejected: candidatesRejected,
    embeds_successful: embedsSuccessful,
    embeds_failed: embedsFailed,
    inserted,
    duplicates_skipped: duplicatesSkipped,
    queries: queries.length,
    pending_review: true,
    unclassified,
    classified_existing: classifiedExisting,
    queued,
    classify_pending_needed: unclassified > 0 && !redisConfigured(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = ((await req.json().catch(() => ({}))) ?? {}) as DiscoverBody;
    const action = body.action ?? "discover";
    const supabase = serviceClient();
    if (!supabase) return json({ error: "missing_supabase_service" }, 500);
    const taxonomyCategory = body.taxonomyCategory?.trim() || "skincare";

    if (action === "list_pending") {
      const { data, error } = await supabase
        .from("video_cache")
        .select(
          "id, product_id, catalog_product_id, attribute_tag, source_platform, source_url, embed_html, youtube_video_id, title, channel_or_author, thumbnail_url, duration_seconds, search_query, fetched_at, pending_review, content_tags, classification_confidence, classification_method, classification_justification",
        )
        .eq("pending_review", true)
        .order("fetched_at", { ascending: false })
        .limit(80);
      if (error) return json({ error: error.message, clips: [] }, 500);
      return json({ clips: data ?? [] });
    }

    if (action === "approve") {
      if (!body.id) return json({ error: "missing_id" }, 400);
      const patch: Record<string, unknown> = {
        pending_review: false,
        approved_by: isUuid(body.approvedBy) ? body.approvedBy : null,
      };
      const { error } = await supabase.from("video_cache").update(patch).eq("id", body.id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "reject") {
      if (!body.id) return json({ error: "missing_id" }, 400);
      const { error } = await supabase.from("video_cache").delete().eq("id", body.id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "vote") {
      const voterKey = body.voterKey?.trim() ?? "";
      if (!body.id || !voterKey || typeof body.isHelpful !== "boolean") {
        return json({ error: "missing_vote" }, 400);
      }
      const { error } = await supabase.from("video_feedback").upsert(
        {
          video_id: body.id,
          voter_key: voterKey.slice(0, 120),
          is_helpful: body.isHelpful,
        },
        { onConflict: "video_id,voter_key" },
      );
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "classify_pending") {
      const taxonomy = await loadTaxonomy(supabase, taxonomyCategory);
      const { data, error } = await supabase
        .from("video_cache")
        .select("id, source_platform, source_url, embed_html, title, channel_or_author, channel_title, thumbnail_url, duration_seconds, youtube_video_id, catalog_product_id, search_query")
        .eq("content_tags", "{}")
        .order("fetched_at", { ascending: false })
        .limit(24);
      if (error) return json({ error: error.message, classified: 0 }, 500);
      let classified = 0;
      let tagged = 0;
      for (const row of data ?? []) {
        const productName = String(row.search_query ?? row.catalog_product_id ?? "");
        const result = await classifyClip(
          {
            source_platform: (row.source_platform as Platform) ?? "youtube",
            source_url: String(row.source_url ?? ""),
            embed_html: (row.embed_html as string | null) ?? null,
            title: String(row.title ?? ""),
            channel_or_author: String(row.channel_or_author ?? row.channel_title ?? ""),
            thumbnail_url: String(row.thumbnail_url ?? ""),
            duration_seconds: (row.duration_seconds as number | null) ?? null,
            youtube_video_id: (row.youtube_video_id as string | null) ?? null,
          },
          taxonomy,
          productName,
        );
        const { error: updateError } = await supabase
          .from("video_cache")
          .update({
            content_tags: result.content_tags,
            classification_confidence: result.classification_confidence,
            classification_method: result.classification_method,
            classification_justification: result.classification_justification,
            pending_review: false,
          })
          .eq("id", row.id);
        if (!updateError) {
          classified += 1;
          if (result.content_tags.length) tagged += 1;
        }
        // Heuristic path is cheap; only throttle when an LLM call likely ran.
        if (!result.classification_justification?.startsWith("heuristic:")) {
          if (result.classification_justification?.includes("RESOURCE_EXHAUSTED")) {
            // Keep going with heuristics for the rest of this batch.
          } else {
            await new Promise((resolve) => setTimeout(resolve, 400));
          }
        }
      }
      return json({ classified, tagged, remaining: Math.max(0, (data?.length ?? 0) - classified) });
    }

    if (action === "refresh_gaps") {
      const taxonomy = await loadTaxonomy(supabase, taxonomyCategory);
      const tagKeys = taxonomy.map((row) => row.tag_key);
      const offset = Math.max(0, body.offset ?? 0);
      const batch = SEED_CATALOG.slice(offset, offset + 2);
      const processed: Array<Record<string, unknown>> = [];
      for (const product of batch) {
        const needs = await productNeedsGapFill(supabase, product.id, tagKeys);
        if (!needs) {
          processed.push({ productId: product.id, skipped: true, reason: "cache_first_threshold" });
          continue;
        }
        const result = await runDiscover(
          supabase,
          {
            action: "discover",
            productId: product.id,
            productName: product.name,
            brand: product.brand,
            ingredients: product.ingredients,
            attributeTags: product.attributeTags,
            suitsSkinTypes: product.suitsSkinTypes,
            taxonomyCategory,
          },
          taxonomy,
        );
        processed.push({ productId: product.id, ...result });
      }
      const nextOffset = offset + batch.length;
      return json({
        processed,
        nextOffset,
        done: nextOffset >= SEED_CATALOG.length,
      });
    }

    const taxonomy = await loadTaxonomy(supabase, taxonomyCategory);
    const result = await runDiscover(supabase, body, taxonomy);
    const status = result.error === "missing_search_credentials" ? 500 : result.error === "missing_query" ? 400 : 200;
    return json(result, status);
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});

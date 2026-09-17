import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * discover-video-content
 *
 * Search-then-embed: Serper general web search finds public post URLs,
 * then each platform's official embed mechanism supplies markup. Never scrape,
 * never download a video file, never call a platform's own search API.
 *
 * Search provider: Serper only (SERPER_API_KEY). Not Brave, Bing, or Google CSE.
 *
 * Actions:
 *   discover     — default. Writes rows with pending_review = false (auto-approve for now).
 *   list_pending — admin queue
 *   approve      — pending_review = false
 *   reject       — delete the row
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Platform = "tiktok" | "instagram" | "facebook" | "pinterest";

const PLATFORMS: Platform[] = ["tiktok", "instagram", "facebook", "pinterest"];
const HOST: Record<Platform, string> = {
  tiktok: "tiktok.com",
  instagram: "instagram.com",
  facebook: "facebook.com",
  pinterest: "pinterest.com",
};
const META_GRAPH = "https://graph.facebook.com/v26.0";
const FACEBOOK_MAX_SECONDS = 5 * 60;

function envInt(name: string, fallback: number, max: number): number {
  const raw = Number(Deno.env.get(name));
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.floor(raw), max);
}

const MAX_RESULTS_PER_QUERY = envInt("DISCOVER_MAX_RESULTS_PER_QUERY", 5, 10);
const MAX_EMBEDS_PER_PLATFORM = envInt("DISCOVER_MAX_EMBEDS_PER_PLATFORM", 4, 8);
const MAX_EMBEDS_TOTAL = envInt("DISCOVER_MAX_EMBEDS_TOTAL", 12, 20);
const MAX_QUERIES = envInt("DISCOVER_MAX_QUERIES", 8, 12);

interface DiscoverBody {
  action?: "discover" | "list_pending" | "approve" | "reject";
  productName?: string;
  brand?: string;
  productId?: string;
  ingredients?: string[];
  attributeTags?: string[];
  suitsSkinTypes?: string[];
  id?: string;
  approvedBy?: string;
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
  if (kind === "reels" || kind === "stories" || kind === "tags" || kind === "explore" || kind === "accounts") {
    return false;
  }
  if (kind !== "p" && kind !== "reel" && kind !== "tv") return false;
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
  const watchId = url.searchParams.get("v");
  if ((parts[0]?.toLowerCase() === "watch" || url.pathname.toLowerCase().includes("/watch")) && watchId) {
    return /^\d+$/.test(watchId);
  }
  if (parts[0]?.toLowerCase() === "reel" && /^\d+$/.test(parts[1] ?? "")) return true;
  if (parts[0]?.toLowerCase() === "share" && /^(v|r)$/i.test(parts[1] ?? "") && /^[\w-]+$/.test(parts[2] ?? "")) {
    return true;
  }
  const videosAt = parts.findIndex((part) => part.toLowerCase() === "videos");
  if (videosAt >= 1 && /^\d+$/.test(parts[videosAt + 1] ?? "")) return true;
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
  if (platform === "facebook") {
    const v = parsed.searchParams.get("v");
    parsed.search = v ? `?v=${v}` : "";
  } else {
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

function pinterestEmbedHtml(pinUrl: string): string {
  // Official Pin widget: https://developers.pinterest.com/docs/web-features/widgets/
  return `<a href="${escapeAttr(pinUrl)}" data-pin-do="embedPin" data-pin-width="medium"></a>`;
}

async function embedTikTok(url: string): Promise<EmbeddedClip | null> {
  const payload = await oembedJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  if (!payload) return null;
  const html = String(payload.html ?? "");
  if (!html) return null;
  return {
    source_platform: "tiktok",
    source_url: url,
    embed_html: html,
    title: String(payload.title ?? "TikTok video"),
    channel_or_author: String(payload.author_name ?? ""),
    thumbnail_url: String(payload.thumbnail_url ?? ""),
    duration_seconds: durationFromOembed(payload, html),
  };
}

async function embedInstagram(url: string): Promise<EmbeddedClip | null> {
  // Current Meta docs: GET /instagram_oembed (token optional since June 2026).
  const params = new URLSearchParams({ url });
  const token = Deno.env.get("META_OEMBED_TOKEN") ?? Deno.env.get("FACEBOOK_ACCESS_TOKEN") ?? "";
  if (token) params.set("access_token", token);
  const payload = await oembedJson(`${META_GRAPH}/instagram_oembed?${params.toString()}`);
  if (!payload) return null;
  const html = String(payload.html ?? "");
  if (!html) return null;
  return {
    source_platform: "instagram",
    source_url: url,
    embed_html: html,
    title: String(payload.title ?? payload.author_name ?? "Instagram video"),
    channel_or_author: String(payload.author_name ?? ""),
    thumbnail_url: String(payload.thumbnail_url ?? ""),
    duration_seconds: durationFromOembed(payload, html),
  };
}

async function embedFacebook(url: string): Promise<EmbeddedClip | null> {
  // Current Meta docs: GET /oembed_video, with /oembed_post as fallback for public posts.
  const token = Deno.env.get("META_OEMBED_TOKEN") ?? Deno.env.get("FACEBOOK_ACCESS_TOKEN") ?? "";
  for (const endpoint of ["oembed_video", "oembed_post"]) {
    const params = new URLSearchParams({ url });
    if (token) params.set("access_token", token);
    const payload = await oembedJson(`${META_GRAPH}/${endpoint}?${params.toString()}`);
    if (!payload) continue;
    const html = String(payload.html ?? "");
    if (!html) continue;
    const duration = durationFromOembed(payload, html);
    if (duration != null && duration > FACEBOOK_MAX_SECONDS) return null;
    return {
      source_platform: "facebook",
      source_url: url,
      embed_html: html,
      title: String(payload.title ?? payload.author_name ?? "Facebook video"),
      channel_or_author: String(payload.author_name ?? ""),
      thumbnail_url: String(payload.thumbnail_url ?? ""),
      duration_seconds: duration,
    };
  }
  return null;
}

async function embedPinterest(url: string, hit: SearchHit): Promise<EmbeddedClip> {
  return {
    source_platform: "pinterest",
    source_url: url,
    embed_html: pinterestEmbedHtml(url),
    title: hit.title || "Pinterest pin",
    channel_or_author: "",
    thumbnail_url: hit.thumbnailUrl,
    duration_seconds: null,
  };
}

async function embedUrl(platform: Platform, hit: SearchHit): Promise<EmbeddedClip | null> {
  const url = canonicalize(hit.url, platform);
  if (!url) return null;
  try {
    if (platform === "tiktok") return await embedTikTok(url);
    if (platform === "instagram") return await embedInstagram(url);
    if (platform === "facebook") return await embedFacebook(url);
    return await embedPinterest(url, { ...hit, url });
  } catch {
    return null;
  }
}

function productSiteQuery(platform: Platform, productName: string): string {
  const quoted = `"${productName}"`;
  if (platform === "pinterest") return `site:${HOST[platform]} ${quoted}`;
  return `site:${HOST[platform]} ${quoted} review`;
}

function tagSiteQuery(platform: Platform, ingredient: string, context?: string): string {
  const terms = context ? `"${ingredient}" "${context}"` : `"${ingredient}"`;
  return `site:${HOST[platform]} ${terms}`;
}

function buildQueries(body: DiscoverBody): PlannedQuery[] {
  const productName = body.productName?.trim() ?? "";
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
        q: productSiteQuery(platform, productName),
        platform,
        attributeTag: null,
        searchQuery: `web:${platform}:${productName}`,
      });
    }
  }

  const ingredient = ingredients[0] ?? "";
  const context = skins[0] ?? attributes[0] ?? "";
  if (ingredient || context) {
    const phrase = ingredient || context;
    const partner = ingredient && context ? context : "";
    const attributeTag = (ingredient || context).replace(/\s+/g, "_");
    for (const platform of PLATFORMS) {
      push({
        q: tagSiteQuery(platform, phrase, partner || undefined),
        platform,
        attributeTag,
        searchQuery: `web:${platform}:attr:${phrase}${partner ? `+${partner}` : ""}`,
      });
    }
  }

  return queries;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = ((await req.json().catch(() => ({}))) ?? {}) as DiscoverBody;
    const action = body.action ?? "discover";
    const supabase = serviceClient();
    if (!supabase) return json({ error: "missing_supabase_service" }, 500);

    if (action === "list_pending") {
      const { data, error } = await supabase
        .from("video_cache")
        .select(
          "id, product_id, attribute_tag, source_platform, source_url, embed_html, title, channel_or_author, thumbnail_url, duration_seconds, search_query, fetched_at, pending_review",
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

    if (!serperKey()) {
      return json(
        {
          inserted: 0,
          error: "missing_search_credentials",
          hint: "Set SERPER_API_KEY as a Supabase Edge Function secret.",
        },
        500,
      );
    }

    const productName = body.productName?.trim();
    if (!productName && !(body.ingredients ?? []).length && !(body.attributeTags ?? []).length) {
      return json({ inserted: 0, error: "missing_query" }, 400);
    }

    const queries = buildQueries(body);
    const { data: existing } = await supabase.from("video_cache").select("source_url");
    const seen = new Set(
      (existing ?? [])
        .map((row) => String(row.source_url ?? ""))
        .filter(Boolean),
    );
    const perPlatform = new Map<Platform, number>();
    const toInsert: Array<Record<string, unknown>> = [];

    let searchesAttempted = 0;
    let searchesFailed = 0;
    let candidatesDiscovered = 0;
    let candidatesRejected = 0;
    let embedsSuccessful = 0;
    let embedsFailed = 0;
    let duplicatesSkipped = 0;
    let haltSearch = false;

    for (const query of queries) {
      if (toInsert.length >= MAX_EMBEDS_TOTAL) break;
      if ((perPlatform.get(query.platform) ?? 0) >= MAX_EMBEDS_PER_PLATFORM) continue;

      let result: SearchResult;
      if (haltSearch) {
        result = { hits: [], error: "halted" };
      } else {
        searchesAttempted += 1;
        result = await serperSearch(query.q);
        if (result.error === "rate_limited") haltSearch = true;
        if (result.error) searchesFailed += 1;
      }

      for (const hit of result.hits) {
        if (toInsert.length >= MAX_EMBEDS_TOTAL) break;
        if ((perPlatform.get(query.platform) ?? 0) >= MAX_EMBEDS_PER_PLATFORM) break;
        candidatesDiscovered += 1;
        const url = canonicalize(hit.url, query.platform);
        if (!url) {
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
        embedsSuccessful += 1;
        perPlatform.set(query.platform, (perPlatform.get(query.platform) ?? 0) + 1);
        toInsert.push({
          product_id: isUuid(body.productId) ? body.productId : null,
          attribute_tag: query.attributeTag,
          source_platform: clip.source_platform,
          source_url: clip.source_url,
          embed_html: clip.embed_html,
          youtube_video_id: null,
          title: clip.title,
          channel_title: clip.channel_or_author,
          channel_or_author: clip.channel_or_author,
          thumbnail_url: clip.thumbnail_url,
          duration_seconds: clip.duration_seconds,
          pending_review: false,
          approved_by: null,
          search_query: query.searchQuery,
          fetched_at: new Date().toISOString(),
        });
      }
    }

    let inserted = 0;
    if (toInsert.length) {
      const { data, error } = await supabase.from("video_cache").upsert(toInsert, {
        onConflict: "source_url",
        ignoreDuplicates: true,
      }).select("id");
      if (error) return json({ inserted: 0, error: error.message }, 500);
      inserted = data?.length ?? toInsert.length;
      duplicatesSkipped += Math.max(0, toInsert.length - inserted);
    }

    return json({
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
      pending_review: false,
    });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});

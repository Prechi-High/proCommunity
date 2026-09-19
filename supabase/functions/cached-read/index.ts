import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { cacheAside } from "../_shared/redis/cacheAside.ts";
import { productKey, productVideosKey, taxonomyKey } from "../_shared/redis/keys.ts";
import { CACHE_TTL } from "../_shared/redis/ttl.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "product" | "tagged_videos" | "taxonomy";

type Body = {
  action?: Action;
  productId?: string;
  tag?: string;
  page?: number;
  limit?: number;
  category?: string;
};

const SELECT_CLIP =
  "id, source_platform, source_url, embed_html, youtube_video_id, title, channel_or_author, channel_title, thumbnail_url, duration_seconds, content_tags, classification_confidence, classification_justification, helpful_count, not_helpful_count, catalog_product_id, fetched_at";

const TAG_KEYS = new Set([
  "how_it_works",
  "how_to_use",
  "composition",
  "who_its_for",
  "results_over_time",
  "precautions",
  "comparisons",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function serviceClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function clampPage(value: unknown, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), 50);
}

function clampLimit(value: unknown, fallback = 20, max = 40): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

function asClip(row: Record<string, unknown>) {
  const tags = Array.isArray(row.content_tags)
    ? (row.content_tags as string[]).filter((tag) => TAG_KEYS.has(tag))
    : [];
  const helpful = Number(row.helpful_count ?? 0);
  const notHelpful = Number(row.not_helpful_count ?? 0);
  return {
    id: String(row.id),
    platform: String(row.source_platform ?? "youtube"),
    sourceUrl: String(row.source_url ?? ""),
    embedHtml: (row.embed_html as string | null) ?? null,
    youtubeVideoId: (row.youtube_video_id as string | null) ?? null,
    title: String(row.title ?? "Video"),
    author: String(row.channel_or_author ?? row.channel_title ?? ""),
    thumbnailUrl: String(row.thumbnail_url ?? ""),
    durationSeconds: (row.duration_seconds as number | null) ?? null,
    contentTags: tags,
    classificationConfidence:
      row.classification_confidence == null ? null : Number(row.classification_confidence),
    classificationJustification: (row.classification_justification as string | null) ?? null,
    helpfulCount: helpful,
    notHelpfulCount: notHelpful,
    catalogProductId: (row.catalog_product_id as string | null) ?? null,
    fetchedAt: (row.fetched_at as string | null) ?? null,
  };
}

async function loadProductRow(client: SupabaseClient, productId: string) {
  const { data, error } = await client
    .from("products")
    .select("*")
    .or(`barcode.eq.${productId},id.eq.${productId}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function loadTaggedPage(
  client: SupabaseClient,
  productId: string,
  tag: string,
  page: number,
  limit: number,
) {
  const fetchLimit = Math.min(page * limit, 80);
  const { data, error } = await client.rpc("list_tagged_videos", {
    p_catalog: productId,
    p_tag: tag,
    p_limit: fetchLimit,
  });
  if (error) throw new Error(error.message);

  let rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  if (!rows.length) {
    const fallback = await client
      .from("video_cache")
      .select(SELECT_CLIP)
      .eq("catalog_product_id", productId)
      .eq("source_platform", "youtube")
      .contains("content_tags", [tag])
      .limit(fetchLimit);
    if (!fallback.error && fallback.data?.length) {
      rows = fallback.data as Record<string, unknown>[];
    }
  }

  const youtubeOnly = rows.filter((row) => String(row.source_platform ?? "youtube") === "youtube");
  const start = (page - 1) * limit;
  const pageRows = youtubeOnly.slice(start, start + limit).map(asClip);
  return { clips: pageRows, page, limit, totalFetched: youtubeOnly.length };
}

async function loadTaxonomyRows(client: SupabaseClient, category: string) {
  const { data, error } = await client
    .from("category_tag_taxonomy")
    .select("tag_key, tag_label, description, sort_order")
    .eq("category", category)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    tagKey: String(row.tag_key),
    tagLabel: String(row.tag_label ?? row.tag_key),
    description: String(row.description ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const started = Date.now();
  try {
    const body = (await req.json()) as Body;
    const action = body.action;
    const client = serviceClient();
    if (!client) return json({ error: "missing_supabase" }, 500);
    if (!action) return json({ error: "missing_action" }, 400);

    if (action === "product") {
      const productId = body.productId?.trim() ?? "";
      if (!productId) return json({ error: "missing_productId" }, 400);
      const key = productKey(productId);
      const { value, event, durationMs } = await cacheAside({
        key,
        ttlSec: CACHE_TTL.product(),
        loader: () => loadProductRow(client, productId),
        shouldCache: (row) => Boolean(row),
      });
      return json({
        product: value,
        cache: { event, durationMs, totalMs: Date.now() - started },
      });
    }

    if (action === "tagged_videos") {
      const productId = body.productId?.trim() ?? "";
      const tag = body.tag?.trim() ?? "";
      if (!productId || !tag || !TAG_KEYS.has(tag)) {
        return json({ error: "missing_product_or_tag" }, 400);
      }
      const page = clampPage(body.page, 1);
      const limit = clampLimit(body.limit, 20, 40);
      const key = productVideosKey(productId, tag, page, limit);
      const { value, event, durationMs } = await cacheAside({
        key,
        ttlSec: CACHE_TTL.videos(),
        loader: () => loadTaggedPage(client, productId, tag, page, limit),
        shouldCache: (payload) => Array.isArray(payload.clips) && payload.clips.length > 0,
      });
      return json({
        ...value,
        cache: { event, durationMs, totalMs: Date.now() - started },
      });
    }

    if (action === "taxonomy") {
      const category = body.category?.trim() || "skincare";
      const key = taxonomyKey(category);
      const { value, event, durationMs } = await cacheAside({
        key,
        ttlSec: CACHE_TTL.taxonomy(),
        loader: () => loadTaxonomyRows(client, category),
        shouldCache: (rows) => Array.isArray(rows) && rows.length > 0,
      });
      return json({
        tags: value,
        cache: { event, durationMs, totalMs: Date.now() - started },
      });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { cacheAside } from "../_shared/redis/cacheAside.ts";
import {
    normalizeSearchQuery,
    productKey,
    productVideosKey,
    searchKey,
    taxonomyKey,
} from "../_shared/redis/keys.ts";
import { redisService } from "../_shared/redis/service.ts";
import { CACHE_TTL } from "../_shared/redis/ttl.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "product" | "tagged_videos" | "taxonomy" | "search" | "upsert_products";

type ProductLike = {
  id?: string;
  name?: string;
  brand?: string;
  description?: string;
  category?: string;
  ingredients?: string[];
  attributeTags?: string[];
  suitsSkinTypes?: string[];
  heroImageUrl?: string | null;
  typicalDurationDays?: number | null;
  shelfLifeMonths?: number | null;
  source?: string;
  barcode?: string | null;
};

type Body = {
  action?: Action;
  productId?: string;
  tag?: string;
  page?: number;
  limit?: number;
  category?: string;
  query?: string;
  chip?: string;
  products?: ProductLike[];
  searchQuery?: string;
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

const CATEGORIES = new Set([
  "cleanser",
  "serum",
  "moisturizer",
  "spf",
  "mask",
  "essence",
  "treatment",
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

function escapeLike(token: string): string {
  return token.replace(/([%_\\])/g, "\\$1");
}

function searchTokens(term: string): string[] {
  return term
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .filter((w) => w.length > 1)
    .slice(0, 16);
}

/** App-facing product: id = barcode when present. */
function toAppProduct(row: Record<string, unknown>) {
  const barcode = (row.barcode as string | null) ?? null;
  return {
    id: String(barcode || row.id),
    name: String(row.name ?? ""),
    brand: String(row.brand ?? ""),
    description: String(row.description ?? ""),
    category: String(row.category ?? "treatment"),
    ingredients: Array.isArray(row.ingredients) ? (row.ingredients as string[]) : [],
    attributeTags: Array.isArray(row.attribute_tags) ? (row.attribute_tags as string[]) : [],
    suitsSkinTypes: Array.isArray(row.suits_skin_types) ? (row.suits_skin_types as string[]) : [],
    heroImageUrl: (row.hero_image_url as string | null) ?? null,
    typicalDurationDays: (row.typical_duration_days as number | null) ?? null,
    shelfLifeMonths: (row.shelf_life_months as number | null) ?? null,
    source: String(row.source ?? "open_beauty_facts"),
    barcode,
    productUrl: null as string | null,
  };
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
  return data ? toAppProduct(data as Record<string, unknown>) : null;
}

async function searchProductsDb(client: SupabaseClient, term: string) {
  let request = client.from("products").select("*").limit(120);
  const cleanTerm = term.replace(/\s+/g, " ").trim();
  const tokens = searchTokens(cleanTerm);
  if (tokens.length > 0) {
    const orParts = tokens.flatMap((token) => {
      const safe = escapeLike(token);
      return [
        `name.ilike.%${safe}%`,
        `brand.ilike.%${safe}%`,
      ];
    });
    if (tokens.length === 1 && cleanTerm) {
      const safeTerm = escapeLike(cleanTerm);
      orParts.push(`name.ilike.%${safeTerm}%`);
      orParts.push(`brand.ilike.%${safeTerm}%`);
    }
    request = request.or(orParts.join(","));
  } else if (cleanTerm) {
    const safeTerm = escapeLike(cleanTerm);
    request = request.or(`name.ilike.%${safeTerm}%,brand.ilike.%${safeTerm}%`);
  }
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => toAppProduct(row as Record<string, unknown>));
  if (tokens.length === 0) return rows.slice(0, 40);
  const fullQuery = tokens.join(" ");
  const scored = rows
    .map((product) => {
      const combined = `${product.brand ?? ""} ${product.name ?? ""}`.toLowerCase().trim();
      const hay = [product.name, product.brand, product.category, ...(product.attributeTags ?? [])]
        .join(" ")
        .toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (hay.includes(token)) score += 1;
      }
      if (product.brand) {
        const brandNorm = String(product.brand).toLowerCase().trim();
        for (const token of tokens) {
          if (brandNorm === token || brandNorm.startsWith(`${token} `)) score += 2;
        }
      }
      if (combined && fullQuery) {
        if (combined === fullQuery) score += 10;
        else if (combined.startsWith(fullQuery)) score += 6;
        else if (combined.includes(fullQuery)) score += 4;
      }
      if (product.name) {
        const nameNorm = String(product.name).toLowerCase().trim();
        for (let i = 0; i < tokens.length - 1; i++) {
          const bigram = `${tokens[i]} ${tokens[i + 1]}`;
          if (combined.includes(bigram) || nameNorm.includes(bigram)) score += 1;
        }
      }
      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.product);
  if (scored.length) return scored;
  return tokens.length <= 1 ? rows.slice(0, 20) : [];
}

async function upsertOneProduct(client: SupabaseClient, product: ProductLike) {
  const barcode = String(product.barcode || product.id || "").trim();
  const name = String(product.name ?? "").trim();
  if (!barcode || !name) return null;

  const category = CATEGORIES.has(String(product.category))
    ? String(product.category)
    : "treatment";
  const row = {
    name,
    brand: String(product.brand ?? "Unknown brand").trim() || "Unknown brand",
    description: String(product.description ?? "").slice(0, 8000),
    category,
    ingredients: Array.isArray(product.ingredients) ? product.ingredients.slice(0, 48) : [],
    attribute_tags: Array.isArray(product.attributeTags) ? product.attributeTags.slice(0, 48) : [],
    suits_skin_types: Array.isArray(product.suitsSkinTypes)
      ? product.suitsSkinTypes.slice(0, 12)
      : [],
    hero_image_url: product.heroImageUrl ?? null,
    typical_duration_days: product.typicalDurationDays ?? null,
    shelf_life_months: product.shelfLifeMonths ?? null,
    source: "open_beauty_facts",
    barcode,
  };

  const { data: existing } = await client
    .from("products")
    .select("id")
    .eq("barcode", barcode)
    .maybeSingle();

  let saved: Record<string, unknown> | null = null;
  if (existing?.id) {
    const { data, error } = await client
      .from("products")
      .update(row)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    saved = data as Record<string, unknown> | null;
  } else {
    const { data, error } = await client.from("products").insert(row).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    saved = data as Record<string, unknown> | null;
  }

  if (!saved) return null;
  const appProduct = toAppProduct(saved);
  await redisService.setJson(productKey(barcode), appProduct, CACHE_TTL.product());
  return appProduct;
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

    if (action === "search") {
      const query = body.query?.trim() ?? "";
      const chip = body.chip?.trim() || undefined;
      const term = normalizeSearchQuery(query, chip) || "skincare serum";
      const key = searchKey(query, chip);
      const { value, event, durationMs } = await cacheAside({
        key,
        ttlSec: CACHE_TTL.search(),
        loader: () => searchProductsDb(client, term),
        shouldCache: (products) => Array.isArray(products) && products.length > 0,
      });
      return json({
        products: value,
        cache: { event, durationMs, totalMs: Date.now() - started },
      });
    }

    if (action === "upsert_products") {
      const list = Array.isArray(body.products) ? body.products.slice(0, 40) : [];
      if (!list.length) return json({ error: "missing_products" }, 400);
      const saved: ReturnType<typeof toAppProduct>[] = [];
      for (const item of list) {
        try {
          const one = await upsertOneProduct(client, item);
          if (one) saved.push(one);
        } catch (error) {
          console.error("[cached-read] upsert_failed", error instanceof Error ? error.message : error);
        }
      }
      const searchQuery = body.searchQuery?.trim();
      if (searchQuery && saved.length) {
        await redisService.setJson(searchKey(searchQuery), saved, CACHE_TTL.search());
      }
      return json({
        upserted: saved.length,
        products: saved,
        cache: { totalMs: Date.now() - started },
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

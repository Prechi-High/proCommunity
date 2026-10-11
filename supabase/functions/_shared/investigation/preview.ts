import { inferDomainFromCategory } from "../evidence/queryPlanner.ts";
import { productPreviewKey } from "../redis/keys.ts";
import { cacheAside } from "../redis/cacheAside.ts";
import { redisService } from "../redis/service.ts";
import { CACHE_TTL } from "../redis/ttl.ts";
import {
  canonicalFromListing,
  identificationStateFromConfidence,
  type IdentificationState,
} from "./canonicalDisplay.ts";
import type { ProductPreviewPayload } from "./types.ts";

type Json = Record<string, unknown>;

type SerperOrganic = { title?: string; link?: string; snippet?: string };
type SerperImage = { imageUrl?: string; title?: string };

export type SearchCandidate = {
  id?: string;
  name?: string;
  brand?: string;
  category?: string;
  image?: string | null;
};

export type PreviewDeps = {
  serperSearch: (q: string) => Promise<{ organic?: SerperOrganic[]; knowledgeGraph?: Json } | null>;
  serperImages: (q: string) => Promise<{ images?: SerperImage[] } | null>;
  slugify: (text: string) => string;
  str: (v: unknown, max: number) => string;
  loadIntel?: (productId: string) => Promise<Json | null>;
};

function specsFromKg(kg: Json | undefined, str: (v: unknown, max: number) => string): ProductPreviewPayload["specs"] {
  if (!kg) return undefined;
  const attrs = kg.attributes as Record<string, string> | undefined;
  if (!attrs || typeof attrs !== "object") return undefined;
  const out: Array<{ label: string; value: string }> = [];
  for (const [label, value] of Object.entries(attrs)) {
    const v = str(value, 120);
    if (v) out.push({ label: str(label, 40), value: v });
    if (out.length >= 6) break;
  }
  return out.length ? out : undefined;
}

function withDisplayFields(
  base: Omit<ProductPreviewPayload, "canonicalDisplayName" | "variantDisplay" | "rawListingTitle" | "identificationState">,
  rawTitle: string,
  identificationState: IdentificationState,
): ProductPreviewPayload {
  const display = canonicalFromListing(rawTitle, base.identity.brand);
  return {
    ...base,
    canonicalDisplayName: display.canonicalDisplayName,
    variantDisplay: display.variantDisplay || base.identity.variant || base.identity.size || "",
    rawListingTitle: display.rawListingTitle,
    identificationState,
    identity: {
      ...base.identity,
      name: display.canonicalDisplayName,
      variant: display.variantDisplay || base.identity.variant,
    },
  };
}

function previewFromIntelRow(hit: Json, id: string, str: (v: unknown, max: number) => string): ProductPreviewPayload | null {
  const payload = hit.payload as Json | undefined;
  if (!payload?.identity) return null;
  const identity = payload.identity as Json;
  const rawTitle = str(hit.name ?? identity.name, 200) || str(payload.query, 200);
  const conf = Number(payload.identityConfidence ?? hit.confidence);
  const images = Array.isArray(payload.images) ? (payload.images as string[]) : [];
  const hero = (hit.hero_image_url as string) ?? images[0] ?? null;
  const base = {
    id,
    query: String(hit.query ?? payload.query ?? id),
    identity: {
      name: str(identity.name, 140),
      brand: str(identity.brand, 80),
      manufacturer: str(identity.manufacturer, 80) || undefined,
      model: str(identity.model, 80),
      category: str(identity.category, 60) || "Product",
      subcategory: str(identity.subcategory, 60) || undefined,
      variant: str(identity.variant, 80) || undefined,
      size: str(identity.size, 60) || undefined,
    },
    domain: undefined as string | undefined,
    summary: str(payload.summary, 300),
    heroImageUrl: hero,
    images: images.length ? images : hero ? [hero] : [],
    specs: undefined,
    previewSource: "product_intel" as const,
  };
  return withDisplayFields(base, rawTitle, identificationStateFromConfidence(conf));
}

function previewFromCandidate(candidate: SearchCandidate, id: string, query: string): ProductPreviewPayload {
  const rawTitle = (candidate.name ?? query).trim();
  const brand = (candidate.brand ?? "").trim();
  const display = canonicalFromListing(rawTitle, brand);
  const hero = candidate.image ?? null;
  return {
    id,
    query,
    identity: {
      name: display.canonicalDisplayName,
      brand,
      model: "",
      category: candidate.category ?? "Product",
      variant: display.variantDisplay,
    },
    canonicalDisplayName: display.canonicalDisplayName,
    variantDisplay: display.variantDisplay,
    rawListingTitle: display.rawListingTitle,
    identificationState: "identified",
    summary: undefined,
    heroImageUrl: hero,
    images: hero ? [hero] : [],
    previewSource: "candidate",
  };
}

async function fetchSerperPreview(
  deps: PreviewDeps,
  q: string,
  id: string,
  seed?: ProductPreviewPayload | null,
): Promise<ProductPreviewPayload> {
  const needImages = !seed?.heroImageUrl;
  const needKg = !seed?.summary && !seed?.identity.model;
  const [overview, imgs] = await Promise.all([
    needKg ? deps.serperSearch(`${q} specifications features`) : Promise.resolve(null),
    needImages ? deps.serperImages(q) : Promise.resolve(null),
  ]);
  const kg = overview?.knowledgeGraph;
  const kgTitle = deps.str(kg?.title, 140);
  const kgType = deps.str(kg?.type, 60);
  const description = deps.str(kg?.description, 400);
  const imageFromKg = typeof kg?.imageUrl === "string" ? kg.imageUrl : null;

  const images = (imgs?.images ?? [])
    .map((i) => i.imageUrl)
    .filter((u): u is string => Boolean(u))
    .slice(0, 12);
  const hero = seed?.heroImageUrl || imageFromKg || images[0] || null;

  const category = seed?.identity.category || kgType || "Product";
  const domain = inferDomainFromCategory(category);
  const rawTitle = seed?.rawListingTitle || kgTitle || q;

  const base = {
    id,
    query: q,
    identity: {
      name: seed?.canonicalDisplayName || kgTitle || q,
      brand: seed?.identity.brand || deps.str(kg?.brand ?? kg?.manufacturer, 80),
      manufacturer: deps.str(kg?.manufacturer, 80) || undefined,
      model: seed?.identity.model || deps.str(kg?.model, 80),
      category,
      subcategory: deps.str(kg?.type, 60) || undefined,
      variant: seed?.variantDisplay || deps.str(kg?.variant, 80) || undefined,
    },
    domain: domain === "inferred" ? undefined : domain,
    summary: seed?.summary || description || overview?.organic?.[0]?.snippet?.slice(0, 280),
    heroImageUrl: hero,
    images:
      hero && !(seed?.images ?? []).includes(hero)
        ? [hero, ...(seed?.images ?? []), ...images]
        : (seed?.images?.length ? seed.images : images.length ? images : hero ? [hero] : []),
    gallery: (imgs?.images ?? [])
      .filter((i) => i.imageUrl)
      .slice(0, 8)
      .map((i) => ({ url: i.imageUrl!, title: i.title })),
    specs: seed?.specs ?? specsFromKg(kg, deps.str),
    previewSource: "serper" as const,
  };
  return withDisplayFields(base, rawTitle, seed?.identificationState ?? identificationStateFromConfidence(0.55));
}

export async function resolveProductPreview(
  deps: PreviewDeps,
  input: { query: string; productId?: string; country?: string; candidate?: SearchCandidate },
): Promise<{ preview: ProductPreviewPayload; cached: boolean; timingMs: number; previewSource: string }> {
  const t0 = Date.now();
  const id = input.productId || deps.slugify(input.query);
  const q = input.query.trim();
  const key = productPreviewKey(id);

  const hot = await redisService.getJson<ProductPreviewPayload>(key);
  if (hot.ok && hot.value) {
    return { preview: { ...hot.value, previewSource: "redis" }, cached: true, timingMs: Date.now() - t0, previewSource: "redis" };
  }

  if (deps.loadIntel) {
    const hit = await deps.loadIntel(id);
    if (hit) {
      const preview = previewFromIntelRow(hit, id, deps.str);
      if (preview) {
        await redisService.setJson(key, preview, CACHE_TTL.productPreview());
        return { preview, cached: false, timingMs: Date.now() - t0, previewSource: "product_intel" };
      }
    }
  }

  let seed: ProductPreviewPayload | null = null;
  if (input.candidate?.name || input.candidate?.image) {
    seed = previewFromCandidate(input.candidate, id, q);
    if (seed.heroImageUrl && seed.summary) {
      await redisService.setJson(key, seed, CACHE_TTL.productPreview());
      return { preview: seed, cached: false, timingMs: Date.now() - t0, previewSource: "candidate" };
    }
  }

  const built = await cacheAside({
    key,
    ttlSec: CACHE_TTL.productPreview(),
    loader: async () => fetchSerperPreview(deps, q, id, seed),
  });

  return {
    preview: built.value,
    cached: built.event === "cache_hit",
    timingMs: Date.now() - t0,
    previewSource: built.value.previewSource ?? "serper",
  };
}

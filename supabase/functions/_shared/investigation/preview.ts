import { inferDomainFromCategory } from "../evidence/queryPlanner.ts";
import { productPreviewKey } from "../redis/keys.ts";
import { cacheAside } from "../redis/cacheAside.ts";
import { CACHE_TTL } from "../redis/ttl.ts";
import type { ProductPreviewPayload } from "./types.ts";

type Json = Record<string, unknown>;

type SerperOrganic = { title?: string; link?: string; snippet?: string };
type SerperImage = { imageUrl?: string; title?: string };

export type PreviewDeps = {
  serperSearch: (q: string) => Promise<{ organic?: SerperOrganic[]; knowledgeGraph?: Json } | null>;
  serperImages: (q: string) => Promise<{ images?: SerperImage[] } | null>;
  slugify: (text: string) => string;
  str: (v: unknown, max: number) => string;
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

export async function resolveProductPreview(
  deps: PreviewDeps,
  input: { query: string; productId?: string; country?: string },
): Promise<{ preview: ProductPreviewPayload; cached: boolean; timingMs: number }> {
  const t0 = Date.now();
  const id = input.productId || deps.slugify(input.query);
  const q = input.query.trim();

  const built = await cacheAside({
    key: productPreviewKey(id),
    ttlSec: CACHE_TTL.productPreview(),
    loader: async () => {
    const [overview, imgs] = await Promise.all([
      deps.serperSearch(`${q} specifications features`),
      deps.serperImages(q),
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
    const hero = imageFromKg || images[0] || null;

    const category = kgType || "Product";
    const domain = inferDomainFromCategory(category);

    const preview: ProductPreviewPayload = {
      id,
      query: q,
      identity: {
        name: kgTitle || q,
        brand: deps.str(kg?.brand ?? kg?.manufacturer, 80),
        manufacturer: deps.str(kg?.manufacturer, 80) || undefined,
        model: deps.str(kg?.model, 80),
        category,
        subcategory: deps.str(kg?.type, 60) || undefined,
        variant: deps.str(kg?.variant, 80) || undefined,
      },
      domain: domain === "inferred" ? undefined : domain,
      summary: description || overview?.organic?.[0]?.snippet?.slice(0, 280),
      heroImageUrl: hero,
      images: hero && !images.includes(hero) ? [hero, ...images] : images.length ? images : hero ? [hero] : [],
      gallery: (imgs?.images ?? [])
        .filter((i) => i.imageUrl)
        .slice(0, 8)
        .map((i) => ({ url: i.imageUrl!, title: i.title })),
      specs: specsFromKg(kg, deps.str),
    };
      return preview;
    },
  });

  return {
    preview: built.value,
    cached: built.event === "cache_hit",
    timingMs: Date.now() - t0,
  };
}

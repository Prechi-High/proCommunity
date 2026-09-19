import { invokeCachedRead } from './cachedRead';
import { products as seedProducts } from './seed';
import {
  fetchOpenBeautyProduct,
  getCachedProduct,
  rememberProduct,
  searchOpenBeautyFacts,
} from './openBeautyFacts';
import { catalogIdForQuery } from './productNormalize';
import { supabase } from './supabase';
import type { Product } from './types';

function fromRow(row: Record<string, unknown>): Product {
  const product: Product = {
    id: String(row.barcode || row.id),
    name: String(row.name ?? ''),
    brand: String(row.brand ?? ''),
    description: String(row.description ?? ''),
    category: (row.category as Product['category']) ?? 'treatment',
    ingredients: (row.ingredients as string[]) ?? [],
    attributeTags: (row.attribute_tags as string[]) ?? (row.attributeTags as string[]) ?? [],
    suitsSkinTypes:
      (row.suits_skin_types as Product['suitsSkinTypes']) ??
      (row.suitsSkinTypes as Product['suitsSkinTypes']) ??
      [],
    heroImageUrl: (row.hero_image_url as string | null) ?? (row.heroImageUrl as string | null) ?? null,
    typicalDurationDays:
      (row.typical_duration_days as number | null) ??
      (row.typicalDurationDays as number | null) ??
      null,
    shelfLifeMonths:
      (row.shelf_life_months as number | null) ?? (row.shelfLifeMonths as number | null) ?? null,
    source: (row.source as Product['source']) ?? 'open_beauty_facts',
    barcode: (row.barcode as string | null) ?? null,
    productUrl: (row.productUrl as string | null) ?? null,
  };
  rememberProduct(product);
  return product;
}

function fromCachedProduct(row: Record<string, unknown>): Product {
  if (row.attribute_tags != null || row.suits_skin_types != null || row.hero_image_url != null) {
    return fromRow(row);
  }
  return fromRow({
    ...row,
    attribute_tags: row.attributeTags,
    suits_skin_types: row.suitsSkinTypes,
    hero_image_url: row.heroImageUrl,
    typical_duration_days: row.typicalDurationDays,
    shelf_life_months: row.shelfLifeMonths,
  });
}

function withAlias(list: Product[], aliasProduct?: Product): Product[] {
  if (!aliasProduct) return list;
  if (!list.some((item) => item.id === aliasProduct.id)) {
    return [aliasProduct, ...list];
  }
  return [aliasProduct, ...list.filter((item) => item.id !== aliasProduct.id)];
}

/** Persist OBF products into Supabase + Redis without blocking the UI. */
function persistProductsInBackground(products: Product[], searchQuery?: string): void {
  if (!products.length) return;
  void invokeCachedRead({
    action: 'upsert_products',
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      description: product.description,
      category: product.category,
      ingredients: product.ingredients,
      attributeTags: product.attributeTags,
      suitsSkinTypes: product.suitsSkinTypes,
      heroImageUrl: product.heroImageUrl ?? null,
      typicalDurationDays: product.typicalDurationDays,
      shelfLifeMonths: product.shelfLifeMonths,
      source: product.source,
      barcode: product.barcode ?? product.id,
    })),
    searchQuery,
  }).catch(() => undefined);
}

function seedFallback(term: string, aliasProduct?: Product): Product[] {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return aliasProduct ? [aliasProduct, ...seedProducts] : seedProducts;

  const ranked = seedProducts
    .map((product) => {
      const hay = [
        product.name,
        product.brand,
        product.category,
        ...product.suitsSkinTypes,
        ...product.ingredients,
        ...product.attributeTags,
      ]
        .join(' ')
        .toLowerCase();
      const score = words.reduce((total, word) => (hay.includes(word) ? total + 1 : total), 0);
      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.product);
  return withAlias(ranked, aliasProduct);
}

/**
 * Hybrid catalog search: Redis (24h) → Supabase → Open Beauty Facts → seed.
 * OBF hits are upserted into Postgres + Redis in the background.
 */
export async function searchCatalog(query: string, chip?: string): Promise<Product[]> {
  const term = chip ? `${query} ${chip}`.trim() : query;
  const searchTerm = term || 'skincare serum';
  const aliasId = catalogIdForQuery(query);
  const aliasProduct = aliasId ? seedProducts.find((product) => product.id === aliasId) : undefined;

  const cached = await invokeCachedRead<{ products?: Record<string, unknown>[] }>({
    action: 'search',
    query: query || searchTerm,
    chip,
  });
  if (cached?.products?.length) {
    return withAlias(
      cached.products.map((row) => fromCachedProduct(row)),
      aliasProduct,
    );
  }

  try {
    const live = await searchOpenBeautyFacts(searchTerm);
    if (live.length) {
      persistProductsInBackground(live, searchTerm);
      return withAlias(live, aliasProduct);
    }
  } catch {
    // Fall through to direct Supabase / seed.
  }

  if (supabase) {
    try {
      let request = supabase.from('products').select('*').limit(40);
      if (searchTerm) {
        request = request.or(`name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`);
      }
      const { data, error } = await request;
      if (!error && data?.length) {
        return withAlias(
          data.map((row) => fromRow(row as Record<string, unknown>)),
          aliasProduct,
        );
      }
    } catch {
      // table may not exist yet
    }
  }

  return seedFallback(searchTerm, aliasProduct);
}

/**
 * Hybrid product load: memory → seed → Redis/DB → OBF → direct Supabase.
 * OBF hits are upserted into Postgres + Redis in the background.
 */
export async function loadProduct(id: string): Promise<Product | null> {
  const cached = getCachedProduct(id);
  if (cached) return cached;

  const seeded = seedProducts.find((product) => product.id === id);
  if (seeded) {
    rememberProduct(seeded);
    return seeded;
  }

  const redisCached = await invokeCachedRead<{ product?: Record<string, unknown> | null }>({
    action: 'product',
    productId: id,
  });
  if (redisCached?.product) return fromCachedProduct(redisCached.product);

  const live = await fetchOpenBeautyProduct(id);
  if (live) {
    rememberProduct(live);
    persistProductsInBackground([live]);
    return live;
  }

  if (supabase) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .or(`barcode.eq.${id},id.eq.${id}`)
      .maybeSingle();
    if (data) return fromRow(data as Record<string, unknown>);
  }
  return null;
}

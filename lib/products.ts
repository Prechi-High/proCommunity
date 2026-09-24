import { invokeCachedRead } from './cachedRead';
import {
    fetchOpenBeautyProduct,
    getCachedProduct,
    rememberProduct,
    searchOpenBeautyFacts,
} from './openBeautyFacts';
import { catalogIdForQuery, normalizeProductName } from './productNormalize';
import { products as seedProducts } from './seed';
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

function rankByTokens(list: Product[], tokens: string[]): Product[] {
  if (!tokens.length) return list;
  const lowered = tokens.map((t) => t.toLowerCase());
  const fullQuery = lowered.join(' ');
  return [...list]
    .map((product) => {
      const combined = normalizeProductName([product.brand, product.name].filter(Boolean).join(' '));
      const hay = normalizeProductName(
        [product.name, product.brand, product.category, ...product.attributeTags].join(' '),
      );
      let score = 0;
      for (const token of lowered) {
        if (hay.includes(token)) score += 1;
      }
      if (product.brand) {
        const brandNorm = normalizeProductName(product.brand);
        for (const token of lowered) {
          if (brandNorm === token || brandNorm.startsWith(`${token} `)) score += 2;
        }
      }
      if (combined && fullQuery) {
        if (combined === fullQuery) score += 10;
        else if (combined.startsWith(fullQuery)) score += 6;
        else if (combined.includes(fullQuery)) score += 4;
      }
      if (product.name) {
        const nameNorm = normalizeProductName(product.name);
        for (let i = 0; i < lowered.length - 1; i++) {
          const bigram = `${lowered[i]} ${lowered[i + 1]}`;
          if (combined.includes(bigram) || nameNorm.includes(bigram)) score += 1;
        }
      }
      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.product);
}

function seedFallback(term: string, aliasProduct?: Product): Product[] {
  const tokens = searchTokens(term);
  if (!tokens.length) return aliasProduct ? [aliasProduct, ...seedProducts] : seedProducts;

  const ranked = rankByTokens(seedProducts, tokens);
  if (ranked.length) return withAlias(ranked, aliasProduct);

  return aliasProduct ? [aliasProduct, ...seedProducts] : seedProducts;
}

function searchTokens(term: string): string[] {
  const normalized = normalizeProductName(term);
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length > 1);
}

function escapeLike(token: string): string {
  return token.replace(/([%_\\])/g, '\\$1');
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
      let request = supabase.from('products').select('*').limit(120);
      const tokens = searchTokens(searchTerm);
      if (tokens.length > 0) {
        const safeTokens = tokens.slice(0, 16);
        const orParts = safeTokens.flatMap((token) => [
          `name.ilike.%${escapeLike(token)}%`,
          `brand.ilike.%${escapeLike(token)}%`,
        ]);
        if (safeTokens.length === 1) {
          orParts.push(`name.ilike.%${escapeLike(searchTerm)}%`);
          orParts.push(`brand.ilike.%${escapeLike(searchTerm)}%`);
        }
        request = request.or(orParts.join(','));
      } else if (searchTerm) {
        const safeTerm = escapeLike(searchTerm);
        request = request.or(`name.ilike.%${safeTerm}%,brand.ilike.%${safeTerm}%`);
      }
      const { data, error } = await request;
      if (!error && data?.length) {
        const ranked = rankByTokens(data.map((row) => fromRow(row as Record<string, unknown>)), tokens);
        if (ranked.length) return withAlias(ranked, aliasProduct);
        const loose = searchTokens(searchTerm).length <= 1
          ? data.map((row) => fromRow(row as Record<string, unknown>)).slice(0, 20)
          : [];
        return withAlias(loose, aliasProduct);
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

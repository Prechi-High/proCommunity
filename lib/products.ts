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
    attributeTags: (row.attribute_tags as string[]) ?? [],
    suitsSkinTypes: (row.suits_skin_types as Product['suitsSkinTypes']) ?? [],
    heroImageUrl: (row.hero_image_url as string | null) ?? null,
    typicalDurationDays: (row.typical_duration_days as number | null) ?? null,
    shelfLifeMonths: (row.shelf_life_months as number | null) ?? null,
    source: (row.source as Product['source']) ?? 'open_beauty_facts',
    barcode: (row.barcode as string | null) ?? null,
    productUrl: null,
  };
  rememberProduct(product);
  return product;
}

export async function searchCatalog(query: string, chip?: string): Promise<Product[]> {
  const term = chip ? `${query} ${chip}`.trim() : query;
  const aliasId = catalogIdForQuery(query);
  const aliasProduct = aliasId ? seedProducts.find((product) => product.id === aliasId) : undefined;
  try {
    const live = await searchOpenBeautyFacts(term || 'skincare serum');
    if (live.length) {
      if (!aliasProduct) return live;
      return [aliasProduct, ...live.filter((item) => item.id !== aliasProduct.id)];
    }
  } catch {
    // Fall through to Supabase / seed. Live API is the primary catalog.
  }

  if (supabase) {
    try {
      let request = supabase.from('products').select('*').limit(40);
      if (term) request = request.or(`name.ilike.%${term}%,brand.ilike.%${term}%`);
      const { data, error } = await request;
      if (!error && data?.length) return data.map(fromRow);
    } catch {
      // table may not exist yet
    }
  }

  // Last resort. Scored per word rather than matched on the whole phrase, so a
  // query like "combination skin serum" still returns something sensible.
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
  if (aliasProduct && !ranked.some((product) => product.id === aliasProduct.id)) {
    return [aliasProduct, ...ranked];
  }
  if (aliasProduct) {
    return [aliasProduct, ...ranked.filter((product) => product.id !== aliasProduct.id)];
  }
  return ranked;
}

export async function loadProduct(id: string): Promise<Product | null> {
  const cached = getCachedProduct(id);
  if (cached) return cached;
  const seeded = seedProducts.find((product) => product.id === id);
  if (seeded) {
    rememberProduct(seeded);
    return seeded;
  }
  const live = await fetchOpenBeautyProduct(id);
  if (live) return live;
  if (supabase) {
    const { data } = await supabase.from('products').select('*').or(`barcode.eq.${id},id.eq.${id}`).maybeSingle();
    if (data) return fromRow(data as Record<string, unknown>);
  }
  return null;
}

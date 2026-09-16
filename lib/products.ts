import { products as seedProducts } from './seed';
import {
  fetchOpenBeautyProduct,
  getCachedProduct,
  rememberProduct,
  searchOpenBeautyFacts,
} from './openBeautyFacts';
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
    heroEmoji: '🧴',
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
  try {
    const live = await searchOpenBeautyFacts(term || 'skincare serum');
    if (live.length) return live;
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

  const q = term.toLowerCase();
  return seedProducts.filter((product) => {
    if (!q) return true;
    const hay = [product.name, product.brand, ...product.ingredients, ...product.attributeTags]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
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

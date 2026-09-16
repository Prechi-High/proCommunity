import type { Product, ProductCategory, SkinType } from './types';

const OBF_SEARCH = 'https://world.openbeautyfacts.org/cgi/search.pl';
const OBF_PRODUCT = 'https://world.openbeautyfacts.org/api/v2/product';
const UA = 'Sourced/1.0 (https://github.com; beauty-confidence-app)';

interface ObfIngredient {
  id?: string;
  text?: string;
}

interface ObfProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  ingredients_text?: string;
  ingredients_text_en?: string;
  ingredients?: ObfIngredient[];
  ingredients_tags?: string[];
  categories_tags?: string[];
  labels_tags?: string[];
  image_front_url?: string;
  image_url?: string;
  url?: string;
  quantity?: string;
}

const cache = new Map<string, Product>();

function headers(): HeadersInit {
  return {
    Accept: 'application/json',
    'User-Agent': UA,
  };
}

function slug(tag: string): string {
  return tag.replace(/^en:/, '').toLowerCase().replace(/[\s-]+/g, '_');
}

function categoryFrom(tags: string[] = []): ProductCategory {
  const joined = tags.join(' ').toLowerCase();
  if (joined.includes('sunscreen') || joined.includes('spf')) return 'spf';
  if (joined.includes('cleanser') || joined.includes('wash')) return 'cleanser';
  if (joined.includes('serum')) return 'serum';
  if (joined.includes('essence')) return 'essence';
  if (joined.includes('mask')) return 'mask';
  if (joined.includes('moistur') || joined.includes('cream')) return 'moisturizer';
  return 'treatment';
}

function emojiFor(category: ProductCategory): string {
  if (category === 'cleanser') return '🧼';
  if (category === 'spf') return '☀️';
  if (category === 'mask') return '🫙';
  if (category === 'serum' || category === 'essence') return '🧪';
  return '🧴';
}

function attributesFrom(product: ObfProduct): string[] {
  const tags = [...(product.labels_tags ?? []), ...(product.categories_tags ?? [])].map(slug);
  const out = new Set<string>();
  for (const tag of tags) {
    if (tag.includes('fragrance_free') || tag.includes('without_perfume')) out.add('fragrance_free');
    if (tag.includes('oil_free')) out.add('oil_free');
    if (tag.includes('hydrat') || tag.includes('moistur')) out.add('hydrating');
    if (tag.includes('matte') || tag.includes('sebum')) out.add('mattifying');
    if (tag.includes('sensitive') || tag.includes('gentle')) out.add('gentle');
    if (tag.includes('ceramide') || tag.includes('barrier')) out.add('barrier_repair');
    if (tag.includes('vitamin_c') || tag.includes('ascorb')) out.add('vitamin_c');
  }
  const ingredients = (product.ingredients_tags ?? []).map(slug).join(' ');
  if (ingredients.includes('niacinamide')) out.add('niacinamide');
  if (ingredients.includes('ceramide')) out.add('barrier_repair');
  return [...out];
}

function suitsFrom(tags: string[]): SkinType[] {
  const all: SkinType[] = [];
  const joined = tags.join(' ').toLowerCase();
  if (joined.includes('oily')) all.push('oily');
  if (joined.includes('dry')) all.push('dry');
  if (joined.includes('combin')) all.push('combination');
  if (joined.includes('sensitive')) all.push('sensitive');
  if (joined.includes('normal')) all.push('normal');
  return all.length ? all : ['oily', 'dry', 'combination', 'sensitive', 'normal'];
}

export function mapObfProduct(raw: ObfProduct): Product | null {
  const code = raw.code?.trim();
  const name = (raw.product_name_en || raw.product_name || '').trim();
  if (!code || !name) return null;
  const category = categoryFrom(raw.categories_tags);
  const ingredients = (raw.ingredients ?? [])
    .map((item) => slug(item.id || item.text || ''))
    .filter((item) => item && item !== 'unknown');
  const product: Product = {
    id: code,
    name,
    brand: (raw.brands || 'Unknown brand').split(',')[0].trim(),
    description: (raw.ingredients_text_en || raw.ingredients_text || '').trim(),
    category,
    ingredients: ingredients.slice(0, 24),
    attributeTags: attributesFrom(raw),
    suitsSkinTypes: suitsFrom([...(raw.categories_tags ?? []), ...(raw.labels_tags ?? [])]),
    heroEmoji: emojiFor(category),
    heroImageUrl: raw.image_front_url || raw.image_url || null,
    typicalDurationDays: null,
    shelfLifeMonths: null,
    source: 'open_beauty_facts',
    barcode: code,
    productUrl: raw.url || `https://world.openbeautyfacts.org/product/${code}`,
  };
  cache.set(code, product);
  return product;
}

export function getCachedProduct(id: string): Product | undefined {
  return cache.get(id);
}

export function rememberProduct(product: Product): void {
  cache.set(product.id, product);
}

export async function searchOpenBeautyFacts(query: string, pageSize = 24): Promise<Product[]> {
  const params = new URLSearchParams({
    action: 'process',
    json: '1',
    page_size: String(pageSize),
    search_simple: '1',
    search_terms: query.trim() || 'skincare',
  });
  const response = await fetch(`${OBF_SEARCH}?${params.toString()}`, { headers: headers() });
  if (!response.ok) throw new Error(`Open Beauty Facts search failed (${response.status})`);
  const json = (await response.json()) as { products?: ObfProduct[] };
  return (json.products ?? []).map(mapObfProduct).filter((item): item is Product => Boolean(item));
}

export async function fetchOpenBeautyProduct(code: string): Promise<Product | null> {
  const cached = cache.get(code);
  if (cached) return cached;
  const response = await fetch(`${OBF_PRODUCT}/${encodeURIComponent(code)}.json`, { headers: headers() });
  if (!response.ok) return null;
  const json = (await response.json()) as { product?: ObfProduct; status?: number };
  if (!json.product) return null;
  return mapObfProduct(json.product);
}

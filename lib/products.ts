import { accessToken } from './auth';
import { useAppStore } from './store';
import { supabaseAnonKey, supabaseUrl } from './supabase';
import type { Product, ProductProfile } from './types';

/**
 * Product Intelligence client. Every product in the app comes from the
 * `product-intelligence` edge function (web + shopping + reviews + community evidence),
 * never from a fixed catalogue.
 */

const COUNTRY = 'ng';

export interface SearchKnowledge {
  title: string;
  type: string;
  description: string;
  image: string | null;
}

export interface SearchResponse {
  products: Product[];
  knowledge: SearchKnowledge | null;
}

type RawCandidate = {
  id: string;
  name: string;
  brand: string;
  category: string;
  image: string | null;
  price: Product['price'];
  rating: number | null;
  ratingCount: number | null;
  offers: number;
  source: string | null;
  link: string | null;
};

export async function callIntel<T>(body: Record<string, unknown>, timeoutMs = 45000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const token = await accessToken().catch(() => null);
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/product-intelligence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token ?? supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ country: COUNTRY, ...body }),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok || !json) throw new Error(json?.error ?? `product_intelligence_http_${res.status}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

const registry = new Map<string, Product>();

export function rememberProduct(product: Product): void {
  const prev = registry.get(product.id);
  const merged = prev ? { ...prev, ...stripEmpty(product) } : product;
  registry.set(product.id, merged);
  useAppStore.getState().rememberProduct(merged);
}

export function getKnownProduct(id: string): Product | undefined {
  return registry.get(id) ?? useAppStore.getState().knownProducts[id];
}

function stripEmpty(product: Product): Partial<Product> {
  return Object.fromEntries(
    Object.entries(product).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Partial<Product>;
}

function fromCandidate(c: RawCandidate): Product {
  return {
    id: c.id,
    name: c.name,
    brand: c.brand,
    category: c.category || 'Product',
    heroImageUrl: c.image,
    price: c.price,
    rating: c.rating,
    ratingCount: c.ratingCount,
    offers: c.offers,
    source: c.source,
    productUrl: c.link,
  };
}

export function displayName(product: Pick<Product, 'name' | 'brand'>): string {
  if (!product.brand) return product.name;
  return product.name.toLowerCase().startsWith(product.brand.toLowerCase())
    ? product.name
    : `${product.brand} ${product.name}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function searchProducts(query: string): Promise<SearchResponse> {
  const q = query.trim();
  if (!q) return { products: [], knowledge: null };
  const { getVisitorKeyForApi } = await import('./siteAnalytics');
  const visitorKey = await getVisitorKeyForApi().catch(() => '');
  const res = await callIntel<{ products?: RawCandidate[]; knowledge?: SearchKnowledge | null }>(
    { action: 'search', query: q, visitorKey },
    30000,
  );
  const products = (res.products ?? []).map(fromCandidate);
  products.forEach((p) => registry.set(p.id, { ...registry.get(p.id), ...p }));
  return { products, knowledge: res.knowledge ?? null };
}

export async function searchCatalog(query: string): Promise<Product[]> {
  return (await searchProducts(query)).products;
}

export function profileToProduct(profile: ProductProfile, base?: Product): Product {
  const low = profile.offers.find((o) => o.price)?.price ?? null;
  return {
    ...base,
    id: profile.id,
    name: profile.identity.name || base?.name || profile.query,
    brand: profile.identity.brand || base?.brand || '',
    category: profile.identity.category || base?.category || 'Product',
    description: profile.summary,
    heroImageUrl: base?.heroImageUrl || profile.images[0] || null,
    price: base?.price ?? low,
    rating: profile.rating ?? base?.rating ?? null,
    ratingCount: profile.ratingCount ?? base?.ratingCount ?? null,
  };
}

export async function investigateProduct(input: {
  id: string;
  query?: string;
  force?: boolean;
}): Promise<ProductProfile> {
  const known = getKnownProduct(input.id);
  const query = input.query?.trim() || (known ? displayName(known) : input.id.replace(/-/g, ' '));
  const res = await callIntel<{ profile?: ProductProfile }>({
    action: 'investigate',
    productId: input.id,
    query,
    force: input.force === true,
  });
  if (!res.profile) throw new Error('empty_profile');
  const profile = res.profile;
  if (!profile.findings) {
    const { buildProductFindings } = await import('./claims/buildFindings');
    profile.findings = buildProductFindings({
      identityConfidence: profile.identityConfidence ?? (profile.identity.model ? 0.72 : 0.4),
      identity: profile.identity,
      brandClaims: [],
      discoveriesRaw: [],
      voices: (profile.voices ?? []).map((v) => ({ ref: v.id, mark: v.mark, stance: v.stance, topic: v.topic })),
      reveals: (profile.reveals ?? []).map((r) => ({ text: r.text, mark: r.mark })),
      praise: profile.praise,
      complaints: profile.complaints,
      sources: profile.sources.map((s) => ({ n: s.n, domain: s.domain, kind: s.kind })),
    });
  }
  rememberProduct(profileToProduct(profile, known));
  return profile;
}

export async function loadProduct(id: string): Promise<Product | null> {
  const known = getKnownProduct(id);
  if (known) return known;
  try {
    const res = await callIntel<{ profile?: ProductProfile | null }>({ action: 'get', productId: id }, 15000);
    if (res.profile) {
      const product = profileToProduct(res.profile);
      rememberProduct(product);
      return product;
    }
  } catch {
    // fall through
  }
  return null;
}

export function formatPrice(price: { amount: number; currency: string; display?: string } | null | undefined): string {
  if (!price) return '';
  if (price.display) return price.display;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency, maximumFractionDigits: 0 }).format(
      price.amount,
    );
  } catch {
    return `${price.currency} ${Math.round(price.amount).toLocaleString()}`;
  }
}

export function formatRange(range: ProductProfile['priceRange']): string {
  if (!range) return '';
  const lo = formatPrice({ amount: range.min, currency: range.currency });
  const hi = formatPrice({ amount: range.max, currency: range.currency });
  return lo === hi ? lo : `${lo} – ${hi}`;
}

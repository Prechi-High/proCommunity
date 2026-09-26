/**
 * Assembles the product confidence journey from:
 * - catalog product identity
 * - product-case lived evidence (verdict / clusters)
 * - Product Intelligence Organisation (edge investigate)
 * - product_images / product_prices when present
 * - literacy videos (how_it_works / how_to_use / composition)
 */

import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';
import type { ProductCaseAnalysis } from './productCase';
import type { Product } from './types';
import { getLiteracyForProduct } from './catalog';
import { loadJourneyForTag, type JourneyClip } from './videos';
import type { LiteracyEntry } from './types';

export type ConfidenceBand = 'High' | 'Likely' | 'Uncertain';

export interface JourneyClaim {
  key: string;
  label: string;
  value: string;
  confidence: number;
  provenance?: string;
}

export interface JourneyPrice {
  amount: number;
  currency: string;
  seller?: string | null;
  observedAt?: string | null;
  availability?: string | null;
}

export interface ProductJourney {
  name: string;
  brand: string;
  category: string;
  description: string | null;
  primaryImage: string | null;
  gallery: string[];
  identificationConfidence: number;
  confidenceBand: ConfidenceBand;
  score: number | null;
  verdict: string | null;
  basis: string | null;
  tooFew: boolean;
  praise: string[];
  complaints: string[];
  signalCount: number;
  claims: JourneyClaim[];
  price: JourneyPrice | null;
  priceRange: { min: number; max: number; currency: string } | null;
  literacyVideos: JourneyClip[];
  literacyNotes: LiteracyEntry[];
  researching: boolean;
  sources: string[];
}

const CLAIM_LABELS: Record<string, string> = {
  product_name: 'Name',
  brand: 'Brand',
  category: 'Category',
  description: 'What it is',
  model: 'Model',
  size: 'Size',
  skin_type: 'Skin type',
  ingredients: 'Ingredients',
  active_ingredients: 'Actives',
  how_to_use: 'How to use',
  frequency: 'Frequency',
  claimed_benefits: 'Claimed benefits',
  fragrance: 'Fragrance',
  spf_value: 'SPF',
  maximum_wattage: 'Max wattage',
  compatibility: 'Compatibility',
  availability: 'Availability',
  price: 'Price',
  price_range: 'Price range',
};

function bandFromConfidence(n: number): ConfidenceBand {
  if (n >= 0.75) return 'High';
  if (n >= 0.45) return 'Likely';
  return 'Uncertain';
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[;|•\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);
  }
  return [];
}

function stringifyValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function loadProductImages(productId: string): Promise<{ primary: string | null; gallery: string[] }> {
  if (!supabase) return { primary: null, gallery: [] };
  try {
    const { data, error } = await supabase
      .from('product_images')
      .select('image_url, is_primary, is_gallery, image_type, confidence')
      .eq('product_id', productId)
      .order('is_primary', { ascending: false })
      .limit(12);
    if (error || !data?.length) return { primary: null, gallery: [] };
    const primary =
      data.find((row) => row.is_primary)?.image_url ??
      data.find((row) => row.image_type === 'primary')?.image_url ??
      data[0]?.image_url ??
      null;
    const gallery = data
      .filter((row) => row.image_url && row.image_url !== primary)
      .map((row) => String(row.image_url));
    return { primary: primary ? String(primary) : null, gallery };
  } catch {
    return { primary: null, gallery: [] };
  }
}

async function loadProductPrices(productId: string): Promise<JourneyPrice[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('product_prices')
      .select('amount, currency, seller, observed_at, availability')
      .eq('product_id', productId)
      .order('observed_at', { ascending: false })
      .limit(8);
    if (error || !data?.length) return [];
    return data
      .filter((row) => row.amount != null)
      .map((row) => ({
        amount: Number(row.amount),
        currency: String(row.currency || 'NGN'),
        seller: (row.seller as string | null) ?? null,
        observedAt: (row.observed_at as string | null) ?? null,
        availability: (row.availability as string | null) ?? null,
      }));
  } catch {
    return [];
  }
}

export async function investigateProductIntelligence(query: string): Promise<{
  intelligence: Record<string, unknown>;
  images: string[];
  confidence: number;
  sources: string[];
  praise: string[];
  complaints: string[];
} | null> {
  const base = (supabaseUrl || '').replace(/\/$/, '');
  const anon = supabaseAnonKey || '';
  if (!base || !anon || !query.trim()) return null;

  try {
    const response = await fetch(`${base}/functions/v1/product-intelligence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anon}`,
        apikey: anon,
        'x-client-info': 'sourced/journey',
      },
      body: JSON.stringify({ action: 'investigate', query: query.trim() }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload?.success) return null;

    const intel = (payload.intelligence ?? {}) as Record<string, unknown>;
    const nested = (intel.intelligence as Record<string, unknown> | undefined) ?? intel;
    const images = Array.isArray(payload.images)
      ? payload.images.map(String)
      : Array.isArray(nested.gallery_images)
        ? (nested.gallery_images as unknown[]).map(String)
        : [];
    const sources = Array.isArray(payload.searchResults?.topMatches)
      ? payload.searchResults.topMatches.map((m: { url?: string }) => String(m.url || '')).filter(Boolean)
      : asStringArray(nested.sources);

    return {
      intelligence: nested,
      images,
      confidence: Number(payload.confidence ?? nested.confidence ?? 0.55),
      sources,
      praise: asStringArray(nested.common_praise ?? nested.praise),
      complaints: asStringArray(nested.common_complaints ?? nested.complaints),
    };
  } catch {
    return null;
  }
}

function claimsFromIntelligence(intel: Record<string, unknown>, sources: string[]): JourneyClaim[] {
  const skip = new Set([
    'product_name',
    'brand',
    'common_praise',
    'common_complaints',
    'praise',
    'complaints',
    'gallery_images',
    'primary_image',
    'sources',
    'confidence',
    'rawData',
    'key_specs',
    'ingredients_or_materials',
  ]);
  const out: JourneyClaim[] = [];
  for (const [key, raw] of Object.entries(intel)) {
    if (skip.has(key)) continue;
    const value = stringifyValue(raw);
    if (!value || value.length < 2) continue;
    out.push({
      key,
      label: CLAIM_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: value.slice(0, 220),
      confidence: 0.7,
      provenance: sources[0] ? `Source · ${sources[0].replace(/^https?:\/\//, '').split('/')[0]}` : undefined,
    });
    if (out.length >= 6) break;
  }
  return out;
}

function experienceFromCase(analysis: ProductCaseAnalysis | null | undefined): {
  praise: string[];
  complaints: string[];
} {
  if (!analysis?.clusters?.length) return { praise: [], complaints: [] };
  const praise: string[] = [];
  const complaints: string[] = [];
  for (const cluster of analysis.clusters) {
    const quotes = cluster.quotes.slice(0, 2).map((q) => q.text.trim()).filter(Boolean);
    if (cluster.tone === 'sage') praise.push(...quotes);
    else if (cluster.tone === 'coral') complaints.push(...quotes);
    else if (cluster.tone === 'honey' && praise.length < 2) praise.push(...quotes.slice(0, 1));
  }
  return {
    praise: [...new Set(praise)].slice(0, 3),
    complaints: [...new Set(complaints)].slice(0, 3),
  };
}

async function loadLiteracyVideos(product: Product): Promise<JourneyClip[]> {
  const tags = ['how_it_works', 'how_to_use', 'composition'] as const;
  const seen = new Set<string>();
  const out: JourneyClip[] = [];
  for (const tag of tags) {
    try {
      const { clips } = await loadJourneyForTag(product, tag);
      for (const clip of clips) {
        if (seen.has(clip.id) || !clip.thumbnailUrl) continue;
        seen.add(clip.id);
        out.push(clip);
        if (out.length >= 4) return out;
      }
    } catch {
      // continue
    }
  }
  return out;
}

export async function assembleProductJourney(
  product: Product,
  analysis: ProductCaseAnalysis | null | undefined,
): Promise<ProductJourney> {
  const query = `${product.brand} ${product.name}`.trim();
  const [images, prices, investigated, literacyVideos] = await Promise.all([
    loadProductImages(product.id),
    loadProductPrices(product.id),
    investigateProductIntelligence(query),
    loadLiteracyVideos(product),
  ]);

  const fromCase = experienceFromCase(analysis);
  const praise = (investigated?.praise?.length ? investigated.praise : fromCase.praise).slice(0, 3);
  const complaints = (
    investigated?.complaints?.length ? investigated.complaints : fromCase.complaints
  ).slice(0, 3);

  const intel = investigated?.intelligence ?? {};
  let claims = claimsFromIntelligence(intel, investigated?.sources ?? []);

  if (claims.length < 3 && product.ingredients?.length) {
    for (const ingredient of product.ingredients.slice(0, 5)) {
      if (claims.some((c) => c.value.toLowerCase() === ingredient.toLowerCase())) continue;
      claims.push({
        key: `ingredient_${ingredient}`,
        label: 'Ingredient',
        value: ingredient,
        confidence: 0.85,
        provenance: 'Product formula',
      });
      if (claims.length >= 6) break;
    }
  }

  if (product.description && !claims.some((c) => c.key === 'description')) {
    claims.unshift({
      key: 'description',
      label: 'What it is',
      value: product.description.slice(0, 220),
      confidence: 0.8,
      provenance: 'Product record',
    });
    claims = claims.slice(0, 6);
  }

  const gallery = [
    ...images.gallery,
    ...(investigated?.images ?? []).filter((url) => url && url !== images.primary),
  ].filter((url, i, arr) => arr.indexOf(url) === i).slice(0, 6);

  const primaryImage =
    images.primary ||
    product.heroImageUrl ||
    investigated?.images?.[0] ||
    gallery[0] ||
    null;

  let price: JourneyPrice | null = prices[0] ?? null;
  let priceRange: ProductJourney['priceRange'] = null;
  if (prices.length) {
    const amounts = prices.map((p) => p.amount);
    priceRange = {
      min: Math.min(...amounts),
      max: Math.max(...amounts),
      currency: prices[0].currency,
    };
  } else {
    const rawPrice = intel.price ?? intel.price_range;
    if (rawPrice != null) {
      const text = stringifyValue(rawPrice);
      const num = Number(String(text).replace(/[^0-9.]/g, ''));
      if (!Number.isNaN(num) && num > 0) {
        price = { amount: num, currency: 'NGN', seller: null, observedAt: null };
      }
    }
  }

  const identificationConfidence = Math.max(
    investigated?.confidence ?? 0,
    analysis?.tooFew ? 0.35 : analysis?.productScore != null ? Math.min(0.95, (analysis.productScore / 100) * 0.9 + 0.2) : 0.5,
  );

  const signalCount =
    (analysis?.counts.yt ?? 0) + (analysis?.counts.rd ?? 0) + (analysis?.counts.own ?? 0);

  return {
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description || stringifyValue(intel.description) || null,
    primaryImage,
    gallery,
    identificationConfidence,
    confidenceBand: bandFromConfidence(identificationConfidence),
    score: analysis?.productScore ?? null,
    verdict: analysis?.verdict ?? null,
    basis: analysis?.basis ?? null,
    tooFew: Boolean(analysis?.tooFew),
    praise,
    complaints,
    signalCount,
    claims,
    price,
    priceRange,
    literacyVideos,
    literacyNotes: getLiteracyForProduct(product).slice(0, 2),
    researching: false,
    sources: investigated?.sources ?? [],
  };
}

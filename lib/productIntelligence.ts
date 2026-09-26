/**
 * Product Intelligence from Photo
 * Identifies products from images via the product-vision Edge Function
 * (works on native + web). Does not use Open Beauty Facts.
 */

import { extractProductFromPhoto as extractVision } from './productVision';

export interface UniversalProductResult {
  name: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
  confidence: number | null;
  keyFeatures: string[];
  provider?: string;
  model?: string;
  rawData?: Record<string, unknown>;
}

export interface ProductIntelligenceResult {
  label: string | null;
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  hint?: string;
  confidence?: number;
  category?: string;
  intelligence?: Record<string, unknown>;
  productName?: string;
  productBrand?: string;
  productCategory?: string;
  productDescription?: string;
  productImage?: string;
  universalResult?: UniversalProductResult;
  attempts?: unknown[];
  source?: string;
}

/** Split a vision label like "CeraVe Foaming Facial Cleanser" into brand + name. */
function splitLabel(label: string): { name: string; brand: string } {
  const cleaned = label.replace(/\s+/g, ' ').trim();
  if (!cleaned) return { name: 'Unknown product', brand: 'Unknown' };

  const knownBrands = [
    'the ordinary',
    'cerave',
    'la roche-posay',
    'la roche posay',
    'neutrogena',
    'cetaphil',
    'paula\'s choice',
    'paulas choice',
    'good molecules',
    'innisfree',
    'cosrx',
    'drunk elephant',
    'glossier',
    'fenty beauty',
    'rare beauty',
    'nivea',
    'dove',
    'olay',
    'aveeno',
    'eucerin',
    'vichy',
    'bioderma',
    'avene',
    'avène',
  ];

  const lower = cleaned.toLowerCase();
  for (const brand of knownBrands) {
    if (lower.startsWith(brand)) {
      const name = cleaned.slice(brand.length).replace(/^[\s\-–—:]+/, '').trim();
      const brandProper = cleaned.slice(0, brand.length);
      return { name: name || cleaned, brand: brandProper };
    }
  }

  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return { brand: parts[0], name: parts.slice(1).join(' ') };
  }
  return { name: cleaned, brand: 'Unknown' };
}

export async function extractProductFromPhoto(asset: {
  uri: string;
  fileName?: string | null;
  width?: number;
  height?: number;
  base64?: string | null;
}): Promise<ProductIntelligenceResult> {
  console.log('[ProductIntelligence] Starting extraction via product-vision for:', asset.uri);

  const vision = await extractVision(asset);

  if (!vision.ok || !vision.label) {
    console.log('[ProductIntelligence] Vision failed:', vision.errorCode, vision.errorMessage);
    return {
      label: vision.label,
      ok: false,
      errorCode: vision.errorCode,
      errorMessage: vision.errorMessage,
      hint: vision.hint,
      attempts: vision.attempts,
      source: vision.source,
    };
  }

  const { name, brand } = splitLabel(vision.label);
  const universalResult: UniversalProductResult = {
    name,
    brand,
    category: 'general',
    description: `Identified from your photo as ${vision.label}.`,
    confidence: 0.8,
    keyFeatures: [],
    provider: vision.source === 'edge-direct' ? 'product-vision' : vision.source,
  };

  console.log('[ProductIntelligence] Identified:', vision.label);

  return {
    label: vision.label,
    ok: true,
    confidence: 0.8,
    category: 'general',
    intelligence: { ...universalResult },
    productName: name,
    productBrand: brand,
    productCategory: 'general',
    productDescription: universalResult.description ?? undefined,
    universalResult,
    source: vision.source,
  };
}

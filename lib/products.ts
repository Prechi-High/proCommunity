import { agentLog } from '@/lib/debug/agentLog';
import { canonicalFromListing } from './products/canonicalDisplay';
import { accessToken } from './auth';
import { hasProductOpenTiming, markProductOpenTiming } from '@/lib/unmask/openTimings';
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
    const json = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
    if (!res.ok || !json) {
      const detail = json?.message ?? json?.error ?? `product_intelligence_http_${res.status}`;
      throw new Error(detail);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

const registry = new Map<string, Product>();

type PreviewResult = { preview: ProductPreviewResponse; cached: boolean; timingMs: number };
const previewInflight = new Map<string, Promise<PreviewResult>>();
const previewSnapshot = new Map<string, PreviewResult>();
type UnmaskStartResult = {
  attached?: boolean;
  started?: boolean;
  job: { progress: UnmaskJobProgress } | null;
  profile?: ProductProfile;
};
const unmaskInflight = new Map<string, Promise<UnmaskStartResult>>();

export function getCachedPreviewResult(productId: string): PreviewResult | undefined {
  return previewSnapshot.get(productId);
}

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

export async function hydrateProductFindings(profile: ProductProfile): Promise<void> {
  const { buildProductFindings } = await import('./claims/buildFindings');
  const { findingsNeedRefresh, isGenericStoredClaim } = await import('./claims/markPhrase');
  if (profile.findings && !findingsNeedRefresh(profile.findings)) return;
  const brandClaims =
    profile.findings?.claims
      .filter((c) => !isGenericStoredClaim(c.topic, c.brandStatement))
      .map((c) => ({
        topic: c.topic,
        exact_text: c.brandStatement,
        criterion: c.criterion,
        partial_criterion: c.partialCriterion,
        brand_source: c.brandSourceId ?? undefined,
      })) ?? [];
  profile.findings = buildProductFindings({
    identityConfidence: profile.identityConfidence ?? (profile.identity.model ? 0.72 : 0.4),
    identity: profile.identity,
    brandClaims,
    discoveriesRaw: [],
    voices: (profile.voices ?? []).map((v) => ({
      ref: v.evidenceRef || v.id,
      mark: v.mark,
      stance: v.stance,
      topic: v.topic,
      text: v.text,
    })),
    ownerClaimsRaw: [],
    reveals: (profile.reveals ?? []).map((r) => ({ text: r.text, mark: r.mark })),
    praise: profile.praise,
    complaints: profile.complaints,
    uses: profile.uses,
    bestFor: profile.bestFor,
    summary: profile.summary,
    sources: profile.sources.map((s) => ({ n: s.n, domain: s.domain, kind: s.kind })),
  });
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

export type ProductPreviewResponse = {
  id: string;
  query: string;
  identity: ProductProfile['identity'];
  canonicalDisplayName: string;
  variantDisplay: string;
  rawListingTitle: string;
  identificationState: 'identified' | 'high_confidence_match' | 'user_verified' | 'externally_verified';
  domain?: string;
  summary?: string;
  heroImageUrl: string | null;
  images: string[];
  gallery?: Array<{ url: string; title?: string }>;
  specs?: Array<{ label: string; value: string }>;
  previewSource?: string;
};

export type UnmaskJobMilestones = {
  identified?: boolean;
  videosFound?: number;
  rawComments?: number;
  validEvidence?: number;
  youtubeComplete?: boolean;
  evidenceMappingComplete?: boolean;
  scorecardComplete?: boolean;
  blueprintStartedAt?: string;
  youtubeStartedAt?: string;
  evidenceMappingStartedAt?: string;
};

export type UnmaskJobProgress = {
  state: string;
  progressPercent: number;
  completedStages: string[];
  activeStages: string[];
  milestones?: UnmaskJobMilestones;
  sections?: Partial<Record<'details' | 'evidence' | 'videos' | 'scores', 'ready' | 'researching' | 'pending'>>;
  parallelStages?: string[];
  startedAt: string;
  updatedAt: string;
};

export function previewToProfile(preview: ProductPreviewResponse): ProductProfile {
  const id = preview.identity;
  const fallbackDisplay = canonicalFromListing(preview.rawListingTitle || id.name, id.brand);
  const displayNameCanon = preview.canonicalDisplayName || fallbackDisplay.canonicalDisplayName;
  const variantLine = preview.variantDisplay || fallbackDisplay.variantDisplay;
  return {
    id: preview.id,
    query: preview.query,
    identity: {
      name: displayNameCanon,
      brand: id.brand ?? '',
      manufacturer: id.manufacturer ?? '',
      model: id.model ?? '',
      category: id.category ?? 'Product',
      subcategory: id.subcategory ?? '',
      variant: variantLine || id.variant || '',
      size: id.size ?? '',
    },
    summary: preview.summary ?? '',
    verdict: '',
    consensus: '',
    consensusMark: '',
    voices: [],
    reveals: [],
    people: { voices: 0, commenters: 0, ratings: 0, discussions: 0 },
    specs: (preview.specs ?? []).map((s) => ({ label: s.label, value: s.value, source: null })),
    praise: [],
    complaints: [],
    bestFor: [],
    notFor: [],
    uses: [],
    howToUse: '',
    compatibility: '',
    alternatives: [],
    offers: [],
    priceRange: null,
    rating: null,
    ratingCount: null,
    score: null,
    confidence: 0,
    band: 'Uncertain',
    images: preview.images,
    gallery: (preview.gallery ?? preview.images.map((url) => ({ url, title: '' }))).map((g) => ({
      url: g.url,
      title: g.title ?? '',
      source: '',
    })),
    variants: [],
    sources: [],
    verifiedAt: new Date().toISOString(),
    identityConfidence: preview.identity.model ? 0.65 : 0.45,
  };
}

/** Fire preview + background Unmask in parallel (e.g. on search result tap). */
export function kickProductOpenPipeline(input: {
  id: string;
  query?: string;
  name?: string;
  brand?: string;
  category?: string;
  heroImageUrl?: string | null;
}): void {
  const known = getKnownProduct(input.id);
  const query = input.query?.trim() || (known ? displayName(known) : input.id.replace(/-/g, ' '));
  if (!hasProductOpenTiming(input.id, 'selection')) {
    markProductOpenTiming(input.id, 'selection');
  }
  agentLog('products.ts:kick', 'kickProductOpenPipeline', { productId: input.id, query }, 'H1');
  void Promise.allSettled([
    resolveProductPreview({
      id: input.id,
      query,
      name: input.name ?? known?.name,
      brand: input.brand ?? known?.brand,
    }).then((r) => {
      if (!hasProductOpenTiming(input.id, 'preview_ready')) {
        markProductOpenTiming(input.id, 'preview_ready');
      }
      agentLog(
        'products.ts:kick',
        'preview_settled',
        { productId: input.id, cached: r.cached, previewSource: r.preview.previewSource, timingMs: r.timingMs },
        'H4',
      );
      return r;
    }),
    startProductUnmask({ id: input.id, query }).then((r) => {
      agentLog(
        'products.ts:kick',
        'unmask_settled',
        { productId: input.id, attached: r.attached, started: r.started, state: r.job?.progress?.state },
        'H1',
      );
      return r;
    }),
  ]);
}

async function resolveProductPreviewInner(input: {
  id: string;
  query?: string;
  name?: string;
  brand?: string;
}): Promise<PreviewResult> {
  if (!hasProductOpenTiming(input.id, 'preview_request_started')) {
    markProductOpenTiming(input.id, 'preview_request_started');
  }
  const known = getKnownProduct(input.id);
  const listingTitle = input.name ?? known?.name ?? '';
  const query = input.query?.trim() || (known ? displayName(known) : input.id.replace(/-/g, ' '));
  agentLog('products.ts:preview', 'resolveProductPreview_start', { productId: input.id, query }, 'H4');
  const res = await callIntel<{
    preview?: ProductPreviewResponse;
    cached?: boolean;
    timingMs?: number;
    previewSource?: string;
  }>(
    {
      action: 'preview',
      productId: input.id,
      query,
      name: listingTitle,
      listingTitle,
      brand: input.brand ?? known?.brand,
      category: known?.category,
      heroImageUrl: known?.heroImageUrl,
    },
    20_000,
  );
  if (!res.preview) throw new Error('empty_preview');
  const preview = res.preview;
  rememberProduct(
    profileToProduct(previewToProfile(preview), {
      id: input.id,
      name: preview.canonicalDisplayName || preview.identity.name,
      brand: preview.identity.brand,
      category: preview.identity.category,
      heroImageUrl: preview.heroImageUrl,
    }),
  );
  const result = { preview, cached: res.cached === true, timingMs: res.timingMs ?? 0 };
  previewSnapshot.set(input.id, result);
  if (!hasProductOpenTiming(input.id, 'preview_ready')) {
    markProductOpenTiming(input.id, 'preview_ready');
  }
  agentLog(
    'products.ts:preview',
    'resolveProductPreview_done',
    { productId: input.id, cached: result.cached, previewSource: res.previewSource ?? preview.previewSource },
    'H4',
  );
  return result;
}

export function resolveProductPreview(input: {
  id: string;
  query?: string;
  name?: string;
  brand?: string;
}): Promise<PreviewResult> {
  const hit = previewSnapshot.get(input.id);
  if (hit) {
    agentLog('products.ts:preview', 'resolveProductPreview_snapshot', { productId: input.id }, 'H4', 'post-fix');
    return Promise.resolve(hit);
  }
  const existing = previewInflight.get(input.id);
  if (existing) {
    agentLog('products.ts:preview', 'resolveProductPreview_inflight_reuse', { productId: input.id }, 'H4', 'post-fix');
    return existing;
  }

  let resolve!: (value: PreviewResult) => void;
  let reject!: (reason?: unknown) => void;
  const flight = new Promise<PreviewResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  previewInflight.set(input.id, flight);

  void resolveProductPreviewInner(input)
    .then(resolve, reject)
    .finally(() => {
      previewInflight.delete(input.id);
    });

  return flight;
}

async function startProductUnmaskInner(input: {
  id: string;
  query?: string;
  force?: boolean;
}): Promise<UnmaskStartResult> {
  if (!hasProductOpenTiming(input.id, 'unmask_job_started')) {
    markProductOpenTiming(input.id, 'unmask_job_started');
  }
  const known = getKnownProduct(input.id);
  const query = input.query?.trim() || (known ? displayName(known) : input.id.replace(/-/g, ' '));
  const res = await callIntel<{
    attached?: boolean;
    started?: boolean;
    job?: { progress: UnmaskJobProgress };
    profile?: ProductProfile;
  }>(
    {
      action: 'start_unmask',
      productId: input.id,
      query,
      name: known?.name,
      brand: known?.brand,
      category: known?.category,
      force: input.force === true,
    },
    25_000,
  );
  if (res.profile) {
    await hydrateProductFindings(res.profile);
    rememberProduct(profileToProduct(res.profile, known));
  }
  return { attached: res.attached, started: res.started, job: res.job ?? null, profile: res.profile };
}

export function startProductUnmask(input: {
  id: string;
  query?: string;
  force?: boolean;
}): Promise<UnmaskStartResult> {
  const existing = unmaskInflight.get(input.id);
  if (existing) {
    agentLog('products.ts:unmask', 'startProductUnmask_inflight_reuse', { productId: input.id }, 'H1', 'post-fix');
    return existing;
  }

  let resolve!: (value: UnmaskStartResult) => void;
  let reject!: (reason?: unknown) => void;
  const flight = new Promise<UnmaskStartResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  unmaskInflight.set(input.id, flight);

  void startProductUnmaskInner(input)
    .then(resolve, reject)
    .finally(() => {
      unmaskInflight.delete(input.id);
    });

  return flight;
}

export async function getUnmaskJobStatus(productId: string): Promise<UnmaskJobProgress | null> {
  const res = await callIntel<{ job?: { progress: UnmaskJobProgress } | null }>(
    { action: 'unmask_status', productId },
    12_000,
  );
  return res.job?.progress ?? null;
}

export async function investigateProduct(input: {
  id: string;
  query?: string;
  force?: boolean;
}): Promise<ProductProfile> {
  const known = getKnownProduct(input.id);
  const query = input.query?.trim() || (known ? displayName(known) : input.id.replace(/-/g, ' '));
  const res = await callIntel<{ profile?: ProductProfile }>(
    {
      action: 'investigate',
      productId: input.id,
      query,
      force: input.force === true,
    },
    120_000,
  );
  if (!res.profile) throw new Error('empty_profile');
  const profile = res.profile;
  await hydrateProductFindings(profile);
  rememberProduct(profileToProduct(profile, known));
  return profile;
}

export async function loadProduct(id: string): Promise<Product | null> {
  const known = getKnownProduct(id);
  if (known) return known;
  try {
    const res = await callIntel<{ profile?: ProductProfile | null }>({ action: 'get', productId: id }, 15000);
    if (res.profile) {
      await hydrateProductFindings(res.profile);
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

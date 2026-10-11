export const CACHE_PREFIX = "cache";

export const CONTENT_TAG_KEYS = [
  "how_it_works",
  "how_to_use",
  "composition",
  "who_its_for",
  "results_over_time",
  "precautions",
  "comparisons",
] as const;

export const CACHE_VIDEO_PAGES = [1, 2, 3, 4, 5] as const;
export const CACHE_VIDEO_LIMITS = [12, 20, 24, 40] as const;
export const CACHE_COMMENT_PAGES = [1, 2, 3, 4, 5] as const;
export const CACHE_COMMENT_LIMITS = [10, 20, 25, 40] as const;

export function productKey(productId: string): string {
  return `${CACHE_PREFIX}:product:${productId}`;
}

/** Normalize search query + optional chip for stable Redis keys. */
export function normalizeSearchQuery(query: string, chip?: string): string {
  return `${query} ${chip ?? ""}`
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function searchKey(query: string, chip?: string): string {
  const normalized = normalizeSearchQuery(query, chip);
  return `${CACHE_PREFIX}:search:${normalized || "_"}`;
}

export function productVideosKey(
  productId: string,
  tag: string,
  page: number,
  limit: number,
): string {
  return `${CACHE_PREFIX}:product:${productId}:videos:tag:${tag}:page:${page}:limit:${limit}`;
}

export function videoCommentsKey(youtubeVideoId: string, page: number, limit: number): string {
  return `${CACHE_PREFIX}:video:${youtubeVideoId}:comments:page:${page}:limit:${limit}`;
}

export function taxonomyKey(category: string): string {
  return `${CACHE_PREFIX}:taxonomy:${category}`;
}

export function productBlueprintKey(productId: string): string {
  return `${CACHE_PREFIX}:product:${productId}:blueprint`;
}

export function productOverviewKey(productId: string): string {
  return `${CACHE_PREFIX}:product:${productId}:overview`;
}

export function productFactSectionKey(productId: string, sectionKey: string): string {
  return `${CACHE_PREFIX}:product:${productId}:facts:${sectionKey}`;
}

export function productDimensionKey(productId: string, dimensionKey: string): string {
  return `${CACHE_PREFIX}:product:${productId}:dimension:${dimensionKey}`;
}

export function productEvidenceKey(productId: string, dimensionKey: string): string {
  return `${CACHE_PREFIX}:product:${productId}:evidence:${dimensionKey}`;
}

const MAX_QUERY_KEY_LEN = 80;

function hashQueryComponent(query: string): string {
  let h = 0;
  for (let i = 0; i < query.length; i++) h = (h * 31 + query.charCodeAt(i)) >>> 0;
  return `qh_${h.toString(36)}`;
}

export function youtubeSearchPageKey(productId: string, queryHash: string, pageToken: string): string {
  const pt = pageToken || "first";
  return `${CACHE_PREFIX}:yt:${productId}:search:${queryHash}:${pt}`;
}

export function youtubeCommentPageKey(
  productId: string,
  videoId: string,
  order: string,
  pageToken: string,
): string {
  const pt = pageToken || "first";
  return `${CACHE_PREFIX}:yt:${productId}:threads:${videoId}:${order}:${pt}`;
}

export function youtubeRepliesKey(productId: string, parentCommentId: string): string {
  return `${CACHE_PREFIX}:yt:${productId}:replies:${parentCommentId}`;
}

export function youtubeHarvestBundleKey(productId: string): string {
  return `${CACHE_PREFIX}:evidence:${productId}:youtube:harvest_v2`;
}

export function evidenceProviderCacheKey(productId: string, provider: string, query: string): string {
  const normalized = query.toLowerCase().replace(/\s+/g, " ").trim();
  const queryPart =
    normalized.length > MAX_QUERY_KEY_LEN
      ? hashQueryComponent(normalized)
      : normalized.replace(/\s+/g, "_").slice(0, MAX_QUERY_KEY_LEN);
  return `${CACHE_PREFIX}:evidence:${productId}:${provider}:${queryPart}`;
}

export function productAskKey(productId: string, questionHash: string): string {
  return `${CACHE_PREFIX}:product:${productId}:ask:${questionHash}`;
}

/** Hot progress + dedupe for in-flight product investigations. */
export function unmaskJobKey(productId: string): string {
  return `unmask:job:${productId}`;
}

export function productPreviewKey(productId: string): string {
  return `${CACHE_PREFIX}:product:${productId}:preview_v1`;
}

export function domainsRegistryKey(): string {
  return `${CACHE_PREFIX}:domains:registry:v1`;
}

export function domainsAliasesKey(): string {
  return `${CACHE_PREFIX}:domains:aliases:v1`;
}

export function domainTemplateKey(domainId: string, version: number): string {
  return `${CACHE_PREFIX}:domain:${domainId}:template:${version}`;
}

export function productVideoKeyVariants(productId: string): string[] {
  const keys: string[] = [];
  for (const tag of CONTENT_TAG_KEYS) {
    for (const page of CACHE_VIDEO_PAGES) {
      for (const limit of CACHE_VIDEO_LIMITS) {
        keys.push(productVideosKey(productId, tag, page, limit));
      }
    }
  }
  return keys;
}

export function videoCommentKeyVariants(youtubeVideoId: string): string[] {
  const keys: string[] = [];
  for (const page of CACHE_COMMENT_PAGES) {
    for (const limit of CACHE_COMMENT_LIMITS) {
      keys.push(videoCommentsKey(youtubeVideoId, page, limit));
    }
  }
  return keys;
}

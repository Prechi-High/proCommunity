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

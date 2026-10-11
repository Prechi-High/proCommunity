function readEnv(name: string): string | undefined {
  if (typeof Deno !== "undefined") return Deno.env.get(name);
  return process.env[name];
}

function envInt(name: string, defaultValue: number): number {
  const n = Number(readEnv(name));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : defaultValue;
}

/** YouTube acquisition limits (distinct from scoring / UI). */
export const YOUTUBE_LIMITS = {
  /** Legacy separate-query mode: max search.list calls. */
  maxSearchQueries: () => envInt("MAX_YOUTUBE_SEARCH_QUERIES", 12),
  /** Bundled OR mode: max total search.list calls (anchors + OR bundles). */
  maxBundledSearchQueries: () => envInt("MAX_YOUTUBE_BUNDLED_SEARCH_QUERIES", 5),
  /** separate | bundled | hybrid (default hybrid). YOUTUBE_SEARCH_MODE kept for legacy. */
  youtubeQueryMode: (): "separate" | "bundled" | "hybrid" => {
    const raw = (readEnv("YOUTUBE_QUERY_MODE") ?? readEnv("YOUTUBE_SEARCH_MODE") ?? "hybrid").trim().toLowerCase();
    if (raw === "separate" || raw === "legacy") return "separate";
    if (raw === "bundled") return "bundled";
    return "hybrid";
  },
  useBundledSearch: () => {
    const raw = (readEnv("YOUTUBE_QUERY_MODE") ?? readEnv("YOUTUBE_SEARCH_MODE") ?? "hybrid").trim().toLowerCase();
    return raw !== "separate" && raw !== "legacy";
  },
  /** Valid product-evidence count per dimension below this triggers hybrid focused fallback. */
  hybridCoverageThreshold: () => envInt("YOUTUBE_HYBRID_COVERAGE_THRESHOLD", 12),
  useBatchGetStats: () => (readEnv("YOUTUBE_USE_BATCH_GET_STATS") ?? "").trim() === "1",
  videosListIdsPerRequest: () => envInt("YOUTUBE_VIDEOS_LIST_IDS_PER_REQUEST", 50),
  maxSearchCallsPerProduct: () => envInt("YOUTUBE_MAX_SEARCH_CALLS_PER_PRODUCT", 15),
  maxSearchPagesPerQuery: () => envInt("MAX_YOUTUBE_SEARCH_PAGES_PER_QUERY", 1),
  maxVideos: () => envInt("MAX_YOUTUBE_VIDEOS", 60),
  maxCommentPagesPerVideo: () => envInt("MAX_YOUTUBE_COMMENT_PAGES_PER_VIDEO", 3),
  maxRawComments: () => envInt("MAX_YOUTUBE_RAW_COMMENTS", 3000),
  maxValidEvidence: () => envInt("MAX_YOUTUBE_VALID_EVIDENCE", 1000),
  maxUiExcerptsPerDimension: () => envInt("MAX_YOUTUBE_UI_EXCERPTS_PER_DIMENSION", 10),
  maxLlmSample: () => envInt("MAX_YOUTUBE_LLM_SAMPLE", 24),
  maxReplyThreads: () => envInt("MAX_YOUTUBE_REPLY_THREADS", 80),
  maxRepliesPerThread: () => envInt("MAX_YOUTUBE_REPLIES_PER_THREAD", 25),
  /** General Data API quota budget (excludes search bucket). */
  maxGeneralQuotaPerProduct: () => envInt("YOUTUBE_MAX_QUOTA_UNITS_PER_PRODUCT", 800),
  maxRequestsPerProduct: () => envInt("YOUTUBE_MAX_REQUESTS_PER_PRODUCT", 900),
  searchPageSize: () => 50,
  commentPageSize: () => 100,
  marginalValidGainMin: () => envInt("YOUTUBE_MARGINAL_VALID_GAIN_MIN", 8),
};

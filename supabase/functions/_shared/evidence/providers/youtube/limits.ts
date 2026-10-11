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
  maxSearchQueries: () => envInt("MAX_YOUTUBE_SEARCH_QUERIES", 12),
  maxSearchPagesPerQuery: () => envInt("MAX_YOUTUBE_SEARCH_PAGES_PER_QUERY", 1),
  maxVideos: () => envInt("MAX_YOUTUBE_VIDEOS", 60),
  maxCommentPagesPerVideo: () => envInt("MAX_YOUTUBE_COMMENT_PAGES_PER_VIDEO", 3),
  maxRawComments: () => envInt("MAX_YOUTUBE_RAW_COMMENTS", 3000),
  maxValidEvidence: () => envInt("MAX_YOUTUBE_VALID_EVIDENCE", 1000),
  maxUiExcerptsPerDimension: () => envInt("MAX_YOUTUBE_UI_EXCERPTS_PER_DIMENSION", 10),
  maxLlmSample: () => envInt("MAX_YOUTUBE_LLM_SAMPLE", 24),
  maxReplyThreads: () => envInt("MAX_YOUTUBE_REPLY_THREADS", 80),
  maxRepliesPerThread: () => envInt("MAX_YOUTUBE_REPLIES_PER_THREAD", 25),
  maxQuotaUnitsPerProduct: () => envInt("YOUTUBE_MAX_QUOTA_UNITS_PER_PRODUCT", 800),
  maxRequestsPerProduct: () => envInt("YOUTUBE_MAX_REQUESTS_PER_PRODUCT", 900),
  searchPageSize: () => 50,
  commentPageSize: () => 100,
  marginalValidGainMin: () => envInt("YOUTUBE_MARGINAL_VALID_GAIN_MIN", 8),
};

export const YOUTUBE_QUOTA = {
  searchList: 100,
  commentThreadsList: 1,
  commentsList: 1,
};

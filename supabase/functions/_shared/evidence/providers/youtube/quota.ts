/** YouTube Data API quota buckets (2026 defaults). */

export const YOUTUBE_QUOTA_COST = {
  /** Search Queries bucket — default ~100 calls/day per project. */
  searchList: 1,
  /** General quota pool — default 10,000 units/day. */
  videosList: 1,
  commentThreadsList: 1,
  commentsList: 1,
  /** Separate batchGetStats bucket — default 10,000 calls/day. */
  videosBatchGetStats: 1,
} as const;

export type YoutubeQuotaLedger = {
  searchQueriesBucket: number;
  generalQuotaUnits: number;
  batchStatsBucket: number;
  totalRequests: number;
  metadataListRequests: number;
  batchStatsRequests: number;
};

export function emptyQuotaLedger(): YoutubeQuotaLedger {
  return {
    searchQueriesBucket: 0,
    generalQuotaUnits: 0,
    batchStatsBucket: 0,
    totalRequests: 0,
    metadataListRequests: 0,
    batchStatsRequests: 0,
  };
}

export function ledgerTotalUnits(ledger: YoutubeQuotaLedger): number {
  return ledger.searchQueriesBucket + ledger.generalQuotaUnits + ledger.batchStatsBucket;
}

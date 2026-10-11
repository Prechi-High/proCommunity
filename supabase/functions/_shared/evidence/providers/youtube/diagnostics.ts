import type { BlueprintDimensionDef } from "../../../blueprint/types.ts";

export type YoutubeAcquisitionDiagnostics = {
  queriesPlanned: number;
  queriesExecuted: string[];
  searchRequests: number;
  videosDiscovered: number;
  uniqueVideos: number;
  videosHarvested: number;
  commentPagesFetched: number;
  replyRequests: number;
  rawCommentsRetrieved: number;
  providerNormalizedItems: number;
  experienceQualityAccepted: number;
  identityAccepted: number;
  dimensionMapped: number;
  finalScoreEvidence: number;
  quotaUnitsEstimated: number;
  requestsUsed: number;
  stoppedBecause: string[];
  dimensionStats: Record<
    string,
    {
      label: string;
      rawCandidates: number;
      accepted: number;
      rejectedRelevance: number;
      rejectedIdentity: number;
      positive: number;
      mixed: number;
      negative: number;
      uniqueAuthors: number;
      uniqueVideos: number;
    }
  >;
};

export function emptyDimensionStats(dimensions: BlueprintDimensionDef[]): YoutubeAcquisitionDiagnostics["dimensionStats"] {
  const out: YoutubeAcquisitionDiagnostics["dimensionStats"] = {};
  for (const d of dimensions) {
    out[d.key] = {
      label: d.label,
      rawCandidates: 0,
      accepted: 0,
      rejectedRelevance: 0,
      rejectedIdentity: 0,
      positive: 0,
      mixed: 0,
      negative: 0,
      uniqueAuthors: 0,
      uniqueVideos: 0,
    };
  }
  return out;
}

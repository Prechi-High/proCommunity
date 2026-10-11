import type { DiscoveredVideo } from "./rank.ts";
import { scoreVideo } from "./rank.ts";
import type { EvidenceSearchInput } from "../types.ts";
import type { YoutubeQuotaLedger } from "./quota.ts";
import { YOUTUBE_QUOTA_COST } from "./quota.ts";

const VIDEO_LIST_PARTS = "snippet,statistics,contentDetails,status,topicDetails";

export type VideoMetadata = {
  id: string;
  title: string;
  description: string;
  viewCount: number;
  commentCount: number;
  likeCount: number;
  commentsDisabled: boolean;
  durationSec?: number;
  topicCategories?: string[];
};

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseDuration(iso?: string): number | undefined {
  if (!iso) return undefined;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return undefined;
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}

type VideosListItem = {
  id?: string;
  snippet?: { title?: string; description?: string; categoryId?: string };
  statistics?: { viewCount?: string; commentCount?: string; likeCount?: string };
  contentDetails?: { duration?: string };
  status?: { commentStatus?: string };
  topicDetails?: { topicCategories?: string[] };
};

type VideosListRes = { items?: VideosListItem[] };

type BatchStatsItem = {
  id?: string;
  statistics?: { viewCount?: string; commentCount?: string; likeCount?: string };
  snippet?: { title?: string; description?: string };
};

type BatchStatsRes = { items?: BatchStatsItem[] };

export async function fetchVideosMetadataBatched(
  apiKey: string,
  videoIds: string[],
  idsPerRequest: number,
  ledger: YoutubeQuotaLedger,
): Promise<Map<string, VideoMetadata>> {
  const out = new Map<string, VideoMetadata>();
  for (let i = 0; i < videoIds.length; i += idsPerRequest) {
    const chunk = videoIds.slice(i, i + idsPerRequest);
    if (!chunk.length) continue;
    ledger.totalRequests += 1;
    ledger.metadataListRequests += 1;
    ledger.generalQuotaUnits += YOUTUBE_QUOTA_COST.videosList;
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=${VIDEO_LIST_PARTS}` +
      `&id=${chunk.map(encodeURIComponent).join(",")}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const json = (await res.json()) as VideosListRes;
    for (const it of json.items ?? []) {
      const id = it.id ?? "";
      if (!id) continue;
      out.set(id, {
        id,
        title: decodeHtml(it.snippet?.title ?? ""),
        description: decodeHtml(it.snippet?.description ?? ""),
        viewCount: Number(it.statistics?.viewCount ?? 0),
        commentCount: Number(it.statistics?.commentCount ?? 0),
        likeCount: Number(it.statistics?.likeCount ?? 0),
        commentsDisabled: it.status?.commentStatus === "disabled",
        durationSec: parseDuration(it.contentDetails?.duration),
        topicCategories: it.topicDetails?.topicCategories,
      });
    }
  }
  return out;
}

/** Optional: 1 batch-stats unit per call for many IDs (statistics-focused). */
export async function fetchBatchVideoStats(
  apiKey: string,
  videoIds: string[],
  idsPerRequest: number,
  ledger: YoutubeQuotaLedger,
): Promise<Map<string, Pick<VideoMetadata, "viewCount" | "commentCount" | "likeCount">>> {
  const out = new Map<string, Pick<VideoMetadata, "viewCount" | "commentCount" | "likeCount">>();
  for (let i = 0; i < videoIds.length; i += idsPerRequest) {
    const chunk = videoIds.slice(i, i + idsPerRequest);
    if (!chunk.length) continue;
    ledger.totalRequests += 1;
    ledger.batchStatsRequests += 1;
    ledger.batchStatsBucket += YOUTUBE_QUOTA_COST.videosBatchGetStats;
    const url =
      `https://www.googleapis.com/youtube/v3/videos/batchGetStats?part=statistics,snippet` +
      `&id=${chunk.map(encodeURIComponent).join(",")}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const json = (await res.json()) as BatchStatsRes;
    for (const it of json.items ?? []) {
      const id = it.id ?? "";
      if (!id) continue;
      out.set(id, {
        viewCount: Number(it.statistics?.viewCount ?? 0),
        commentCount: Number(it.statistics?.commentCount ?? 0),
        likeCount: Number(it.statistics?.likeCount ?? 0),
      });
    }
  }
  return out;
}

export function enrichDiscoveredVideos(
  videos: Map<string, DiscoveredVideo>,
  meta: Map<string, VideoMetadata>,
  input: EvidenceSearchInput,
): DiscoveredVideo[] {
  const list: DiscoveredVideo[] = [];
  for (const [id, v] of videos) {
    const m = meta.get(id);
    const title = m?.title || v.title;
    const description = m?.description || v.description;
    let score = scoreVideo({ id, title, description }, v.matchedQueryTopics, input);
    if (m) {
      if (m.commentsDisabled) score *= 0.15;
      if (m.commentCount > 50) score += 0.06;
      if (m.viewCount > 10_000) score += 0.04;
      if (m.durationSec && m.durationSec > 300) score += 0.03;
    }
    list.push({
      ...v,
      title,
      description,
      videoRelevanceScore: Math.min(1, score),
      ...(m
        ? {
            viewCount: m.viewCount,
            commentCount: m.commentCount,
            commentsDisabled: m.commentsDisabled,
          }
        : {}),
    });
  }
  return list;
}

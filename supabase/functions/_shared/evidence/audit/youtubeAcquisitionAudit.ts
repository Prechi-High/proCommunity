/**
 * Instrumented mirror of providers/youtube.ts — counts acquisition caps without changing production provider code.
 */
import { PROVIDER_CAPS, PROVIDER_TIMEOUT_MS, secret } from "../providers/config.ts";
import type { EvidenceSearchInput, RawEvidence } from "../providers/types.ts";
import { planEvidenceQueries } from "../queryPlanner.ts";

const COMMENT_SPAM = /\b(subscribe|check out my|use code|link in bio|dm me)\b/i;
const FIRST_PERSON = /\b(i|my|me|we|our|i've|i'm)\b/i;

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export type YoutubeAcquisitionReport = {
  productName: string;
  plannedQueriesFromPlanner: string[];
  plannedQueryCount: number;
  /** Queries actually sent to search.list today (production youtube.ts). */
  actualYoutubeSearchQueries: string[];
  searchApiRequests: number;
  maxResultsPerSearch: number;
  searchPaginationImplemented: boolean;
  videoResultsReturned: number;
  uniqueVideosAfterDedupe: number;
  videosSelectedForComments: number;
  videosSkippedByCap: number;
  commentThreadsApiRequests: number;
  commentsListApiRequests: number;
  commentPaginationImplemented: boolean;
  maxResultsPerCommentPage: number;
  commentPagesPerVideo: number[];
  topLevelThreadsRetrieved: number;
  inlineRepliesRetrieved: number;
  totalRawConversationRows: number;
  providerReturnedItems: number;
  rejectedAtProvider: Record<string, number>;
  providerCap: number;
  videosWithCommentsDisabledOrFailed: number;
  commentSortOrder: string;
  estimatedQuotaUnits: { searchList: number; commentThreadsList: number; commentsList: number; total: number };
  notes: string[];
};

type NormalizeOutcome = "accepted" | "too_short" | "too_long" | "no_first_person" | "spam";

function tryNormalize(
  id: string,
  text: string,
  author: string,
  videoId: string,
  videoTitle: string,
  publishedAt: string,
  likes: number,
  parentId?: string,
  contextText?: string,
): { row: RawEvidence | null; outcome: NormalizeOutcome } {
  const clean = decodeHtml(text).replace(/\s+/g, " ").trim();
  if (clean.length < 25) return { row: null, outcome: "too_short" };
  if (clean.length > 900) return { row: null, outcome: "too_long" };
  if (!FIRST_PERSON.test(clean)) return { row: null, outcome: "no_first_person" };
  if (COMMENT_SPAM.test(clean)) return { row: null, outcome: "spam" };
  return {
    row: {
      provider: "youtube",
      platform: "youtube",
      sourceId: id,
      conversationId: videoId,
      parentId,
      author: author.replace(/^@/, "") || "YouTube viewer",
      text: clean,
      title: videoTitle,
      url: `https://www.youtube.com/watch?v=${videoId}&lc=${id}`,
      createdAt: publishedAt,
      engagement: { likes },
      contextText,
      rawMetadata: { videoId, videoTitle },
    },
    outcome: "accepted",
  };
}

/** Runs the same API strategy as production `youtubeProvider.searchProductEvidence` with full counters. */
export async function runYoutubeAcquisitionAudit(input: EvidenceSearchInput): Promise<YoutubeAcquisitionReport> {
  const key = secret("YOUTUBE_DATA_API_KEY");
  if (!key) throw new Error("YOUTUBE_DATA_API_KEY not configured");

  const planned = planEvidenceQueries(input);
  const plannedQueries = planned.map((p) => p.query);
  const cap = Math.min(PROVIDER_CAPS.youtube, input.maxItems ?? PROVIDER_CAPS.youtube);
  const q = `${input.brand ? `${input.brand} ` : ""}${input.productName} review`.trim();
  const actualSearchQueries = [q];
  const maxResultsPerSearch = 4;
  const maxResultsPerCommentPage = 50;
  const notes: string[] = [
    "Production youtube.ts ignores planEvidenceQueries / input.evidenceTopics — only one review query is searched.",
    "gatherConversationEvidence passes up to 24 planned queries but loadProviderEvidenceWithCache uses queries[0] only for cache key; provider still receives full queries array unused by YouTube.",
  ];

  type SearchRes = { items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string } }> };
  const search = await withTimeout(
    fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResultsPerSearch}&relevanceLanguage=en&q=${encodeURIComponent(q)}&key=${key}`,
    ).then((r) => (r.ok ? (r.json() as Promise<SearchRes>) : null)),
    PROVIDER_TIMEOUT_MS,
  );

  const videoRows = (search?.items ?? [])
    .map((i) => ({ id: i.id?.videoId ?? "", title: decodeHtml(i.snippet?.title ?? "") }))
    .filter((v) => v.id);
  const videos = videoRows.slice(0, 4);

  type ThreadRes = {
    items?: Array<{
      id?: string;
      snippet?: {
        topLevelComment?: {
          id?: string;
          snippet?: {
            authorDisplayName?: string;
            textOriginal?: string;
            textDisplay?: string;
            likeCount?: number;
            publishedAt?: string;
          };
        };
      };
      replies?: {
        comments?: Array<{
          id?: string;
          snippet?: {
            authorDisplayName?: string;
            textOriginal?: string;
            textDisplay?: string;
            likeCount?: number;
            publishedAt?: string;
            parentId?: string;
          };
        }>;
      };
    }>;
  };

  const rejectedAtProvider: Record<string, number> = {};
  const items: RawEvidence[] = [];
  let commentThreadsApiRequests = 0;
  let topLevel = 0;
  let inlineReplies = 0;
  let rawRows = 0;
  let commentsDisabled = 0;
  const pagesPerVideo: number[] = [];

  for (const v of videos) {
    const res = await withTimeout(
      fetch(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${v.id}&maxResults=${maxResultsPerCommentPage}&order=relevance&textFormat=plainText&key=${key}`,
      ).then((r) => (r.ok ? (r.json() as Promise<ThreadRes>) : null)),
      PROVIDER_TIMEOUT_MS,
    );
    commentThreadsApiRequests += 1;
    pagesPerVideo.push(res?.items?.length ? 1 : 0);
    if (!res?.items) {
      commentsDisabled += 1;
      continue;
    }
    for (const it of res.items) {
      const top = it.snippet?.topLevelComment;
      const sn = top?.snippet;
      if (!top?.id || !sn) continue;
      rawRows += 1;
      topLevel += 1;
      const topText = String(sn.textOriginal ?? sn.textDisplay ?? "");
      const topNorm = tryNormalize(
        top.id,
        topText,
        String(sn.authorDisplayName ?? ""),
        v.id,
        v.title,
        String(sn.publishedAt ?? ""),
        Number(sn.likeCount ?? 0),
      );
      if (topNorm.outcome !== "accepted") {
        rejectedAtProvider[topNorm.outcome] = (rejectedAtProvider[topNorm.outcome] ?? 0) + 1;
      } else if (topNorm.row) {
        items.push(topNorm.row);
      }
      for (const reply of it.replies?.comments ?? []) {
        rawRows += 1;
        inlineReplies += 1;
        const rs = reply.snippet;
        if (!reply.id || !rs) continue;
        const replyText = String(rs.textOriginal ?? rs.textDisplay ?? "");
        const replyNorm = tryNormalize(
          reply.id,
          replyText,
          String(rs.authorDisplayName ?? ""),
          v.id,
          v.title,
          String(rs.publishedAt ?? ""),
          Number(rs.likeCount ?? 0),
          rs.parentId ?? top.id,
          topText.slice(0, 200),
        );
        if (replyNorm.outcome !== "accepted") {
          rejectedAtProvider[replyNorm.outcome] = (rejectedAtProvider[replyNorm.outcome] ?? 0) + 1;
        } else if (replyNorm.row) {
          items.push(replyNorm.row);
        }
      }
      if (items.length >= cap) break;
    }
    if (items.length >= cap) break;
  }

  if (items.length >= cap) {
    rejectedAtProvider.rejected_provider_cap = 1;
    notes.push(`MAX_YOUTUBE_EVIDENCE (${cap}) stopped comment harvesting mid-loop — not a video cap alone.`);
  }

  const searchQuota = 100 * actualSearchQueries.length;
  const threadQuota = 1 * commentThreadsApiRequests;
  const quota = { searchList: searchQuota, commentThreadsList: threadQuota, commentsList: 0, total: searchQuota + threadQuota };

  return {
    productName: input.productName,
    plannedQueriesFromPlanner: plannedQueries,
    plannedQueryCount: plannedQueries.length,
    actualYoutubeSearchQueries: actualSearchQueries,
    searchApiRequests: 1,
    maxResultsPerSearch,
    searchPaginationImplemented: false,
    videoResultsReturned: videoRows.length,
    uniqueVideosAfterDedupe: videos.length,
    videosSelectedForComments: videos.length,
    videosSkippedByCap: Math.max(0, videoRows.length - videos.length),
    commentThreadsApiRequests,
    commentsListApiRequests: 0,
    commentPaginationImplemented: false,
    maxResultsPerCommentPage,
    commentPagesPerVideo: pagesPerVideo,
    topLevelThreadsRetrieved: topLevel,
    inlineRepliesRetrieved: inlineReplies,
    totalRawConversationRows: rawRows,
    providerReturnedItems: items.slice(0, cap).length,
    rejectedAtProvider,
    providerCap: cap,
    videosWithCommentsDisabledOrFailed: commentsDisabled,
    commentSortOrder: "relevance",
    estimatedQuotaUnits: quota,
    notes,
  };
}

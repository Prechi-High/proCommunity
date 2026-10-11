import { assessExperienceQuality } from "../../experienceQuality.ts";
import { assessProductEvidenceMatch } from "../../identityGate.ts";
import { mapStatementToDimensions } from "../../dimensionRelevance.ts";
import {
  planDimensionTargetedQueries,
  planEvidenceQueries,
  selectYoutubeSearchQueries,
  type PlannedQuery,
} from "../../queryPlanner.ts";
import { PROVIDER_TIMEOUT_MS, secret } from "../config.ts";
import type { EvidenceSearchInput, RawEvidence } from "../types.ts";
import type { EvidenceProviderCacheStore } from "../../gatherConversationEvidence.ts";
import { cachedJson, cacheFromStore, youtubeCommentPageKey, youtubeRepliesKey, youtubeSearchPageKey } from "./cache.ts";
import { emptyDimensionStats, type YoutubeAcquisitionDiagnostics } from "./diagnostics.ts";
import { YOUTUBE_LIMITS, YOUTUBE_QUOTA } from "./limits.ts";
import {
  commentPagesForVideo,
  queryHash,
  rankVideos,
  scoreVideo,
  type DiscoveredVideo,
} from "./rank.ts";

const COMMENT_SPAM = /\b(subscribe|check out my|use code|link in bio|dm me)\b/i;

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

type Budget = {
  quotaUnits: number;
  requests: number;
  stopped: string[];
};

function budgetOk(b: Budget, limits: ReturnType<typeof readLimits>): boolean {
  if (b.quotaUnits >= limits.maxQuotaUnits) {
    b.stopped.push("quota_budget");
    return false;
  }
  if (b.requests >= limits.maxRequests) {
    b.stopped.push("request_budget");
    return false;
  }
  return true;
}

function readLimits() {
  return {
    maxSearchQueries: YOUTUBE_LIMITS.maxSearchQueries(),
    maxSearchPages: YOUTUBE_LIMITS.maxSearchPagesPerQuery(),
    maxVideos: YOUTUBE_LIMITS.maxVideos(),
    maxCommentPages: YOUTUBE_LIMITS.maxCommentPagesPerVideo(),
    maxRaw: YOUTUBE_LIMITS.maxRawComments(),
    maxReplyThreads: YOUTUBE_LIMITS.maxReplyThreads(),
    maxRepliesPerThread: YOUTUBE_LIMITS.maxRepliesPerThread(),
    maxQuotaUnits: YOUTUBE_LIMITS.maxQuotaUnitsPerProduct(),
    maxRequests: YOUTUBE_LIMITS.maxRequestsPerProduct(),
    marginalMin: YOUTUBE_LIMITS.marginalValidGainMin(),
    searchPageSize: YOUTUBE_LIMITS.searchPageSize(),
    commentPageSize: YOUTUBE_LIMITS.commentPageSize(),
  };
}

function normalizeRow(
  id: string,
  text: string,
  author: string,
  videoId: string,
  videoTitle: string,
  publishedAt: string,
  likes: number,
  parentId?: string,
  contextText?: string,
  extraMeta?: Record<string, unknown>,
): RawEvidence | null {
  const clean = decodeHtml(text).replace(/\s+/g, " ").trim();
  if (clean.length < 25 || clean.length > 900) return null;
  if (COMMENT_SPAM.test(clean)) return null;
  return {
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
    rawMetadata: { videoId, videoTitle, ...extraMeta },
  };
}

type SearchItem = {
  id?: { videoId?: string };
  snippet?: { title?: string; description?: string };
};

type SearchRes = { items?: SearchItem[]; nextPageToken?: string };

type ThreadItem = {
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
    totalReplyCount?: number;
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
};

type ThreadRes = { items?: ThreadItem[]; nextPageToken?: string };

type ReplyRes = {
  items?: Array<{
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
  nextPageToken?: string;
};

function countValidEvidence(
  items: RawEvidence[],
  input: EvidenceSearchInput,
): { valid: number; expOk: number; idOk: number; dimOk: number; perDim: Record<string, number> } {
  const target = {
    name: input.productName,
    brand: input.brand ?? "",
    model: input.model,
    query: input.productName,
  };
  const dims = input.dimensions ?? [];
  const perDim: Record<string, number> = {};
  let valid = 0;
  let expOk = 0;
  let idOk = 0;
  let dimOk = 0;
  const seen = new Set<string>();

  for (const item of items) {
    const key = item.sourceId;
    if (seen.has(key)) continue;
    seen.add(key);
    const eq = assessExperienceQuality(item.text, item.platform);
    if (!eq.affectsScoring) continue;
    expOk += 1;
    const match = assessProductEvidenceMatch(item.text, target);
    if (!match.affectsScore) continue;
    idOk += 1;
    const statement = match.isolatedStatement ?? item.text;
    const links = mapStatementToDimensions(statement, dims, true).filter((l) => l.relevanceConfidence >= 0.5);
    if (!links.length) continue;
    dimOk += 1;
    valid += 1;
    for (const l of links) perDim[l.dimensionKey] = (perDim[l.dimensionKey] ?? 0) + 1;
  }
  return { valid, expOk, idOk, dimOk, perDim };
}

function updateDimensionDiagnostics(
  stats: YoutubeAcquisitionDiagnostics["dimensionStats"],
  items: RawEvidence[],
  input: EvidenceSearchInput,
) {
  const target = {
    name: input.productName,
    brand: input.brand ?? "",
    model: input.model,
    query: input.productName,
  };
  const dims = input.dimensions ?? [];
  const authorsByDim: Record<string, Set<string>> = {};
  const videosByDim: Record<string, Set<string>> = {};

  for (const item of items) {
    const eq = assessExperienceQuality(item.text, item.platform);
    const text = item.text;
    for (const d of dims) {
      const kwHit = d.keywords.some((k) => k.length > 2 && text.toLowerCase().includes(k.toLowerCase()));
      if (kwHit) {
        stats[d.key].rawCandidates += 1;
      }
    }
    if (!eq.affectsScoring) continue;
    const match = assessProductEvidenceMatch(text, target);
    if (!match.affectsScore) {
      for (const d of dims) {
        const kwHit = d.keywords.some((k) => k.length > 2 && text.toLowerCase().includes(k.toLowerCase()));
        if (kwHit) stats[d.key].rejectedIdentity += 1;
      }
      continue;
    }
    const statement = match.isolatedStatement ?? text;
    const links = mapStatementToDimensions(statement, dims, true);
    const passing = links.filter((l) => l.relevanceConfidence >= 0.5);
    if (!passing.length) {
      for (const d of dims) {
        const kwHit = d.keywords.some((k) => k.length > 2 && text.toLowerCase().includes(k.toLowerCase()));
        if (kwHit) stats[d.key].rejectedRelevance += 1;
      }
      continue;
    }
    for (const l of passing) {
      const s = stats[l.dimensionKey];
      if (!s) continue;
      s.accepted += 1;
      if (l.stance === "positive") s.positive += 1;
      else if (l.stance === "negative") s.negative += 1;
      else s.mixed += 1;
      authorsByDim[l.dimensionKey] ??= new Set();
      videosByDim[l.dimensionKey] ??= new Set();
      if (item.author) authorsByDim[l.dimensionKey].add(item.author);
      if (item.conversationId) videosByDim[l.dimensionKey].add(item.conversationId);
    }
  }
  for (const key of Object.keys(stats)) {
    stats[key].uniqueAuthors = authorsByDim[key]?.size ?? 0;
    stats[key].uniqueVideos = videosByDim[key]?.size ?? 0;
  }
}

export async function harvestYoutubeEvidence(input: EvidenceSearchInput & {
  forceRefresh?: boolean;
  cacheStore?: EvidenceProviderCacheStore;
}): Promise<{ items: RawEvidence[]; diagnostics: YoutubeAcquisitionDiagnostics }> {
  const key = secret("YOUTUBE_DATA_API_KEY");
  if (!key) {
    return {
      items: [],
      diagnostics: {
        queriesPlanned: 0,
        queriesExecuted: [],
        searchRequests: 0,
        videosDiscovered: 0,
        uniqueVideos: 0,
        videosHarvested: 0,
        commentPagesFetched: 0,
        replyRequests: 0,
        rawCommentsRetrieved: 0,
        providerNormalizedItems: 0,
        experienceQualityAccepted: 0,
        identityAccepted: 0,
        dimensionMapped: 0,
        finalScoreEvidence: 0,
        quotaUnitsEstimated: 0,
        requestsUsed: 0,
        stoppedBecause: ["missing_api_key"],
        dimensionStats: emptyDimensionStats(input.dimensions ?? []),
      },
    };
  }
  const limits = readLimits();
  const budget: Budget = { quotaUnits: 0, requests: 0, stopped: [] };
  const cache = cacheFromStore(input.cacheStore);
  const forceRefresh = input.forceRefresh === true;

  const planned = planEvidenceQueries(input);
  let queriesToRun = selectYoutubeSearchQueries(planned, limits.maxSearchQueries);
  const executedQueries: string[] = [];

  const videoMap = new Map<string, DiscoveredVideo>();
  let searchRequests = 0;

  const runSearchBatch = async (batch: PlannedQuery[]) => {
    for (const pq of batch) {
      if (!budgetOk(budget, limits)) break;
      if (videoMap.size >= limits.maxVideos) break;
      executedQueries.push(pq.query);
      let pageToken = "";
      for (let page = 0; page < limits.maxSearchPages; page++) {
        if (!budgetOk(budget, limits)) break;
        const qHash = queryHash(pq.query);
        const cacheKey = youtubeSearchPageKey(input.productId, qHash, pageToken);
        const res = await cachedJson(
          cache,
          cacheKey,
          forceRefresh,
          async () => {
            budget.requests += 1;
            budget.quotaUnits += YOUTUBE_QUOTA.searchList;
            searchRequests += 1;
            const url =
              `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${limits.searchPageSize}` +
              `&relevanceLanguage=en&q=${encodeURIComponent(pq.query)}&key=${key}` +
              (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
            return withTimeout(fetch(url).then((r) => (r.ok ? (r.json() as Promise<SearchRes>) : null)), PROVIDER_TIMEOUT_MS);
          },
        );
        if (!res?.items?.length) break;
        for (const it of res.items) {
          const id = it.id?.videoId ?? "";
          if (!id) continue;
          const title = decodeHtml(it.snippet?.title ?? "");
          const description = decodeHtml(it.snippet?.description ?? "");
          const existing = videoMap.get(id);
          const topics = existing ? [...new Set([...existing.matchedQueryTopics, pq.topic])] : [pq.topic];
          const scored = scoreVideo({ id, title, description }, topics, input);
          videoMap.set(id, {
            id,
            title,
            description,
            matchedQueryTopics: topics,
            videoRelevanceScore: Math.max(existing?.videoRelevanceScore ?? 0, scored),
          });
          if (videoMap.size >= limits.maxVideos) break;
        }
        pageToken = res.nextPageToken ?? "";
        if (!pageToken) break;
      }
    }
  };

  await runSearchBatch(queriesToRun);

  const items: RawEvidence[] = [];
  const seenComment = new Set<string>();
  const harvestedVideoIds = new Set<string>();
  let rawComments = 0;
  let commentPages = 0;
  let replyRequests = 0;
  let replyThreads = 0;
  let videosHarvested = 0;

  const harvestComments = async (videos: DiscoveredVideo[], onlyNew = false) => {
    for (let vi = 0; vi < videos.length; vi++) {
      if (!budgetOk(budget, limits)) break;
      if (items.length >= limits.maxRaw) {
        budget.stopped.push("max_raw_comments");
        break;
      }
      const v = videos[vi];
      if (onlyNew && harvestedVideoIds.has(v.id)) continue;
      harvestedVideoIds.add(v.id);
      videosHarvested += 1;
      const pages = commentPagesForVideo(vi, limits.maxCommentPages);

      for (const order of ["relevance", "time"] as const) {
        if (order === "time" && vi >= 8) continue;
        let pageToken = "";
        for (let p = 0; p < pages; p++) {
          if (!budgetOk(budget, limits)) break;
          if (items.length >= limits.maxRaw) break;
          const cacheKey = youtubeCommentPageKey(input.productId, v.id, order, pageToken);
          const res = await cachedJson(
            cache,
            cacheKey,
            forceRefresh,
            async () => {
              budget.requests += 1;
              budget.quotaUnits += YOUTUBE_QUOTA.commentThreadsList;
              const url =
                `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${v.id}` +
                `&maxResults=${limits.commentPageSize}&order=${order}&textFormat=plainText&key=${key}` +
                (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
              return withTimeout(fetch(url).then((r) => (r.ok ? (r.json() as Promise<ThreadRes>) : null)), PROVIDER_TIMEOUT_MS);
            },
          );
          if (!res?.items) break;
          commentPages += 1;

          for (const it of res.items) {
            const top = it.snippet?.topLevelComment;
            const sn = top?.snippet;
            if (!top?.id || !sn) continue;
            rawComments += 1;
            const topText = String(sn.textOriginal ?? sn.textDisplay ?? "");
            if (!seenComment.has(top.id)) {
              seenComment.add(top.id);
              const row = normalizeRow(
                top.id,
                topText,
                String(sn.authorDisplayName ?? ""),
                v.id,
                v.title,
                String(sn.publishedAt ?? ""),
                Number(sn.likeCount ?? 0),
                undefined,
                undefined,
                { videoRelevanceScore: v.videoRelevanceScore, matchedQueryTopics: v.matchedQueryTopics },
              );
              if (row) items.push(row);
            }
            for (const reply of it.replies?.comments ?? []) {
              const rs = reply.snippet;
              if (!reply.id || !rs) continue;
              rawComments += 1;
              if (seenComment.has(reply.id)) continue;
              seenComment.add(reply.id);
              const row = normalizeRow(
                reply.id,
                String(rs.textOriginal ?? rs.textDisplay ?? ""),
                String(rs.authorDisplayName ?? ""),
                v.id,
                v.title,
                String(rs.publishedAt ?? ""),
                Number(rs.likeCount ?? 0),
                rs.parentId ?? top.id,
                topText.slice(0, 200),
                { videoRelevanceScore: v.videoRelevanceScore },
              );
              if (row) items.push(row);
            }

            const totalReplies = it.snippet?.totalReplyCount ?? 0;
            const inlineCount = it.replies?.comments?.length ?? 0;
            const highlyRelevant = v.videoRelevanceScore >= 0.55;
            if (
              highlyRelevant &&
              totalReplies > inlineCount &&
              replyThreads < limits.maxReplyThreads &&
              budgetOk(budget, limits)
            ) {
              replyThreads += 1;
              const repKey = youtubeRepliesKey(input.productId, top.id);
              const repRes = await cachedJson(
                cache,
                repKey,
                forceRefresh,
                async () => {
                  budget.requests += 1;
                  budget.quotaUnits += YOUTUBE_QUOTA.commentsList;
                  replyRequests += 1;
                  const url =
                    `https://www.googleapis.com/youtube/v3/comments?part=snippet&parentId=${top.id}` +
                    `&maxResults=${limits.maxRepliesPerThread}&textFormat=plainText&key=${key}`;
                  return withTimeout(fetch(url).then((r) => (r.ok ? (r.json() as Promise<ReplyRes>) : null)), PROVIDER_TIMEOUT_MS);
                },
              );
              for (const rc of repRes?.items ?? []) {
                const rs = rc.snippet;
                if (!rc.id || !rs || seenComment.has(rc.id)) continue;
                seenComment.add(rc.id);
                rawComments += 1;
                const row = normalizeRow(
                  rc.id,
                  String(rs.textOriginal ?? rs.textDisplay ?? ""),
                  String(rs.authorDisplayName ?? ""),
                  v.id,
                  v.title,
                  String(rs.publishedAt ?? ""),
                  Number(rs.likeCount ?? 0),
                  rs.parentId ?? top.id,
                  topText.slice(0, 200),
                );
                if (row) items.push(row);
              }
            }
            if (items.length >= limits.maxRaw) break;
          }
          pageToken = res.nextPageToken ?? "";
          if (!pageToken) break;
        }
      }
    }
  };

  let ranked = rankVideos([...videoMap.values()]);
  await harvestComments(ranked);

  // Tier C: weak dimensions
  const weakThreshold = 12;
  for (let round = 0; round < 2; round++) {
    if (!budgetOk(budget, limits)) break;
    const { perDim, valid } = countValidEvidence(items, input);
    const weak = (input.dimensions ?? [])
      .filter((d) => (perDim[d.key] ?? 0) < weakThreshold)
      .map((d) => d.key);
    if (!weak.length) break;
    const targeted = planDimensionTargetedQueries(input, weak.slice(0, 4));
    const newQueries = targeted.filter((t) => !executedQueries.includes(t.query));
    if (!newQueries.length) break;
    await runSearchBatch(newQueries);
    ranked = rankVideos([...videoMap.values()]);
    await harvestComments(ranked.slice(0, 20), true);
    const nextValid = countValidEvidence(items, input).valid;
    const gain = nextValid - valid;
    if (gain < limits.marginalMin) {
      budget.stopped.push("marginal_gain_low");
      break;
    }
  }

  if (items.length >= limits.maxRaw) budget.stopped.push("max_raw_comments");

  const counts = countValidEvidence(items, input);
  const dimStats = emptyDimensionStats(input.dimensions ?? []);
  updateDimensionDiagnostics(dimStats, items, input);

  const diagnostics: YoutubeAcquisitionDiagnostics = {
    queriesPlanned: planned.length,
    queriesExecuted: [...new Set(executedQueries)],
    searchRequests,
    videosDiscovered: videoMap.size,
    uniqueVideos: videoMap.size,
    videosHarvested,
    commentPagesFetched: commentPages,
    replyRequests,
    rawCommentsRetrieved: rawComments,
    providerNormalizedItems: items.length,
    experienceQualityAccepted: counts.expOk,
    identityAccepted: counts.idOk,
    dimensionMapped: counts.dimOk,
    finalScoreEvidence: counts.valid,
    quotaUnitsEstimated: budget.quotaUnits,
    requestsUsed: budget.requests,
    stoppedBecause: [...new Set(budget.stopped)],
    dimensionStats: dimStats,
  };

  const capped = items.slice(0, limits.maxRaw);
  return { items: capped, diagnostics };
}

import type { PlannedQuery } from "../../queryPlanner.ts";
import type { EvidenceSearchInput } from "../types.ts";

export type DiscoveredVideo = {
  id: string;
  title: string;
  description: string;
  matchedQueryTopics: string[];
  videoRelevanceScore: number;
  viewCount?: number;
  commentCount?: number;
  commentsDisabled?: boolean;
};

const REVIEW_SIGNALS = /\b(review|honest|after \d+|months? later|long term|wear test|battery test|problems|issues|vs\.?|comparison)\b/i;

export function scoreVideo(
  video: { id: string; title: string; description?: string },
  matchedTopics: string[],
  input: EvidenceSearchInput,
): number {
  const title = video.title.toLowerCase();
  const desc = (video.description ?? "").toLowerCase();
  const hay = `${title} ${desc}`;
  let score = 0.2;

  const brand = (input.brand ?? "").toLowerCase();
  const name = (input.productName ?? "").toLowerCase();
  if (brand && hay.includes(brand)) score += 0.22;
  if (name && hay.includes(name)) score += 0.25;
  if (input.model && hay.includes(input.model.toLowerCase())) score += 0.1;

  if (REVIEW_SIGNALS.test(hay)) score += 0.18;
  if (/\b(unboxing|first impressions)\b/i.test(hay)) score += 0.05;
  if (/\b(sponsored|ad)\b/i.test(title)) score -= 0.15;

  score += Math.min(0.25, matchedTopics.length * 0.06);
  return Math.max(0, Math.min(1, score));
}

export function rankVideos(videos: DiscoveredVideo[]): DiscoveredVideo[] {
  return [...videos].sort((a, b) => b.videoRelevanceScore - a.videoRelevanceScore);
}

export function commentPagesForVideo(rankIndex: number, maxPages: number): number {
  if (rankIndex < 5) return maxPages;
  if (rankIndex < 15) return Math.max(1, maxPages - 1);
  if (rankIndex < 30) return Math.max(1, Math.floor(maxPages / 2));
  return 1;
}

export function queryHash(q: string): string {
  let h = 0;
  for (let i = 0; i < q.length; i++) h = (h * 31 + q.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function topicFromQuery(planned: PlannedQuery[], query: string): string[] {
  const p = planned.find((x) => x.query === query);
  return p ? [p.topic] : [];
}

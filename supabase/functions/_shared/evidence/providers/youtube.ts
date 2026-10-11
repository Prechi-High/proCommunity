import { PROVIDER_CAPS, PROVIDER_ENABLED, PROVIDER_TIMEOUT_MS, secret } from "./config.ts";
import type { EvidenceProvider, EvidenceSearchInput, ProviderSearchResult, RawEvidence } from "./types.ts";

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

function normalizeComment(
  id: string,
  text: string,
  author: string,
  videoId: string,
  videoTitle: string,
  publishedAt: string,
  likes: number,
  parentId?: string,
  contextText?: string,
): RawEvidence | null {
  const clean = decodeHtml(text).replace(/\s+/g, " ").trim();
  if (clean.length < 25 || clean.length > 900) return null;
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
    rawMetadata: { videoId, videoTitle },
  };
}

export const youtubeProvider: EvidenceProvider = {
  id: "youtube",

  async healthCheck() {
    return { ok: Boolean(secret("YOUTUBE_DATA_API_KEY")) };
  },

  async searchProductEvidence(input: EvidenceSearchInput): Promise<ProviderSearchResult> {
    if (!PROVIDER_ENABLED.youtube) return { provider: "youtube", status: "disabled", items: [] };
    const key = secret("YOUTUBE_DATA_API_KEY");
    if (!key) return { provider: "youtube", status: "disabled", items: [] };

    const cap = Math.min(PROVIDER_CAPS.youtube, input.maxItems ?? PROVIDER_CAPS.youtube);
    const q = `${input.brand ? `${input.brand} ` : ""}${input.productName} review`.trim();

    type SearchRes = { items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string } }> };
    const search = await withTimeout(
      fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=4&relevanceLanguage=en&q=${encodeURIComponent(q)}&key=${key}`,
      ).then((r) => (r.ok ? (r.json() as Promise<SearchRes>) : null)),
      PROVIDER_TIMEOUT_MS,
    );
    const videos = (search?.items ?? [])
      .map((i) => ({ id: i.id?.videoId ?? "", title: decodeHtml(i.snippet?.title ?? "") }))
      .filter((v) => v.id)
      .slice(0, 4);

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

    const items: RawEvidence[] = [];
    let requests = 0;
    for (const v of videos) {
      const res = await withTimeout(
        fetch(
          `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${v.id}&maxResults=50&order=relevance&textFormat=plainText&key=${key}`,
        ).then((r) => (r.ok ? (r.json() as Promise<ThreadRes>) : null)),
        PROVIDER_TIMEOUT_MS,
      );
      requests += 1;
      if (!res?.items) continue;
      for (const it of res.items) {
        const top = it.snippet?.topLevelComment;
        const sn = top?.snippet;
        if (!top?.id || !sn) continue;
        const topText = String(sn.textOriginal ?? sn.textDisplay ?? "");
        const topRow = normalizeComment(
          top.id,
          topText,
          String(sn.authorDisplayName ?? ""),
          v.id,
          v.title,
          String(sn.publishedAt ?? ""),
          Number(sn.likeCount ?? 0),
        );
        if (topRow && FIRST_PERSON.test(topRow.text) && !COMMENT_SPAM.test(topRow.text)) {
          items.push(topRow);
        }
        for (const reply of it.replies?.comments ?? []) {
          const rs = reply.snippet;
          if (!reply.id || !rs) continue;
          const replyText = String(rs.textOriginal ?? rs.textDisplay ?? "");
          const parentSnippet = topText.slice(0, 200);
          const row = normalizeComment(
            reply.id,
            replyText,
            String(rs.authorDisplayName ?? ""),
            v.id,
            v.title,
            String(rs.publishedAt ?? ""),
            Number(rs.likeCount ?? 0),
            rs.parentId ?? top.id,
            parentSnippet,
          );
          if (row && FIRST_PERSON.test(row.text) && !COMMENT_SPAM.test(row.text)) {
            items.push(row);
          }
        }
        if (items.length >= cap) break;
      }
      if (items.length >= cap) break;
    }

    return { provider: "youtube", status: "ok", items: items.slice(0, cap), requestsUsed: requests };
  },
};

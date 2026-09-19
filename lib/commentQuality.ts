/** Deterministic comment quality for classifier evidence. Not LLM-based. */

export const COMMENT_MIN_CHARS = 25;
export const COMMENT_KEEP_SCORE = 2;
export const COMMENT_THREADS_FETCH = 20;
export const COMMENT_REPLIES_PER_THREAD = 3;
export const COMMENT_THREADS_FOR_LLM = 8;

const SKIN_WORDS =
  /\b(cleanser|serum|moisturizer|moisturiser|routine|breakout|acne|dry|oily|sensitive|ceramide|niacinamide|retinol|barrier|irritat\w*|redness|how|week|month|result|compare|versus|\bvs\b|ingredient|apply|application|layer|patch|sting|peel|foam|hydrate|hydrating|texture|smell|scent|absorb|purging|comedogenic|spf|sunscreen)\b/i;

const SPAM_ONLY = /^(first!?|love(\s+this)?!?|subscribe!?|nice!?|cool!?|wow!?|🔥+|❤️+|😍+|lol!?|lmao!?|same!?|this!?)+$/i;
const EMOJI_HEAVY = /^[\p{Emoji}\p{Emoji_Presentation}\p{Extended_Pictographic}\s!.?]+$/u;

export type CommentScoreInput = {
  body: string;
  /** True when this row is a reply under a kept parent. */
  isReply?: boolean;
  parentIsQuestion?: boolean;
};

export type CommentScore = {
  score: number;
  keep: boolean;
  cleaned: string;
};

export function cleanCommentBody(body: string): string {
  return body
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function scoreComment(input: CommentScoreInput): CommentScore {
  const cleaned = cleanCommentBody(input.body);
  if (!cleaned || cleaned.length < COMMENT_MIN_CHARS) {
    return { score: 0, keep: false, cleaned };
  }
  if (EMOJI_HEAVY.test(cleaned) || SPAM_ONLY.test(cleaned)) {
    return { score: 0, keep: false, cleaned };
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 2) {
    return { score: 0, keep: false, cleaned };
  }
  const urlCount = (cleaned.match(/https?:\/\/|www\./gi) ?? []).length;
  if (urlCount >= 2 || (urlCount === 1 && words.length < 12)) {
    return { score: 0, keep: false, cleaned };
  }
  if (/(.)\1{6,}/.test(cleaned)) {
    return { score: 0, keep: false, cleaned };
  }

  let score = 0;
  if (cleaned.length >= 100) score += 2;
  else if (cleaned.length >= 40) score += 1;
  if (SKIN_WORDS.test(cleaned)) score += 2;
  if (cleaned.includes('?')) score += 1;
  if (input.isReply && input.parentIsQuestion) score += 1;

  return { score, keep: score >= COMMENT_KEEP_SCORE, cleaned };
}

export type ThreadComment = {
  id: string;
  parentId: string | null;
  authorDisplayName: string;
  body: string;
  likeCount: number;
  youtubeVideoId: string;
  evidenceScore: number;
  isMeaningful: boolean;
  replies: ThreadComment[];
};

/** Keep top-level if meaningful; attach up to N replies (inherit parent keep). */
export function filterMeaningfulThreads(
  tops: Array<Omit<ThreadComment, 'replies' | 'evidenceScore' | 'isMeaningful'> & { replies?: Array<Omit<ThreadComment, 'replies' | 'evidenceScore' | 'isMeaningful'>> }>,
  maxReplies = COMMENT_REPLIES_PER_THREAD,
): ThreadComment[] {
  const out: ThreadComment[] = [];
  for (const top of tops) {
    const scored = scoreComment({ body: top.body });
    if (!scored.keep) continue;
    const parentIsQuestion = scored.cleaned.includes('?');
    const replies: ThreadComment[] = [];
    for (const reply of (top.replies ?? []).slice(0, maxReplies)) {
      const cleaned = cleanCommentBody(reply.body);
      if (!cleaned) continue;
      // Parent kept → attach reply unless it is spam / emoji-only / promo.
      if (EMOJI_HEAVY.test(cleaned) || SPAM_ONLY.test(cleaned)) continue;
      const words = cleaned.split(/\s+/).filter(Boolean);
      if (words.length < 2) continue;
      const urlCount = (cleaned.match(/https?:\/\/|www\./gi) ?? []).length;
      if (urlCount >= 2) continue;
      const replyScore = scoreComment({
        body: cleaned,
        isReply: true,
        parentIsQuestion,
      });
      replies.push({
        ...reply,
        body: cleaned,
        parentId: top.id,
        evidenceScore: Math.max(replyScore.score, 1),
        isMeaningful: true,
        replies: [],
      });
    }
    out.push({
      ...top,
      body: scored.cleaned,
      parentId: null,
      evidenceScore: scored.score,
      isMeaningful: true,
      replies,
    });
  }
  return out;
}

/** Format for LLM evidence. Caps to maxThreads. */
export function formatCommentEvidence(threads: ThreadComment[], maxThreads = COMMENT_THREADS_FOR_LLM): string {
  const lines: string[] = [];
  for (const thread of threads.slice(0, maxThreads)) {
    lines.push(`Comment (@${thread.authorDisplayName}): ${thread.body}`);
    for (const reply of thread.replies) {
      lines.push(`  Reply (@${reply.authorDisplayName}): ${reply.body}`);
    }
  }
  return lines.join('\n').trim();
}

"""Deterministic comment quality for classifier evidence. Not LLM-based."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

COMMENT_MIN_CHARS = 25
COMMENT_KEEP_SCORE = 2
COMMENT_THREADS_FOR_LLM = 8
COMMENT_REPLIES_PER_THREAD = 3

SKIN_WORDS = re.compile(
    r"\b(cleanser|serum|moisturizer|moisturiser|routine|breakout|acne|dry|oily|sensitive|"
    r"ceramide|niacinamide|retinol|barrier|irritat\w*|redness|how|week|month|result|"
    r"compare|versus|\bvs\b|ingredient|apply|application|layer|patch|sting|peel|foam|"
    r"hydrate|hydrating|texture|smell|scent|absorb|purging|comedogenic|spf|sunscreen)\b",
    re.I,
)
SPAM_ONLY = re.compile(
    r"^(first!?|love(\s+this)?!?|subscribe!?|nice!?|cool!?|wow!?|🔥+|❤️+|😍+|lol!?|lmao!?|same!?|this!?)+$",
    re.I,
)
EMOJI_HEAVY = re.compile(r"^[\W\d\s🔥❤️😍😂🤣✨💯]+$", re.UNICODE)


def clean_comment_body(body: str) -> str:
    text = re.sub(r"<[^>]+>", " ", body or "")
    text = (
        text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )
    return re.sub(r"\s+", " ", text).strip()


@dataclass
class CommentScore:
    score: int
    keep: bool
    cleaned: str


def score_comment(
    body: str,
    *,
    is_reply: bool = False,
    parent_is_question: bool = False,
) -> CommentScore:
    cleaned = clean_comment_body(body)
    if not cleaned or len(cleaned) < COMMENT_MIN_CHARS:
        return CommentScore(0, False, cleaned)
    if EMOJI_HEAVY.match(cleaned) or SPAM_ONLY.match(cleaned):
        return CommentScore(0, False, cleaned)
    words = [w for w in cleaned.split() if w]
    if len(words) <= 2:
        return CommentScore(0, False, cleaned)
    url_count = len(re.findall(r"https?://|www\.", cleaned, flags=re.I))
    if url_count >= 2 or (url_count == 1 and len(words) < 12):
        return CommentScore(0, False, cleaned)
    if re.search(r"(.)\1{6,}", cleaned):
        return CommentScore(0, False, cleaned)

    score = 0
    if len(cleaned) >= 100:
        score += 2
    elif len(cleaned) >= 40:
        score += 1
    if SKIN_WORDS.search(cleaned):
        score += 2
    if "?" in cleaned:
        score += 1
    if is_reply and parent_is_question:
        score += 1
    return CommentScore(score, score >= COMMENT_KEEP_SCORE, cleaned)


@dataclass
class ThreadComment:
    id: str
    author: str
    body: str
    parent_id: str | None = None
    like_count: int = 0
    evidence_score: int = 0
    is_meaningful: bool = False
    replies: list[ThreadComment] = field(default_factory=list)


def format_comment_evidence(threads: list[ThreadComment], max_threads: int = COMMENT_THREADS_FOR_LLM) -> str:
    lines: list[str] = []
    for thread in threads[:max_threads]:
        lines.append(f"Comment (@{thread.author}): {thread.body}")
        for reply in thread.replies:
            lines.append(f"  Reply (@{reply.author}): {reply.body}")
    return "\n".join(lines).strip()


def threads_from_rows(rows: list[dict[str, Any]]) -> list[ThreadComment]:
    """Build parent→reply threads from flat youtube_comments rows."""
    tops: dict[str, ThreadComment] = {}
    orphans: list[dict[str, Any]] = []
    for row in rows:
        parent_id = row.get("parent_comment_id")
        if parent_id:
            orphans.append(row)
            continue
        if row.get("is_meaningful") is False:
            continue
        body = clean_comment_body(str(row.get("body") or ""))
        if not body:
            continue
        cid = str(row.get("id") or "")
        tops[cid] = ThreadComment(
            id=cid,
            author=str(row.get("author_display_name") or "viewer"),
            body=body,
            like_count=int(row.get("like_count") or 0),
            evidence_score=int(row.get("evidence_score") or 0),
            is_meaningful=True,
        )
    for row in orphans:
        parent_id = str(row.get("parent_comment_id") or "")
        parent = tops.get(parent_id)
        if not parent:
            continue
        if len(parent.replies) >= COMMENT_REPLIES_PER_THREAD:
            continue
        body = clean_comment_body(str(row.get("body") or ""))
        if not body:
            continue
        parent.replies.append(
            ThreadComment(
                id=str(row.get("id") or ""),
                author=str(row.get("author_display_name") or "viewer"),
                body=body,
                parent_id=parent_id,
                like_count=int(row.get("like_count") or 0),
                evidence_score=int(row.get("evidence_score") or 0),
                is_meaningful=True,
            )
        )
    # Prefer higher evidence score / likes
    ordered = sorted(tops.values(), key=lambda t: (t.evidence_score, t.like_count), reverse=True)
    return ordered

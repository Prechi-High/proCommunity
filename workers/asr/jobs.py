from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

JOB_VERSION = 1
MAX_ATTEMPTS = 3
BACKOFF_SECONDS = (30, 120, 600)


def build_job(
    *,
    video_id: str,
    product_id: str | None,
    platform: str,
    video_url: str,
    attempt: int = 1,
) -> dict[str, Any]:
    return {
        "version": JOB_VERSION,
        "jobType": "TRANSCRIBE_VIDEO",
        "jobId": str(uuid4()),
        "videoId": video_id,
        "productId": product_id,
        "platform": platform,
        "videoUrl": video_url,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "attempt": attempt,
    }


def parse_job(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("invalid_job")
    if raw.get("jobType") != "TRANSCRIBE_VIDEO":
        raise ValueError("unsupported_job_type")
    video_id = str(raw.get("videoId") or "").strip()
    if not video_id:
        raise ValueError("missing_video_id")
    attempt = int(raw.get("attempt") or 1)
    return {
        "version": int(raw.get("version") or JOB_VERSION),
        "jobType": "TRANSCRIBE_VIDEO",
        "jobId": str(raw.get("jobId") or uuid4()),
        "videoId": video_id,
        "productId": raw.get("productId"),
        "platform": str(raw.get("platform") or ""),
        "videoUrl": str(raw.get("videoUrl") or ""),
        "createdAt": str(raw.get("createdAt") or ""),
        "attempt": max(1, attempt),
    }


def next_backoff(attempt: int) -> int:
    index = min(max(attempt, 1), len(BACKOFF_SECONDS)) - 1
    return BACKOFF_SECONDS[index]


def is_permanent(error: str) -> bool:
    permanent = {
        "missing_video",
        "invalid_job",
        "unsupported_job_type",
        "unsupported_platform",
        "invalid_url",
    }
    return error in permanent

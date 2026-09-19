from __future__ import annotations

from typing import Any

from supabase import Client, create_client

from comment_quality import format_comment_evidence, threads_from_rows
from config import Settings

ALLOWED_STATUSES = {"pending", "queued", "processing", "complete", "failed", "skipped"}


class VideoStore:
    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("missing_supabase")
        self.client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        self.category = settings.taxonomy_category

    def load_taxonomy(self) -> list[dict[str, Any]]:
        result = (
            self.client.table("category_tag_taxonomy")
            .select("tag_key, tag_label, description, sort_order")
            .eq("category", self.category)
            .order("sort_order")
            .execute()
        )
        return result.data or []

    def get_video(self, video_id: str) -> dict[str, Any] | None:
        result = (
            self.client.table("video_cache")
            .select(
                "id, catalog_product_id, source_platform, source_url, youtube_video_id, title, "
                "channel_or_author, channel_title, description, content_tags, analysis_status, "
                "transcript_available, transcript_source, classification_confidence"
            )
            .eq("id", video_id)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return rows[0] if rows else None

    def comments_for(self, youtube_video_id: str | None) -> list[str]:
        """Return threaded meaningful comment evidence lines for metadata checks."""
        evidence = self.comment_evidence(youtube_video_id)
        if not evidence:
            return []
        return [line for line in evidence.split("\n") if line.strip()]

    def comment_evidence(self, youtube_video_id: str | None) -> str:
        if not youtube_video_id:
            return ""
        result = (
            self.client.table("youtube_comments")
            .select(
                "id, parent_comment_id, author_display_name, body, like_count, "
                "evidence_score, is_meaningful"
            )
            .eq("youtube_video_id", youtube_video_id)
            .eq("is_meaningful", True)
            .limit(60)
            .execute()
        )
        threads = threads_from_rows(result.data or [])
        return format_comment_evidence(threads)

    def already_complete(self, video: dict[str, Any]) -> bool:
        tags = video.get("content_tags") or []
        return video.get("analysis_status") == "complete" and bool(tags)

    def upsert_job(self, video_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        result = (
            self.client.table("video_analysis_jobs")
            .upsert(
                {
                    "video_id": video_id,
                    "job_type": "TRANSCRIBE_VIDEO",
                    "status": "queued",
                    "job_payload": payload,
                },
                on_conflict="video_id,job_type",
            )
            .execute()
        )
        rows = result.data or []
        return rows[0] if rows else {"video_id": video_id}

    def mark_job(self, video_id: str, status: str, attempts: int, error: str | None = None) -> None:
        self.client.table("video_analysis_jobs").update(
            {
                "status": status,
                "attempts": attempts,
                "error_message": (error or "")[:500] or None,
            }
        ).eq("video_id", video_id).eq("job_type", "TRANSCRIBE_VIDEO").execute()

    def save_analysis(
        self,
        video_id: str,
        *,
        tags: list[str],
        confidence: float | None,
        justification: str | None,
        method: str,
        transcript_source: str,
        transcript_available: bool,
        metrics: dict[str, Any],
        analysis_status: str,
        last_analyzed_at: str,
    ) -> None:
        self.client.table("video_cache").update(
            {
                "content_tags": tags,
                "classification_confidence": confidence,
                "classification_justification": (justification or "")[:280] or None,
                "classification_method": method,
                "transcript_source": transcript_source,
                "transcript_available": transcript_available,
                "analysis_status": analysis_status,
                "analysis_metrics": metrics,
                "last_analyzed_at": last_analyzed_at,
            }
        ).eq("id", video_id).execute()

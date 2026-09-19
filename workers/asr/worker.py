from __future__ import annotations

import time
from datetime import datetime, timezone

from classify import classify_evidence
from config import load_settings
from jobs import MAX_ATTEMPTS, is_permanent, next_backoff, parse_job
from logging_config import configure_logging, log_event
from redis_client import RedisQueue
from supabase_client import VideoStore
from transcription import get_transcript


def process_job(store: VideoStore, settings, job: dict, logger) -> None:
    started = time.monotonic()
    parsed = parse_job(job)
    video = store.get_video(parsed["videoId"])
    if not video:
        raise ValueError("missing_video")

    if store.already_complete(video):
        store.mark_job(parsed["videoId"], "complete", parsed["attempt"])
        log_event(
            logger,
            job_id=parsed["jobId"],
            video_id=parsed["videoId"],
            processing_stage="idempotent_skip",
            success=True,
        )
        return

    store.upsert_job(parsed["videoId"], parsed)
    store.mark_job(parsed["videoId"], "processing", parsed["attempt"])
    comment_evidence = store.comment_evidence(video.get("youtube_video_id"))
    comments = store.comments_for(video.get("youtube_video_id"))
    caption_started = time.monotonic()
    transcript = get_transcript(settings, video, comments, comment_evidence=comment_evidence)
    caption_ms = int((time.monotonic() - caption_started) * 1000)

    taxonomy = store.load_taxonomy()
    llm_started = time.monotonic()
    tags, confidence, evidence, llm_error = classify_evidence(
        settings,
        product_name=str(parsed.get("productId") or video.get("catalog_product_id") or ""),
        taxonomy=taxonomy,
        title=str(video.get("title") or ""),
        author=str(video.get("channel_or_author") or video.get("channel_title") or ""),
        evidence=transcript.text,
        evidence_source=transcript.source,
    )
    llm_ms = int((time.monotonic() - llm_started) * 1000)
    method = "transcript" if transcript.source in {"captions", "asr"} else "title_description"
    status = "complete" if tags or not llm_error else "failed"
    store.save_analysis(
        parsed["videoId"],
        tags=tags,
        confidence=confidence,
        justification=evidence or llm_error,
        method=method,
        transcript_source=transcript.source,
        transcript_available=transcript.source == "captions" or transcript.used_asr,
        metrics={
            "total_ms": int((time.monotonic() - started) * 1000),
            "caption_or_asr_ms": caption_ms,
            "llm_ms": llm_ms,
            "used_asr": transcript.used_asr,
            "transcript_source": transcript.source,
        },
        analysis_status=status if tags or transcript.source != "none" else "skipped",
        last_analyzed_at=datetime.now(timezone.utc).isoformat(),
    )
    store.mark_job(parsed["videoId"], "complete" if status != "failed" else "failed", parsed["attempt"], llm_error)
    log_event(
        logger,
        job_id=parsed["jobId"],
        video_id=parsed["videoId"],
        product_id=parsed.get("productId"),
        platform=parsed.get("platform") or video.get("source_platform"),
        processing_stage="complete",
        duration_ms=int((time.monotonic() - started) * 1000),
        success=status != "failed",
        used_asr=transcript.used_asr,
        transcript_source=transcript.source,
    )


def main() -> None:
    logger = configure_logging()
    settings = load_settings()
    if not settings.upstash_url or not settings.upstash_token:
        raise SystemExit("missing_upstash")
    store = VideoStore(settings)
    queue = RedisQueue(settings)
    log_event(logger, processing_stage="boot", redis_env=settings.redis_env, whisper=settings.whisper_model_size)

    idle_rounds = 0
    while True:
        try:
            queue.promote_delayed(time.time())
            job = queue.pop_job()
            if not job:
                idle_rounds += 1
                if settings.exit_when_idle:
                    log_event(logger, processing_stage="idle_exit", success=True)
                    return
                time.sleep(settings.poll_seconds)
                continue
            idle_rounds = 0
            try:
                process_job(store, settings, job, logger)
                queue.ack(job)
            except Exception as exc:
                error = str(exc)[:180]
                attempt = int(job.get("attempt") or 1)
                log_event(
                    logger,
                    job_id=job.get("jobId"),
                    video_id=job.get("videoId"),
                    processing_stage="error",
                    success=False,
                    error=error,
                    attempt=attempt,
                )
                if is_permanent(error) or attempt >= MAX_ATTEMPTS:
                    if job.get("videoId"):
                        store.mark_job(str(job["videoId"]), "dead", attempt, error)
                    queue.dead_letter(job)
                else:
                    job["attempt"] = attempt + 1
                    queue.retry_later(job, time.time() + next_backoff(attempt))
        except Exception as exc:
            log_event(logger, processing_stage="loop_error", success=False, error=str(exc)[:180])
            time.sleep(settings.poll_seconds)


if __name__ == "__main__":
    main()

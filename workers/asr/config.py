from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_local_env() -> None:
    """Load workers/asr/.env only. Never the repo-root production .env."""
    path = Path(__file__).resolve().parent / ".env"
    if not path.exists():
        return
    try:
        from dotenv import load_dotenv

        load_dotenv(path, override=False)
    except ImportError:
        pass


def _env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip().strip('"').strip("'")


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    upstash_url: str
    upstash_token: str
    queue_key: str
    processing_key: str
    dead_key: str
    delayed_key: str
    redis_env: str
    gemini_api_key: str
    openrouter_api_key: str
    nvidia_api_key: str
    gemini_model: str
    openrouter_model: str
    nvidia_model: str
    confidence_floor: float
    whisper_model_size: str
    whisper_device: str
    whisper_compute_type: str
    poll_seconds: float
    stale_processing_seconds: int
    taxonomy_category: str
    youtube_data_api_key: str
    exit_when_idle: bool

    @property
    def production(self) -> bool:
        return self.redis_env.lower() in {"production", "prod"}


def load_settings() -> Settings:
    _load_local_env()
    size = _env("WHISPER_MODEL_SIZE", "tiny").lower()
    if size not in {"tiny", "base", "small", "medium"}:
        size = "tiny"
    return Settings(
        supabase_url=_env("SUPABASE_URL") or _env("EXPO_PUBLIC_SUPABASE_URL"),
        supabase_service_role_key=_env("SUPABASE_SERVICE_ROLE_KEY"),
        upstash_url=_env("UPSTASH_REDIS_REST_URL").rstrip("/"),
        upstash_token=_env("UPSTASH_REDIS_REST_TOKEN"),
        queue_key=_env("ASR_QUEUE_KEY", "asr:jobs"),
        processing_key=_env("ASR_PROCESSING_KEY", "asr:processing"),
        dead_key=_env("ASR_DEAD_KEY", "asr:dead"),
        delayed_key=_env("ASR_DELAYED_KEY", "asr:delayed"),
        redis_env=_env("ASR_REDIS_ENV", "development"),
        gemini_api_key=_env("GEMINI_API_KEY") or _env("GOOGLE_API_KEY"),
        openrouter_api_key=_env("OPENROUTER_API_KEY"),
        nvidia_api_key=_env("NVIDIA_API_KEY") or _env("NGC_API_KEY"),
        gemini_model=_env("GEMINI_MODEL", "gemini-2.5-flash"),
        openrouter_model=_env("OPENROUTER_MODEL", "google/gemini-2.5-flash"),
        nvidia_model=_env("NVIDIA_MODEL", "meta/llama-3.1-8b-instruct"),
        confidence_floor=float(_env("CLASSIFICATION_CONFIDENCE_FLOOR", "0.7")),
        whisper_model_size=size,
        whisper_device=_env("WHISPER_DEVICE", "cpu"),
        whisper_compute_type=_env("WHISPER_COMPUTE_TYPE", "int8"),
        poll_seconds=float(_env("ASR_POLL_SECONDS", "5")),
        stale_processing_seconds=int(_env("ASR_STALE_SECONDS", "900")),
        taxonomy_category=_env("TAXONOMY_CATEGORY", "skincare"),
        youtube_data_api_key=_env("YOUTUBE_DATA_API_KEY"),
        exit_when_idle=_env("ASR_EXIT_WHEN_IDLE", "false").lower() in {"1", "true", "yes"},
    )

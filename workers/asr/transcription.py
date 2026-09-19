from __future__ import annotations

import os
import re
import shutil
import tempfile
from dataclasses import dataclass
from typing import Protocol

from config import Settings

CAPTION_MIN_CHARS = 40
METADATA_MIN_CHARS = 80


class TranscriptProvider(Protocol):
    def captions(self, video: dict) -> str: ...


@dataclass
class TranscriptResult:
    text: str
    source: str
    used_asr: bool


class YouTubeCaptionProvider:
    def captions(self, video: dict) -> str:
        video_id = video.get("youtube_video_id") or _youtube_id(str(video.get("source_url") or ""))
        if not video_id:
            return ""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
        except ImportError:
            return ""
        try:
            api = YouTubeTranscriptApi()
            fetched = api.fetch(video_id, languages=["en", "en-US", "en-GB"])
            text = " ".join(chunk.text for chunk in fetched if getattr(chunk, "text", None))
            return re.sub(r"\s+", " ", text).strip()[:8000]
        except Exception:
            try:
                from youtube_transcript_api import YouTubeTranscriptApi as Legacy

                snippets = Legacy.get_transcript(video_id, languages=["en", "en-US"])
                return re.sub(r"\s+", " ", " ".join(item.get("text", "") for item in snippets)).strip()[:8000]
            except Exception:
                return ""


class NativeCaptionProvider:
    """TikTok/Instagram/Facebook/Pinterest have no public caption API we can call."""

    def captions(self, video: dict) -> str:
        return ""


_whisper_model = None


def _youtube_id(url: str) -> str | None:
    match = re.search(r"(?:v=|/shorts/|/embed/|youtu\.be/)([\w-]{11})", url)
    return match.group(1) if match else None


def provider_for(platform: str) -> TranscriptProvider:
    if platform == "youtube":
        return YouTubeCaptionProvider()
    return NativeCaptionProvider()


def metadata_sufficient(title: str, description: str, comments: list[str]) -> bool:
    blob = " ".join([title, description, *comments]).strip()
    if len(blob) >= METADATA_MIN_CHARS:
        return True
    return bool(
        re.search(
            r"\b(how to|how i use|how i apply|routine|before\s*after|ingredient|vs\.?|versus|review|unbox|tutorial|demo)\b",
            title,
            re.I,
        )
    )


def _load_whisper(settings: Settings):
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model
    from faster_whisper import WhisperModel

    _whisper_model = WhisperModel(
        settings.whisper_model_size,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute_type,
    )
    return _whisper_model


def _extract_youtube_audio(video_url: str, dest_dir: str) -> str | None:
    try:
        import yt_dlp
    except ImportError:
        return None
    outtmpl = os.path.join(dest_dir, "audio.%(ext)s")
    options = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "noplaylist": True,
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "wav"}],
        "overwrites": True,
    }
    try:
        with yt_dlp.YoutubeDL(options) as client:
            client.download([video_url])
    except Exception:
        return None
    for name in os.listdir(dest_dir):
        if name.endswith((".wav", ".mp3", ".m4a", ".webm")):
            return os.path.join(dest_dir, name)
    return None


def transcribe_audio(settings: Settings, audio_path: str) -> str:
    model = _load_whisper(settings)
    segments, _info = model.transcribe(audio_path, beam_size=1, vad_filter=True)
    text = " ".join(segment.text.strip() for segment in segments if segment.text)
    return re.sub(r"\s+", " ", text).strip()[:8000]


def get_transcript(
    settings: Settings,
    video: dict,
    comments: list[str],
    comment_evidence: str = "",
) -> TranscriptResult:
    platform = str(video.get("source_platform") or "")
    captions = provider_for(platform).captions(video)
    if len(captions) >= CAPTION_MIN_CHARS:
        return TranscriptResult(text=captions, source="captions", used_asr=False)

    title = str(video.get("title") or "")
    description = str(video.get("description") or "")
    threaded = (comment_evidence or "").strip()
    comment_blob = threaded or " ".join(comments[:8])
    if metadata_sufficient(title, description, comments if not threaded else [threaded]):
        evidence = "\n".join(part for part in [title, description, threaded or " ".join(comments[:8])] if part).strip()
        return TranscriptResult(text=evidence[:8000], source="comments_metadata", used_asr=False)

    if platform != "youtube":
        evidence = "\n".join(part for part in [title, description, comment_blob] if part).strip()
        return TranscriptResult(text=evidence, source="none" if not evidence else "comments_metadata", used_asr=False)

    dest = tempfile.mkdtemp(prefix="asr-")
    try:
        audio = _extract_youtube_audio(str(video.get("source_url") or ""), dest)
        if not audio:
            return TranscriptResult(text=" ".join([title, description]).strip(), source="none", used_asr=False)
        text = transcribe_audio(settings, audio)
        return TranscriptResult(text=text or title, source="asr" if text else "none", used_asr=bool(text))
    finally:
        shutil.rmtree(dest, ignore_errors=True)

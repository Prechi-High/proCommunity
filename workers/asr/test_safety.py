from jobs import is_permanent, next_backoff, parse_job
from classify import validate_classification
from supabase_client import VideoStore
from transcription import get_transcript, metadata_sufficient


ALLOWED = {
    "how_it_works",
    "how_to_use",
    "composition",
    "who_its_for",
    "results_over_time",
    "precautions",
    "comparisons",
}


class FakeTable:
    def __init__(self, store):
        self.store = store
        self._op = None
        self._payload = None
        self._filters = {}

    def update(self, payload):
        self._op = "update"
        self._payload = payload
        return self

    def eq(self, key, value):
        self._filters[key] = value
        return self

    def execute(self):
        if self._op == "update" and self._filters.get("id"):
            self.store.writes.append({**self._payload, "id": self._filters["id"]})
        return type("R", (), {"data": []})()


class FakeClient:
    def __init__(self, store):
        self.store = store

    def table(self, name):
        self.store.last_table = name
        return FakeTable(self.store)


def test_already_complete_is_idempotent():
    assert VideoStore.already_complete(
        None,
        {"analysis_status": "complete", "content_tags": ["how_to_use"]},
    )
    assert not VideoStore.already_complete(None, {"analysis_status": "queued", "content_tags": []})


def test_save_analysis_write_is_keyed_by_video_id():
    store = VideoStore.__new__(VideoStore)
    store.writes = []
    store.client = FakeClient(store)
    store.save_analysis(
        "vid-1",
        tags=["how_to_use"],
        confidence=0.9,
        justification="applies cleanser",
        method="transcript",
        transcript_source="captions",
        transcript_available=True,
        metrics={"used_asr": False},
        analysis_status="complete",
        last_analyzed_at="2026-09-19T00:00:00Z",
    )
    assert store.writes[0]["id"] == "vid-1"
    assert store.writes[0]["content_tags"] == ["how_to_use"]
    assert store.writes[0]["transcript_source"] == "captions"


def test_retry_then_dead():
    assert next_backoff(1) == 30
    assert next_backoff(2) == 120
    assert next_backoff(3) == 600
    assert is_permanent("invalid_url")
    assert not is_permanent("llm_http_429")


def test_retry_mutates_attempt_without_duplicate_identity():
    job = parse_job(
        {
            "jobType": "TRANSCRIBE_VIDEO",
            "jobId": "same-job",
            "videoId": "vid-1",
            "attempt": 1,
        }
    )
    job["attempt"] = job["attempt"] + 1
    again = parse_job(job)
    assert again["jobId"] == "same-job"
    assert again["videoId"] == "vid-1"
    assert again["attempt"] == 2


def test_captions_skip_asr(monkeypatch):
    monkeypatch.setattr(
        "transcription.YouTubeCaptionProvider.captions",
        lambda self, video: "This is a long enough existing caption track about applying cleanser twice daily.",
    )
    called = {"asr": False}

    def boom(*_args, **_kwargs):
        called["asr"] = True
        raise AssertionError("asr should not run")

    monkeypatch.setattr("transcription._extract_youtube_audio", boom)
    result = get_transcript(
        None,
        {"source_platform": "youtube", "youtube_video_id": "abcdefghijk", "title": "How I Use CeraVe"},
        [],
    )
    assert result.source == "captions"
    assert result.used_asr is False
    assert called["asr"] is False


def test_metadata_skips_asr_when_title_is_enough(monkeypatch):
    monkeypatch.setattr("transcription.YouTubeCaptionProvider.captions", lambda self, video: "")
    monkeypatch.setattr(
        "transcription._extract_youtube_audio",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("asr should not run")),
    )
    result = get_transcript(
        None,
        {
            "source_platform": "youtube",
            "title": "How I Use CeraVe Foaming Cleanser",
            "description": "My morning skincare routine with this cleanser.",
        },
        [],
    )
    assert result.used_asr is False
    assert result.source == "comments_metadata"


def test_temp_audio_deleted_after_asr(monkeypatch, tmp_path):
    monkeypatch.setattr("transcription.YouTubeCaptionProvider.captions", lambda self, video: "")
    monkeypatch.setattr("transcription.metadata_sufficient", lambda *_args, **_kwargs: False)

    def extract(_url, dest):
        audio = dest / "audio.wav" if hasattr(dest, "__truediv__") else None
        path = str(tmp_path / "nested" / "audio.wav")
        # transcription uses a real tempfile dir; write a dummy file there.
        import os

        path = os.path.join(dest, "audio.wav")
        with open(path, "wb") as handle:
            handle.write(b"fake")
        return path

    monkeypatch.setattr("transcription._extract_youtube_audio", extract)
    monkeypatch.setattr("transcription.transcribe_audio", lambda settings, audio_path: "spoken words about applying cleanser")
    seen = {}

    import shutil

    real_rmtree = shutil.rmtree

    def tracking_rmtree(path, ignore_errors=False):
        seen["path"] = path
        return real_rmtree(path, ignore_errors=ignore_errors)

    monkeypatch.setattr("transcription.shutil.rmtree", tracking_rmtree)
    result = get_transcript(
        None,
        {"source_platform": "youtube", "source_url": "https://www.youtube.com/watch?v=abcdefghijk", "title": "CeraVe"},
        [],
    )
    assert result.used_asr is True
    assert seen.get("path")
    import os

    assert not os.path.exists(seen["path"])


def test_worker_loop_survives_one_failure():
    from jobs import is_permanent

    error = "faster-whisper failed"
    assert not is_permanent(error)


def test_review_unboxing_rejected():
    tags, _score, _why = validate_classification(
        {"tags": ["REVIEW", "UNBOXING", "OTHER"], "confidence": 0.99, "evidence": "unbox"},
        ALLOWED,
        0.7,
    )
    assert tags == []

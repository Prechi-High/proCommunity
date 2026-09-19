from jobs import build_job, is_permanent, next_backoff, parse_job
from classify import normalize_tag, parse_classifier_json, validate_classification
from transcription import metadata_sufficient


ALLOWED = {
    "how_it_works",
    "how_to_use",
    "composition",
    "who_its_for",
    "results_over_time",
    "precautions",
    "comparisons",
}


def test_parse_job_requires_video_id():
    try:
        parse_job({"jobType": "TRANSCRIBE_VIDEO"})
        raise AssertionError("expected")
    except ValueError as exc:
        assert "missing_video_id" in str(exc)


def test_parse_job_roundtrip():
    job = build_job(
        video_id="11111111-1111-1111-1111-111111111111",
        product_id="gentle-foaming-cleanser",
        platform="youtube",
        video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    )
    parsed = parse_job(job)
    assert parsed["jobType"] == "TRANSCRIBE_VIDEO"
    assert parsed["attempt"] == 1
    assert parsed["productId"] == "gentle-foaming-cleanser"


def test_backoff():
    assert next_backoff(1) == 30
    assert next_backoff(2) == 120
    assert next_backoff(3) == 600


def test_permanent_errors():
    assert is_permanent("missing_video")
    assert not is_permanent("gemini_http_429")


def test_unknown_tags_rejected():
    tags, score, _why = validate_classification(
        {"tags": ["HOW_TO_USE", "UNBOXING", "not_a_tag"], "confidence": 0.94, "evidence": "applies cleanser"},
        ALLOWED,
        0.7,
    )
    assert tags == ["how_to_use"]
    assert score == 0.94


def test_below_floor_clears_tags():
    tags, score, why = validate_classification(
        {"tags": ["how_to_use"], "confidence": 0.2, "evidence": "guess"},
        ALLOWED,
        0.7,
    )
    assert tags == []
    assert score == 0.2
    assert why


def test_parse_json_fences():
    parsed = parse_classifier_json('```json\n{"tags":["how_to_use"],"confidence":0.9}\n```')
    assert parsed["tags"] == ["how_to_use"]


def test_normalize_alias():
    assert normalize_tag("INGREDIENTS", ALLOWED) == "composition"
    assert normalize_tag("OTHER", ALLOWED) is None


def test_metadata_sufficient_from_title():
    assert metadata_sufficient("How I Use CeraVe Foaming Cleanser", "", [])
    assert not metadata_sufficient("CeraVe", "", [])


def test_duplicate_job_identity():
    a = build_job(video_id="v1", product_id="p", platform="youtube", video_url="u")
    b = build_job(video_id="v1", product_id="p", platform="youtube", video_url="u")
    assert a["videoId"] == b["videoId"]
    assert a["jobId"] != b["jobId"]

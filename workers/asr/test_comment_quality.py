from comment_quality import format_comment_evidence, score_comment, threads_from_rows
from classify import validate_classification


ALLOWED = {
    "how_it_works",
    "how_to_use",
    "composition",
    "who_its_for",
    "results_over_time",
    "precautions",
    "comparisons",
}


def test_rejects_spam_comments():
    assert score_comment("first!!!").keep is False
    assert score_comment("❤️❤️❤️").keep is False
    assert score_comment("subscribe now http://spam.example http://more.example").keep is False


def test_keeps_meaningful_skin_comment():
    result = score_comment(
        "This cleanser didn't strip my barrier. I use it in my evening routine for oily skin."
    )
    assert result.keep is True
    assert result.score >= 2


def test_thread_evidence_shows_reply():
    rows = [
        {
            "id": "c1",
            "parent_comment_id": None,
            "author_display_name": "Maya",
            "body": "Did this cleanser irritate anyone with a damaged barrier?",
            "like_count": 4,
            "evidence_score": 4,
            "is_meaningful": True,
        },
        {
            "id": "r1",
            "parent_comment_id": "c1",
            "author_display_name": "Sam",
            "body": "I use it every other night with moisturizer and it is fine.",
            "like_count": 2,
            "evidence_score": 2,
            "is_meaningful": True,
        },
    ]
    evidence = format_comment_evidence(threads_from_rows(rows))
    assert "Comment (@Maya):" in evidence
    assert "Reply (@Sam):" in evidence


def test_unknown_tags_still_rejected():
    tags, score, _ = validate_classification(
        {"tags": ["UNBOXING", "HOW_TO_USE", "made_up_tag"], "confidence": 0.95, "evidence": "applies cleanser"},
        ALLOWED,
        0.7,
    )
    assert tags == ["how_to_use"]
    assert score == 0.95

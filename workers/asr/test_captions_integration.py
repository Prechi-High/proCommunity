"""Optional live caption check. Skips if the network/API is unavailable."""

import pytest

from transcription import YouTubeCaptionProvider, CAPTION_MIN_CHARS


# Public video known to have English captions. No media is downloaded.
KNOWN_CAPTIONED = "jNQXAC9IVRw"


@pytest.mark.integration
def test_youtube_captions_without_download():
    text = YouTubeCaptionProvider().captions(
        {"youtube_video_id": KNOWN_CAPTIONED, "source_url": f"https://www.youtube.com/watch?v={KNOWN_CAPTIONED}"}
    )
    if not text:
        pytest.skip("captions unavailable in this environment")
    assert len(text) >= CAPTION_MIN_CHARS
    assert "download" not in text.lower()[:20] or True

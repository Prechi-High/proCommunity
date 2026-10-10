"""One-off: crop category card photos from project info/go ahead/search.png."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "project info" / "go ahead" / "search.png"
OUT = ROOT / "assets" / "search-home" / "categories"

# Pixel boxes (left, top, right, bottom) on 941×1672 go-ahead search.png — image band per card
BOXES: dict[str, tuple[int, int, int, int]] = {
    "tech": (52, 672, 438, 738),
    "care": (502, 672, 888, 738),
    "home": (472, 674, 681, 740),
    "style": (682, 674, 888, 740),
    "food": (52, 778, 438, 844),
    "auto": (262, 778, 448, 844),
    "kids": (472, 834, 681, 900),
    "other": (682, 834, 888, 900),
}


def main() -> None:
    im = Image.open(SRC).convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    for cat_id, box in BOXES.items():
        crop = im.crop(box)
        out_path = OUT / f"{cat_id}.jpg"
        crop.save(out_path, "JPEG", quality=92, optimize=True)
        print(f"saved {out_path} {crop.size}")


if __name__ == "__main__":
    main()

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from config import Settings

TAG_ALIASES = {
    "HOW_TO_USE": "how_to_use",
    "DEMONSTRATION": "how_to_use",
    "ROUTINE": "how_to_use",
    "HOW_IT_WORKS": "how_it_works",
    "INGREDIENTS": "composition",
    "COMPOSITION": "composition",
    "WHO_ITS_FOR": "who_its_for",
    "RESULTS_AFTER_USAGE": "results_over_time",
    "BEFORE_AFTER": "results_over_time",
    "RESULTS_OVER_TIME": "results_over_time",
    "PRECAUTIONS": "precautions",
    "COMPARISON": "comparisons",
    "COMPARISONS": "comparisons",
    "PROS_AND_CONS": "comparisons",
}


def normalize_tag(raw: str, allowed: set[str]) -> str | None:
    value = raw.strip()
    if value in allowed:
        return value
    mapped = TAG_ALIASES.get(value.upper().replace(" ", "_"))
    if mapped in allowed:
        return mapped
    lowered = value.lower().replace(" ", "_")
    return lowered if lowered in allowed else None


def parse_classifier_json(raw: str) -> dict[str, Any] | None:
    stripped = re.sub(r"```(?:json)?", " ", raw).strip()
    match = re.search(r"\{[\s\S]*\}", stripped)
    if not match:
        return None
    for candidate in (match.group(0), re.sub(r",\s*([}\]])", r"\1", match.group(0))):
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


def validate_classification(
    payload: dict[str, Any] | None,
    allowed: set[str],
    floor: float,
) -> tuple[list[str], float | None, str | None]:
    if not payload:
        return [], None, "classifier_unparsed"
    raw_tags = payload.get("tags") or payload.get("content_tags") or []
    if isinstance(raw_tags, str):
        raw_tags = [raw_tags]
    tags = []
    for item in raw_tags:
        mapped = normalize_tag(str(item), allowed)
        if mapped and mapped not in tags:
            tags.append(mapped)
    confidence = payload.get("confidence")
    try:
        score = max(0.0, min(1.0, float(confidence)))
    except (TypeError, ValueError):
        score = 0.0
    evidence = str(payload.get("evidence") or payload.get("justification") or "")[:280]
    if score < floor:
        return [], score, evidence or "below_confidence_floor"
    return tags, score, evidence or None


def classify_evidence(
    settings: Settings,
    *,
    product_name: str,
    taxonomy: list[dict[str, Any]],
    title: str,
    author: str,
    evidence: str,
    evidence_source: str,
) -> tuple[list[str], float | None, str | None, str | None]:
    allowed = {str(row["tag_key"]) for row in taxonomy}
    taxonomy_block = "\n".join(
        f"- {row['tag_key']} ({row['tag_label']}): {row['description']}" for row in taxonomy
    )
    source_note = {
        "captions": "Evidence is existing captions/subtitles. Do not invent spoken content.",
        "asr": "Evidence is an ASR fallback transcript. Prefer it over the title.",
        "comments_metadata": "No captions. Classify from title, description, and comments only.",
        "none": "Very little evidence. Return [] unless a tag is obvious from the title.",
    }.get(evidence_source, "Classify from the provided evidence.")
    prompt = f"""Classify this skincare product video using ONLY the product's fixed taxonomy.
Multi-label: return only tag_key values from the Allowed tags list below.
Never invent tags, categories, or free-text labels. Unknown tags are rejected.
If none of the allowed tags clearly apply, return []. Empty is correct.
Confidence 0-1. One-line evidence.
Priority of evidence: transcript, then meaningful comment threads (Comment / Reply), then description, then title.

Product: {product_name}
Title: {title}
Author: {author}
{source_note}
Evidence:
{evidence[:4000]}

Allowed tags (closed list — do not add others):
{taxonomy_block}

Return JSON only: {{"tags":["how_to_use"],"confidence":0.82,"evidence":"..."}}"""

    raw, error = call_llm(settings, prompt)
    parsed = parse_classifier_json(raw) if raw else None
    tags, score, evidence_out = validate_classification(parsed, allowed, settings.confidence_floor)
    return tags, score, evidence_out, error


def call_llm(settings: Settings, prompt: str) -> tuple[str, str | None]:
    if settings.gemini_api_key:
        text, err = _gemini(settings, prompt)
        if text:
            return text, None
        if err:
            last = err
        else:
            last = "gemini_empty"
    else:
        last = "no_gemini_key"
    if settings.openrouter_api_key:
        text, err = _openai_compat(
            "https://openrouter.ai/api/v1/chat/completions",
            settings.openrouter_api_key,
            settings.openrouter_model,
            prompt,
            extra={"HTTP-Referer": "https://pro-community.vercel.app", "X-Title": "Sourced"},
        )
        if text:
            return text, None
        last = err or last
    if settings.nvidia_api_key:
        text, err = _openai_compat(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            settings.nvidia_api_key,
            settings.nvidia_model,
            prompt,
        )
        if text:
            return text, None
        last = err or last
    return "", last


def _gemini(settings: Settings, prompt: str) -> tuple[str, str | None]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    response = httpx.post(
        url,
        headers={"Content-Type": "application/json", "x-goog-api-key": settings.gemini_api_key},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0, "maxOutputTokens": 400, "responseMimeType": "application/json"},
        },
        timeout=45,
    )
    if response.status_code != 200:
        return "", f"gemini_http_{response.status_code}"
    payload = response.json()
    parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "\n".join(part.get("text") or "" for part in parts)
    return text, None if text else "gemini_empty"


def _openai_compat(
    url: str,
    key: str,
    model: str,
    prompt: str,
    extra: dict[str, str] | None = None,
) -> tuple[str, str | None]:
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}
    if extra:
        headers.update(extra)
    response = httpx.post(
        url,
        headers=headers,
        json={"model": model, "temperature": 0, "max_tokens": 400, "messages": [{"role": "user", "content": prompt}]},
        timeout=45,
    )
    if response.status_code != 200:
        return "", f"llm_http_{response.status_code}"
    payload = response.json()
    text = (((payload.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
    return text, None if text else "llm_empty"

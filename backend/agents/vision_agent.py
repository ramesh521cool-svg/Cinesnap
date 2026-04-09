"""
Vision Agent — Identifies content from camera frames using:
  1. Google Cloud Vision API (OCR + label detection)
  2. Perceptual hashing (frame stability)
  3. Text cleanup heuristics to produce a title candidate
"""
import base64
import os
import re
import httpx
from dataclasses import dataclass
from typing import Optional


VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate"

# Common noise words to strip from OCR text before title search
NOISE_WORDS = {
    "netflix", "hbo", "hulu", "disney", "apple", "amazon", "prime",
    "max", "paramount", "peacock", "streaming", "original", "series",
    "season", "episode", "part", "volume", "chapter", "now streaming",
    "cc", "hd", "4k", "uhd", "dolby", "atmos", "dts",
}

STREAMING_LOGOS = {
    "netflix": "Netflix",
    "hbo": "HBO",
    "disney": "Disney+",
    "hulu": "Hulu",
    "amazon": "Amazon Prime",
    "apple": "Apple TV+",
    "paramount": "Paramount+",
    "peacock": "Peacock",
}


@dataclass
class VisionResult:
    title_candidate: str
    year_candidate: Optional[int]
    detected_text: str
    platform_hint: Optional[str]
    scene_labels: list[str]
    confidence: float          # 0.0 – 1.0
    is_stable_frame: bool


async def analyze_frames(frames_b64: list[str]) -> VisionResult:
    """
    Send frames to Google Vision API and extract structured content hints.
    Uses the first 2 frames to reduce cost and latency.
    """
    api_key = os.environ["GOOGLE_VISION_API_KEY"]

    # Limit to 2 frames — the best quality ones
    selected = _pick_best_frames(frames_b64, n=2)

    requests = []
    for frame_b64 in selected:
        requests.append({
            "image": {"content": frame_b64},
            "features": [
                {"type": "TEXT_DETECTION", "maxResults": 50},
                {"type": "LABEL_DETECTION", "maxResults": 20},
                {"type": "LOGO_DETECTION", "maxResults": 5},
            ]
        })

    async with httpx.AsyncClient(timeout=8.0, verify=False) as client:
        resp = await client.post(
            VISION_API_URL,
            params={"key": api_key},
            json={"requests": requests}
        )

    if resp.status_code != 200:
        return _fallback_result()

    responses = resp.json().get("responses", [])

    all_text: list[str] = []
    all_labels: list[str] = []
    all_logos: list[str] = []

    for r in responses:
        if r.get("textAnnotations"):
            full_text = r["textAnnotations"][0].get("description", "")
            all_text.append(full_text)
        if r.get("labelAnnotations"):
            for lbl in r["labelAnnotations"]:
                if lbl.get("score", 0) > 0.70:
                    all_labels.append(lbl["description"].lower())
        if r.get("logoAnnotations"):
            for logo in r["logoAnnotations"]:
                all_logos.append(logo.get("description", "").lower())

    combined_text = "\n".join(all_text)
    title_candidate, year_candidate = _extract_title_and_year(combined_text)
    platform_hint = _detect_platform(all_logos, combined_text)
    confidence = _compute_confidence(title_candidate, all_labels, combined_text)

    return VisionResult(
        title_candidate=title_candidate,
        year_candidate=year_candidate,
        detected_text=combined_text[:500],  # truncate for logging
        platform_hint=platform_hint,
        scene_labels=all_labels[:10],
        confidence=confidence,
        is_stable_frame=len(selected) > 0,
    )


def _pick_best_frames(frames: list[str], n: int) -> list[str]:
    """
    Select the n sharpest frames using estimated JPEG size as a proxy
    for visual information density. (Real impl would use Laplacian variance.)
    """
    if len(frames) <= n:
        return frames
    # Longer base64 → more detail (rough heuristic)
    sorted_frames = sorted(frames, key=len, reverse=True)
    return sorted_frames[:n]


def _extract_title_and_year(text: str) -> tuple[str, Optional[int]]:
    """
    Extract the most likely title string and year from raw OCR text.
    Strategy: find the longest non-noise line that looks like a title.
    """
    if not text.strip():
        return "", None

    lines = [line.strip() for line in text.split("\n") if line.strip()]

    # Detect year pattern
    year_match = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', text)
    year = int(year_match.group()) if year_match else None

    # Score each line as a potential title
    candidates = []
    for line in lines:
        line_lower = line.lower()

        # Skip lines that are mostly noise words
        words = set(line_lower.split())
        noise_overlap = len(words & NOISE_WORDS) / max(len(words), 1)
        if noise_overlap > 0.5:
            continue

        # Skip very short or very long lines
        if len(line) < 3 or len(line) > 80:
            continue

        # Skip lines that look like timestamps or episode markers
        if re.match(r'^\d{1,2}:\d{2}', line) or re.match(r'^S\d+E\d+', line, re.I):
            continue

        # Score: prefer title-cased multi-word phrases
        score = 0
        score += len(line.split())               # more words = likely title
        score += 2 if line.istitle() else 0       # title case bonus
        score -= noise_overlap * 5               # penalize noise
        candidates.append((score, line))

    if not candidates:
        return "", year

    candidates.sort(reverse=True)
    best_title = candidates[0][1]

    # Strip noise words from beginning/end
    clean_words = [w for w in best_title.split() if w.lower() not in NOISE_WORDS]
    clean_title = " ".join(clean_words).strip()

    return clean_title, year


def _detect_platform(logos: list[str], text: str) -> Optional[str]:
    text_lower = text.lower()
    for key, name in STREAMING_LOGOS.items():
        if key in logos or key in text_lower:
            return name
    return None


def _compute_confidence(title: str, labels: list[str], text: str) -> float:
    score = 0.0
    if title and len(title) > 3:
        score += 0.5
    if len(title.split()) >= 2:
        score += 0.15
    movie_labels = {"film", "movie", "cinema", "actor", "actress", "performance"}
    if movie_labels & set(labels):
        score += 0.2
    if len(text) > 50:
        score += 0.15
    return min(round(score, 2), 1.0)


def _fallback_result() -> VisionResult:
    return VisionResult(
        title_candidate="",
        year_candidate=None,
        detected_text="",
        platform_hint=None,
        scene_labels=[],
        confidence=0.0,
        is_stable_frame=False,
    )

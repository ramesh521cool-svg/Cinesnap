"""
Vision Agent — Identifies content from camera frames using Claude Vision.
Sends the best frame to Claude and asks it to identify the movie/show on screen.
"""
import base64
import os
import re
from dataclasses import dataclass
from typing import Optional

import anthropic


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
    Send the best frame to Claude Vision and extract the movie/show title.
    """
    if not frames_b64:
        return _fallback_result()

    # Pick the largest frame (most detail)
    best_frame = max(frames_b64, key=len)

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    prompt = """Look at this image of a TV or screen. Identify what movie or TV show is playing.

Respond in this exact format:
TITLE: <title here>
YEAR: <year if visible, otherwise UNKNOWN>
PLATFORM: <streaming service if visible (Netflix, HBO, Disney+, etc.), otherwise UNKNOWN>
CONFIDENCE: <HIGH, MEDIUM, or LOW>
EXPLANATION: <one sentence about what visual clues you used>

If you cannot identify any movie or show, respond with:
TITLE: UNIDENTIFIED
YEAR: UNKNOWN
PLATFORM: UNKNOWN
CONFIDENCE: LOW
EXPLANATION: Could not identify content from this frame."""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": best_frame,
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ],
                }
            ],
        )

        response_text = message.content[0].text
        return _parse_claude_response(response_text)

    except Exception as e:
        return _fallback_result()


def _parse_claude_response(text: str) -> VisionResult:
    """Parse Claude's structured response into a VisionResult."""

    def extract(field: str) -> str:
        match = re.search(rf'^{field}:\s*(.+)$', text, re.MULTILINE | re.IGNORECASE)
        return match.group(1).strip() if match else ""

    title = extract("TITLE")
    year_str = extract("YEAR")
    platform = extract("PLATFORM")
    confidence_str = extract("CONFIDENCE").upper()
    explanation = extract("EXPLANATION")

    # Map confidence string to float
    confidence_map = {"HIGH": 0.90, "MEDIUM": 0.65, "LOW": 0.20}
    confidence = confidence_map.get(confidence_str, 0.20)

    # If Claude says unidentified
    if not title or title.upper() == "UNIDENTIFIED":
        return VisionResult(
            title_candidate="",
            year_candidate=None,
            detected_text=explanation,
            platform_hint=None,
            scene_labels=[],
            confidence=0.0,
            is_stable_frame=True,
        )

    # Parse year
    year = None
    if year_str and year_str.upper() != "UNKNOWN":
        year_match = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', year_str)
        if year_match:
            year = int(year_match.group())

    # Clean up platform
    platform_hint = None if (not platform or platform.upper() == "UNKNOWN") else platform

    return VisionResult(
        title_candidate=title,
        year_candidate=year,
        detected_text=explanation,
        platform_hint=platform_hint,
        scene_labels=["movie", "film"],
        confidence=confidence,
        is_stable_frame=True,
    )


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

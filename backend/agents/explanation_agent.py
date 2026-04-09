"""
Explanation Agent — Uses Claude to synthesize all collected data into
a human-readable explanation:
  - One-sentence summary verdict
  - 3–5 bullet pros
  - 2–3 bullet cons
  - Optional notable critic quote
"""
import os
import json
import re
from typing import Optional

import anthropic

from models.content import ContentMatch, FinalScore, Explanation
from models.review import ReviewBundle


async def generate_explanation(
    content: ContentMatch,
    score: FinalScore,
    bundle: ReviewBundle,
) -> Explanation:
    """
    Ask Claude to synthesize all available data into a concise explanation
    of why this content received its score.
    """
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # Build a compact context string for Claude
    sources_text = _format_sources(bundle)

    prompt = f"""You are CineSnap's honest review synthesizer. Based on the aggregated review data below,
write a brief, unbiased explanation of the score.

CONTENT: {content.title} ({content.year or 'year unknown'}) — {content.type.value}
GENRES: {', '.join(content.genre) if content.genre else 'unknown'}
FINAL SCORE: {score.final}/5.0 ({score.verdict.value})
CRITIC AVERAGE: {score.breakdown.critics or 'N/A'}
AUDIENCE AVERAGE: {score.breakdown.audience or 'N/A'}

REVIEW SOURCES:
{sources_text}

Respond with ONLY valid JSON in this exact structure:
{{
  "summary": "One confident sentence explaining the overall verdict.",
  "pros": ["Pro 1", "Pro 2", "Pro 3"],
  "cons": ["Con 1", "Con 2"],
  "notable_quote": "Optional short critic quote if available, else null"
}}

Rules:
- summary must be 1 sentence, max 20 words
- 2–4 pros, 1–3 cons
- Be specific, not generic (avoid "great acting" without context)
- Do not invent information not supported by the review data
- pros/cons should reflect what critics AND audiences actually said"""

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
            system="You are a concise, factual movie critic synthesizer. Output only valid JSON.",
        )
        text = response.content[0].text.strip()
        return _parse_explanation(text, score)
    except Exception:
        return _fallback_explanation(content, score)


def _format_sources(bundle: ReviewBundle) -> str:
    lines = []
    for s in bundle.sources:
        if not s.is_outlier:
            lines.append(f"- {s.name}: {s.raw} (normalized: {s.normalized}/5)")
    return "\n".join(lines) if lines else "No detailed source data available."


def _parse_explanation(text: str, score: FinalScore) -> Explanation:
    # Extract JSON from response
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if not match:
        return _fallback_explanation_from_score(score)

    try:
        data = json.loads(match.group())
        return Explanation(
            summary=data.get("summary", ""),
            pros=data.get("pros", [])[:4],
            cons=data.get("cons", [])[:3],
            notable_quote=data.get("notable_quote"),
        )
    except (json.JSONDecodeError, KeyError):
        return _fallback_explanation_from_score(score)


def _fallback_explanation(content: ContentMatch, score: FinalScore) -> Explanation:
    return _fallback_explanation_from_score(score)


def _fallback_explanation_from_score(score: FinalScore) -> Explanation:
    if score.verdict.value == "WATCH":
        summary = "Critics and audiences agree — this one is worth your time."
        pros = ["Highly rated by both critics and general audiences", "Strong consensus across review platforms"]
        cons = ["May not appeal to every taste"]
    elif score.verdict.value == "SKIP":
        summary = "Reviews suggest this doesn't live up to expectations."
        pros = ["Some viewers may find entertainment value"]
        cons = ["Below-average critical reception", "Audience scores reflect disappointment"]
    else:
        summary = "A divisive title — enjoyable for fans of the genre, less so for others."
        pros = ["Has a dedicated fanbase"]
        cons = ["Mixed critical reception", "Not universally recommended"]

    return Explanation(summary=summary, pros=pros, cons=cons)

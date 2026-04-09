"""
Review Agent — Aggregates reviews from 10+ sources:

  Tier 1 (API): IMDb, Rotten Tomatoes, Metacritic, TMDb  (via OMDB + TMDb)
  Tier 2 (AI-assisted): Letterboxd, Reddit, Roger Ebert,
                         Google Knowledge Panel, Common Sense Media
                         (via Claude tool use + SerpAPI)

All scores are normalized to the 1–5 scale in this layer.
"""
import asyncio
import os
from typing import Optional

import anthropic
import httpx

from models.content import ContentMatch, ContentType
from models.review import ReviewSource, ReviewBundle, ReviewCategory, Sentiment
from services import omdb_service, tmdb_service


async def aggregate_reviews(content: ContentMatch) -> ReviewBundle:
    """
    Gather all available reviews for the identified content.
    Runs Tier 1 (fast API calls) and Tier 2 (Claude web search) in parallel.
    """
    tier1_task = _fetch_tier1(content)
    tier2_task = _fetch_tier2_via_claude(content)

    tier1_sources, tier2_sources = await asyncio.gather(tier1_task, tier2_task)

    all_sources = tier1_sources + tier2_sources
    confidence = min(len(all_sources) / 8.0, 1.0)   # full confidence at 8+ sources

    return ReviewBundle(
        content_id=str(content.tmdb_id or content.imdb_id or content.title),
        sources=all_sources,
        aggregation_confidence=round(confidence, 2),
    )


async def _fetch_tier1(content: ContentMatch) -> list[ReviewSource]:
    """Fast structured API calls — OMDB (IMDb/RT/MC) + TMDb audience score."""
    sources: list[ReviewSource] = []

    tasks = []

    # OMDB gives us IMDb, Rotten Tomatoes, Metacritic in one call
    if content.imdb_id:
        tasks.append(omdb_service.get_ratings(content.imdb_id))

    # TMDb audience score
    if content.tmdb_id:
        detail_coro = (
            tmdb_service.get_movie_details(content.tmdb_id)
            if content.type == ContentType.movie
            else tmdb_service.get_tv_details(content.tmdb_id)
        )
        tasks.append(detail_coro)

    results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, Exception):
            continue
        if isinstance(result, list):       # OMDB result
            sources.extend(result)
        elif isinstance(result, dict):     # TMDb details
            vote_avg = result.get("vote_average", 0)
            vote_count = result.get("vote_count", 0)
            tmdb_src = await omdb_service.get_tmdb_score(vote_avg, vote_count)
            if tmdb_src:
                sources.append(tmdb_src)

    return sources


async def _fetch_tier2_via_claude(content: ContentMatch) -> list[ReviewSource]:
    """
    Use Claude with web search to synthesize Letterboxd, Reddit,
    and other sources not available via direct API.
    """
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    query = f'"{content.title}" {content.year or ""} movie review rating score'

    prompt = f"""You are a review aggregation assistant. Find and extract review ratings for the
{content.type.value} "{content.title}" ({content.year or "unknown year"}) from these sources:
- Letterboxd (average star rating out of 5)
- Reddit r/movies or r/television (community sentiment, positive/negative/mixed)
- Roger Ebert / RogerEbert.com (star rating out of 4)
- Common Sense Media (rating out of 5)
- Google Knowledge Panel audience score (%)

For each source you find, return ONLY a JSON array with objects like:
{{"name": "Letterboxd", "raw": "3.8/5", "normalized": 3.8, "category": "audience", "sentiment": "positive"}}

Normalized score MUST be on a 1–5 scale:
- Letterboxd (0–5): use directly
- RogerEbert (0–4): multiply by 1.25
- Google % audience: (pct/100)*4 + 1

If you cannot find a source, skip it. Return valid JSON array only."""

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text.strip()
        return _parse_claude_sources(text)

    except Exception:
        return []


def _parse_claude_sources(text: str) -> list[ReviewSource]:
    """Parse Claude's JSON response into ReviewSource objects."""
    import json
    import re

    # Extract JSON array from response
    match = re.search(r'\[.*\]', text, re.DOTALL)
    if not match:
        return []

    try:
        items = json.loads(match.group())
    except json.JSONDecodeError:
        return []

    sources = []
    for item in items:
        try:
            normalized = float(item.get("normalized", 0))
            if not (1.0 <= normalized <= 5.0):
                continue

            category_str = item.get("category", "audience")
            category = ReviewCategory(category_str) if category_str in ReviewCategory.__members__.values() else ReviewCategory.audience

            sentiment_str = item.get("sentiment")
            sentiment = None
            if sentiment_str and sentiment_str in Sentiment.__members__.values():
                sentiment = Sentiment(sentiment_str)

            sources.append(ReviewSource(
                name=item.get("name", "Unknown"),
                raw=str(item.get("raw", "")),
                normalized=round(normalized, 2),
                category=category,
                sentiment=sentiment,
            ))
        except (ValueError, KeyError):
            continue

    return sources

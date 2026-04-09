"""
Search Agent — Resolves a title candidate from VisionAgent into a
confirmed ContentMatch using TMDb + OMDB cross-reference.

Strategy:
  1. TMDb text search (movie + TV in parallel)
  2. Fuzzy title match with Levenshtein distance
  3. OMDB cross-reference to get IMDb ID for ratings pipeline
  4. Return the best match above confidence threshold
"""
import os
from difflib import SequenceMatcher
from typing import Optional

from agents.vision_agent import VisionResult
from models.content import ContentMatch, ContentType
from services import tmdb_service, omdb_service


MIN_CONFIDENCE = 0.45   # Below this we return None (unidentified)


async def resolve_content(vision: VisionResult) -> Optional[ContentMatch]:
    """
    Given a VisionResult, find the best matching content on TMDb.
    Returns None if no confident match is found.
    """
    if not vision.title_candidate or vision.confidence < 0.2:
        return None

    # Search TMDb
    candidates = await tmdb_service.search_content(
        query=vision.title_candidate,
        year=vision.year_candidate,
    )

    if not candidates:
        return None

    # Re-rank by string similarity to the extracted title
    ranked = _rank_by_similarity(vision.title_candidate, candidates)

    best = ranked[0] if ranked else None
    if best is None or best.match_confidence < MIN_CONFIDENCE:
        return None

    # Enrich with full details (director, runtime, imdb_id, genres)
    best = await _enrich_match(best)

    return best


def _rank_by_similarity(query: str, candidates: list[ContentMatch]) -> list[ContentMatch]:
    """Re-rank candidates using title string similarity."""
    query_lower = query.lower().strip()

    def similarity_score(match: ContentMatch) -> float:
        title_sim = SequenceMatcher(
            None, query_lower, match.title.lower()
        ).ratio()
        # Combine similarity with TMDb popularity-based confidence
        return title_sim * 0.6 + match.match_confidence * 0.4

    scored = [(similarity_score(c), c) for c in candidates]
    scored.sort(key=lambda x: x[0], reverse=True)

    # Update confidence to reflect combined score
    results = []
    for score, match in scored:
        match.match_confidence = round(score, 2)
        results.append(match)

    return results


async def _enrich_match(match: ContentMatch) -> ContentMatch:
    """Fetch full details and IMDb ID for the matched content."""
    if match.type == ContentType.movie and match.tmdb_id:
        details = await tmdb_service.get_movie_details(match.tmdb_id)
        if details:
            match = _apply_movie_details(match, details)

    elif match.type == ContentType.tv_show and match.tmdb_id:
        details = await tmdb_service.get_tv_details(match.tmdb_id)
        if details:
            match = _apply_tv_details(match, details)

    return match


def _apply_movie_details(match: ContentMatch, details: dict) -> ContentMatch:
    match.imdb_id = details.get("imdb_id") or (
        details.get("external_ids", {}).get("imdb_id")
    )
    match.runtime_min = details.get("runtime")
    match.language = details.get("original_language", match.language)

    genres = [g["name"] for g in details.get("genres", [])]
    match.genre = genres

    credits = details.get("credits", {})
    crew = credits.get("crew", [])
    directors = [p["name"] for p in crew if p.get("job") == "Director"]
    if directors:
        match.director = directors[0]

    return match


def _apply_tv_details(match: ContentMatch, details: dict) -> ContentMatch:
    ext_ids = details.get("external_ids", {})
    match.imdb_id = ext_ids.get("imdb_id")
    match.language = details.get("original_language", match.language)

    genres = [g["name"] for g in details.get("genres", [])]
    match.genre = genres

    credits = details.get("credits", {})
    crew = credits.get("crew", [])
    creators = details.get("created_by", [])
    if creators:
        match.director = creators[0].get("name")

    return match

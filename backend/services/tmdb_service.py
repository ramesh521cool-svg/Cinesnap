"""
TMDb API service — movie/TV metadata and poster images.
Docs: https://developer.themoviedb.org/docs
"""
import httpx
import os
from typing import Optional
from models.content import ContentMatch, ContentType


TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"


async def search_content(query: str, year: Optional[int] = None) -> list[ContentMatch]:
    """Text search TMDb for movies and TV shows matching the query."""
    api_key = os.environ["TMDB_API_KEY"]
    params = {"api_key": api_key, "query": query, "include_adult": False}
    if year:
        params["year"] = year

    async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
        # Search both movies and TV in parallel
        movie_resp, tv_resp = await _parallel_search(client, api_key, query, year)

    results: list[ContentMatch] = []

    for item in (movie_resp.get("results") or [])[:3]:
        results.append(_tmdb_movie_to_match(item))

    for item in (tv_resp.get("results") or [])[:3]:
        results.append(_tmdb_tv_to_match(item))

    # Sort by popularity proxy (vote count * vote average)
    results.sort(key=lambda x: x.match_confidence, reverse=True)
    return results


async def _parallel_search(client, api_key, query, year):
    import asyncio
    movie_task = client.get(f"{TMDB_BASE}/search/movie", params={
        "api_key": api_key, "query": query, "year": year or ""
    })
    tv_task = client.get(f"{TMDB_BASE}/search/tv", params={
        "api_key": api_key, "query": query
    })
    movie_resp, tv_resp = await asyncio.gather(movie_task, tv_task)
    return movie_resp.json(), tv_resp.json()


async def get_movie_details(tmdb_id: int) -> Optional[dict]:
    """Fetch full movie details including credits."""
    api_key = os.environ["TMDB_API_KEY"]
    async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
        resp = await client.get(
            f"{TMDB_BASE}/movie/{tmdb_id}",
            params={"api_key": api_key, "append_to_response": "credits,external_ids"}
        )
    if resp.status_code != 200:
        return None
    return resp.json()


async def get_tv_details(tmdb_id: int) -> Optional[dict]:
    """Fetch full TV show details."""
    api_key = os.environ["TMDB_API_KEY"]
    async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
        resp = await client.get(
            f"{TMDB_BASE}/tv/{tmdb_id}",
            params={"api_key": api_key, "append_to_response": "credits,external_ids"}
        )
    if resp.status_code != 200:
        return None
    return resp.json()


def _tmdb_movie_to_match(item: dict) -> ContentMatch:
    year = None
    if item.get("release_date"):
        try:
            year = int(item["release_date"][:4])
        except (ValueError, IndexError):
            pass

    poster = None
    if item.get("poster_path"):
        poster = f"{TMDB_IMAGE_BASE}{item['poster_path']}"

    # Use vote_count as proxy for confidence/popularity
    vote_count = item.get("vote_count", 0)
    vote_avg = item.get("vote_average", 0)
    confidence = min((vote_count / 5000) * (vote_avg / 10), 1.0)

    return ContentMatch(
        title=item.get("title", "Unknown"),
        year=year,
        type=ContentType.movie,
        poster_url=poster,
        tmdb_id=item.get("id"),
        language=item.get("original_language", "en"),
        match_confidence=round(confidence, 2),
    )


def _tmdb_tv_to_match(item: dict) -> ContentMatch:
    year = None
    if item.get("first_air_date"):
        try:
            year = int(item["first_air_date"][:4])
        except (ValueError, IndexError):
            pass

    poster = None
    if item.get("poster_path"):
        poster = f"{TMDB_IMAGE_BASE}{item['poster_path']}"

    vote_count = item.get("vote_count", 0)
    vote_avg = item.get("vote_average", 0)
    confidence = min((vote_count / 3000) * (vote_avg / 10), 1.0)

    return ContentMatch(
        title=item.get("name", "Unknown"),
        year=year,
        type=ContentType.tv_show,
        poster_url=poster,
        tmdb_id=item.get("id"),
        language=item.get("original_language", "en"),
        match_confidence=round(confidence, 2),
    )

"""
OMDB API service — fetches IMDb, Rotten Tomatoes, and Metacritic
ratings for a given IMDb ID.
Docs: https://www.omdbapi.com/
"""
import httpx
import os
from typing import Optional
from models.review import ReviewSource, ReviewCategory, Sentiment


OMDB_BASE = "http://www.omdbapi.com/"


async def get_ratings(imdb_id: str) -> list[ReviewSource]:
    """
    Fetch all available ratings from OMDB for the given IMDb ID.
    Returns a list of normalized ReviewSource objects.
    """
    api_key = os.environ["OMDB_API_KEY"]
    async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
        resp = await client.get(OMDB_BASE, params={
            "apikey": api_key,
            "i": imdb_id,
            "tomatoes": True,
        })

    if resp.status_code != 200:
        return []

    data = resp.json()
    if data.get("Response") == "False":
        return []

    sources: list[ReviewSource] = []

    # IMDb user rating
    imdb_raw = data.get("imdbRating")
    imdb_votes = data.get("imdbVotes", "0").replace(",", "")
    if imdb_raw and imdb_raw != "N/A":
        try:
            normalized = float(imdb_raw) / 2.0
            sources.append(ReviewSource(
                name="IMDb",
                raw=f"{imdb_raw}/10",
                normalized=round(normalized, 2),
                category=ReviewCategory.audience,
                review_count=int(imdb_votes) if imdb_votes.isdigit() else None,
                url=f"https://www.imdb.com/title/{imdb_id}/",
            ))
        except ValueError:
            pass

    # Parse the Ratings array (includes RT and Metacritic)
    for rating in data.get("Ratings", []):
        source = _parse_rating_entry(rating)
        if source:
            sources.append(source)

    return sources


def _parse_rating_entry(rating: dict) -> Optional[ReviewSource]:
    source_name = rating.get("Source", "")
    value = rating.get("Value", "")

    if source_name == "Rotten Tomatoes":
        if "%" in value:
            try:
                pct = float(value.replace("%", ""))
                # RT critic score: 0–100% → 1–5
                normalized = (pct / 100) * 4.0 + 1.0
                return ReviewSource(
                    name="Rotten Tomatoes",
                    raw=value,
                    normalized=round(normalized, 2),
                    category=ReviewCategory.critics,
                    url="https://www.rottentomatoes.com/",
                )
            except ValueError:
                pass

    elif source_name == "Metacritic":
        if "/" in value:
            try:
                score = float(value.split("/")[0])
                # Metacritic: 0–100 → 1–5
                normalized = (score / 100) * 4.0 + 1.0
                return ReviewSource(
                    name="Metacritic",
                    raw=value,
                    normalized=round(normalized, 2),
                    category=ReviewCategory.critics,
                    url="https://www.metacritic.com/",
                )
            except ValueError:
                pass

    elif source_name == "Internet Movie Database":
        # Duplicate of imdbRating — skip
        pass

    return None


async def get_tmdb_score(tmdb_vote_average: float, vote_count: int) -> Optional[ReviewSource]:
    """Convert TMDb vote average to a ReviewSource."""
    if tmdb_vote_average <= 0 or vote_count < 10:
        return None
    normalized = tmdb_vote_average / 2.0
    return ReviewSource(
        name="TMDb",
        raw=f"{tmdb_vote_average}/10",
        normalized=round(normalized, 2),
        category=ReviewCategory.audience,
        review_count=vote_count,
        url="https://www.themoviedb.org/",
    )

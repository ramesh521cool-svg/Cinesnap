from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class ContentType(str, Enum):
    movie = "movie"
    tv_show = "tv_show"
    documentary = "documentary"
    unknown = "unknown"


class Verdict(str, Enum):
    watch = "WATCH"
    skip = "SKIP"
    optional = "OPTIONAL"


class ContentMatch(BaseModel):
    title: str
    year: Optional[int] = None
    type: ContentType = ContentType.unknown
    genre: List[str] = []
    poster_url: Optional[str] = None
    tmdb_id: Optional[int] = None
    imdb_id: Optional[str] = None
    director: Optional[str] = None
    runtime_min: Optional[int] = None
    language: str = "en"
    match_confidence: float = Field(ge=0.0, le=1.0)
    # TV-specific
    episode_title: Optional[str] = None
    season: Optional[int] = None
    episode: Optional[int] = None


class ScoreBreakdown(BaseModel):
    critics: Optional[float] = None
    audience: Optional[float] = None
    sentiment: Optional[float] = None


class FinalScore(BaseModel):
    final: float = Field(ge=1.0, le=5.0)
    verdict: Verdict
    confidence: float = Field(ge=0.0, le=1.0)
    breakdown: ScoreBreakdown


class Explanation(BaseModel):
    summary: str
    pros: List[str]
    cons: List[str]
    notable_quote: Optional[str] = None


class ScanStatus(str, Enum):
    processing = "processing"
    complete = "complete"
    unidentified = "unidentified"
    error = "error"


class ScanResult(BaseModel):
    scan_id: str
    status: ScanStatus
    content: Optional[ContentMatch] = None
    score: Optional[FinalScore] = None
    sources: List[dict] = []
    explanation: Optional[Explanation] = None
    processing_ms: Optional[int] = None
    # For unidentified results
    reason: Optional[str] = None
    suggestions: List[str] = []
    partial_match: Optional[dict] = None

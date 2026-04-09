from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class ReviewCategory(str, Enum):
    critics = "critics"
    audience = "audience"
    sentiment = "sentiment"


class Sentiment(str, Enum):
    positive = "positive"
    negative = "negative"
    neutral = "neutral"
    mixed = "mixed"


class ReviewSource(BaseModel):
    name: str
    raw: str                          # Original display value e.g. "8.9/10"
    normalized: float = Field(ge=1.0, le=5.0)   # Normalized to 1–5 scale
    category: ReviewCategory
    sentiment: Optional[Sentiment] = None
    review_count: Optional[int] = None          # Number of reviews behind score
    url: Optional[str] = None
    is_outlier: bool = False          # Flagged by outlier detection


class ReviewBundle(BaseModel):
    content_id: str                   # tmdb_id or imdb_id
    sources: list[ReviewSource]
    aggregation_confidence: float = Field(ge=0.0, le=1.0, default=0.0)

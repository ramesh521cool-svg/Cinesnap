"""
Scoring Agent — Honest Score Engine

Algorithm:
  1. Normalize all scores to [1.0, 5.0]         (done in ReviewAgent)
  2. Detect and remove outliers (Z-score > 2.0)
  3. Split into critic / audience / sentiment buckets
  4. Weighted average: critics 40%, audience 40%, sentiment 20%
  5. Compute confidence: coverage × agreement × vision_confidence
  6. Map final score to Watch / Skip / Optional verdict

All math is deterministic — no LLM involved here.
"""
import math
from models.content import FinalScore, ScoreBreakdown, Verdict
from models.review import ReviewBundle, ReviewCategory


# Bucket weights
WEIGHT_CRITICS   = 0.40
WEIGHT_AUDIENCE  = 0.40
WEIGHT_SENTIMENT = 0.20

# Verdict thresholds
WATCH_THRESHOLD    = 3.8
OPTIONAL_THRESHOLD = 2.5   # below this → SKIP


def compute_score(bundle: ReviewBundle, vision_confidence: float = 1.0) -> FinalScore:
    """
    Compute the final CineSnap score from a ReviewBundle.
    Returns a FinalScore with verdict and confidence.
    """
    sources = bundle.sources

    if not sources:
        return FinalScore(
            final=3.0,
            verdict=Verdict.optional,
            confidence=0.0,
            breakdown=ScoreBreakdown(),
        )

    # Step 1: Remove outliers within the full set
    clean_sources = _remove_outliers([s.normalized for s in sources], sources)

    # Step 2: Split into buckets
    critics   = [s.normalized for s in clean_sources if s.category == ReviewCategory.critics]
    audience  = [s.normalized for s in clean_sources if s.category == ReviewCategory.audience]
    sentiment = [s.normalized for s in clean_sources if s.category == ReviewCategory.sentiment]

    # Step 3: Bucket averages
    avg_critics   = _mean(critics)
    avg_audience  = _mean(audience)
    avg_sentiment = _mean(sentiment)

    # Step 4: Weighted final score
    weights_used = []
    bucket_scores = []

    if avg_critics is not None:
        bucket_scores.append(avg_critics * WEIGHT_CRITICS)
        weights_used.append(WEIGHT_CRITICS)
    if avg_audience is not None:
        bucket_scores.append(avg_audience * WEIGHT_AUDIENCE)
        weights_used.append(WEIGHT_AUDIENCE)
    if avg_sentiment is not None:
        bucket_scores.append(avg_sentiment * WEIGHT_SENTIMENT)
        weights_used.append(WEIGHT_SENTIMENT)

    if not bucket_scores:
        final_score = 3.0
    else:
        total_weight = sum(weights_used)
        final_score = sum(bucket_scores) / total_weight

    final_score = round(max(1.0, min(5.0, final_score)), 1)

    # Step 5: Confidence
    all_clean_scores = [s.normalized for s in clean_sources]
    n_sources = len(all_clean_scores)

    coverage_factor    = min(n_sources / 8.0, 1.0)
    agreement_factor   = max(0.0, 1.0 - _std(all_clean_scores) / 2.0) if len(all_clean_scores) > 1 else 0.5
    vision_factor      = vision_confidence

    confidence = coverage_factor * agreement_factor * vision_factor
    confidence = round(max(0.0, min(1.0, confidence)), 2)

    # Step 6: Verdict
    if final_score >= WATCH_THRESHOLD:
        verdict = Verdict.watch
    elif final_score >= OPTIONAL_THRESHOLD:
        verdict = Verdict.optional
    else:
        verdict = Verdict.skip

    return FinalScore(
        final=final_score,
        verdict=verdict,
        confidence=confidence,
        breakdown=ScoreBreakdown(
            critics=round(avg_critics, 2) if avg_critics is not None else None,
            audience=round(avg_audience, 2) if avg_audience is not None else None,
            sentiment=round(avg_sentiment, 2) if avg_sentiment is not None else None,
        ),
    )


def _remove_outliers(scores: list[float], sources) -> list:
    """Remove sources whose score is more than 2 standard deviations from the mean."""
    if len(scores) < 3:
        return sources  # Too few to meaningful outlier-detect

    mu = _mean(scores)
    sigma = _std(scores)

    if sigma == 0:
        return sources

    clean = []
    for source in sources:
        z = abs(source.normalized - mu) / sigma
        if z <= 2.0:
            clean.append(source)
        else:
            # Mark as outlier but keep in bundle for transparency
            source.is_outlier = True

    return clean if clean else sources  # fallback: keep all if all are outliers


def _mean(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def _std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mu = sum(values) / len(values)
    variance = sum((x - mu) ** 2 for x in values) / len(values)
    return math.sqrt(variance)

"""
Scan router — the core API surface.
Exposes:
  POST /scan/frame   → submit frames, get scan_id
  GET  /scan/result/{scan_id}  → poll for result
  WS   /scan/stream/{scan_id}  → real-time progress events
"""
import asyncio
import time
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from agents import vision_agent, search_agent, review_agent, scoring_agent, explanation_agent
from models.content import ScanResult, ScanStatus

router = APIRouter(prefix="/scan", tags=["scan"])

# In-memory scan store (replace with Redis in production)
_scan_store: dict[str, ScanResult] = {}
_progress_store: dict[str, dict] = {}
_ws_connections: dict[str, list[WebSocket]] = {}


class ScanFrameRequest(BaseModel):
    frames: list[str]          # base64-encoded JPEG frames
    device_id: str
    timestamp: Optional[int] = None


class SearchByTitleRequest(BaseModel):
    title: str
    device_id: str = "web"


@router.post("/search", status_code=202)
async def search_by_title(request: SearchByTitleRequest, background_tasks: BackgroundTasks):
    """
    Bypass camera — search directly by title string.
    Used by the web demo manual search and quick-pick buttons.
    """
    if not request.title.strip():
        raise HTTPException(status_code=422, detail="Title is required")

    scan_id = f"scan_{uuid.uuid4().hex[:8]}"
    _scan_store[scan_id] = ScanResult(scan_id=scan_id, status=ScanStatus.processing)
    _progress_store[scan_id] = {"stage": "search", "progress": 0.1}

    background_tasks.add_task(_run_title_pipeline, scan_id, request.title.strip())

    return {"scan_id": scan_id, "status": "processing", "estimated_ms": 3000}


@router.post("/frame", status_code=202)
async def submit_frame(request: ScanFrameRequest, background_tasks: BackgroundTasks):
    """Accept camera frames and kick off the async scan pipeline."""
    if not request.frames:
        raise HTTPException(status_code=422, detail="No frames provided")
    if len(request.frames) > 5:
        request.frames = request.frames[:5]

    scan_id = f"scan_{uuid.uuid4().hex[:8]}"
    _scan_store[scan_id] = ScanResult(scan_id=scan_id, status=ScanStatus.processing)
    _progress_store[scan_id] = {"stage": "vision", "progress": 0.0}

    background_tasks.add_task(_run_pipeline, scan_id, request.frames)

    return {"scan_id": scan_id, "status": "processing", "estimated_ms": 3500}


@router.get("/result/{scan_id}")
async def get_result(scan_id: str):
    """Poll for the result of a previously submitted scan."""
    result = _scan_store.get(scan_id)
    if not result:
        raise HTTPException(status_code=404, detail="Scan not found")

    if result.status == ScanStatus.processing:
        progress = _progress_store.get(scan_id, {})
        return {
            "scan_id": scan_id,
            "status": "processing",
            "stage": progress.get("stage", "unknown"),
            "progress": progress.get("progress", 0.0),
        }

    return result


@router.websocket("/stream/{scan_id}")
async def stream_progress(websocket: WebSocket, scan_id: str):
    """WebSocket endpoint for real-time scan stage updates."""
    await websocket.accept()

    if scan_id not in _ws_connections:
        _ws_connections[scan_id] = []
    _ws_connections[scan_id].append(websocket)

    try:
        # Keep alive until scan completes or client disconnects
        while True:
            result = _scan_store.get(scan_id)
            if result and result.status in (ScanStatus.complete, ScanStatus.unidentified, ScanStatus.error):
                await websocket.send_json({"event": "complete", "scan_id": scan_id})
                break
            await asyncio.sleep(0.3)
    except WebSocketDisconnect:
        pass
    finally:
        if scan_id in _ws_connections:
            _ws_connections[scan_id] = [
                ws for ws in _ws_connections[scan_id] if ws != websocket
            ]


async def _run_pipeline(scan_id: str, frames_b64: list[str]):
    """
    The full 5-stage pipeline. Runs asynchronously in the background.
    Pushes stage updates to any connected WebSocket clients.
    """
    start_ms = int(time.time() * 1000)

    async def push_update(stage: str, progress: float, data: dict = {}):
        _progress_store[scan_id] = {"stage": stage, "progress": progress}
        for ws in _ws_connections.get(scan_id, []):
            try:
                await ws.send_json({
                    "event": "stage_update",
                    "stage": stage,
                    "progress": progress,
                    **data
                })
            except Exception:
                pass

    try:
        # ── Stage 1: Vision ────────────────────────────────────────
        await push_update("vision", 0.1)
        vision_result = await vision_agent.analyze_frames(frames_b64)
        await push_update("vision", 0.25, {"confidence": vision_result.confidence})

        if vision_result.confidence < 0.2:
            _scan_store[scan_id] = ScanResult(
                scan_id=scan_id,
                status=ScanStatus.unidentified,
                reason="low_vision_confidence",
                suggestions=[
                    "Point camera directly at the title card",
                    "Wait for subtitles or opening credits",
                    "Reduce screen glare and ambient light",
                    "Move closer to the screen",
                ],
                partial_match={
                    "title_candidate": vision_result.title_candidate,
                    "confidence": vision_result.confidence,
                },
            )
            return

        # ── Stage 2: Search ────────────────────────────────────────
        await push_update("search", 0.35)
        content = await search_agent.resolve_content(vision_result)

        if not content:
            _scan_store[scan_id] = ScanResult(
                scan_id=scan_id,
                status=ScanStatus.unidentified,
                reason="content_not_found",
                suggestions=[
                    f'Search manually for: "{vision_result.title_candidate}"',
                    "Try scanning during a clearer scene",
                    "Ensure the screen is fully visible",
                ],
                partial_match={"title_candidate": vision_result.title_candidate, "confidence": vision_result.confidence},
            )
            return

        await push_update("search", 0.50, {"title": content.title})

        # ── Stages 3+4: Reviews + Scoring (parallel) ───────────────
        await push_update("reviews", 0.55)
        bundle = await review_agent.aggregate_reviews(content)
        await push_update("scoring", 0.75)
        score = scoring_agent.compute_score(bundle, vision_confidence=vision_result.confidence)

        # ── Stage 5: Explanation ───────────────────────────────────
        await push_update("explanation", 0.85)
        explanation = await explanation_agent.generate_explanation(content, score, bundle)

        end_ms = int(time.time() * 1000)

        _scan_store[scan_id] = ScanResult(
            scan_id=scan_id,
            status=ScanStatus.complete,
            content=content,
            score=score,
            sources=[
                {
                    "name": s.name,
                    "raw": s.raw,
                    "normalized": s.normalized,
                    "category": s.category.value,
                    "sentiment": s.sentiment.value if s.sentiment else None,
                    "is_outlier": s.is_outlier,
                }
                for s in bundle.sources
            ],
            explanation=explanation,
            processing_ms=end_ms - start_ms,
        )

    except Exception as exc:
        _scan_store[scan_id] = ScanResult(
            scan_id=scan_id,
            status=ScanStatus.error,
            reason=str(exc),
            suggestions=["Please try again", "Check your internet connection"],
        )


async def _run_title_pipeline(scan_id: str, title: str):
    """
    Simplified pipeline for manual title search — skips Vision agent entirely.
    Injects a synthetic VisionResult with the given title and confidence 1.0.
    """
    start_ms = int(time.time() * 1000)

    async def push(stage: str, progress: float):
        _progress_store[scan_id] = {"stage": stage, "progress": progress}

    try:
        # ── Stage 1: Synthetic Vision (skip real OCR) ──────────────
        await push("vision", 0.05)
        from agents.vision_agent import VisionResult
        vision_result = VisionResult(
            title_candidate=title,
            year_candidate=None,
            detected_text=title,
            platform_hint=None,
            scene_labels=["movie", "film"],
            confidence=0.95,
            is_stable_frame=True,
        )
        await push("vision", 0.20)

        # ── Stage 2: Search ────────────────────────────────────────
        await push("search", 0.30)
        content = await search_agent.resolve_content(vision_result)

        if not content:
            _scan_store[scan_id] = ScanResult(
                scan_id=scan_id,
                status=ScanStatus.unidentified,
                reason="content_not_found",
                suggestions=[
                    f'No results found for "{title}"',
                    "Check the spelling and try again",
                    "Try the full original title",
                ],
                partial_match={"title_candidate": title, "confidence": 0.0},
            )
            return

        await push("search", 0.45)

        # ── Stage 3: Reviews ───────────────────────────────────────
        await push("reviews", 0.55)
        bundle = await review_agent.aggregate_reviews(content)

        # ── Stage 4: Scoring ───────────────────────────────────────
        await push("scoring", 0.75)
        score = scoring_agent.compute_score(bundle, vision_confidence=1.0)

        # ── Stage 5: Explanation ───────────────────────────────────
        await push("explanation", 0.87)
        explanation = await explanation_agent.generate_explanation(content, score, bundle)

        end_ms = int(time.time() * 1000)

        _scan_store[scan_id] = ScanResult(
            scan_id=scan_id,
            status=ScanStatus.complete,
            content=content,
            score=score,
            sources=[
                {
                    "name": s.name,
                    "raw": s.raw,
                    "normalized": s.normalized,
                    "category": s.category.value,
                    "sentiment": s.sentiment.value if s.sentiment else None,
                    "is_outlier": s.is_outlier,
                }
                for s in bundle.sources
            ],
            explanation=explanation,
            processing_ms=end_ms - start_ms,
        )

    except Exception as exc:
        _scan_store[scan_id] = ScanResult(
            scan_id=scan_id,
            status=ScanStatus.error,
            reason=str(exc),
            suggestions=["Please try again", "Check your internet connection"],
        )

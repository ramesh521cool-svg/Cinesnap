"""
CineSnap Backend — FastAPI entry point.

Run:
    uvicorn main:app --reload --port 8000
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from routers.scan import router as scan_router


load_dotenv()

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate required env vars on startup
    required = ["ANTHROPIC_API_KEY", "TMDB_API_KEY", "OMDB_API_KEY", "GOOGLE_VISION_API_KEY"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")
    yield


app = FastAPI(
    title="CineSnap API",
    description="Point your camera at any screen — instantly know: Watch, Skip, or Optional?",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan_router, prefix="/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "cinesnap-api"}


# ── Serve frontend static files ───────────────────────────────────────────────
# This makes the FastAPI server ALSO serve the web UI, so one Railway
# deployment gives you both the API and the app at the same URL.
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/", include_in_schema=False)
    async def serve_ui():
        return FileResponse(str(STATIC_DIR / "index.html"))


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."}},
    )

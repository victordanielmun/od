"""FastAPI application entrypoint."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.init_db import init_db
from app.api.endpoints import words, recording, analysis, auth, progress, achievements
from app.api.endpoints import challenges, learning_profile

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    # Startup: create tables & seed
    init_db()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.TTS_CACHE_DIR, exist_ok=True)
    yield
    # Shutdown (nothing special for now)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(words.router)
app.include_router(recording.router)
app.include_router(analysis.router)
app.include_router(progress.router)
app.include_router(achievements.router)
# ── English Learning System ────────────────────────────────
app.include_router(challenges.router)
app.include_router(learning_profile.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}

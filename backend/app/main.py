from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import hub, ielts, auth
from app.core.config import settings
from app.database import create_db_and_tables

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Replace deprecated on_event('startup') with modern lifespan handler."""
    logger.info("Starting IELTS Daily API — initialising database...")
    create_db_and_tables()
    logger.info("Database ready.")
    yield
    logger.info("Shutting down IELTS Daily API.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(hub.router, prefix="/api/hub", tags=["Knowledge Hub"])
app.include_router(ielts.router, prefix="/api/ielts", tags=["IELTS Modules"])


# ── Health ────────────────────────────────────────────────────────────────
@app.get("/")
def health_check():
    return {"status": "healthy"}

"""
app/services/scraper.py
─────────────────────────────────────────────────────────────────────────────
Media scraper for vocabulary cards.

Image strategy (in order):
  1. DuckDuckGo DDGS images (via the renamed `ddgs` package)
  2. Fallback: Unsplash Source URL (free, no key, always returns an image)

News strategy:
  DuckDuckGo DDGS text search (news snippets).

The DDGS library is synchronous; we run it in asyncio.to_thread() so the
FastAPI event loop stays free.
"""
from __future__ import annotations

import asyncio
import logging
import urllib.parse

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Unsplash Source fallback — returns a stable CDN URL for any keyword.
# No API key needed. Format: https://source.unsplash.com/featured/?{query}
# ---------------------------------------------------------------------------
def _unsplash_url(query: str) -> str:
    encoded = urllib.parse.quote_plus(query)
    return f"https://source.unsplash.com/400x300/?{encoded}"


import random
import time

def _scrape_sync(query: str, max_images: int, max_news: int) -> dict:
    """Blocking scrape — called from a thread pool, with retries."""
    images: list[str] = []
    news: list[str] = []

    def safe_ddgs_call(func_name, *args, **kwargs):
        """Helper to retry DDGS calls with backoff."""
        from ddgs import DDGS
        for attempt in range(3):
            try:
                with DDGS(timeout=20) as ddgs:
                    if func_name == "images":
                        return list(ddgs.images(*args, **kwargs))
                    if func_name == "text":
                        return list(ddgs.text(*args, **kwargs))
            except Exception as e:
                if "403" in str(e) and attempt < 2:
                    time.sleep(1.5 * (attempt + 1)) # exponential backoff
                    continue
                logger.warning("DDGS %s failed (attempt %d): %s", func_name, attempt+1, e)
                break
        return []

    # ── Images via DDGS ──────────────────────────────────────────────────
    img_results = safe_ddgs_call("images", query, max_results=max_images)
    images = [r["image"] for r in img_results if "image" in r]

    # ── Fallback: Unsplash Source ────────────────────────────────────────
    if not images:
        logger.info("Using Unsplash Source fallback for '%s'", query)
        images = [_unsplash_url(query)]

    # ── News snippets via DDGS text search ──────────────────────────────
    text_results = safe_ddgs_call("text", f"{query} meaning example", max_results=max_news)
    news = [r["body"] for r in text_results if "body" in r]

    return {"images": images, "news": news}


async def get_media_for_word(query: str, max_images: int = 3, max_news: int = 2) -> dict:
    """
    Non-blocking async wrapper. Runs the synchronous DDGS scrape inside
    a thread pool so the event loop stays free during I/O wait.
    """
    return await asyncio.to_thread(_scrape_sync, query, max_images, max_news)

"""POST /api/ingest — accept two URLs, return metadata for both videos."""

from __future__ import annotations

import asyncio
import logging
import traceback

from fastapi import APIRouter, HTTPException, Request

from app.db import get_pool
from app.embeddings import get_embedder
from app.schemas import IngestRequest, IngestResponse
from app.services.ingest import ingest_video

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest(req: IngestRequest, request: Request) -> IngestResponse:
    """Ingest both videos concurrently.

    Both URLs run in parallel via asyncio.gather. Any exception from either
    call is captured (not just our typed ones) so the browser sees a real
    error message instead of a generic 500. Full traceback is logged
    server-side for debugging.
    """
    pool = get_pool(request.app)
    embedder = get_embedder(request.app)

    async def _safe(label: str, url: str) -> object:
        try:
            return await ingest_video(pool, embedder, url)
        except Exception as e:  # noqa: BLE001 — we log + surface every type
            tb = traceback.format_exc()
            logger.error("ingest failed for %s (%s):\n%s", label, url, tb)
            # Wrap with a label so the user knows which URL broke
            return RuntimeError(f"{label}: {type(e).__name__}: {e}")

    # Run sequentially (not concurrently) — Render free tier is 512 MB and
    # two simultaneous ingest pipelines (yt-dlp + embedding) cause OOM kills.
    result_a = await _safe("video A", str(req.url_a))
    result_b = await _safe("video B", str(req.url_b))
    results = [result_a, result_b]

    failures = [r for r in results if isinstance(r, Exception)]
    if failures:
        # Concatenate all failures so the user sees both if both broke.
        detail = " | ".join(str(f) for f in failures)
        raise HTTPException(status_code=400, detail=detail)

    return IngestResponse(video_a=results[0], video_b=results[1])  # type: ignore[arg-type]

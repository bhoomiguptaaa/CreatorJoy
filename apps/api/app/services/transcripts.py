"""Transcript fetcher with two-stage fallback.

Stage 1 (free, fast):  ``youtube-transcript-api`` — pulls native captions
                       (auto-generated or manually uploaded).
Stage 2 (paid, robust): ``yt-dlp`` audio download → Groq Whisper Large V3.

Returns a normalized list of ``TranscriptSegment`` objects regardless of
which path produced them, plus a ``source`` tag the ingest layer stores
on the video row for analytics.
"""

from __future__ import annotations

import asyncio
import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import httpx
from groq import AsyncGroq
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

from app.config import settings
from app.services.youtube import download_audio

logger = logging.getLogger(__name__)

# Supadata free tier rate-limits concurrent requests — serialize all calls.
_supadata_sem = asyncio.Semaphore(1)

TranscriptSource = Literal["native_captions", "whisper_fallback"]


@dataclass(slots=True)
class TranscriptSegment:
    """One piece of timestamped transcript text."""

    text: str
    start: float           # seconds from video start
    duration: float        # seconds

    @property
    def end(self) -> float:
        return self.start + self.duration

    def to_dict(self) -> dict[str, float | str]:
        return {"text": self.text, "start": self.start, "duration": self.duration}


# ─── Stage 1: native captions ─────────────────────────────────────────────


def _apify_proxies() -> dict | None:
    """Return a proxies dict using Apify residential IPs, or None if unconfigured."""
    if not settings.apify_api_token:
        return None
    proxy_url = f"http://auto:{settings.apify_api_token}@proxy.apify.com:8000"
    return {"http": proxy_url, "https": proxy_url}


def _fetch_native_sync(video_id: str) -> list[TranscriptSegment]:
    """Blocking call — caller wraps in to_thread."""
    from app.services.youtube import _COOKIES_FILE

    kwargs: dict = {"languages": ["en", "en-US", "en-GB", "a.en"]}
    if _COOKIES_FILE:
        kwargs["cookies"] = _COOKIES_FILE

    proxies = _apify_proxies()
    if proxies:
        kwargs["proxies"] = proxies

    raw = YouTubeTranscriptApi.get_transcript(video_id, **kwargs)
    return [
        TranscriptSegment(
            text=seg["text"].replace("\n", " ").strip(),
            start=float(seg["start"]),
            duration=float(seg.get("duration", 0.0)),
        )
        for seg in raw
        if seg.get("text", "").strip()
    ]


async def fetch_native_captions(video_id: str) -> list[TranscriptSegment] | None:
    """Try the free path. Returns None if captions are unavailable."""
    try:
        return await asyncio.to_thread(_fetch_native_sync, video_id)
    except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as e:
        logger.info("native captions unavailable for %s: %s", video_id, type(e).__name__)
        return None
    except Exception as e:
        # Network blips, parse errors, etc. Fall through to Whisper.
        logger.warning("native captions errored for %s: %s", video_id, e)
        return None


# ─── Stage 2: Groq Whisper ────────────────────────────────────────────────


GROQ_WHISPER_MAX_BYTES = 24 * 1024 * 1024  # Groq caps at 25 MB; 24 leaves headroom


async def _whisper_transcribe(audio_path: Path) -> list[TranscriptSegment]:
    """Send a local audio file to Groq Whisper Large V3 with segment timestamps."""
    size = audio_path.stat().st_size
    if size > GROQ_WHISPER_MAX_BYTES:
        raise RuntimeError(
            f"audio file {audio_path.name} is {size / 1024 / 1024:.1f} MB — "
            f"exceeds Groq Whisper's 25 MB limit. Try a shorter video, or "
            f"chunk the audio (production work)."
        )
    client = AsyncGroq(api_key=settings.groq_api_key)
    with open(audio_path, "rb") as f:
        audio_bytes = f.read()
    response = await client.audio.transcriptions.create(
        file=(audio_path.name, audio_bytes),
        model=settings.groq_whisper_model,
        response_format="verbose_json",
        timestamp_granularities=["segment"],
        temperature=0.0,
    )
    # Groq returns either a pydantic model or a dict depending on SDK version.
    segments = getattr(response, "segments", None) or response.get("segments", [])  # type: ignore[union-attr]
    out: list[TranscriptSegment] = []
    for seg in segments:
        # Each seg has: id, start, end, text, ...
        text = (seg["text"] if isinstance(seg, dict) else seg.text).strip()
        if not text:
            continue
        start = float(seg["start"] if isinstance(seg, dict) else seg.start)
        end = float(seg["end"] if isinstance(seg, dict) else seg.end)
        out.append(TranscriptSegment(text=text, start=start, duration=max(end - start, 0.01)))
    return out


async def fetch_whisper_fallback(video_id: str) -> list[TranscriptSegment]:
    """Download audio + transcribe via Groq Whisper. Cleans up temp files."""
    with tempfile.TemporaryDirectory(prefix="creatorjoy_") as tmpdir:
        audio_path = await asyncio.to_thread(download_audio, video_id, tmpdir)
        return await _whisper_transcribe(audio_path)


# ─── Stage 1b: Supadata transcript API ───────────────────────────────────


async def fetch_supadata_transcript(video_id: str) -> list[TranscriptSegment] | None:
    """Fetch transcript via Supadata.ai API — works from any server IP.

    Returns None if the key is not configured or the video has no transcript.
    """
    if not settings.supadata_api_key:
        return None
    try:
        async with _supadata_sem:  # serialize: only one Supadata call at a time
            async with httpx.AsyncClient(timeout=30) as client:
                # Retry up to 3 times on 429 with backoff
                for attempt in range(3):
                    resp = await client.get(
                        "https://api.supadata.ai/v1/youtube/transcript",
                        params={"videoId": video_id, "lang": "en", "text": "false"},
                        headers={"x-api-key": settings.supadata_api_key},
                    )
                    if resp.status_code == 429:
                        wait = 2 ** attempt  # 1s, 2s, 4s
                        logger.warning("supadata 429 for %s, retrying in %ss", video_id, wait)
                        await asyncio.sleep(wait)
                        continue
                    if resp.status_code == 404:
                        logger.info("supadata: no transcript for %s", video_id)
                        return None
                    resp.raise_for_status()
                    break
                else:
                    logger.warning("supadata: exhausted retries for %s", video_id)
                    return None
                data = resp.json()

        # Supadata returns {content: [{text, offset, duration}], lang, ...}
        # offset and duration are in milliseconds
        content = data.get("content") or []
        if not content:
            logger.info("supadata: empty transcript for %s", video_id)
            return None

        segments = []
        for item in content:
            text = (item.get("text") or "").replace("\n", " ").strip()
            if not text:
                continue
            # offset is in milliseconds → convert to seconds
            start = float(item.get("offset") or item.get("start") or 0) / 1000
            duration = float(item.get("duration") or 2000) / 1000
            segments.append(TranscriptSegment(text=text, start=start, duration=duration))

        logger.info("supadata: got %d segments for %s", len(segments), video_id)
        return segments if segments else None

    except Exception as e:
        logger.warning("supadata fetch failed for %s: %s", video_id, e)
        return None


# ─── Public API ───────────────────────────────────────────────────────────


async def fetch_transcript(
    video_id: str,
) -> tuple[list[TranscriptSegment], TranscriptSource]:
    """Two-stage fetch. Native captions first, Whisper fallback otherwise.

    Raises if BOTH paths fail — the ingest orchestrator turns that into a
    user-facing error.
    """
    # Stage 1: native captions via youtube-transcript-api
    native = await fetch_native_captions(video_id)
    if native:
        return native, "native_captions"

    # Stage 1b: Supadata API — works from any server IP, no bot detection
    supadata = await fetch_supadata_transcript(video_id)
    if supadata:
        return supadata, "native_captions"

    # Stage 2: Whisper fallback via yt-dlp audio download
    logger.info("falling back to Whisper for %s", video_id)
    try:
        whisper = await asyncio.wait_for(fetch_whisper_fallback(video_id), timeout=90.0)
    except asyncio.TimeoutError:
        raise RuntimeError(
            f"All transcript sources failed for {video_id}: "
            "native captions blocked, Supadata unavailable, yt-dlp timed out after 90s."
        )
    return whisper, "whisper_fallback"

"""Timestamp-aware transcript chunker.

This is one of the four design spikes called out in the README. Generic
recursive-character text splitting throws away the only metadata video
transcripts have that documents don't: time. We exploit that by emitting
two extra chunk types beyond the usual sliding window:

    intro_5s   — text covering 0–5 seconds   (the literal hook)
    intro_15s  — text covering 0–15 seconds  (extended hook context)
    body       — 30-second sliding windows with 5-second overlap

The intro chunks let the query router answer "compare the hooks in the
first 5 seconds" deterministically — we metadata-filter on chunk_type
instead of praying top-k semantic search surfaces the intro.

Pure function, no I/O. Cheap to test.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

from app.config import settings
from app.services.transcripts import TranscriptSegment

logger = logging.getLogger(__name__)


ChunkType = Literal["intro_5s", "intro_15s", "body"]


@dataclass(slots=True)
class Chunk:
    """A timestamped, embeddable slice of transcript."""

    video_id: str
    text: str
    start_time: float
    end_time: float
    chunk_type: ChunkType
    token_count: int = 0


# ─── Token counting ───────────────────────────────────────────────────────

# tiktoken's cl100k_base is the BPE used by gpt-3.5/4. Close enough to BGE
# tokenizer for cost analytics; we're not using these counts to truncate.
try:
    import tiktoken

    _ENCODER = tiktoken.get_encoding("cl100k_base")

    def _count_tokens(text: str) -> int:
        return len(_ENCODER.encode(text, disallowed_special=()))

except Exception as e:  # pragma: no cover
    logger.warning("tiktoken unavailable, falling back to word-count: %s", e)

    def _count_tokens(text: str) -> int:
        return len(text.split())


# ─── Helpers ──────────────────────────────────────────────────────────────


def _join(segments: list[TranscriptSegment]) -> str:
    """Concatenate segment text with single spaces, collapsing whitespace."""
    return " ".join(s.text for s in segments if s.text).strip()


def _segments_in_range(
    segments: list[TranscriptSegment], start: float, end: float
) -> list[TranscriptSegment]:
    """Segments whose START falls in [start, end). Half-open interval."""
    return [s for s in segments if start <= s.start < end]


# ─── Public API ───────────────────────────────────────────────────────────


def chunk_transcript(
    segments: list[TranscriptSegment],
    *,
    video_id: str,
    body_window_seconds: float | None = None,
    body_step_seconds: float | None = None,
    intro_short_seconds: float | None = None,
    intro_long_seconds: float | None = None,
) -> list[Chunk]:
    """Split a transcript into intro + body chunks.

    Returned chunks are ready for embedding and DB insert.
    """
    if not segments:
        return []

    # Defaults pulled from settings so behavior is configurable per-deploy.
    body_window = body_window_seconds or settings.body_chunk_seconds
    overlap = settings.body_chunk_overlap_seconds
    body_step = body_step_seconds or max(body_window - overlap, 1.0)
    intro_short = intro_short_seconds or settings.intro_short_seconds
    intro_long = intro_long_seconds or settings.intro_long_seconds

    chunks: list[Chunk] = []
    last_end = segments[-1].end

    # ─── 1. Intro chunks (deterministic, used by 'hook' query class) ─────
    intro_5s_segs = _segments_in_range(segments, 0.0, intro_short)
    intro_5s_text = _join(intro_5s_segs)
    if intro_5s_text:
        chunks.append(
            Chunk(
                video_id=video_id,
                text=intro_5s_text,
                start_time=0.0,
                end_time=min(intro_short, last_end),
                chunk_type="intro_5s",
                token_count=_count_tokens(intro_5s_text),
            )
        )

    intro_15s_segs = _segments_in_range(segments, 0.0, intro_long)
    intro_15s_text = _join(intro_15s_segs)
    # Skip the longer intro if it's identical to the shorter one (very short videos).
    if intro_15s_text and intro_15s_text != intro_5s_text:
        chunks.append(
            Chunk(
                video_id=video_id,
                text=intro_15s_text,
                start_time=0.0,
                end_time=min(intro_long, last_end),
                chunk_type="intro_15s",
                token_count=_count_tokens(intro_15s_text),
            )
        )

    # ─── 2. Body chunks (sliding window with overlap) ────────────────────
    t = 0.0
    while t < last_end:
        window_end = t + body_window
        window_segs = _segments_in_range(segments, t, window_end)
        text = _join(window_segs)
        if text:
            chunks.append(
                Chunk(
                    video_id=video_id,
                    text=text,
                    start_time=t,
                    end_time=min(window_end, last_end),
                    chunk_type="body",
                    token_count=_count_tokens(text),
                )
            )
        t += body_step

    return chunks

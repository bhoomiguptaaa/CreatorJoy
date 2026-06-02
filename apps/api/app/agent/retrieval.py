"""Class-specific retrieval strategies.

Each function returns the chunks (and structured metadata, where relevant)
that will be stuffed into the prompt for one query class.

The shape of the SQL — especially the ``WHERE video_id = $1 AND chunk_type
IN (...)`` filter combined with HNSW vector ordering — is exactly why we
chose pgvector over a managed vector DB. One database, one query, atomic.
"""

from __future__ import annotations

from typing import Literal

import asyncpg

from app.agent.state import ChunkRow, VideoMeta
from app.config import settings
from app.embeddings import Embedder

VideoLabel = Literal["A", "B"]


# ─── Video metadata ───────────────────────────────────────────────────────


_DESCRIPTION_CHAR_CAP = 800  # YouTube descriptions can be 5000+ chars; cap for prompt cost


async def fetch_video_meta(
    pool: asyncpg.Pool, video_id: str, label: VideoLabel
) -> VideoMeta:
    row = await pool.fetchrow(
        """
        SELECT video_id, title, channel_name, follower_count,
               view_count, like_count, comment_count, engagement_rate,
               duration_seconds, upload_date, description, tags
        FROM videos WHERE video_id = $1
        """,
        video_id,
    )
    if not row:
        raise ValueError(f"video not found: {video_id}")

    desc = row["description"] or ""
    if len(desc) > _DESCRIPTION_CHAR_CAP:
        desc = desc[:_DESCRIPTION_CHAR_CAP].rstrip() + "…"

    return VideoMeta(
        video_id=row["video_id"],
        video_label=label,
        title=row["title"],
        channel_name=row["channel_name"],
        follower_count=row["follower_count"],
        view_count=row["view_count"],
        like_count=row["like_count"],
        comment_count=row["comment_count"],
        engagement_rate=float(row["engagement_rate"]),
        duration_seconds=row["duration_seconds"],
        upload_date=row["upload_date"].isoformat() if row["upload_date"] else None,
        description=desc or None,
        tags=list(row["tags"]) if row["tags"] else None,
    )


def _row_to_chunk(row: asyncpg.Record, label: VideoLabel) -> ChunkRow:
    return ChunkRow(
        chunk_id=str(row["chunk_id"]),
        video_id=row["video_id"],
        video_label=label,
        text=row["text"],
        start_time=float(row["start_time"]),
        end_time=float(row["end_time"]),
        chunk_type=row["chunk_type"],
    )


# ─── Strategy 1: engagement_stats ─────────────────────────────────────────
# No vector retrieval. The answer is in the videos table; we let the LLM
# read it from the structured stats block in the prompt.


async def retrieve_engagement_stats(
    pool: asyncpg.Pool,
    *,
    video_a_id: str,
    video_b_id: str,
) -> tuple[list[ChunkRow], VideoMeta, VideoMeta]:
    a = await fetch_video_meta(pool, video_a_id, "A")
    b = await fetch_video_meta(pool, video_b_id, "B")
    return [], a, b


# ─── Strategy 2: hook ─────────────────────────────────────────────────────
# Deterministic: pull the intro chunks from BOTH videos. No semantic search.


async def retrieve_hooks(
    pool: asyncpg.Pool,
    *,
    video_a_id: str,
    video_b_id: str,
) -> tuple[list[ChunkRow], VideoMeta, VideoMeta]:
    rows = await pool.fetch(
        """
        SELECT chunk_id, video_id, text, start_time, end_time, chunk_type
        FROM chunks
        WHERE video_id = ANY($1::text[])
          AND chunk_type IN ('intro_5s', 'intro_15s')
        ORDER BY video_id, chunk_type, start_time
        """,
        [video_a_id, video_b_id],
    )
    chunks: list[ChunkRow] = []
    for row in rows:
        label: VideoLabel = "A" if row["video_id"] == video_a_id else "B"
        chunks.append(_row_to_chunk(row, label))

    a = await fetch_video_meta(pool, video_a_id, "A")
    b = await fetch_video_meta(pool, video_b_id, "B")
    return chunks, a, b


# ─── Strategy 3: comparison ──────────────────────────────────────────────
# Parallel top-k from each video so both sides have balanced context.


async def retrieve_comparison(
    pool: asyncpg.Pool,
    embedder: Embedder,
    *,
    question: str,
    video_a_id: str,
    video_b_id: str,
) -> tuple[list[ChunkRow], VideoMeta, VideoMeta]:
    embedding = embedder.embed_one(question)
    k = settings.retrieval_top_k_per_video

    rows_a = await pool.fetch(
        """
        SELECT chunk_id, video_id, text, start_time, end_time, chunk_type
        FROM chunks
        WHERE video_id = $1 AND chunk_type = 'body'
        ORDER BY embedding <=> $2::vector
        LIMIT $3
        """,
        video_a_id,
        embedding,
        k,
    )
    rows_b = await pool.fetch(
        """
        SELECT chunk_id, video_id, text, start_time, end_time, chunk_type
        FROM chunks
        WHERE video_id = $1 AND chunk_type = 'body'
        ORDER BY embedding <=> $2::vector
        LIMIT $3
        """,
        video_b_id,
        embedding,
        k,
    )

    chunks: list[ChunkRow] = []
    chunks.extend(_row_to_chunk(r, "A") for r in rows_a)
    chunks.extend(_row_to_chunk(r, "B") for r in rows_b)

    a = await fetch_video_meta(pool, video_a_id, "A")
    b = await fetch_video_meta(pool, video_b_id, "B")
    return chunks, a, b


# ─── Strategy 4: single_video (default) ──────────────────────────────────
# Naive RAG: top-k across BOTH videos. The LLM, having full context for
# both, decides which one is being asked about. We could heuristic-detect
# "in Video A" / "Video B" and filter, but the parallel-k path is safer.


async def retrieve_single(
    pool: asyncpg.Pool,
    embedder: Embedder,
    *,
    question: str,
    video_a_id: str,
    video_b_id: str,
) -> tuple[list[ChunkRow], VideoMeta, VideoMeta]:
    embedding = embedder.embed_one(question)
    k = settings.retrieval_top_k_single

    rows = await pool.fetch(
        """
        SELECT chunk_id, video_id, text, start_time, end_time, chunk_type
        FROM chunks
        WHERE video_id = ANY($1::text[]) AND chunk_type = 'body'
        ORDER BY embedding <=> $2::vector
        LIMIT $3
        """,
        [video_a_id, video_b_id],
        embedding,
        k,
    )

    chunks: list[ChunkRow] = []
    for r in rows:
        label: VideoLabel = "A" if r["video_id"] == video_a_id else "B"
        chunks.append(_row_to_chunk(r, label))

    a = await fetch_video_meta(pool, video_a_id, "A")
    b = await fetch_video_meta(pool, video_b_id, "B")
    return chunks, a, b

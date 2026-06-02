"""Ingestion orchestrator.

Composes yt-dlp metadata, transcript fetching (with Whisper fallback),
chunking, and embedding into a single async function the route layer
can call. Handles the cache check at the front and writes both
``videos`` and ``chunks`` rows in a single transaction at the end.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import asyncpg

from app.config import settings
from app.embeddings import Embedder
from app.schemas import VideoMetadata
from app.services import youtube
from app.services.chunker import Chunk, chunk_transcript
from app.services.transcripts import TranscriptSegment, fetch_transcript

logger = logging.getLogger(__name__)


# ─── Cache check ──────────────────────────────────────────────────────────


async def _load_cached_video(
    pool: asyncpg.Pool, video_id: str
) -> VideoMetadata | None:
    """Return cached metadata if the video was ingested within the TTL."""
    row = await pool.fetchrow(
        """
        SELECT video_id, url, title, channel_name, channel_id, follower_count,
               view_count, like_count, comment_count, engagement_rate,
               duration_seconds, upload_date, thumbnail_url, language,
               transcript_source, ingested_at, last_refreshed_at
        FROM videos
        WHERE video_id = $1
        """,
        video_id,
    )
    if not row:
        return None

    age = datetime.now(timezone.utc) - row["last_refreshed_at"]
    if age > timedelta(seconds=settings.video_cache_ttl_seconds):
        return None

    return VideoMetadata(
        video_id=row["video_id"],
        url=row["url"],
        title=row["title"],
        channel_name=row["channel_name"],
        channel_id=row["channel_id"],
        follower_count=row["follower_count"],
        view_count=row["view_count"],
        like_count=row["like_count"],
        comment_count=row["comment_count"],
        engagement_rate=float(row["engagement_rate"]),
        duration_seconds=row["duration_seconds"],
        upload_date=row["upload_date"],
        thumbnail_url=row["thumbnail_url"],
        language=row["language"],
        transcript_source=row["transcript_source"],
        ingested_at=row["ingested_at"],
    )


# ─── Channel cache ────────────────────────────────────────────────────────


async def _resolve_channel_followers(
    pool: asyncpg.Pool, channel_id: str | None, fallback_followers: int | None
) -> int | None:
    """Return cached follower count, or fetch + cache if missing/stale.

    If yt-dlp's video-level fetch already returned a follower count, prefer
    that and avoid the second yt-dlp call.
    """
    if not channel_id:
        return fallback_followers
    if fallback_followers is not None:
        # Persist it for the next ingestion of any video by this creator.
        await pool.execute(
            """
            INSERT INTO channels (channel_id, channel_name, follower_count, last_refreshed_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (channel_id) DO UPDATE
              SET follower_count = EXCLUDED.follower_count,
                  last_refreshed_at = NOW()
            """,
            channel_id,
            "",  # channel_name set elsewhere; placeholder ok with our schema
            fallback_followers,
        )
        return fallback_followers

    row = await pool.fetchrow(
        "SELECT follower_count, last_refreshed_at FROM channels WHERE channel_id = $1",
        channel_id,
    )
    if row:
        age = datetime.now(timezone.utc) - row["last_refreshed_at"]
        if age <= timedelta(seconds=settings.video_cache_ttl_seconds):
            return row["follower_count"]

    # Fetch fresh — YouTube API first, yt-dlp fallback
    followers = await asyncio.to_thread(youtube.fetch_channel_followers_ytapi, channel_id)
    if followers is not None:
        info = youtube.ChannelInfo(channel_id=channel_id, channel_name="", follower_count=followers)
    else:
        info = await asyncio.to_thread(youtube.fetch_channel_info, channel_id)
    if info and info.follower_count is not None:
        await pool.execute(
            """
            INSERT INTO channels (channel_id, channel_name, follower_count, last_refreshed_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (channel_id) DO UPDATE
              SET channel_name = EXCLUDED.channel_name,
                  follower_count = EXCLUDED.follower_count,
                  last_refreshed_at = NOW()
            """,
            channel_id,
            info.channel_name,
            info.follower_count,
        )
        return info.follower_count
    return None


# ─── Engagement rate ──────────────────────────────────────────────────────


def _compute_engagement_rate(views: int, likes: int, comments: int) -> float:
    """(likes + comments) / views * 100. Zero if views is 0."""
    if views <= 0:
        return 0.0
    return (likes + comments) / views * 100.0


# ─── DB writes ────────────────────────────────────────────────────────────


async def _persist_video_and_chunks(
    pool: asyncpg.Pool,
    video: youtube.VideoInfo,
    follower_count: int | None,
    engagement_rate: float,
    transcript: list[TranscriptSegment],
    transcript_source: str,
    chunks: list[Chunk],
    embeddings: list[list[float]],
) -> datetime:
    """Atomic write of the video row + all chunk rows. Returns ingested_at."""
    transcript_jsonb = [seg.to_dict() for seg in transcript]

    async with pool.acquire() as conn:
        async with conn.transaction():
            ingested_at = await conn.fetchval(
                """
                INSERT INTO videos (
                    video_id, url, title, channel_id, channel_name, follower_count,
                    view_count, like_count, comment_count, engagement_rate,
                    duration_seconds, upload_date, thumbnail_url, description, tags,
                    language, transcript_full, transcript_source,
                    ingested_at, last_refreshed_at
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10,
                    $11, $12, $13, $14, $15,
                    $16, $17::jsonb, $18,
                    NOW(), NOW()
                )
                ON CONFLICT (video_id) DO UPDATE SET
                    url = EXCLUDED.url,
                    title = EXCLUDED.title,
                    channel_id = EXCLUDED.channel_id,
                    channel_name = EXCLUDED.channel_name,
                    follower_count = EXCLUDED.follower_count,
                    view_count = EXCLUDED.view_count,
                    like_count = EXCLUDED.like_count,
                    comment_count = EXCLUDED.comment_count,
                    engagement_rate = EXCLUDED.engagement_rate,
                    duration_seconds = EXCLUDED.duration_seconds,
                    upload_date = EXCLUDED.upload_date,
                    thumbnail_url = EXCLUDED.thumbnail_url,
                    description = EXCLUDED.description,
                    tags = EXCLUDED.tags,
                    language = EXCLUDED.language,
                    transcript_full = EXCLUDED.transcript_full,
                    transcript_source = EXCLUDED.transcript_source,
                    last_refreshed_at = NOW()
                RETURNING ingested_at
                """,
                video.video_id,
                video.url,
                video.title,
                video.channel_id,
                video.channel_name,
                follower_count,
                video.view_count,
                video.like_count,
                video.comment_count,
                engagement_rate,
                video.duration_seconds,
                video.upload_date,
                video.thumbnail_url,
                video.description,
                video.tags,
                video.language,
                __import__("json").dumps(transcript_jsonb),
                transcript_source,
            )

            # Replace any prior chunks for this video (re-ingestion case)
            await conn.execute("DELETE FROM chunks WHERE video_id = $1", video.video_id)

            await conn.executemany(
                """
                INSERT INTO chunks (
                    video_id, text, start_time, end_time, chunk_type,
                    token_count, embedding
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                [
                    (
                        c.video_id,
                        c.text,
                        c.start_time,
                        c.end_time,
                        c.chunk_type,
                        c.token_count,
                        emb,
                    )
                    for c, emb in zip(chunks, embeddings, strict=True)
                ],
            )

    return ingested_at


# ─── Public entry point ───────────────────────────────────────────────────


class IngestError(RuntimeError):
    """User-facing failure (no captions AND Whisper failed, etc.)."""


async def ingest_video(
    pool: asyncpg.Pool, embedder: Embedder, url_or_id: str
) -> VideoMetadata:
    """Ingest a single video end-to-end. Returns the canonical metadata bundle."""
    video_id = youtube.extract_video_id(url_or_id)

    # 1. Cache check
    cached = await _load_cached_video(pool, video_id)
    if cached is not None:
        logger.info("cache hit for %s (age within TTL)", video_id)
        return cached

    # 2. Metadata — YouTube Data API v3 first (no bot risk), yt-dlp fallback
    try:
        info = await asyncio.to_thread(youtube.fetch_video_info_ytapi, video_id)
        logger.info("metadata via YouTube Data API v3 for %s", video_id)
    except Exception as e:
        logger.warning("YouTube API failed for %s (%s), falling back to yt-dlp", video_id, e)
        info = await asyncio.to_thread(youtube.fetch_video_info, video_id)

    # Reject videos that are absurdly long for our cost story
    if info.duration_seconds and info.duration_seconds > settings.max_video_duration_seconds:
        raise IngestError(
            f"video is {info.duration_seconds // 60} min — exceeds the {settings.max_video_duration_seconds // 60} min limit"
        )

    # 3. Channel followers (with cache)
    follower_count = await _resolve_channel_followers(pool, info.channel_id, info.follower_count)

    # 4. Engagement rate
    engagement_rate = _compute_engagement_rate(
        info.view_count, info.like_count, info.comment_count
    )

    # 5. Transcript (native + Whisper fallback)
    try:
        transcript, source = await fetch_transcript(video_id)
    except Exception as e:
        raise IngestError(f"failed to transcribe {video_id}: {e}") from e
    if not transcript:
        raise IngestError(f"empty transcript for {video_id}")

    # 6. Chunk
    chunks = chunk_transcript(transcript, video_id=video_id)
    if not chunks:
        raise IngestError(f"chunker produced no chunks for {video_id}")

    # 7. Embed (CPU-bound — run in thread)
    texts = [c.text for c in chunks]
    embeddings = await asyncio.to_thread(embedder.embed, texts)

    # 8. Persist
    ingested_at = await _persist_video_and_chunks(
        pool=pool,
        video=info,
        follower_count=follower_count,
        engagement_rate=engagement_rate,
        transcript=transcript,
        transcript_source=source,
        chunks=chunks,
        embeddings=embeddings,
    )

    return VideoMetadata(
        video_id=info.video_id,
        url=info.url,
        title=info.title,
        channel_name=info.channel_name,
        channel_id=info.channel_id,
        follower_count=follower_count,
        view_count=info.view_count,
        like_count=info.like_count,
        comment_count=info.comment_count,
        engagement_rate=engagement_rate,
        duration_seconds=info.duration_seconds,
        upload_date=info.upload_date,
        thumbnail_url=info.thumbnail_url,
        language=info.language,
        transcript_source=source,
        ingested_at=ingested_at,
    )

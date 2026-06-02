"""GET /api/videos/{video_id} — fast cache fetch for already-ingested videos."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.db import get_pool
from app.schemas import VideoMetadata

router = APIRouter()


@router.get("/videos/{video_id}", response_model=VideoMetadata)
async def get_video(video_id: str, request: Request) -> VideoMetadata:
    pool = get_pool(request.app)
    row = await pool.fetchrow(
        """
        SELECT video_id, url, title, channel_name, channel_id, follower_count,
               view_count, like_count, comment_count, engagement_rate,
               duration_seconds, upload_date, thumbnail_url, language,
               transcript_source, ingested_at
        FROM videos
        WHERE video_id = $1
        """,
        video_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="video not found")
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

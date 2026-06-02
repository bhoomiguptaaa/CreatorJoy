"""Pydantic schemas shared across routes.

These are wire-format types — the JSON shape the frontend sees. Keep them
flat and serializable; do not put DB types here.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


# ─── Ingest ───────────────────────────────────────────────────────────────


class IngestRequest(BaseModel):
    url_a: HttpUrl
    url_b: HttpUrl


class VideoMetadata(BaseModel):
    video_id: str
    url: str
    title: str
    channel_name: str
    channel_id: str | None = None
    follower_count: int | None = None
    view_count: int
    like_count: int
    comment_count: int
    engagement_rate: float
    duration_seconds: int | None = None
    upload_date: date | None = None
    thumbnail_url: str | None = None
    language: str | None = None
    transcript_source: Literal["native_captions", "whisper_fallback"] | None = None
    ingested_at: datetime


class IngestResponse(BaseModel):
    video_a: VideoMetadata
    video_b: VideoMetadata


# ─── Chat ─────────────────────────────────────────────────────────────────


QueryClass = Literal["single_video", "comparison", "hook", "engagement_stats"]


class ChatRequest(BaseModel):
    thread_id: str = Field(..., description="Client-generated thread ID")
    video_a_id: str
    video_b_id: str
    question: str


class Citation(BaseModel):
    """One citation that the frontend will render as a clickable badge."""

    video_id: str
    video_label: Literal["A", "B"]
    start_time: float
    end_time: float
    chunk_type: str
    text_preview: str = Field(..., description="First ~120 chars of the chunk")


# ─── Threads ──────────────────────────────────────────────────────────────


class ThreadMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    citations: list[Citation] = []
    created_at: datetime


class ThreadHistory(BaseModel):
    thread_id: str
    video_a_id: str | None = None
    video_b_id: str | None = None
    messages: list[ThreadMessage] = []

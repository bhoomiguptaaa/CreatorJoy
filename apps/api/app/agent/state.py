"""LangGraph state types for the chat agent.

The graph flows:

    classify  →  retrieve_<class>  →  assemble  →  END

A node mutates the state by returning a partial dict; LangGraph merges it.
The SSE route consumes the final state, then streams from Groq separately
so we can emit token-level events without forcing tokens through the graph.
"""

from __future__ import annotations

from typing import Literal, NotRequired, TypedDict

QueryClass = Literal["single_video", "comparison", "hook", "engagement_stats"]


class ChunkRow(TypedDict):
    """One retrieved chunk, ready to be cited in the prompt."""

    chunk_id: str
    video_id: str
    video_label: Literal["A", "B"]
    text: str
    start_time: float
    end_time: float
    chunk_type: str


class VideoMeta(TypedDict, total=False):
    """Structured engagement context — injected into the prompt verbatim."""

    video_id: str
    video_label: Literal["A", "B"]
    title: str
    channel_name: str
    follower_count: int | None
    view_count: int
    like_count: int
    comment_count: int
    engagement_rate: float
    duration_seconds: int | None
    upload_date: str | None
    description: str | None  # truncated YouTube description box
    tags: list[str] | None   # creator-provided hashtags


class Message(TypedDict):
    role: Literal["user", "assistant"]
    content: str


class ChatState(TypedDict, total=False):
    # ─── Inputs ───
    history: list[Message]      # prior turns from chat_messages
    video_a_id: str
    video_b_id: str
    question: str

    # ─── Filled by classify node ───
    query_class: QueryClass

    # ─── Filled by retrieval nodes ───
    chunks: list[ChunkRow]
    video_a_meta: VideoMeta
    video_b_meta: VideoMeta

    # ─── Filled by assemble node ───
    system_prompt: str
    user_messages: list[Message]   # full message array ready for Groq

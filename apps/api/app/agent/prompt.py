"""Prompt assembly — turns the retrieved state into messages for Groq.

The shape of the prompt is design spike #3 (engagement metrics as
structured context) and #4 (citation-aware streaming). The LLM is told
to cite every transcript-derived claim using the inline ``[A:M:SS]``
format — the frontend regex-matches these and renders clickable badges.
"""

from __future__ import annotations

import json
from typing import Literal

from app.agent.state import ChunkRow, Message, VideoMeta


def _format_seconds(seconds: float) -> str:
    """Format 92.5 → '1:32'."""
    s = int(seconds)
    return f"{s // 60}:{s % 60:02d}"


# ─── System prompt ────────────────────────────────────────────────────────

_SYSTEM_TEMPLATE = """You are Creatorjoy, an analyst that helps creators understand WHY their videos perform differently and how to improve.

You are looking at TWO videos labeled A and B.

──────── VIDEO A STATS ────────
{video_a_stats}

──────── VIDEO B STATS ────────
{video_b_stats}

──────── RELEVANT TRANSCRIPT EXCERPTS ────────
{chunks_block}

──────── INSTRUCTIONS ────────
1. Cite EVERY claim drawn from a transcript using the format [LABEL:M:SS] where LABEL is A or B and M:SS is the chunk's start time. Example: [A:0:32]. Use the exact start_time shown in the excerpt header.
2. For numerical claims (engagement rate, views, etc.), reference the stats blocks directly — do NOT cite a transcript chunk for numbers.
3. Be specific and concrete. Avoid generic advice. Tie every recommendation to evidence in the transcripts or the stats.
4. If asked about hooks, focus on the first 5–15 seconds of each video.
5. If the user asks about something not in the available context, say so honestly rather than guessing.
6. Maintain context from prior messages in the conversation.
"""


def _stats_block(meta: VideoMeta) -> str:
    """Render a video's structured stats as JSON (LLM-friendly).

    Includes the YouTube description and tags — these answer "what is this
    video about?" questions far better than semantically-retrieved transcript
    chunks (the description is the creator's own summary).
    """
    return json.dumps(
        {
            "label": meta.get("video_label"),
            "video_id": meta.get("video_id"),
            "title": meta.get("title"),
            "channel_name": meta.get("channel_name"),
            "follower_count": meta.get("follower_count"),
            "view_count": meta.get("view_count"),
            "like_count": meta.get("like_count"),
            "comment_count": meta.get("comment_count"),
            "engagement_rate": meta.get("engagement_rate"),
            "duration_seconds": meta.get("duration_seconds"),
            "upload_date": meta.get("upload_date"),
            "description": meta.get("description"),
            "tags": meta.get("tags"),
        },
        indent=2,
        ensure_ascii=False,
    )


def _chunks_block(chunks: list[ChunkRow]) -> str:
    """Render retrieved chunks as labeled excerpts the LLM can cite."""
    if not chunks:
        return "(no transcript excerpts retrieved for this query — answer from stats only)"
    lines: list[str] = []
    for c in chunks:
        ts = _format_seconds(c["start_time"])
        end_ts = _format_seconds(c["end_time"])
        kind = c["chunk_type"]
        lines.append(f"[{c['video_label']}:{ts}] ({kind}, {ts}–{end_ts})")
        lines.append(c["text"].strip())
        lines.append("")  # blank line between
    return "\n".join(lines).strip()


def build_system_prompt(
    *,
    video_a_meta: VideoMeta,
    video_b_meta: VideoMeta,
    chunks: list[ChunkRow],
) -> str:
    return _SYSTEM_TEMPLATE.format(
        video_a_stats=_stats_block(video_a_meta),
        video_b_stats=_stats_block(video_b_meta),
        chunks_block=_chunks_block(chunks),
    )


# ─── Full message array for Groq ──────────────────────────────────────────


Role = Literal["system", "user", "assistant"]


def build_messages(
    *,
    system_prompt: str,
    history: list[Message],
    question: str,
) -> list[dict[str, str]]:
    msgs: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for m in history:
        msgs.append({"role": m["role"], "content": m["content"]})
    msgs.append({"role": "user", "content": question})
    return msgs

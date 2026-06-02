"""GET /api/threads/{thread_id} — restore chat history on page reload."""

from __future__ import annotations

import json

from fastapi import APIRouter, Request

from app.db import get_pool
from app.schemas import Citation, ThreadHistory, ThreadMessage

router = APIRouter()


@router.get("/threads/{thread_id}", response_model=ThreadHistory)
async def get_thread(thread_id: str, request: Request) -> ThreadHistory:
    pool = get_pool(request.app)
    rows = await pool.fetch(
        """
        SELECT role, content, citations, created_at, video_a_id, video_b_id
        FROM chat_messages
        WHERE thread_id = $1
        ORDER BY created_at ASC
        """,
        thread_id,
    )

    messages: list[ThreadMessage] = []
    for r in rows:
        raw_citations = r["citations"]
        citations_list = (
            json.loads(raw_citations) if isinstance(raw_citations, str) else (raw_citations or [])
        )
        messages.append(
            ThreadMessage(
                role=r["role"],
                content=r["content"],
                citations=[Citation(**c) for c in citations_list],
                created_at=r["created_at"],
            )
        )

    video_a_id = rows[0]["video_a_id"] if rows else None
    video_b_id = rows[0]["video_b_id"] if rows else None

    return ThreadHistory(
        thread_id=thread_id,
        video_a_id=video_a_id,
        video_b_id=video_b_id,
        messages=messages,
    )

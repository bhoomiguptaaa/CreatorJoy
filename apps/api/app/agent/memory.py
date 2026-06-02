"""Chat history persistence — loads prior turns and saves new ones.

We use a plain ``chat_messages`` table rather than LangGraph's PostgresSaver
because (a) we want full control over which fields the threads endpoint
returns, and (b) memory at this scale is just a flat SELECT — no need to
serialize/deserialize the entire LangGraph state on every turn.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import asyncpg

from app.agent.state import Message

logger = logging.getLogger(__name__)


# How many prior turns to load into the prompt. Caps prompt cost; 10 turns
# is a comfortable working memory for product chat.
MAX_HISTORY_MESSAGES = 20


async def load_history(pool: asyncpg.Pool, thread_id: str) -> list[Message]:
    """Return the conversation as a list of role/content dicts (oldest first)."""
    rows = await pool.fetch(
        """
        SELECT role, content
        FROM chat_messages
        WHERE thread_id = $1
        ORDER BY created_at ASC
        LIMIT $2
        """,
        thread_id,
        MAX_HISTORY_MESSAGES,
    )
    return [Message(role=r["role"], content=r["content"]) for r in rows]


async def save_user_message(
    pool: asyncpg.Pool,
    *,
    thread_id: str,
    video_a_id: str,
    video_b_id: str,
    content: str,
) -> None:
    await pool.execute(
        """
        INSERT INTO chat_messages (thread_id, video_a_id, video_b_id, role, content)
        VALUES ($1, $2, $3, 'user', $4)
        """,
        thread_id,
        video_a_id,
        video_b_id,
        content,
    )


async def save_assistant_message(
    pool: asyncpg.Pool,
    *,
    thread_id: str,
    video_a_id: str,
    video_b_id: str,
    content: str,
    query_class: str,
    citations: list[dict[str, Any]],
) -> None:
    await pool.execute(
        """
        INSERT INTO chat_messages (
            thread_id, video_a_id, video_b_id, role, content,
            query_class, citations
        )
        VALUES ($1, $2, $3, 'assistant', $4, $5, $6::jsonb)
        """,
        thread_id,
        video_a_id,
        video_b_id,
        content,
        query_class,
        json.dumps(citations),
    )

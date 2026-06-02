"""GET /api/chat — Server-Sent Events stream of the chat agent.

Event types emitted to the client:

  metadata  — sent once at the start. Payload:
              { "query_class": "comparison", "citations": [{...}, ...] }
              The citations array contains every chunk the LLM was given,
              with text previews + timestamps so the frontend can resolve
              `[A:0:32]` tags it sees in the streaming text to clickable
              YouTube-seek badges.

  token     — each delta from Groq's stream. Payload is the raw text.

  done      — terminal event when streaming finishes successfully.

  error     — terminal event if anything blows up. Payload is JSON error.
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

from fastapi import APIRouter, Query, Request
from sse_starlette.sse import EventSourceResponse

from app.agent.graph import build_chat_graph
from app.agent.memory import (
    load_history,
    save_assistant_message,
    save_user_message,
)
from app.agent.state import ChatState
from app.agent.streaming import stream_completion
from app.db import get_pool
from app.embeddings import get_embedder

logger = logging.getLogger(__name__)
router = APIRouter()


def _citations_payload(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Shape the chunks as the frontend expects them."""
    return [
        {
            "video_id": c["video_id"],
            "video_label": c["video_label"],
            "start_time": float(c["start_time"]),
            "end_time": float(c["end_time"]),
            "chunk_type": c["chunk_type"],
            "text_preview": c["text"][:160].strip() + ("…" if len(c["text"]) > 160 else ""),
        }
        for c in chunks
    ]


@router.get("/chat")
async def chat_stream(
    request: Request,
    thread_id: str = Query(..., min_length=1, max_length=128),
    video_a_id: str = Query(..., min_length=11, max_length=128),
    video_b_id: str = Query(..., min_length=11, max_length=128),
    question: str = Query(..., min_length=1, max_length=2000),
):
    pool = get_pool(request.app)
    embedder = get_embedder(request.app)

    async def event_generator() -> AsyncIterator[dict[str, Any]]:
        try:
            # 1. Load prior conversation
            history = await load_history(pool, thread_id)

            # 2. Persist the user message immediately (so refresh shows it)
            await save_user_message(
                pool,
                thread_id=thread_id,
                video_a_id=video_a_id,
                video_b_id=video_b_id,
                content=question,
            )

            # 3. Run the LangGraph: classify → route → retrieve → assemble
            graph = build_chat_graph(pool, embedder)
            initial: ChatState = {
                "history": history,
                "video_a_id": video_a_id,
                "video_b_id": video_b_id,
                "question": question,
            }
            final = await graph.ainvoke(initial)

            # 4. Emit metadata so the frontend can resolve [A:M:SS] citations
            citations = _citations_payload(final.get("chunks", []))
            yield {
                "event": "metadata",
                "data": json.dumps(
                    {
                        "query_class": final["query_class"],
                        "citations": citations,
                    }
                ),
            }

            # 5. Stream the answer
            full_response = ""
            async for token in stream_completion(final["user_messages"]):
                full_response += token
                yield {"event": "token", "data": token}

            # 6. Persist the assistant message with the citations it had access to
            await save_assistant_message(
                pool,
                thread_id=thread_id,
                video_a_id=video_a_id,
                video_b_id=video_b_id,
                content=full_response,
                query_class=final["query_class"],
                citations=citations,
            )

            yield {"event": "done", "data": "[DONE]"}

        except Exception as e:  # noqa: BLE001
            logger.exception("chat stream failed")
            yield {"event": "error", "data": json.dumps({"error": str(e)})}

    return EventSourceResponse(event_generator())

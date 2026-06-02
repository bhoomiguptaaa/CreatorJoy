"""LangGraph StateGraph that wires classify → route → retrieve → assemble.

The graph stops at ``assemble`` and hands control back to the SSE route.
The route then streams from Groq directly. Splitting at this boundary
keeps the graph synchronous-ish and lets the route own token-level event
emission without forcing tokens through the graph's reducer.
"""

from __future__ import annotations

import logging

import asyncpg
from langgraph.graph import END, StateGraph

from app.agent import classifier, retrieval
from app.agent.prompt import build_messages, build_system_prompt
from app.agent.state import ChatState, QueryClass
from app.embeddings import Embedder

logger = logging.getLogger(__name__)


# ─── Nodes ────────────────────────────────────────────────────────────────


async def _classify_node(state: ChatState) -> dict:
    cls = await classifier.classify(state["question"])
    logger.info("query_class=%s for q=%r", cls, state["question"][:60])
    return {"query_class": cls}


def _make_engagement_node(pool: asyncpg.Pool):
    async def node(state: ChatState) -> dict:
        chunks, a, b = await retrieval.retrieve_engagement_stats(
            pool, video_a_id=state["video_a_id"], video_b_id=state["video_b_id"]
        )
        return {"chunks": chunks, "video_a_meta": a, "video_b_meta": b}
    return node


def _make_hook_node(pool: asyncpg.Pool):
    async def node(state: ChatState) -> dict:
        chunks, a, b = await retrieval.retrieve_hooks(
            pool, video_a_id=state["video_a_id"], video_b_id=state["video_b_id"]
        )
        return {"chunks": chunks, "video_a_meta": a, "video_b_meta": b}
    return node


def _make_comparison_node(pool: asyncpg.Pool, embedder: Embedder):
    async def node(state: ChatState) -> dict:
        chunks, a, b = await retrieval.retrieve_comparison(
            pool, embedder,
            question=state["question"],
            video_a_id=state["video_a_id"],
            video_b_id=state["video_b_id"],
        )
        return {"chunks": chunks, "video_a_meta": a, "video_b_meta": b}
    return node


def _make_single_node(pool: asyncpg.Pool, embedder: Embedder):
    async def node(state: ChatState) -> dict:
        chunks, a, b = await retrieval.retrieve_single(
            pool, embedder,
            question=state["question"],
            video_a_id=state["video_a_id"],
            video_b_id=state["video_b_id"],
        )
        return {"chunks": chunks, "video_a_meta": a, "video_b_meta": b}
    return node


async def _assemble_node(state: ChatState) -> dict:
    system_prompt = build_system_prompt(
        video_a_meta=state["video_a_meta"],
        video_b_meta=state["video_b_meta"],
        chunks=state.get("chunks", []),
    )
    user_messages = build_messages(
        system_prompt=system_prompt,
        history=state.get("history", []),
        question=state["question"],
    )
    return {"system_prompt": system_prompt, "user_messages": user_messages}


# ─── Routing ──────────────────────────────────────────────────────────────


_ROUTE_MAP: dict[QueryClass, str] = {
    "engagement_stats": "retrieve_engagement",
    "hook": "retrieve_hook",
    "comparison": "retrieve_comparison",
    "single_video": "retrieve_single",
}


def _route_by_class(state: ChatState) -> str:
    """Return the destination node name directly — no path_map indirection."""
    return _ROUTE_MAP[state["query_class"]]


# ─── Builder ──────────────────────────────────────────────────────────────


def build_chat_graph(pool: asyncpg.Pool, embedder: Embedder):
    builder: StateGraph = StateGraph(ChatState)

    builder.add_node("classify", _classify_node)
    builder.add_node("retrieve_engagement", _make_engagement_node(pool))
    builder.add_node("retrieve_hook", _make_hook_node(pool))
    builder.add_node("retrieve_comparison", _make_comparison_node(pool, embedder))
    builder.add_node("retrieve_single", _make_single_node(pool, embedder))
    builder.add_node("assemble", _assemble_node)

    builder.set_entry_point("classify")
    # Pass list of valid destinations (not dict) so LangGraph treats the
    # function's return value as a direct node name, not a path_map key.
    builder.add_conditional_edges(
        "classify", _route_by_class, list(_ROUTE_MAP.values())
    )

    for ret in _ROUTE_MAP.values():
        builder.add_edge(ret, "assemble")

    builder.add_edge("assemble", END)

    return builder.compile()

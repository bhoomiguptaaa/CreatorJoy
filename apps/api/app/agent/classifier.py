"""Hybrid query classifier.

Strategy:
  1. Heuristic keyword match — free, instant, covers ~80% of real queries.
  2. LLM fallback — small Groq call when no heuristic fires.

The classifier output drives which retrieval branch the graph takes:

  engagement_stats  →  no vector retrieval; inject videos table row
  hook              →  metadata-filtered intro chunks (deterministic)
  comparison        →  parallel top-k from each video
  single_video      →  standard top-k filtered to one video

This is design spike #2 in the README — naive top-k breaks on three of the
four query shapes this product needs to answer.
"""

from __future__ import annotations

import logging
import re

from groq import AsyncGroq

from app.agent.state import QueryClass
from app.config import settings

logger = logging.getLogger(__name__)


# ─── Heuristic patterns ───────────────────────────────────────────────────

# Order matters: more specific classes before more general.
# Each pattern is matched case-insensitively.

_PATTERNS: list[tuple[QueryClass, list[re.Pattern[str]]]] = [
    (
        "hook",
        [
            re.compile(r"\bhook(s)?\b", re.IGNORECASE),
            re.compile(r"\bintro(s|duction)?\b", re.IGNORECASE),
            re.compile(r"\bopening\b", re.IGNORECASE),
            re.compile(r"\bfirst\s+\d+\s+(second|sec|s)\b", re.IGNORECASE),
            re.compile(r"\bstart\s+of\b", re.IGNORECASE),
        ],
    ),
    (
        "engagement_stats",
        [
            re.compile(r"\bengagement\s+rate\b", re.IGNORECASE),
            re.compile(r"\b(view|like|comment|subscriber|follower)s?\b", re.IGNORECASE),
            re.compile(r"\bhow\s+many\b", re.IGNORECASE),
            re.compile(r"\bwho('?s| is)\s+the\s+creator\b", re.IGNORECASE),
            re.compile(r"\bupload(ed)?\s+(date|on)\b", re.IGNORECASE),
        ],
    ),
    (
        "comparison",
        [
            re.compile(r"\b(compare|vs\.?|versus)\b", re.IGNORECASE),
            re.compile(r"\bdifference\s+between\b", re.IGNORECASE),
            re.compile(r"\bwhy\s+(did|does|is)\s+.*(more|better|worse|outperform)\b", re.IGNORECASE),
            re.compile(r"\boutperform(ed)?\b", re.IGNORECASE),
            re.compile(r"\b(suggest|improvement|improve).*\b(based on|from|like)\b", re.IGNORECASE),
            re.compile(r"\bwhich\s+(video|one)\s+is\s+(better|more)\b", re.IGNORECASE),
        ],
    ),
]


def classify_heuristic(question: str) -> QueryClass | None:
    """Return a class if any pattern matches, else None."""
    for cls, patterns in _PATTERNS:
        for p in patterns:
            if p.search(question):
                logger.debug("heuristic matched %s for %r", cls, question[:60])
                return cls
    return None


# ─── LLM fallback ─────────────────────────────────────────────────────────

_LLM_SYSTEM = """You are a query classifier. Read the user's question about two videos and respond with EXACTLY ONE of these labels:

- engagement_stats — question is about views, likes, comments, follower/subscriber counts, engagement rate, upload date, or who the creator is
- hook — question is about the intro, opening, hook, or first N seconds of the video(s)
- comparison — question compares the two videos (why one outperformed, what's the difference, suggest improvements based on the other)
- single_video — anything else; questions about one specific video's content

Respond with only the label. No punctuation, no explanation."""


_VALID: set[QueryClass] = {"single_video", "comparison", "hook", "engagement_stats"}


async def classify_llm(question: str) -> QueryClass:
    """Tiny Groq call — ~50 tokens in, 1-2 tokens out, ~$0.0001."""
    client = AsyncGroq(api_key=settings.groq_api_key)
    response = await client.chat.completions.create(
        model=settings.groq_llm_model,
        messages=[
            {"role": "system", "content": _LLM_SYSTEM},
            {"role": "user", "content": question},
        ],
        temperature=0.0,
        max_tokens=10,
    )
    raw = (response.choices[0].message.content or "").strip().lower()
    raw = raw.replace(".", "").replace(",", "").strip()
    if raw in _VALID:
        return raw  # type: ignore[return-value]
    logger.warning("LLM classifier returned unexpected label %r, defaulting to single_video", raw)
    return "single_video"


# ─── Public entry point ───────────────────────────────────────────────────


async def classify(question: str) -> QueryClass:
    if cls := classify_heuristic(question):
        return cls
    return await classify_llm(question)

"""Groq streaming wrapper.

Bridges Groq's async streaming response to a clean ``async for token``
iterator the SSE route consumes.
"""

from __future__ import annotations

import logging
from typing import AsyncIterator

from groq import AsyncGroq

from app.config import settings

logger = logging.getLogger(__name__)


async def stream_completion(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.3,
    max_tokens: int = 1024,
) -> AsyncIterator[str]:
    """Yield token deltas from Groq Llama 3.3 70B as they arrive.

    Citation-aware: the system prompt already instructs the model to emit
    inline ``[A:M:SS]`` tags. We don't transform the stream — the frontend
    parses citations on the fly via regex.
    """
    client = AsyncGroq(api_key=settings.groq_api_key)
    stream = await client.chat.completions.create(
        model=settings.groq_llm_model,
        messages=messages,  # type: ignore[arg-type]
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta

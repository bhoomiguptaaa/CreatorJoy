"""Embedder interface + BGE-small-en-v1.5 implementation via fastembed.

fastembed uses ONNX Runtime instead of PyTorch, producing identical 384-dim
BGE vectors at ~80 MB RAM vs ~450 MB for the torch/sentence-transformers stack.
This makes it viable on Render's free tier (512 MB total).

The `Embedder` protocol exists so swapping to OpenAI / Cohere / Voyage is a
30-line change.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator, Protocol

from fastapi import FastAPI

from app.config import settings


class Embedder(Protocol):
    dim: int

    def embed(self, texts: list[str]) -> list[list[float]]: ...

    def embed_one(self, text: str) -> list[float]: ...


class BGEEmbedder:
    """fastembed BGE-small-en-v1.5 embedder — ONNX Runtime, no torch."""

    dim: int = 384

    def __init__(self, model_name: str = settings.embedding_model) -> None:
        from fastembed import TextEmbedding
        # fastembed downloads the ONNX model on first use (~90 MB).
        # In Docker we pre-download it at build time via a RUN step.
        self._model = TextEmbedding(model_name=model_name)

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        # fastembed returns a generator of numpy arrays
        vectors = list(self._model.embed(texts))
        return [v.tolist() for v in vectors]

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]


@asynccontextmanager
async def embedder_lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Load the embedding model once at startup, attach to app.state."""
    app.state.embedder = BGEEmbedder()
    try:
        yield
    finally:
        pass


def get_embedder(app: FastAPI) -> Embedder:
    return app.state.embedder

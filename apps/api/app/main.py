"""FastAPI entry point for the Creatorjoy RAG backend.

Lifecycle: open Postgres pool → load BGE embedder → mount routes.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import db_lifespan
from app.embeddings import embedder_lifespan

# Routes are imported lazily inside lifespan to avoid heavy imports at module
# load time when running tests / migrations.


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    async with db_lifespan(app), embedder_lifespan(app):
        # Mount routers after dependencies are ready
        from app.routes import chat, ingest, threads, videos

        app.include_router(ingest.router, prefix="/api", tags=["ingest"])
        app.include_router(videos.router, prefix="/api", tags=["videos"])
        app.include_router(chat.router, prefix="/api", tags=["chat"])
        app.include_router(threads.router, prefix="/api", tags=["threads"])

        yield


app = FastAPI(
    title="Creatorjoy RAG",
    description="The intelligence layer for creator analytics.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz", tags=["meta"])
async def healthz() -> dict[str, str]:
    return {"status": "ok"}

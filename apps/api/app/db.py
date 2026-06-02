"""Database connection pool lifecycle.

We use asyncpg directly (no ORM) for two reasons:
  1. pgvector queries with HNSW are simpler as raw SQL.
  2. We want full control over the per-query metadata filters used by the
     query router; an ORM abstraction adds noise without helping here.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

import asyncpg
from fastapi import FastAPI

from app.config import settings


async def _init_connection(conn: asyncpg.Connection) -> None:
    """Register pgvector type codec on each new connection."""
    await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
    # pgvector type registration — sends/receives as text for portability
    await conn.set_type_codec(
        "vector",
        encoder=lambda v: "[" + ",".join(str(x) for x in v) + "]",
        decoder=lambda s: [float(x) for x in s.strip("[]").split(",") if x],
        schema="public",
        format="text",
    )


@asynccontextmanager
async def db_lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Open and close the asyncpg pool around the app lifecycle."""
    pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=10,
        init=_init_connection,
        command_timeout=30,
    )
    app.state.db_pool = pool
    try:
        yield
    finally:
        await pool.close()


def get_pool(app: FastAPI) -> asyncpg.Pool:
    return app.state.db_pool

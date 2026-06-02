"""Application configuration loaded from environment variables.

Single source of truth for runtime settings. Loaded once at startup;
import the `settings` singleton anywhere it's needed.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── Database ──────────────────────────────────────────────────────
    database_url: str = Field(..., description="Neon Postgres connection string")

    # ─── Groq ──────────────────────────────────────────────────────────
    groq_api_key: str = Field(..., description="Groq API key")
    groq_llm_model: str = "llama-3.3-70b-versatile"
    groq_whisper_model: str = "whisper-large-v3"

    # ─── Embeddings ────────────────────────────────────────────────────
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dim: int = 384

    # ─── HTTP ──────────────────────────────────────────────────────────
    cors_origins_raw: str = Field(default="http://localhost:3000", alias="cors_origins")

    # ─── Limits ────────────────────────────────────────────────────────
    max_video_duration_seconds: int = 5400  # 90 minutes
    video_cache_ttl_seconds: int = 86400    # 24 hours

    # ─── Chunking ──────────────────────────────────────────────────────
    body_chunk_seconds: float = 30.0
    body_chunk_overlap_seconds: float = 5.0
    intro_short_seconds: float = 5.0
    intro_long_seconds: float = 15.0

    # ─── Retrieval ─────────────────────────────────────────────────────
    retrieval_top_k_single: int = 5
    retrieval_top_k_per_video: int = 3  # used for comparison queries

    # ─── yt-dlp authentication ─────────────────────────────────────────
    # YouTube actively blocks unauthenticated yt-dlp on certain videos
    # (newer / more "protected" content). Pick at most one of the two
    # auth paths below; if both unset, the code falls through a chain of
    # alternative player clients (ios → android → web).
    yt_cookies_browser: str | None = None  # "chrome" | "firefox" | "edge" | "safari" | "brave"
    yt_cookies_file: str | None = None     # path to Netscape-format cookies.txt
    yt_cookies_b64: str | None = None      # base64-encoded cookies.txt (for Render env var)

    # ─── YouTube Data API v3 ───────────────────────────────────────────────
    youtube_api_key: str | None = None    # GCP API key — free 10K units/day

    # ─── Apify proxy (residential IPs for YouTube bypass) ─────────────────
    apify_api_token: str | None = None

    # ─── Supadata (YouTube transcript API) ────────────────────────────────
    supadata_api_key: str | None = None

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_raw.split(",") if o.strip()]


settings = Settings()  # type: ignore[call-arg]

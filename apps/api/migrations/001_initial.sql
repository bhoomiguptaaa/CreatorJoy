-- Creatorjoy RAG — initial schema
-- Run with: psql $DATABASE_URL -f migrations/001_initial.sql

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()


-- ─────────────────────────────────────────────────────────────────────────
-- channels: cached creator metadata (saves a yt-dlp call when both videos
-- belong to the same creator, or for repeat ingestions)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
    channel_id          TEXT PRIMARY KEY,
    channel_name        TEXT NOT NULL,
    follower_count      BIGINT,
    last_refreshed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────
-- videos: one row per ingested YouTube video
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS videos (
    video_id            TEXT PRIMARY KEY,           -- 11-char YouTube ID
    url                 TEXT NOT NULL,
    title               TEXT NOT NULL,
    channel_id          TEXT REFERENCES channels(channel_id) ON DELETE SET NULL,
    channel_name        TEXT NOT NULL,
    follower_count      BIGINT,
    view_count          BIGINT NOT NULL DEFAULT 0,
    like_count          BIGINT NOT NULL DEFAULT 0,
    comment_count       BIGINT NOT NULL DEFAULT 0,
    engagement_rate     NUMERIC(10, 6) NOT NULL DEFAULT 0,  -- (likes + comments) / views * 100
    duration_seconds    INT,
    upload_date         DATE,
    thumbnail_url       TEXT,
    description         TEXT,
    tags                TEXT[],
    language            TEXT,
    transcript_full     JSONB,                      -- raw [{text, start, duration}, ...]
    transcript_source   TEXT,                       -- 'native_captions' | 'whisper_fallback'
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_refreshed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);


-- ─────────────────────────────────────────────────────────────────────────
-- chunks: timestamped transcript chunks with embeddings
-- chunk_type:
--   'intro_5s'   — text covering 0–5 seconds (deterministic hook chunk)
--   'intro_15s'  — text covering 0–15 seconds (extended hook chunk)
--   'body'       — 30-second sliding window with 5-second overlap
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chunks (
    chunk_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    text                TEXT NOT NULL,
    start_time          NUMERIC NOT NULL,           -- seconds
    end_time            NUMERIC NOT NULL,           -- seconds
    chunk_type          TEXT NOT NULL CHECK (chunk_type IN ('intro_5s', 'intro_15s', 'body')),
    token_count         INT NOT NULL DEFAULT 0,
    embedding           VECTOR(384),                -- BGE-small-en-v1.5
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Filtering by (video_id, chunk_type) is the hot path for our query router
CREATE INDEX IF NOT EXISTS idx_chunks_video_chunktype
    ON chunks(video_id, chunk_type);

-- HNSW index for fast vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
    ON chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);


-- ─────────────────────────────────────────────────────────────────────────
-- LangGraph PostgresSaver creates its own tables (`checkpoints`,
-- `checkpoint_blobs`, `checkpoint_writes`) at first use — no migration here.
-- ─────────────────────────────────────────────────────────────────────────

-- Chat history for the LangGraph agent.
-- Each turn is one row. thread_id is generated client-side and persisted in
-- localStorage so memory survives page reloads.

CREATE TABLE IF NOT EXISTS chat_messages (
    message_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       TEXT NOT NULL,
    video_a_id      TEXT,
    video_b_id      TEXT,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    query_class     TEXT,                              -- only set on assistant rows
    citations       JSONB NOT NULL DEFAULT '[]'::jsonb, -- only set on assistant rows
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_time
    ON chat_messages(thread_id, created_at);

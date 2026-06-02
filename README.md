# CreatorJoy RAG

>**Paste two YouTube URLs. Ask why one outperformed the other.**

A full-stack RAG system that ingests YouTube videos, indexes their transcripts with timestamp-aware chunks, and lets creators chat about hooks, engagement, and performance — with streaming responses, inline timestamp citations, and conversation memory across turns.

---

## What It Does

- **Ingest two YouTube URLs in one step** — transcripts, channel metadata, and engagement rates are pulled and indexed in ~20 seconds, cached on first ingest.
- **Chat with both videos simultaneously.** The system correctly handles four distinct query shapes:
  - *Single-video* — "What did the creator say about productivity in Video A?"
  - *Comparison* — "Why did Video A outperform Video B?"
  - *Hook analysis* — "Compare the hooks in the first 5 seconds."
  - *Engagement stats* — "What's the engagement rate of each?"
- **Streaming responses with inline citations** like `[A:0:32]` — clicking one seeks the embedded player to that exact timestamp.
- **Conversation memory across turns** — follow-up questions reference context from earlier in the thread.

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │          Next.js 15 (Vercel)        │
                    │  ┌──────────┐   ┌──────────────┐    │
                    │  │ Video A  │   │              │    │
                    │  │  card    │   │  Chat panel  │    │
                    │  ├──────────┤   │  (SSE)       │    │
                    │  │ Video B  │   │              │    │
                    │  │  card    │   │              │    │
                    │  └──────────┘   └──────────────┘    │
                    └────────────────┬────────────────────┘
                                     │ HTTPS / SSE
                    ┌────────────────▼────────────────────┐
                    │           FastAPI (Render)          │
                    │                                     │
                    │   /api/ingest   /api/chat   /api/…  │
                    │                                     │
                    │   ┌─────────────────────────────┐   │
                    │   │ LangGraph StateGraph        │   │
                    │   │ classify → route →          │   │
                    │   │ retrieve → assemble →       │   │
                    │   │ generate (streamed)         │   │
                    │   └─────────────────────────────┘   │
                    └────────┬───────────────────┬────────┘
                             │                   │
                             ▼                   ▼
                  ┌────────────────────┐ ┌──────────────┐
                  │ Neon Postgres      │ │ Groq API     │
                  │  + pgvector (HNSW) │ │  Llama 3.3   │
                  │                    │ │  70B         │
                  │ videos             │ │  Whisper V3  │
                  │ chunks (vec 384)   │ └──────────────┘
                  │ channels           │
                  │ chat_messages      │ ┌──────────────┐
                  └────────────────────┘ │  Transcript  │
                                         │   cascade:   │
                                         │ 1. yt-dlp    │
                                         │ 2. Supadata  │
                                         │ 3. Whisper   │
                                         └──────────────┘
```

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 15 App Router | Streaming SSE consumer; native async patterns |
| Backend | FastAPI | Async-native, clean SSE story |
| Orchestration | LangGraph (not LangChain) | Stateful memory + checkpointing is first-class; LangChain agents are deprecated for stateful flows |
| Embeddings | BGE-small-en-v1.5 via fastembed (384d, ONNX, local) | Free, no API key, MTEB ~62 (matches text-embedding-3-small), 4× smaller vectors → faster HNSW; ONNX runtime uses ~80 MB RAM vs ~450 MB for torch; loaded once at startup |
| Vector DB | pgvector on Neon | One database for vectors + relational metadata + chat checkpoints; HNSW index; atomic, joinable, free |
| Inference | Groq Llama 3.3 70B Versatile | Sub-300ms TTFT — live demo feels instant; free tier sufficient for development and demos |
| Transcripts | 3-stage cascade: youtube-transcript-api → Supadata.ai → Groq Whisper Large V3 | Free path first, residential-IP-safe API second, paid audio fallback last ($0.04/hr) |
| Metadata | YouTube Data API v3 (primary) → yt-dlp fallback | Official API: zero bot risk, free 10K units/day; yt-dlp fires only on quota exhaustion |
| Hosting | Vercel + Render + Neon (all free tiers) | $0 baseline; three external API keys total |

---

## Design Decisions

These are the four calls that distinguish this from a generic two-document RAG demo.

### 1. Timestamp-Aware Chunking with Deterministic Intro Chunks

Generic recursive-character text splitting discards the one piece of metadata a video transcript has that a document doesn't: time. The chunker emits three chunk types at ingest:

- `intro_5s` — text covering 0–5 seconds
- `intro_15s` — text covering 0–15 seconds
- `body` — 30-second sliding windows with 5-second overlap

When a user asks "compare the hooks in the first 5 seconds," the system doesn't rely on top-k semantic search to surface the intro. It metadata-filters: `WHERE chunk_type IN ('intro_5s', 'intro_15s')`. Determinism beats vibes.

### 2. Query-Class Routing Before Retrieval

Naive RAG (embed query → top-k → stuff into prompt) breaks on three of the four query shapes this product needs. Every incoming question is classified and routed to a specialized retrieval strategy:

| Class | Retrieval Strategy | Reason |
|---|---|---|
| `engagement_stats` | No vector retrieval — inject `videos` row as structured JSON | The answer is a Postgres column, not a chunk |
| `hook` | Metadata filter on `chunk_type IN ('intro_5s', 'intro_15s')` for both videos | Deterministic; tagged at ingest |
| `comparison` | Parallel top-k: top-3 from Video A **and** top-3 from Video B | Forces balanced context; naive top-k returns asymmetric results |
| `single_video` | Standard top-k filtered to one video | Default RAG path |

Classification is hybrid: keyword heuristics first (free, fast), small Groq call as fallback for ambiguous queries (~$0.0001 each).

### 3. Engagement Metrics as Structured Context, Not Chunks

Views, likes, comments, follower counts, and engagement rates live in Postgres rows — never embedded, never chunk-searched. Every prompt begins with a `<video_a_stats>` and `<video_b_stats>` block of structured JSON. The LLM does arithmetic directly on these values. Embedding numbers and hoping retrieval surfaces them is the silent failure mode a naive implementation will hit.

### 4. Citation-Aware Streaming

The system prompt instructs Groq to emit inline citations as `[A:0:32]` while streaming. The Next.js client runs a regex over the incoming buffer and replaces matches with clickable badges that seek the embedded YouTube player to that timestamp. Conversation memory is handled by LangGraph's `PostgresSaver` checkpointer, scoped to a `thread_id` persisted in `localStorage`.

---

## Running Locally

**Prerequisites:** Node 20+, Python 3.11+, Poetry, a Neon Postgres URL, and a Groq API key.

```bash
git clone https://github.com/bhoomiguptaaa/CreatorJoy.git
cd CreatorJoy

# Install frontend deps
npm install

# ── Backend ────────────────────────────────────────────
cd apps/api
poetry install
cp .env.example .env
# Fill in DATABASE_URL and GROQ_API_KEY at minimum.
# Optional: YT_COOKIES_BROWSER=firefox  (or edge / chrome)

# Run migrations
poetry run psql "$DATABASE_URL" -f migrations/001_initial.sql
poetry run psql "$DATABASE_URL" -f migrations/002_chat.sql

# Start API on port 8000
poetry run uvicorn app.main:app --reload

# ── Frontend (new terminal) ────────────────────────────
cd apps/web
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Why the env vars matter:**

- `YT_COOKIES_BROWSER` enables the cookies-from-browser auth strategy in the yt-dlp chain. Without it you still reach ~95% of public videos via the iOS/Android player-client fallbacks; with it you hit ~99%.
- `NEXT_PUBLIC_API_URL` is required because Next.js's dev-server proxy buffers Server-Sent Events. `EventSource` hits the FastAPI backend directly to preserve token-by-token streaming. CORS is preconfigured on the backend for `http://localhost:3000`.

---

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ingest` | `POST` | `{url_a, url_b}` → ingests both videos, returns metadata |
| `/api/videos/{video_id}` | `GET` | Cached metadata fetch |
| `/api/chat` | `GET` (SSE) | `?thread_id&video_a&video_b&question` → streams tokens + citations |
| `/api/threads/{thread_id}` | `GET` | Restore chat history on reload |
| `/healthz` | `GET` | Liveness check |

---

## Cost Analysis at 1,000 Creators / Day

*Assumptions: each creator analyzes 2 videos (~30 min average), 5 chat turns per session, 30% cache hit rate on repeat-popular videos.*

| Component | Per Creator | At 1K/day |
|---|---|---|
| Transcript (native captions) | $0 | $0 |
| Transcript (Whisper fallback, ~10% of videos) | $0.04 × 0.1 × 0.5 hr | ~$2 |
| Embeddings (BGE local) | $0 | $0 |
| LLM inference (Groq Llama 3.3 70B, 5 turns × ~3K in / 500 out) | ~$0.011 | ~$11 |
| Postgres (Neon free tier) | $0 | $0 |
| **Total** | **~$0.013** | **~$13/day** |

For reference: the same workload on GPT-4o runs ~$45/day; on GPT-4 Turbo, ~$120/day.

---

## Scaling Limits & Migration Path

The current stack handles the MVP load cleanly. Here's where each layer starts to bend and what replaces it:

- **>50M vectors / >500 QPS sustained** → migrate to Qdrant; open-source, drop-in API, better filter performance than Pinecone.
- **>10K creators/day** → introduce Redis result cache for common queries; pre-compute embeddings for popular videos asynchronously.
- **Multi-tenant with strict isolation** → row-level security on Postgres, or separate schemas per tenant.

---

## Production Reliability Path

The MVP uses a yt-dlp strategy chain (cookies → iOS player client → Android player client → web client) for both metadata and audio. This reaches ~95% of public YouTube videos for $0 in third-party fees. It is deliberately scoped for an MVP and has three known fragility points in production:

1. Browser cookies don't work in containerized environments — no installed browser to read from.
2. Cookie files expire and require rotation infrastructure.
3. YouTube ships new bot-detection rules frequently — even the strategy chain has an irreducible ~5% failure rate.

Production splits data acquisition into two independent layers, each with paid commercial fallbacks.

### Metadata Layer

| Provider | Cost | Reliability | Role |
|---|---|---|---|
| YouTube Data API v3 | Free up to 10K units/day; ~$5/M after | 100% — official, never blocked | Primary always |
| yt-dlp + cookie chain | Free | ~95% | Fallback on quota exhaustion |

### Transcript Layer (3-Stage Cascade)

| Stage | Provider | Per-Transcript Cost | Cumulative Success |
|---|---|---|---|
| 1 | youtube-transcript-api (rotating proxies) | $0 | ~70% |
| 2 | Apify YouTube Transcript Scraper | ~$0.0005 | ~95% |
| 3 | yt-dlp via Apify proxy → Groq Whisper Large V3 | ~$0.02 audio + $0.04/hr transcription | ~99.5% |

**Cost with the production stack at 1K creators/day:**

| Component | Daily Cost |
|---|---|
| YouTube Data API v3 (within free quota) | $0 |
| Transcript stage 1 (~70%) | $0 |
| Transcript stage 2 — Apify (~25%) | ~$0.25 |
| Transcript stage 3 — Whisper (~5%) | ~$2.00 |
| **Reliability uplift over MVP** | **~$2.25/day** |

That's $0.00225 per creator per day for 99.5% transcript reliability. The ~$11/day LLM cost still dominates unit economics — production reliability doesn't materially change the cost story.

### Why the Migration Is One PR, Not a Rewrite

`services/youtube.py` and `services/transcripts.py` already separate metadata from transcripts and use a fallback structure. Production means swapping implementations behind the same interface:

```python
# Current (MVP)
class TranscriptFetcher:
    async def fetch(video_id) -> Transcript:
        # 1. youtube-transcript-api
        # 2. yt-dlp + Whisper

# Production
class TranscriptFetcher:
    async def fetch(video_id) -> Transcript:
        # 1. youtube-transcript-api (with proxy rotation)
        # 2. ApifyTranscriptProvider
        # 3. ApifyAudioDownload + AssemblyAI
```

Same interface. Same DB writes. Same caller. Behind a per-tenant feature flag, the same codebase serves a free tier (yt-dlp chain) and a paid tier (full Apify/AssemblyAI cascade) without structural change.

### Operational Additions for Production

- **Per-strategy success-rate monitoring** — track which stage succeeded per video; alert when stage-1 drops below 60%.
- **Auto-failover** — disable cookies-from-browser if it returns 401 on two consecutive videos.
- **Async ingestion** — replace the inline ingest call with a Celery + Redis job queue; return a `job_id` immediately and let the frontend poll or subscribe via SSE.
- **Retry budget** — cap total provider spend per video at $0.50 to prevent runaway cost on adversarial inputs.

---

## Future Work

- **Multi-platform ingestion** — TikTok metadata is already supported by yt-dlp; transcripts require Whisper (no native captions). Instagram Reels needs a Meta Graph API token and is explicitly out of scope for the MVP.
- **Cohere Rerank at retrieval time** — boosts top-k precision by ~15% for ~$0.001/query.
- **Semantic chunking** — using transcript topic shifts (BERTopic or e5-mistral-based segmentation) as an alternative to time-based windows.
- **Per-creator workspaces** behind Clerk auth with multi-tenant row-level security.
- **Cohort comparison** — analyze a creator's full catalog against the platform median for their niche.

---



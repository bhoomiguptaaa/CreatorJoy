# Creatorjoy RAG

> Paste two YouTube URLs. Ask why one outperformed the other.

A full-stack RAG system that ingests YouTube videos, indexes their transcripts with timestamp-aware chunks, and lets creators chat about hooks, engagement, and improvements with **streaming responses**, **source citations**, and **conversation memory**.

**Live demo:** https://creatorjoy-rag.vercel.app


---

## What it does

- Ingest two YouTube URLs in one step — transcripts, channel metadata, and engagement rates pulled and indexed in ~20 seconds (cached after first ingest).
- Chat with both videos simultaneously. The system handles four query shapes correctly:
  - **Single-video** — _"What did the creator say about productivity in Video A?"_
  - **Comparison** — _"Why did Video A outperform Video B?"_
  - **Hook analysis** — _"Compare the hooks in the first 5 seconds."_
  - **Engagement stats** — _"What's the engagement rate of each?"_
- Streaming responses with inline citations like `[A:0:32]` that on click jump the embedded video to that timestamp.
- Conversation memory across turns — second message references context from the first.

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │       Next.js 15 (Vercel)           │
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
                    │        FastAPI (Render)             │
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
                  └────────────────────┘ │ Transcript   │
                                         │  cascade:    │
                                         │ 1. yt-       │
                                         │  transcript  │
                                         │  -api        │
                                         │ 2. Supadata  │
                                         │  .ai API     │
                                         │ 3. yt-dlp +  │
                                         │  Whisper V3  │
                                         └──────────────┘
                                         ┌──────────────┐
                                         │ Metadata:    │
                                         │ YouTube Data │
                                         │  API v3 →    │
                                         │ yt-dlp       │
                                         │  fallback    │
                                         └──────────────┘
```

---

## Tech stack & why

| Layer | Choice | Why this over alternatives |
|---|---|---|
| Frontend | Next.js 16.2.6 App Router | Required by JD; streaming SSE consumer |
| Backend | FastAPI | Async-native, clean SSE story, required by JD |
| Orchestration | **LangGraph** (not LangChain) | Stateful memory + checkpointing is first-class. LangChain agents are deprecated in favor of LangGraph for stateful flows. |
| Embeddings | **BGE-small-en-v1.5 via fastembed** (384d, ONNX, local) | Free, no API key, MTEB ~62 (matches `text-embedding-3-small`), 4× smaller vectors → faster HNSW. ONNX runtime uses ~80MB RAM vs ~450MB for torch. Loaded once at FastAPI startup. |
| Vector DB | **pgvector on Neon** | One database for vectors + relational metadata + chat checkpoints. HNSW index. Atomic, joinable, free. |
| Inference | **Groq Llama 3.3 70B Versatile** | Sub-300ms TTFT — live demo feels instant. Free tier generous enough for development and demos. |
| Transcript | **3-stage cascade:** youtube-transcript-api → Supadata.ai → Groq Whisper Large V3 | Free path first, residential-IP-safe API second, paid audio fallback last ($0.04/hr). |
| Metadata | **YouTube Data API v3** (primary) → yt-dlp fallback | Official API: zero bot risk, free 10K units/day. yt-dlp only fires if quota exhausted. |
| Hosting | Vercel + Render free tier + Neon free tier | $0 baseline. Three external API keys total. |

---

## The four design decisions that matter

These are the calls that separate this from a generic two-document RAG demo. Each one is the answer to a question a hiring manager would actually ask.

### 1. Timestamp-aware chunking with deterministic intro chunks

Generic recursive-character text splitting throws away the one piece of metadata a video transcript has that a document doesn't: time. Our chunker emits:

- `intro_5s` — text covering 0–5 seconds, marked at ingest
- `intro_15s` — text covering 0–15 seconds, marked at ingest
- `body` — 30-second sliding windows with 5-second overlap

When the user asks _"compare the hooks in the first 5 seconds,"_ we don't pray top-k semantic search surfaces the intro. We metadata-filter: `WHERE chunk_type IN ('intro_5s', 'intro_15s')`. Determinism beats vibes.

### 2. Query-class routing before retrieval

Naive RAG (embed query → top-k → stuff into prompt) breaks on three of the four query shapes this product needs to answer. We classify every incoming question and route to a specialized retrieval strategy:

| Class | Retrieval strategy | Reason |
|---|---|---|
| `engagement_stats` | **No vector retrieval.** Inject `videos` row as structured JSON. | The answer is a Postgres column, not a chunk. |
| `hook` | Metadata filter on `chunk_type IN ('intro_5s','intro_15s')` for both videos. | Deterministic — we tagged these at ingest. |
| `comparison` | **Parallel top-k:** top-3 from Video A AND top-3 from Video B. | Forces balanced context. Naive top-k returns asymmetric results. |
| `single_video` | Standard top-k filtered to one video. | Default RAG path. |

Classification: hybrid — keyword heuristics first (free, fast), small Groq call as fallback for ambiguous queries (~$0.0001).

### 3. Engagement metrics as structured context, not chunks

Views, likes, comments, follower counts, engagement rates live in Postgres rows — never embedded, never chunk-searched. Every prompt to the LLM begins with a `<video_a_stats>` and `<video_b_stats>` block of structured JSON. The LLM does math on these directly. Embedding numbers and hoping retrieval finds them is the silent failure mode every other applicant will hit.

### 4. Citation-aware streaming

The system prompt instructs Groq to emit inline citations as `[A:0:32]` while streaming. The Next.js client runs a regex over the streaming buffer and replaces matches with clickable badges that seek the embedded YouTube player to that timestamp. Memory is handled by LangGraph's `PostgresSaver` checkpointer, scoped to a `thread_id` persisted in `localStorage`.

---

## Cost analysis at 1,000 creators / day

Assumptions: each creator analyzes 2 videos (~30 min average), has 5 chat turns per session, 30% cache hit rate on repeat-popular videos.

| Component | Per creator | At 1K/day |
|---|---|---|
| Transcript (native captions) | $0 | $0 |
| Transcript (Whisper fallback, ~10% of videos) | $0.04 × 0.1 × 0.5 hr | ~$2 |
| Embedding (BGE local, no API) | $0 | $0 |
| Embedding API alternative (`text-embedding-3-small`) | ~$0.0005 | ~$0.50 |
| LLM inference (Groq Llama 3.3 70B, 5 turns × ~3K in / 500 out) | ~$0.011 | ~$11 |
| Postgres (Neon free tier) | $0 | $0 |
| **Total** | **~$0.013** | **~$13/day** |

That's **$0.013 per creator per session** — well under typical SaaS unit economics. For comparison, the same workload on GPT-4o would run ~$45/day; on GPT-4 Turbo, ~$120/day.

### When this stack stops scaling

- **>50M vectors with sustained >500 QPS** → migrate to Qdrant (open-source, drop-in API, better filter performance than Pinecone).
- **>10K creators/day** → introduce Redis result cache for top common queries; pre-compute embeddings for popular videos asynchronously.
- **Multi-tenant with strict isolation** → row-level security on Postgres or separate schemas per tenant.

---

## Production reliability path

The MVP uses a yt-dlp **strategy chain** (cookies → iOS player client → Android player client → web client) for both metadata and audio download. This gets us ~95% of public YouTube videos for $0 in third-party fees. It is **deliberately scoped for a weekend technical screen** and is fragile for production for three reasons:

1. **Browser cookies don't work in containerized prod** — there's no installed browser to read from.
2. **Cookie files expire** and need rotation infrastructure.
3. **YouTube ships new bot-detection rules every few weeks** — even the strategy chain has an irreducible ~5% failure rate.

Production-grade Creatorjoy splits data acquisition into **two independent layers**, each with paid commercial fallbacks. yt-dlp moves from primary path to free fallback.

### Metadata layer (production)

Replace yt-dlp metadata with the **official YouTube Data API v3**:

| Provider | Cost | Reliability | Role |
|---|---|---|---|
| YouTube Data API v3 | Free up to 10,000 units/day; ~$5/M units after | 100% — official, never blocked | Primary always |
| yt-dlp + cookies + chain | Free | ~95% | Fallback if quota exhausted |

The official API returns title, channel info, follower count, views, likes, comments, upload date, duration — everything needed to compute engagement rate. Zero anti-bot risk. Free quota covers ~2,500 video lookups per day; cost is negligible above that.

Caveat: the official API does **not** provide transcripts for arbitrary videos (only ones the API caller owns). That's the next layer.

### Transcript layer (production cascade)

A three-stage cascade where each stage is more reliable but more expensive. Stage one handles the easy ~70%; stages two and three pick up the long tail.

| Stage | Provider | Per-transcript cost | Cumulative success |
|---|---|---|---|
| 1 | youtube-transcript-api with rotating proxies | $0 | ~70% |
| 2 | Apify YouTube Transcript Scraper actor | ~$0.0005 | ~95% |
| 3 | yt-dlp via Apify proxy → AssemblyAI / Groq Whisper Large V3 | ~$0.02 audio + $0.04/hr transcription | ~99.5% |

**Apify is the production substitute for the cat-and-mouse fight.** They run a fleet of residential proxies and maintain the YouTube scraping stack as their core business. Production-grade Creatorjoy outsources that fight at $0.50 per 1,000 transcripts. Equivalent providers in this space: Supadata.ai, Tactiq, ScrapingBee.

### Cost at 1,000 creators / day with the production stack

Per creator: 2 videos.

| Component | Daily cost |
|---|---|
| YouTube Data API v3 (within free 10K-unit quota) | $0 |
| Transcript stage 1 (~70% of videos) | $0 |
| Transcript stage 2 — Apify (~25%) | ~$0.25 |
| Transcript stage 3 — Whisper (~5%) | ~$2.00 |
| **Reliability budget added on top of MVP cost** | **~$2.25/day** |

That's **$0.00225 per creator per day for 99.5% transcript reliability with zero engineering ops on the YouTube side.** The $11/day LLM cost still dominates the unit economics — i.e., adding production reliability does **not** materially change the cost story.

### Why the migration is one PR, not a rewrite

The current `services/youtube.py` and `services/transcripts.py` already separate metadata from transcripts and use a fallback structure. Production means swapping implementations behind the same interface:

```python
# Current (weekend MVP)
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

Same interface. Same DB writes. Same caller. Behind a per-tenant feature flag, the same codebase serves a free tier (yt-dlp chain) and a paid tier (full Apify/AssemblyAI cascade) without any structural change.

### Operational layer

Beyond providers, production also needs:

- **Per-strategy success-rate monitoring.** Track which strategy succeeded for each video; alert when stage-1 success drops below 60%.
- **Auto-failover** when a strategy degrades (e.g., disable cookies-from-browser if it returns 401 for two consecutive videos).
- **Async ingestion** for long videos. Replace the inline ingest call with a Celery + Redis job queue; return a `job_id` immediately and let the frontend poll or subscribe.
- **Retry budget.** Cap total provider spend per video at $0.50 to prevent runaway cost on adversarial inputs.

---

## Running locally

### Prerequisites

- Node 20+, Python 3.11+, [Poetry](https://python-poetry.org/docs/#installation), a Neon Postgres URL, and a Groq API key.

### Setup

```bash
git clone https://github.com/Yash600/creatorjoy-rag.git
cd creatorjoy-rag

# Install frontend deps via npm workspaces
npm install

# ─── Backend ──────────────────────────────────────────
cd apps/api
poetry install
cp .env.example .env
# Fill in DATABASE_URL and GROQ_API_KEY at minimum.
# Optional but recommended for max ingest reliability:
#   YT_COOKIES_BROWSER=firefox  (or edge / chrome)

# Run migrations (or paste each .sql file into Neon's SQL editor)
poetry run psql "$DATABASE_URL" -f migrations/001_initial.sql
poetry run psql "$DATABASE_URL" -f migrations/002_chat.sql

# Start the API (port 8000)
poetry run uvicorn app.main:app --reload

# ─── Frontend (new terminal) ──────────────────────────
cd apps/web
cp .env.example .env.local
# .env.local must contain:
#   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
# (used by EventSource — the dev-server rewrite buffers SSE)
npm run dev
```

Open `http://localhost:3000`.

### Why the env vars matter

- `YT_COOKIES_BROWSER` enables the cookies-from-browser auth strategy in the yt-dlp chain. Without it you still hit ~95% of public videos via the iOS/Android player-client fallbacks; with it you hit ~99% (the missing 1% are videos that block embeds entirely).
- `NEXT_PUBLIC_API_URL` is required because Next.js's dev-server proxy buffers Server-Sent Events. EventSource hits the FastAPI backend directly to preserve token-by-token streaming. CORS is preconfigured on the backend for `http://localhost:3000`.

---

## API reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ingest` | POST | `{url_a, url_b}` → ingests both videos, returns metadata |
| `/api/videos/{video_id}` | GET | Cached metadata fetch |
| `/api/chat` | GET (SSE) | `?thread_id&video_a&video_b&question` → streams tokens + citations |
| `/api/threads/{thread_id}` | GET | Restore chat history on reload |
| `/healthz` | GET | Liveness check |

---

## Future work

- **Multi-platform ingestion.** TikTok metadata is already supported by yt-dlp; transcripts require Whisper (no native captions). Instagram Reels needs a Meta Graph API token (Instagram Basic Display app review) — explicitly scoped out of the weekend MVP because the auth flow alone is a multi-day project.
- **Cohere Rerank** at retrieval time — boosts top-k precision by ~15% for ~$0.001/query.
- **Semantic chunking** as an alternative to time-based, using transcript topic shifts (BERTopic or e5-mistral-based segmentation).
- **Per-creator workspaces** behind Clerk auth; multi-tenant isolation via row-level security.
- **Cohort comparison** — analyze a creator's full catalog vs. the platform median for their niche.

(Production reliability concerns — provider cascade, async ingestion queue, monitoring — are covered in the [Production reliability path](#production-reliability-path) section above.)

---

## License

MIT

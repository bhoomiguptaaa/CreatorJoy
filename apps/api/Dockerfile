# ─── Build stage ─────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

# Build tools needed by asyncpg, psycopg, and other C-extension packages
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        g++ \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for layer caching
COPY requirements.txt ./

# Install all runtime deps into the system Python
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download fastembed ONNX model so cold starts don't hit the CDN.
# fastembed caches to ~/.cache/fastembed-models by default.
ENV FASTEMBED_CACHE_PATH=/root/.cache/fastembed-models
RUN python - <<'EOF'
from fastembed import TextEmbedding
list(TextEmbedding(model_name="BAAI/bge-small-en-v1.5").embed(["warmup"]))
print("fastembed BGE model cached successfully.")
EOF


# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM python:3.11-slim

# ffmpeg for yt-dlp audio extraction + libpq for psycopg at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Tell fastembed where the pre-downloaded model lives (must match builder path)
ENV FASTEMBED_CACHE_PATH=/root/.cache/fastembed-models

WORKDIR /app

# Copy installed Python packages from builder
COPY --from=builder /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy pre-downloaded HuggingFace model cache
COPY --from=builder /root/.cache /root/.cache

# Copy application source
COPY app/ ./app/
COPY migrations/ ./migrations/

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

"""Standalone ingestion diagnostic.

Walks every stage of the ingestion pipeline against a single URL and prints
PASS/FAIL at each checkpoint, so we can see exactly which step is failing
instead of getting a vague 500 error from the API.

Usage:
    cd D:\\creatorsjoy\\apps\\api
    poetry run python scripts/diagnose.py "https://youtu.be/maFuWOprKfU"

Each checkpoint either prints a green PASS with key facts (file size,
chunk count, etc.) or a red FAIL with the exception. The script keeps
going after a failure so you see how far into the pipeline things get.
"""

from __future__ import annotations

import asyncio
import sys
import tempfile
import traceback
from pathlib import Path

# ANSI color helpers
GREEN = "\x1b[32m"
RED = "\x1b[31m"
DIM = "\x1b[2m"
BOLD = "\x1b[1m"
RESET = "\x1b[0m"


def ok(label: str, detail: str = "") -> None:
    print(f"  {GREEN}✓ PASS{RESET}  {label}  {DIM}{detail}{RESET}")


def fail(label: str, err: BaseException) -> None:
    print(f"  {RED}✗ FAIL{RESET}  {label}")
    print(f"         {RED}{type(err).__name__}: {err}{RESET}")


def header(n: int, title: str) -> None:
    print()
    print(f"{BOLD}── Step {n}: {title} ──{RESET}")


async def main(url: str) -> None:
    print(f"\n{BOLD}Ingestion diagnostic for:{RESET}  {url}\n")

    # Step 1: Parse URL
    header(1, "Parse URL → video_id")
    from app.services.youtube import extract_video_id

    try:
        video_id = extract_video_id(url)
        ok("URL parsed", f"video_id = {video_id}")
    except Exception as e:
        fail("URL parse", e)
        return

    # Step 2: Metadata via yt-dlp
    header(2, "Fetch metadata (yt-dlp + strategy chain)")
    from app.services.youtube import fetch_video_info

    info = None
    try:
        info = await asyncio.to_thread(fetch_video_info, video_id)
        ok(
            "yt-dlp metadata",
            f"title={info.title!r}, duration={info.duration_seconds}s, "
            f"views={info.view_count:,}",
        )
    except Exception as e:
        fail("yt-dlp metadata", e)
        traceback.print_exc()
        return

    # Step 3a: Native captions
    header(3, "Fetch transcript")
    print(f"  {DIM}3a — try youtube-transcript-api first{RESET}")
    from app.services.transcripts import fetch_native_captions

    transcript = None
    source = None
    try:
        transcript = await fetch_native_captions(video_id)
        if transcript:
            source = "native_captions"
            ok(
                "native captions",
                f"{len(transcript)} segments, "
                f"first = {transcript[0].text[:60]!r}",
            )
        else:
            print(f"  {DIM}native captions returned None — falling through to Whisper{RESET}")
    except Exception as e:
        fail("native captions (unexpected)", e)

    # Step 3b: Whisper fallback (only if 3a missed)
    if not transcript:
        print(f"\n  {DIM}3b — fall back to yt-dlp audio download + Groq Whisper{RESET}")

        # 3b.i: Audio download
        from app.services.youtube import download_audio

        audio_path = None
        with tempfile.TemporaryDirectory(prefix="diagnose_") as tmpdir:
            try:
                audio_path = await asyncio.to_thread(download_audio, video_id, tmpdir)
                size_mb = audio_path.stat().st_size / 1024 / 1024
                ok("audio download", f"{audio_path.name}, {size_mb:.2f} MB")
                if size_mb > 24:
                    fail(
                        "size check",
                        RuntimeError(
                            f"file is {size_mb:.1f} MB — exceeds Groq Whisper's 25 MB cap"
                        ),
                    )
                    return
            except Exception as e:
                fail("audio download", e)
                traceback.print_exc()
                return

            # 3b.ii: Whisper transcription
            from app.services.transcripts import _whisper_transcribe

            try:
                transcript = await _whisper_transcribe(audio_path)
                source = "whisper_fallback"
                ok(
                    "Groq Whisper",
                    f"{len(transcript)} segments, "
                    f"first = {transcript[0].text[:60]!r}" if transcript else "EMPTY",
                )
            except Exception as e:
                fail("Groq Whisper", e)
                traceback.print_exc()
                return

    if not transcript:
        fail("transcript", RuntimeError("both native captions and Whisper produced nothing"))
        return

    # Step 4: Chunking
    header(4, "Chunk transcript")
    from app.services.chunker import chunk_transcript

    try:
        chunks = chunk_transcript(transcript, video_id=video_id)
        types = {}
        for c in chunks:
            types[c.chunk_type] = types.get(c.chunk_type, 0) + 1
        ok(
            "chunker",
            f"{len(chunks)} chunks → " + ", ".join(f"{k}={v}" for k, v in types.items()),
        )
    except Exception as e:
        fail("chunker", e)
        traceback.print_exc()
        return

    # Step 5: Embeddings
    header(5, "Embed chunks (BGE-small-en-v1.5)")
    from app.embeddings import BGEEmbedder

    try:
        print(f"  {DIM}loading BGE model (~30s on first run)…{RESET}")
        embedder = BGEEmbedder()
        embeddings = await asyncio.to_thread(embedder.embed, [c.text for c in chunks])
        ok(
            "BGE embed",
            f"{len(embeddings)} vectors of dim {len(embeddings[0]) if embeddings else 0}",
        )
    except Exception as e:
        fail("BGE embed", e)
        traceback.print_exc()
        return

    # Step 6: Database connectivity (read-only — don't actually insert)
    header(6, "Database connectivity (Neon + pgvector)")
    import asyncpg
    from app.config import settings

    try:
        conn = await asyncpg.connect(settings.database_url)
        version = await conn.fetchval("SELECT version()")
        chunk_count = await conn.fetchval("SELECT COUNT(*) FROM chunks")
        await conn.close()
        ok(
            "DB connect",
            f"{version[:40]}…, existing chunks in DB = {chunk_count}",
        )
    except Exception as e:
        fail("DB connect", e)
        traceback.print_exc()
        return

    # Done
    print(f"\n{GREEN}{BOLD}All checkpoints passed.{RESET}")
    print(
        f"\nThe app's /api/ingest should succeed for this URL. If it doesn't, "
        f"the bug is in the route layer (concurrency, response serialization)."
    )
    print(f"\n  source: {source}")
    print(f"  metadata: {info.title!r} by {info.channel_name!r}")
    print(f"  chunks: {len(chunks)}, embeddings: {len(embeddings)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: poetry run python scripts/diagnose.py <youtube-url>")
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))

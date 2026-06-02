// Thin typed client for the FastAPI backend.
//
// All requests bypass Next.js's dev-server proxy via an absolute URL.
// Reasons:
//   - The proxy buffers SSE responses (chat would arrive as a blob)
//   - The proxy times out long-running requests (ingest of long videos
//     gets cut to a generic 500 even though the backend eventually returns 200)
//
// Set NEXT_PUBLIC_API_URL in .env.local to the FastAPI origin
// (http://127.0.0.1:8000 locally, your Render URL in prod).
// CORS is preconfigured on the backend for http://localhost:3000.

import type {
  IngestResponse,
  ThreadHistoryResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return res.json();
  let detail = `${res.status} ${res.statusText}`;
  try {
    const body = await res.json();
    detail = body.detail ?? detail;
  } catch {
    // body wasn't JSON; keep status text
  }
  throw new ApiError(res.status, detail);
}

export async function ingestVideos(
  urlA: string,
  urlB: string,
  signal?: AbortSignal,
): Promise<IngestResponse> {
  const res = await fetch(`${API_BASE}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url_a: urlA, url_b: urlB }),
    signal,
  });
  return jsonOrThrow<IngestResponse>(res);
}

export async function fetchThreadHistory(
  threadId: string,
  signal?: AbortSignal,
): Promise<ThreadHistoryResponse> {
  const res = await fetch(
    `${API_BASE}/api/threads/${encodeURIComponent(threadId)}`,
    { signal },
  );
  return jsonOrThrow<ThreadHistoryResponse>(res);
}

/**
 * Build the /api/chat URL for an EventSource. Same absolute-URL approach
 * as the other endpoints — bypasses dev-server SSE buffering.
 */
export function buildChatUrl(params: {
  threadId: string;
  videoAId: string;
  videoBId: string;
  question: string;
}): string {
  const qs = new URLSearchParams({
    thread_id: params.threadId,
    video_a_id: params.videoAId,
    video_b_id: params.videoBId,
    question: params.question,
  });
  return `${API_BASE}/api/chat?${qs.toString()}`;
}

export { ApiError };

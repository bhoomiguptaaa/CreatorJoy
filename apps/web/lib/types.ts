// Shared types — kept manually in sync with apps/api/app/schemas.py.
// We don't auto-generate to avoid an extra build step in a weekend project.

export interface VideoMetadata {
  video_id: string;
  url: string;
  title: string;
  channel_name: string;
  channel_id?: string | null;
  follower_count?: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  engagement_rate: number;
  duration_seconds?: number | null;
  upload_date?: string | null;
  thumbnail_url?: string | null;
  language?: string | null;
  transcript_source?: "native_captions" | "whisper_fallback" | null;
  ingested_at: string;
}

export interface IngestResponse {
  video_a: VideoMetadata;
  video_b: VideoMetadata;
}

export type QueryClass =
  | "single_video"
  | "comparison"
  | "hook"
  | "engagement_stats";

export interface Citation {
  video_id: string;
  video_label: "A" | "B";
  start_time: number;
  end_time: number;
  chunk_type: string;
  text_preview: string;
}

export interface ChatMetadataEvent {
  query_class: QueryClass;
  citations: Citation[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  query_class?: QueryClass;
  citations?: Citation[];
  // Client-only flags
  isStreaming?: boolean;
}

export interface ThreadHistoryResponse {
  thread_id: string;
  video_a_id?: string | null;
  video_b_id?: string | null;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    citations: Citation[];
    created_at: string;
  }>;
}

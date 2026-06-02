"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  formatCount,
  formatDate,
  formatDuration,
  formatRate,
} from "@/lib/format";
import type { VideoMetadata } from "@/lib/types";

interface SeekRequest {
  seconds: number;
  nonce: number;
}

interface Props {
  label: "A" | "B";
  video: VideoMetadata;
  seek: SeekRequest | null;
}

export function VideoCard({ label, video, seek }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isA = label === "A";

  useEffect(() => {
    if (!seek || !iframeRef.current?.contentWindow) return;
    const cw = iframeRef.current.contentWindow;
    cw.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [seek.seconds, true] }),
      "*",
    );
    cw.postMessage(
      JSON.stringify({ event: "command", func: "playVideo", args: [] }),
      "*",
    );
  }, [seek?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const embedSrc = `https://www.youtube.com/embed/${video.video_id}?enablejsapi=1&rel=0`;
  const isWhisper = video.transcript_source === "whisper_fallback";

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden fade-in transition-all duration-200">
      {/* Label bar */}
      <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold font-mono border",
              isA
                ? "bg-[var(--video-a)]/10 border-[var(--video-a)]/20 text-[var(--video-a)]"
                : "bg-[var(--video-b)]/10 border-[var(--video-b)]/20 text-[var(--video-b)]"
            )}
          >
            {label}
          </span>
          <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[200px]">
            {video.channel_name}
          </span>
        </div>
        <span className="text-[9px] font-mono text-[var(--text-secondary)] bg-[var(--surface-raised)] border border-[var(--border)] px-2 py-0.5 rounded">
          {isWhisper ? "whisper" : "native captions"}
        </span>
      </div>

      {/* Embed */}
      <div className="relative aspect-video bg-[#000]">
        <iframe
          ref={iframeRef}
          src={embedSrc}
          className="absolute inset-0 w-full h-full border-none"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* Info */}
      <div className="px-4 py-3.5 space-y-3.5">
        <div className="text-sm font-semibold leading-snug line-clamp-2 text-[var(--text-primary)]">
          {video.title}
        </div>
        <div className="text-[11px] font-mono text-[var(--text-secondary)]">
          {formatCount(video.follower_count)} subscribers · uploaded {formatDate(video.upload_date)}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Stat label="Views" value={formatCount(video.view_count)} />
          <Stat label="Likes" value={formatCount(video.like_count)} />
          <Stat label="Comments" value={formatCount(video.comment_count)} />
          <Stat label="Duration" value={formatDuration(video.duration_seconds)} />
          <Stat
            label="Engagement"
            value={formatRate(video.engagement_rate)}
            highlight
            videoLabel={label}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  videoLabel,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  videoLabel?: "A" | "B";
}) {
  const isA = videoLabel === "A";
  return (
    <div
      className={cn(
        "rounded-md px-2.5 py-1.5 transition-all border",
        highlight
          ? isA
            ? "bg-[var(--video-a)]/5 border-[var(--video-a)]/20"
            : "bg-[var(--video-b)]/5 border-[var(--video-b)]/20"
          : "bg-[var(--surface-raised)] border-[var(--border-subtle)]"
      )}
    >
      <div className="text-[8px] uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-0.5 font-mono">
        {label}
      </div>
      <div
        className={cn(
          "text-xs font-bold font-mono",
          highlight
            ? isA
              ? "text-[var(--video-a)]"
              : "text-[var(--video-b)]"
            : "text-[var(--text-primary)]"
        )}
      >
        {value}
      </div>
    </div>
  );
}

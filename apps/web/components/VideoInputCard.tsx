"use client";

import React from "react";
import { 
  BadgeCheck, 
  Eye, 
  ThumbsUp, 
  MessageSquare, 
  Users, 
  Youtube, 
  Instagram 
} from "lucide-react";
import { formatNumber, formatDate, formatRate } from "@/lib/format";

interface VideoInputCardProps {
  label: "A" | "B";
  value: string;
  onChange: (url: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  video?: {
    title: string;
    channel: string;
    verified: boolean;
    date: string;
    duration: string;
    thumbnail: string;
    views: number;
    likes: number;
    comments: number;
    subscribers: number;
    engagementRate: number;
  };
}

export function VideoInputCard({
  label,
  value,
  onChange,
  onSubmit,
  loading = false,
  video,
}: VideoInputCardProps) {
  const isA = label === "A";

  // Loading state
  if (loading) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 transition-all duration-200">
        {/* Label above input */}
        <div className="flex items-center gap-1.5 mb-2 font-mono text-xs text-[var(--text-muted)] uppercase tracking-widest select-none">
          <span
            className={`w-2 h-2 rounded-full ${
              isA ? "bg-[var(--video-a)]" : "bg-[var(--video-b)]"
            }`}
          />
          Video {label}
        </div>

        {/* Skeleton Shimmer */}
        <div className="space-y-4">
          <div className="aspect-video w-full rounded-lg shimmer bg-[var(--surface-raised)]" />
          <div className="space-y-2">
            <div className="h-4 w-4/5 rounded shimmer bg-[var(--surface-raised)]" />
            <div className="h-3 w-1/3 rounded shimmer bg-[var(--surface-raised)]" />
          </div>
          <div className="flex gap-2 flex-wrap pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-7 w-20 rounded-full shimmer bg-[var(--surface-raised)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Loaded state
  if (video) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 transition-all duration-200">
        {/* Label above input */}
        <div className="flex items-center gap-1.5 mb-2 font-mono text-xs text-[var(--text-muted)] uppercase tracking-widest select-none">
          <span
            className={`w-2 h-2 rounded-full ${
              isA ? "bg-[var(--video-a)]" : "bg-[var(--video-b)]"
            }`}
          />
          Video {label}
        </div>

        {/* Thumbnail with duration badge */}
        <div className="relative aspect-video w-full rounded-lg overflow-hidden ring-1 ring-[var(--border)] bg-[#000]">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
          />
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded select-none">
            {video.duration}
          </span>
        </div>

        {/* Video Info */}
        <div className="mt-3 space-y-1">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mt-2 line-clamp-1 leading-snug">
            {video.title}
          </h3>
          <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
            <span>{video.channel}</span>
            {video.verified && (
              <BadgeCheck className="w-3.5 h-3.5 text-[var(--accent)] fill-[var(--accent)]/10" />
            )}
          </div>
          <div className="text-xs font-mono text-[var(--text-muted)] mt-0.5">
            Uploaded {formatDate(video.date)}
          </div>
        </div>

        {/* Stats row & Engagement */}
        <div className="mt-4 pt-3 border-t border-[var(--border)] flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {/* Views */}
            <div className="flex items-center gap-1 text-xs font-mono text-[var(--text-secondary)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full">
              <Eye className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>{formatNumber(video.views)}</span>
            </div>

            {/* Likes */}
            <div className="flex items-center gap-1 text-xs font-mono text-[var(--text-secondary)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full">
              <ThumbsUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>{formatNumber(video.likes)}</span>
            </div>

            {/* Comments */}
            <div className="flex items-center gap-1 text-xs font-mono text-[var(--text-secondary)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full">
              <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>{formatNumber(video.comments)}</span>
            </div>

            {/* Subscribers */}
            <div className="flex items-center gap-1 text-xs font-mono text-[var(--text-secondary)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full">
              <Users className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>{formatNumber(video.subscribers)}</span>
            </div>
          </div>

          {/* Engagement rate */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono text-[var(--text-secondary)] font-semibold tracking-wider">
              Engagement Rate
            </span>
            <div className="bg-[var(--surface-raised)] border border-[var(--accent)]/30 text-[var(--accent)] font-mono text-sm font-semibold px-2 py-1 rounded-lg">
              {formatRate(video.engagementRate)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 transition-all duration-200">
      {/* Label above input */}
      <div className="flex items-center gap-1.5 mb-2 font-mono text-xs text-[var(--text-muted)] uppercase tracking-widest select-none">
        <span
          className={`w-2 h-2 rounded-full ${
            isA ? "bg-[var(--video-a)]" : "bg-[var(--video-b)]"
          }`}
        />
        Video {label}
      </div>

      {/* Input Group */}
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Paste YouTube or Instagram Reel URL…"
          className="flex-1 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg px-4 py-2.5 text-xs font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:outline-none"
        >
          Analyze
        </button>
      </div>

      {/* Supported Platforms */}
      <div className="flex items-center gap-2 mt-2.5 text-[var(--text-muted)] text-xs">
        <span className="font-mono text-[10px] uppercase tracking-wider select-none">Supported:</span>
        <Youtube className="w-4 h-4" />
        <Instagram className="w-4 h-4" />
      </div>
    </div>
  );
}

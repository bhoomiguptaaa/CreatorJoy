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
      <div className="bg-white/4 border border-white/8 rounded-2xl p-4 transition-all duration-200">
        {/* Label above input */}
        <div className="flex items-center gap-1.5 mb-2 font-mono text-xs text-[var(--text-muted)] uppercase tracking-widest select-none">
          <span
            className={`w-2 h-2 rounded-full ${
              isA ? "bg-[#7C3AED]" : "bg-[#06b6d4]"
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
      <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden transition-all duration-200">
        {/* Thumbnail fills card top */}
        <div className="relative aspect-video w-full overflow-hidden bg-[#000]">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
          />
          <span className="absolute bottom-2 right-2 bg-black/85 text-white text-[10px] font-mono px-1.5 py-0.5 rounded select-none">
            {video.duration}
          </span>
        </div>

        {/* Info & Stats Section */}
        <div className="p-4 space-y-3">
          {/* Label under thumbnail */}
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest select-none">
            <span
              className={`w-2 h-2 rounded-full ${
                isA ? "bg-[#7C3AED]" : "bg-[#06b6d4]"
              }`}
            />
            Video {label}
          </div>

          {/* Title and Channel */}
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-[var(--text-primary)] line-clamp-1 leading-snug">
              {video.title}
            </h3>
            <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <span>{video.channel}</span>
              {video.verified && (
                <BadgeCheck className="w-3.5 h-3.5 text-[#7C3AED] fill-[#7C3AED]/10" />
              )}
            </div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
              Uploaded {formatDate(video.date)}
            </div>
          </div>

          {/* Stats row - Icons + numbers in a tight horizontal pill row */}
          <div className="pt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs font-mono text-[var(--text-secondary)] select-none">
            <div className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>{formatNumber(video.views)}</span>
            </div>
            <div className="flex items-center gap-1">
              <ThumbsUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>{formatNumber(video.likes)}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>{formatNumber(video.comments)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>{formatNumber(video.subscribers)}</span>
            </div>
          </div>

          {/* Engagement Rate */}
          <div className="flex items-center justify-between border-t border-white/5 pt-3 select-none">
            <span className="text-[10px] uppercase font-mono text-[var(--text-secondary)] font-semibold tracking-wider">
              Engagement Rate
            </span>
            <div className="border border-[#7C3AED] text-[#7C3AED] font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#7C3AED]/5">
              {formatRate(video.engagementRate)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  return (
    <div className="bg-white/4 border border-white/8 rounded-2xl p-4 transition-all duration-200">
      {/* Label above input */}
      <div className="flex items-center gap-1.5 mb-2 font-mono text-xs text-[var(--text-muted)] uppercase tracking-widest select-none">
        <span
          className={`w-2 h-2 rounded-full ${
            isA ? "bg-[#7C3AED]" : "bg-[#06b6d4]"
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
          className="flex-1 bg-[#0d0d14] border border-transparent rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#7C3AED]/50 focus-visible:outline-none focus:border-[#7C3AED]/50"
        />
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg px-3.5 py-2 text-xs font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap focus-visible:ring-2 focus-visible:ring-[#7C3AED]/50 focus-visible:outline-none"
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

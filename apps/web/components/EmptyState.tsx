"use client";

import React from "react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 select-none text-center">
      {/* Decorative Sparkle Character */}
      <span className="text-5xl text-[var(--border)] animate-pulse select-none">
        ✦
      </span>

      {/* Heading & Subtitle */}
      <div className="space-y-1">
        <h3 className="text-base font-medium text-[var(--text-muted)]">
          Drop two videos. Ask anything.
        </h3>
        <p className="text-xs text-[var(--text-muted)]/60">
          Hooks, engagement, improvements — all in one chat.
        </p>
      </div>

      {/* Example Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-2 max-w-sm">
        <div className="border border-[var(--border)]/60 rounded-full px-3 py-1 text-xs text-[var(--text-muted)]/50">
          Why did Video A outperform?
        </div>
        <div className="border border-[var(--border)]/60 rounded-full px-3 py-1 text-xs text-[var(--text-muted)]/50">
          Compare the hooks
        </div>
        <div className="border border-[var(--border)]/60 rounded-full px-3 py-1 text-xs text-[var(--text-muted)]/50">
          What should I fix?
        </div>
      </div>
    </div>
  );
}

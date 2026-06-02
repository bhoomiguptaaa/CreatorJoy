"use client";

import React from "react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 select-none text-center p-6">
      {/* Decorative Sparkle Character with text gradient */}
      <span className="text-6xl bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent animate-pulse select-none font-bold">
        ✦
      </span>

      {/* Heading & Subtitle */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white tracking-wide">
          Drop two videos. Ask anything.
        </h3>
        <p className="text-sm text-white/60 max-w-[280px] mx-auto leading-relaxed">
          Hooks, engagement, improvements — all in one chat.
        </p>
      </div>

      {/* Example Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4 max-w-md">
        <div className="border border-white/10 bg-white/[0.02] rounded-full px-4 py-1.5 text-xs text-white/40 transition-colors duration-150">
          Why did Video A outperform?
        </div>
        <div className="border border-white/10 bg-white/[0.02] rounded-full px-4 py-1.5 text-xs text-white/40 transition-colors duration-150">
          Compare the hooks
        </div>
        <div className="border border-white/10 bg-white/[0.02] rounded-full px-4 py-1.5 text-xs text-white/40 transition-colors duration-150">
          What should I fix?
        </div>
      </div>
    </div>
  );
}

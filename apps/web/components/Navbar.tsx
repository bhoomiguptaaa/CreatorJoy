"use client";

import React from "react";

interface NavbarProps {
  analysesLeft?: number;
  onNewAnalysis?: () => void;
  onExport?: () => void;
}

export function Navbar({
  analysesLeft = 2,
  onNewAnalysis,
  onExport,
}: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 h-14 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[var(--border)] w-full px-6 flex items-center justify-between">
      {/* Left: Logo group */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 border border-[var(--border)] rounded-md font-mono text-xs font-bold text-[var(--text-primary)] select-none">
          CJ
        </div>
        <span className="font-semibold text-[15px] text-[var(--text-primary)] select-none">
          CreatorJoy
        </span>
      </div>

      {/* Center: Empty */}
      <div className="flex-1" />

      {/* Right: Action items */}
      <div className="flex items-center gap-3">
        {/* Remaining analyses badge */}
        <div className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)] select-none">
          {analysesLeft} left
        </div>

        {/* Export Report button */}
        <button
          onClick={onExport}
          className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:outline-none"
        >
          Export Report
        </button>

        {/* New Analysis button */}
        <button
          onClick={onNewAnalysis}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:outline-none"
        >
          + New Analysis
        </button>
      </div>
    </nav>
  );
}

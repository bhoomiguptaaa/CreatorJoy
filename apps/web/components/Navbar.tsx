"use client";

import React from "react";

interface NavbarProps {
  onNewAnalysis?: () => void;
  onExport?: () => void;
}

export function Navbar({
  onNewAnalysis,
  onExport,
}: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 h-14 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-[var(--border)] w-full px-6 flex items-center justify-between font-sans">
      {/* Left: Logo group */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 border border-[var(--border)] rounded-md font-mono text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-raised)] select-none">
          CJ
        </div>
        <span className="font-semibold text-[15px] text-[var(--text-primary)] select-none tracking-tight">
          CreatorJoy
        </span>
      </div>

      {/* Center: Empty */}
      <div className="flex-1" />

      {/* Right: Action items */}
      <div className="flex items-center gap-3">
        {/* Export Report button (Ghost style) */}
        <button
          onClick={onExport}
          className="bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3.5 py-1.5 text-xs font-medium transition-colors duration-150 rounded-lg focus-visible:ring-2 focus-visible:ring-[#7C3AED]/50 focus-visible:outline-none"
        >
          Export Report
        </button>

        {/* New Analysis button (Filled purple pill) */}
        <button
          onClick={onNewAnalysis}
          className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-full px-4 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#7C3AED]/50 focus-visible:outline-none"
        >
          + New Analysis
        </button>
      </div>
    </nav>
  );
}

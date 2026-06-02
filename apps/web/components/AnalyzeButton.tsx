"use client";

import React from "react";
import { Shield } from "lucide-react";

interface AnalyzeButtonProps {
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

export function AnalyzeButton({
  disabled = false,
  loading = false,
  onClick,
}: AnalyzeButtonProps) {
  // Determine styling class names depending on the active state
  let buttonClasses = "w-full h-12 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:outline-none ";

  if (loading) {
    buttonClasses += "bg-[var(--accent)] text-white cursor-not-allowed opacity-80";
  } else if (disabled) {
    buttonClasses += "bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed opacity-40";
  } else {
    buttonClasses += "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white cursor-pointer active:scale-[0.98]";
  }

  return (
    <div className="w-full">
      <button
        onClick={!loading && !disabled ? onClick : undefined}
        disabled={loading || disabled}
        className={buttonClasses}
      >
        {loading ? (
          <>
            <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
            <span>Analyzing…</span>
          </>
        ) : (
          <span>✦ Analyze Videos</span>
        )}
      </button>

      {/* Security Disclaimer */}
      <div className="flex items-center justify-center gap-1 mt-2 text-xs text-[var(--text-muted)] select-none">
        <Shield className="w-3.5 h-3.5" />
        <span>Your data is processed securely</span>
      </div>
    </div>
  );
}

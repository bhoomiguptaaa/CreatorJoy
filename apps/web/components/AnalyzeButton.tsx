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
    buttonClasses += "bg-gradient-to-r from-purple-600 to-indigo-600 text-white cursor-not-allowed opacity-80";
  } else if (disabled) {
    buttonClasses += "bg-white/5 border border-white/10 text-white/30 cursor-not-allowed";
  } else {
    buttonClasses += "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold cursor-pointer active:scale-[0.98] border border-purple-500/20";
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

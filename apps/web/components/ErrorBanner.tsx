"use client";

import React from "react";
import { AlertCircle, X } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-lg px-4 py-3 flex items-start gap-3 text-sm text-[var(--red)] select-none">
      {/* Alert Icon */}
      <AlertCircle className="w-5 h-5 flex-shrink-0" />

      {/* Error Message */}
      <div className="flex-1 break-words leading-tight">{message}</div>

      {/* Dismiss Button */}
      <button
        onClick={onDismiss}
        className="ml-auto text-[var(--red)]/60 hover:text-[var(--red)] cursor-pointer transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:outline-none rounded-md p-0.5"
        aria-label="Dismiss error"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

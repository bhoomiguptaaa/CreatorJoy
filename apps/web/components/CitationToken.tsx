"use client";

import { cn } from "@/lib/utils";

interface Props {
  label: "A" | "B";
  seconds: number;
  raw: string; // "[A:0:32]"
  onSeek: (label: "A" | "B", seconds: number) => void;
}

/** A clickable inline pill that seeks the matching YouTube embed. */
export function CitationToken({ label, seconds, raw, onSeek }: Props) {
  const mm = Math.floor(seconds / 60);
  const ss = (seconds % 60).toString().padStart(2, "0");
  const isA = label === "A";

  return (
    <button
      type="button"
      className={cn(
        "citation font-mono transition-all duration-150 font-semibold rounded text-[10px] tracking-wider py-0.5 px-1.5 select-none border",
        isA
          ? "bg-[var(--video-a)]/10 text-[var(--video-a)] border-[var(--video-a)]/20 hover:bg-[var(--video-a)]/20 hover:border-[var(--video-a)]/40"
          : "bg-[var(--video-b)]/10 text-[var(--video-b)] border-[var(--video-b)]/20 hover:bg-[var(--video-b)]/20 hover:border-[var(--video-b)]/40"
      )}
      title={`Jump Video ${label} to ${mm}:${ss}`}
      onClick={() => onSeek(label, seconds)}
    >
      {label} · {mm}:{ss}
    </button>
  );
}

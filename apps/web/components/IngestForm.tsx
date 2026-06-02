"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  loading: boolean;
  onSubmit: (urlA: string, urlB: string) => void;
  errorMessage?: string | null;
}

export function IngestForm({ loading, onSubmit, errorMessage }: Props) {
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");

  const canSubmit = urlA.trim().length > 0 && urlB.trim().length > 0 && !loading;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(urlA.trim(), urlB.trim());
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 w-full max-w-2xl">
      <div className="flex gap-2 items-center flex-1">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold font-mono text-[var(--video-a)] select-none">
            A
          </span>
          <input
            value={urlA}
            onChange={(e) => setUrlA(e.target.value)}
            placeholder="youtube.com/watch?v=…"
            disabled={loading}
            className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all font-mono"
          />
        </div>
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold font-mono text-[var(--video-b)] select-none">
            B
          </span>
          <input
            value={urlB}
            onChange={(e) => setUrlB(e.target.value)}
            placeholder="youtube.com/watch?v=…"
            disabled={loading}
            className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-5 py-2 text-xs rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all font-sans"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>
      <div className="flex items-center gap-1.5 text-[9px] font-mono text-[var(--text-secondary)] pl-1">
        <span>⚡</span>
        <span>Best with videos under 8 mins · First load ~20s, subsequent instant</span>
      </div>
      {errorMessage && (
        <div
          role="alert"
          className="border border-[var(--red)]/20 bg-[var(--red)]/10 text-[var(--red)] rounded-lg px-3 py-2 text-xs leading-relaxed font-mono"
        >
          <strong className="font-semibold font-sans">Error:</strong> {errorMessage}
        </div>
      )}
    </form>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    icon: "🎬",
    label: "Fetching video metadata",
    messages: [
      "Pulling titles, views & subscriber counts…",
      "Reading the engagement signals…",
      "Checking how many stuck around to like…",
    ],
  },
  {
    icon: "📝",
    label: "Extracting transcripts",
    messages: [
      "Capturing every word your creators said…",
      "Reading between the captions…",
      "Finding the exact moments that landed…",
    ],
  },
  {
    icon: "⚡",
    label: "Chunking & indexing content",
    messages: [
      "Slicing the transcript into smart chunks…",
      "Mapping hook moments to timestamps…",
      "Tagging what made viewers stay or leave…",
    ],
  },
  {
    icon: "🧠",
    label: "Building content intelligence",
    messages: [
      "Embedding creator DNA into vector space…",
      "Training on what made Video A pop off…",
      "Almost ready — this is the good part…",
    ],
  },
];

// Flatten all messages into a single sequence with step info
const SEQUENCE = STEPS.flatMap((step, si) =>
  step.messages.map((msg, mi) => ({ stepIndex: si, msgIndex: mi, msg }))
);

interface Props {
  visible: boolean;
}

export function LoadingOverlay({ visible }: Props) {
  const [seqIndex, setSeqIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      setSeqIndex(0);
      setFade(true);
      return;
    }

    timerRef.current = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setSeqIndex((i) => (i + 1) % SEQUENCE.length);
        setFade(true);
      }, 220);
    }, 2800);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  const current = SEQUENCE[seqIndex % SEQUENCE.length];
  const step = STEPS[current.stepIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-md">
      <div className="flex flex-col items-center gap-8 px-8 max-w-md w-full">

        {/* Animated spinner */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--border)]" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)] animate-spin" />
          <span className="text-2xl select-none">{step.icon}</span>
        </div>

        {/* Step label + message */}
        <div className="text-center space-y-1.5 select-none">
          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--text-primary)] font-mono">
            {step.label}
          </div>
          <div
            className="text-xs text-[var(--text-secondary)] min-h-[1.25rem] transition-opacity duration-200"
            style={{ opacity: fade ? 1 : 0 }}
          >
            {current.msg}
          </div>
        </div>

        {/* Step progress dots */}
        <div className="flex items-center gap-1.5 select-none">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <div
                className="rounded transition-all duration-500"
                style={{
                  width: i === current.stepIndex ? "16px" : "6px",
                  height: "6px",
                  background:
                    i < current.stepIndex
                      ? "var(--accent)"
                      : i === current.stepIndex
                      ? "var(--accent)"
                      : "var(--border)",
                  opacity: i > current.stepIndex ? 0.3 : 1,
                }}
              />
              {i < STEPS.length - 1 && (
                <div
                  className="w-3 h-[1px] transition-all duration-500"
                  style={{
                    background:
                      i < current.stepIndex ? "var(--accent)" : "var(--border)",
                    opacity: i < current.stepIndex ? 1 : 0.3,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Tip */}
        <div className="text-xs text-[var(--text-secondary)] text-center bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-3 max-w-sm">
          💡 <span className="font-semibold font-mono uppercase text-[9px] tracking-wider text-[var(--text-primary)] mr-1">Pro tip:</span>{" "}
          Ask &ldquo;Compare the hooks in the first 30 seconds.&rdquo;
        </div>
      </div>
    </div>
  );
}

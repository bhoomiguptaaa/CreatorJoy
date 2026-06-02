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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 dark:bg-[#0a0a0f]/95 backdrop-blur-xl transition-colors duration-200">
      <div className="flex flex-col items-center gap-8 px-8 max-w-md w-full">

        {/* Animated spinner with purple ring and lightning bolt */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-white/5" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#7C3AED] animate-spin" />
          <span className="text-2xl select-none">⚡</span>
        </div>

        {/* Step label + message */}
        <div className="text-center space-y-2 select-none">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-850 dark:text-white font-mono">
            {step.label}
          </div>
          <div
            className="text-xs text-gray-500 dark:text-white/50 min-h-[1.25rem] transition-opacity duration-200"
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
                      ? "#7C3AED"
                      : i === current.stepIndex
                      ? "#7C3AED"
                      : "var(--progress-inactive)",
                  opacity: i > current.stepIndex ? 0.3 : 1,
                }}
              />
              {i < STEPS.length - 1 && (
                <div
                  className="w-3 h-[1px] transition-all duration-500"
                  style={{
                    background:
                      i < current.stepIndex ? "#7C3AED" : "var(--progress-inactive)",
                    opacity: i < current.stepIndex ? 1 : 0.3,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Pro Tip */}
        <div className="text-xs text-gray-600 dark:text-white/70 bg-white dark:bg-[#13131F]/90 border border-gray-200 dark:border-white/5 border-l-4 border-l-amber-500 rounded-xl px-4 py-3.5 max-w-sm shadow-md dark:shadow-xl shadow-black/5 dark:shadow-black/40 flex items-start gap-3 transition-colors duration-200">
          <span className="text-sm select-none">💡</span>
          <div className="text-left">
            <span className="font-bold font-mono uppercase text-[9px] tracking-widest text-amber-500 block mb-0.5">Pro tip</span>
            <span className="leading-relaxed">Ask &ldquo;Compare the hooks in the first 30 seconds.&rdquo;</span>
          </div>
        </div>
      </div>
    </div>
  );
}

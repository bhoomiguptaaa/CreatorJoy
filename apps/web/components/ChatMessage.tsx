"use client";

import { parseCitations } from "@/lib/citations";
import type { ChatMessage as ChatMessageType, QueryClass } from "@/lib/types";
import { CitationToken } from "./CitationToken";
import { cn } from "@/lib/utils";

interface Props {
  message: ChatMessageType;
  onSeek: (label: "A" | "B", seconds: number) => void;
}

const CLASS_LABEL: Record<QueryClass, string> = {
  engagement_stats: "Engagement stats",
  hook: "Hook analysis",
  comparison: "Comparison",
  single_video: "Single video",
};

export function ChatMessage({ message, onSeek }: Props) {
  const isUser = message.role === "user";
  const tokens = isUser ? null : parseCitations(message.content);

  return (
    <div
      className={cn(
        "flex mb-4 w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed transition-all",
          isUser
            ? "bg-[var(--accent)] text-white shadow-md font-medium"
            : "bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-primary)]"
        )}
      >
        {!isUser && message.query_class && (
          <div className="inline-block font-mono text-[9px] uppercase tracking-widest text-[var(--accent)] mb-2.5 font-bold bg-[var(--accent)]/10 px-2 py-0.5 rounded border border-[var(--accent)]/20">
            {CLASS_LABEL[message.query_class]}
          </div>
        )}

        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="whitespace-pre-wrap text-[var(--text-primary)]">
            {tokens?.map((t, i) =>
              t.kind === "text" ? (
                <span key={i} className="text-[var(--text-primary)]">{t.value}</span>
              ) : (
                <CitationToken
                  key={i}
                  label={t.label}
                  seconds={t.seconds}
                  raw={t.raw}
                  onSeek={onSeek}
                />
              ),
            )}
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 bg-[var(--accent)] animate-pulse align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send, Shield } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatPanelProps {
  messages: Array<Message>;
  loading?: boolean;
  streamEnabled?: boolean;
  onStreamToggle?: (v: boolean) => void;
  onSend?: (message: string) => void;
  onCitationClick?: (video: "A" | "B", seconds: number) => void;
  onClear?: () => void;
  disabled?: boolean;
}

// Helper to parse citations like [A:0:32] or [B:1:05]
const parseCitations = (text: string) => {
  const regex = /\[([AB]):(\d+):(\d+)\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push({ type: "text", content: text.substring(lastIndex, matchIndex) });
    }

    const video = match[1] as "A" | "B";
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const totalSeconds = minutes * 60 + seconds;

    parts.push({
      type: "citation",
      video,
      seconds: totalSeconds,
      raw: match[0],
      label: `${video}:${match[2]}:${match[3].padStart(2, "0")}`,
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.substring(lastIndex) });
  }

  return parts;
};

export function ChatPanel({
  messages,
  loading = false,
  streamEnabled = true,
  onStreamToggle,
  onSend,
  onCitationClick,
  onClear,
  disabled = false,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages area to bottom on new messages or loading updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  // Update document.title on AI response states
  useEffect(() => {
    if (loading) {
      document.title = "● CreatorJoy — Thinking…";
    } else {
      document.title = "CreatorJoy — AI Video Analyzer";
    }
    return () => {
      document.title = "CreatorJoy — AI Video Analyzer";
    };
  }, [loading]);

  const handleSend = () => {
    if (!input.trim() || loading || disabled) return;
    onSend?.(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessageContent = (content: string) => {
    const parts = parseCitations(content);
    return parts.map((part, index) => {
      if (part.type === "text") {
        return <span key={index}>{part.content}</span>;
      }

      const isVideoA = part.video === "A";
      const colorClass = isVideoA
        ? "bg-[var(--video-a)]/10 text-[var(--video-a)] border-[var(--video-a)]/20 hover:bg-[var(--video-a)]/20"
        : "bg-[var(--video-b)]/10 text-[var(--video-b)] border-[var(--video-b)]/20 hover:bg-[var(--video-b)]/20";

      return (
        <button
          key={index}
          onClick={() => onCitationClick?.(part.video!, part.seconds!)}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono border transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:outline-none ${colorClass}`}
        >
          {part.label}
        </button>
      );
    });
  };

  const suggestedPrompts = [
    "Compare hooks in first 5 seconds",
    "What's the engagement rate of each?",
    "Suggest improvements for Video B",
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
      {/* Header bar */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            AI Analysis Chat
          </span>
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
        <button
          onClick={onClear}
          disabled={messages.length === 0}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150 rounded px-1 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:outline-none"
        >
          Clear Chat
        </button>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent"
      >
        {messages.length === 0 && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="text-3xl mb-3">✨</div>
            <p className="text-sm text-[var(--text-primary)] font-medium mb-1">
              Start your analysis
            </p>
            <p className="text-xs text-[var(--text-secondary)] max-w-[240px]">
              Ask questions about views, retention hooks, or comparison metrics.
            </p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={index}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div
                className={
                  isUser
                    ? "ml-auto max-w-[80%] bg-[var(--accent)] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm"
                    : "mr-auto max-w-[90%] bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-[var(--text-primary)] leading-relaxed"
                }
              >
                {isUser ? (
                  <span>{msg.content}</span>
                ) : (
                  <div className="whitespace-pre-wrap">
                    {renderMessageContent(msg.content)}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)] mt-1 select-none px-1">
                {msg.timestamp}
              </span>
            </div>
          );
        })}

        {/* Typing indicator */}
        {loading && (
          <div className="flex flex-col items-start">
            <div className="flex gap-1 items-center mr-auto max-w-[90%] bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl rounded-tl-sm px-4 py-3">
              <span
                className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)] mt-1 select-none px-1">
              typing...
            </span>
          </div>
        )}
      </div>

      {/* Suggested prompts row */}
      <div className="px-4 py-2 border-t border-[var(--border)] flex gap-2 overflow-x-auto scrollbar-none select-none bg-[var(--bg)]/30">
        {suggestedPrompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => !disabled && !loading && onSend?.(prompt)}
            disabled={disabled || loading}
            className="flex-shrink-0 border border-[var(--border)] rounded-full px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)] transition-colors duration-150 whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:outline-none"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="px-4 py-3 border-t border-[var(--border)] flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              disabled
                ? "Perform analysis to unlock chat…"
                : "Ask a question about your videos…"
            }
            rows={1}
            className="flex-1 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors duration-150 resize-none overflow-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:outline-none focus:border-[var(--accent)]/50"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim() || loading}
            className="w-9 h-9 flex-shrink-0 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white flex items-center justify-center transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:outline-none"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Toggle switch and hints */}
        <div className="flex justify-between items-center px-1 select-none">
          <button
            type="button"
            onClick={() => onStreamToggle?.(!streamEnabled)}
            disabled={disabled}
            className="flex items-center gap-2 text-[10px] uppercase font-mono text-[var(--text-muted)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none rounded p-0.5 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:outline-none"
          >
            <span>Stream Responses</span>
            <div
              className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors duration-200 ${
                streamEnabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                  streamEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
          </button>

          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            Enter to send
          </span>
        </div>
      </div>
    </div>
  );
}

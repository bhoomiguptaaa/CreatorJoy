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

      const colorClass = "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-800/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:text-purple-700 dark:hover:text-purple-200 transition-colors duration-150";

      return (
        <button
          key={index}
          onClick={() => onCitationClick?.(part.video!, part.seconds!)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono border cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:outline-none ${colorClass}`}
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
    <div className="flex flex-col h-full bg-white dark:bg-[#13131F]/40 backdrop-blur-md border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm dark:shadow-none transition-colors duration-200">
      {/* Header bar */}
      <div className="px-4 py-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white/90">
            AI Analysis Chat
          </span>
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
        <button
          onClick={onClear}
          disabled={messages.length === 0}
          className="text-xs text-gray-400 hover:text-gray-900 dark:text-white/40 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150 rounded px-1.5 py-0.5 focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:outline-none"
        >
          Clear Chat
        </button>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {messages.length === 0 && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none gap-3">
            <span className="text-5xl bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent animate-pulse select-none font-bold">
              ✦
            </span>
            <div>
              <p className="text-sm text-gray-900 dark:text-white font-medium mb-1">
                Start your analysis
              </p>
              <p className="text-xs text-gray-500 dark:text-white/50 max-w-[250px] leading-relaxed">
                Ask questions about views, retention hooks, or comparison metrics.
              </p>
            </div>
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
                    ? "ml-auto max-w-[80%] bg-[#7C3AED] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm shadow-lg shadow-purple-900/10"
                    : "mr-auto max-w-[90%] bg-gray-100 dark:bg-[#13131F] border border-gray-200 dark:border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-900 dark:text-white/90 leading-relaxed"
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
              <span className="text-[10px] font-mono text-gray-400 dark:text-[#6B7280] mt-1 select-none px-1">
                {msg.timestamp}
              </span>
            </div>
          );
        })}

        {/* Typing indicator */}
        {loading && (
          <div className="flex flex-col items-start">
            <div className="flex gap-1 items-center mr-auto max-w-[90%] bg-gray-100 dark:bg-[#181826] border border-gray-200 dark:border-white/5 rounded-2xl rounded-tl-sm px-4 py-3">
              <span
                className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-[#444444] animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-[#444444] animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-[#444444] animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-400 dark:text-[#6B7280] mt-1 select-none px-1">
              typing...
            </span>
          </div>
        )}
      </div>

      {/* Suggested prompts row */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-white/5 flex gap-2 overflow-x-auto scrollbar-none select-none bg-gray-50/50 dark:bg-white/[0.01]">
        {suggestedPrompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => !disabled && !loading && onSend?.(prompt)}
            disabled={disabled || loading}
            className="flex-shrink-0 border border-gray-300 dark:border-white/10 bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 rounded-full px-3.5 py-1.5 text-xs text-gray-700 dark:text-white/60 hover:text-gray-900 dark:hover:text-white transition-all duration-200 whitespace-nowrap cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:outline-none"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-white/5 flex flex-col gap-3">
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
            className="flex-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-none rounded-2xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 transition-all duration-200 resize-none overflow-hidden focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim() || loading}
            className="w-10 h-10 flex-shrink-0 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:outline-none shadow-md shadow-purple-900/30"
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
            className="flex items-center gap-2 text-[10px] uppercase font-mono text-gray-500 dark:text-white/40 hover:text-gray-850 dark:hover:text-white/60 transition-colors duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed select-none rounded p-0.5 focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:outline-none"
          >
            <span>Stream Responses</span>
            <div
              className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors duration-200 ${
                streamEnabled ? "bg-[#7C3AED]" : "bg-gray-200 dark:bg-white/10"
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                  streamEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
          </button>

          <span className="text-[10px] font-mono text-gray-400 dark:text-white/40">
            Enter to send
          </span>
        </div>
      </div>
    </div>
  );
}

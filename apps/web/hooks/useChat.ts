"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildChatUrl, fetchThreadHistory } from "@/lib/api";
import { getThreadIdForPair, resetThreadIdForPair } from "@/lib/format";
import { openChatStream } from "@/lib/sse";
import type { ChatMessage, QueryClass } from "@/lib/types";

interface UseChatArgs {
  videoAId: string | null;
  videoBId: string | null;
}

interface UseChatReturn {
  messages: ChatMessage[];
  threadId: string;
  isStreaming: boolean;
  send(question: string): void;
  newThread(): void;
}

/**
 * Chat state for the currently-loaded video pair.
 *
 * Thread IDs are keyed by the (sorted) video pair so:
 *   - Empty state (no videos) shows nothing — no leakage from prior sessions.
 *   - Loading the same pair again restores its conversation.
 *   - Loading a different pair switches to that pair's thread automatically.
 */
export function useChat({ videoAId, videoBId }: UseChatArgs): UseChatReturn {
  const [threadId, setThreadId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const closeStreamRef = useRef<(() => void) | null>(null);

  // Re-bind thread + restore history whenever the video pair changes.
  useEffect(() => {
    closeStreamRef.current?.();
    setIsStreaming(false);

    if (!videoAId || !videoBId) {
      // No videos loaded — empty chat, no thread bound.
      setThreadId("");
      setMessages([]);
      return;
    }

    const id = getThreadIdForPair(videoAId, videoBId);
    setThreadId(id);

    let cancelled = false;
    fetchThreadHistory(id)
      .then((res) => {
        if (cancelled) return;
        setMessages(
          res.messages.map((m) => ({
            role: m.role,
            content: m.content,
            citations: m.citations,
          })),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setMessages([]);
      });

    return () => {
      cancelled = true;
    };
  }, [videoAId, videoBId]);

  const send = useCallback(
    (question: string) => {
      if (!videoAId || !videoBId || !threadId || !question.trim()) return;
      if (isStreaming) return;

      // Optimistic user message + empty streaming assistant placeholder
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question },
        { role: "assistant", content: "", isStreaming: true },
      ]);
      setIsStreaming(true);

      const url = buildChatUrl({
        threadId,
        videoAId,
        videoBId,
        question,
      });
      const stream = openChatStream(url);
      closeStreamRef.current = () => stream.close();

      stream.on("metadata", (meta) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              query_class: meta.query_class as QueryClass,
              citations: meta.citations,
            };
          }
          return next;
        });
      });

      stream.on("token", (tok) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: last.content + tok,
            };
          }
          return next;
        });
      });

      stream.on("done", () => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, isStreaming: false };
          }
          return next;
        });
        setIsStreaming(false);
      });

      stream.on("fail", (err) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: last.content || `[error] ${err.message}`,
              isStreaming: false,
            };
          }
          return next;
        });
        setIsStreaming(false);
      });
    },
    [videoAId, videoBId, threadId, isStreaming],
  );

  const newThread = useCallback(() => {
    closeStreamRef.current?.();
    if (!videoAId || !videoBId) return;
    const id = resetThreadIdForPair(videoAId, videoBId);
    setThreadId(id);
    setMessages([]);
    setIsStreaming(false);
  }, [videoAId, videoBId]);

  // Tear down any open stream when the page unmounts
  useEffect(() => {
    return () => closeStreamRef.current?.();
  }, []);

  return { messages, threadId, isStreaming, send, newThread };
}

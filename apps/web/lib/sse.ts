// Typed wrapper around EventSource for the /api/chat stream.
//
// Usage:
//   const stream = openChatStream(url);
//   stream.on("metadata", (m) => ...);
//   stream.on("token", (t) => ...);
//   stream.on("done", () => stream.close());
//   stream.on("fail", (e) => ...);

import type { ChatMetadataEvent } from "./types";

type Listeners = {
  metadata?: (data: ChatMetadataEvent) => void;
  token?: (data: string) => void;
  done?: () => void;
  fail?: (error: { message: string }) => void;
};

export interface ChatStream {
  on<K extends keyof Listeners>(event: K, fn: NonNullable<Listeners[K]>): void;
  close(): void;
}

export function openChatStream(url: string): ChatStream {
  const es = new EventSource(url);
  const listeners: Listeners = {};

  es.addEventListener("metadata", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as ChatMetadataEvent;
      listeners.metadata?.(data);
    } catch {
      /* ignore malformed event */
    }
  });

  es.addEventListener("token", (e: MessageEvent) => {
    listeners.token?.(e.data);
  });

  es.addEventListener("done", () => {
    listeners.done?.();
    es.close();
  });

  // Server emits a custom "error" event with JSON. EventSource also fires
  // 'error' on connection drops (where e.data is undefined). Distinguish.
  es.addEventListener("error", (e: MessageEvent) => {
    if (e.data) {
      try {
        const parsed = JSON.parse(e.data);
        listeners.fail?.({ message: parsed.error ?? "unknown error" });
      } catch {
        listeners.fail?.({ message: "unparseable error event" });
      }
    } else if (es.readyState === EventSource.CLOSED) {
      listeners.fail?.({ message: "connection closed" });
    }
    es.close();
  });

  return {
    on(event, fn) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (listeners as any)[event] = fn;
    },
    close() {
      es.close();
    },
  };
}

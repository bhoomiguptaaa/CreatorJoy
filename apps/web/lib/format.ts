// Tiny formatter helpers used by the video cards.

export function formatCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatRate(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${rate.toFixed(2)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Thread IDs are keyed by the video pair, sorted for order-independence so
 * (A,B) and (B,A) share a conversation. When the user analyzes a new pair,
 * we surface a different thread automatically — no chat leakage between
 * unrelated sessions.
 */

function _pairKey(videoAId: string, videoBId: string): string {
  const [a, b] = [videoAId, videoBId].sort();
  return `creatorjoy.thread.${a}::${b}`;
}

function _newId(): string {
  return `t_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function getThreadIdForPair(
  videoAId: string,
  videoBId: string,
): string {
  if (typeof window === "undefined") return "";
  const key = _pairKey(videoAId, videoBId);
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = _newId();
    window.localStorage.setItem(key, id);
  }
  return id;
}

export function resetThreadIdForPair(
  videoAId: string,
  videoBId: string,
): string {
  if (typeof window === "undefined") return "";
  const key = _pairKey(videoAId, videoBId);
  const id = _newId();
  window.localStorage.setItem(key, id);
  return id;
}

// Inline citation parser.
//
// The LLM emits citations like [A:0:32] and [B:1:15] in its streaming
// output. We split the message into a list of {text|citation} tokens
// the React renderer can map to plain spans + clickable badges.

export type RenderToken =
  | { kind: "text"; value: string }
  | {
      kind: "citation";
      label: "A" | "B";
      seconds: number;
      raw: string; // e.g. "[A:0:32]"
    };

const CITATION_RE = /\[([AB]):(\d+):(\d{1,2})\]/g;

export function parseCitations(text: string): RenderToken[] {
  const out: RenderToken[] = [];
  let lastIndex = 0;
  // Reset regex state on each call
  CITATION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CITATION_RE.exec(text)) !== null) {
    const [raw, label, mm, ss] = match;
    if (match.index > lastIndex) {
      out.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }
    out.push({
      kind: "citation",
      label: label as "A" | "B",
      seconds: parseInt(mm, 10) * 60 + parseInt(ss, 10),
      raw,
    });
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) {
    out.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return out;
}

import React, { useMemo } from "react";
import katex from "katex";

interface MathTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

interface Segment {
  type: "text" | "math";
  value: string;
  display: boolean;
}

// Match $$...$$ first (greedy) then $...$ (non-greedy, no newlines inside).
const MATH_PATTERN = /\$\$([\s\S]+?)\$\$|\$([^\n$]+?)\$/g;

function splitSegments(text: string): Segment[] {
  if (!text) return [];
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(MATH_PATTERN)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ type: "text", value: text.slice(last, i), display: false });
    const display = m[0].startsWith("$$");
    const inner = (display ? m[1] : m[2]) ?? "";
    out.push({ type: "math", value: inner, display });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last), display: false });
  return out;
}

function renderMath(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      strict: "ignore",
      output: "html",
    });
  } catch {
    return latex;
  }
}

export default function MathText({ text, className, style }: MathTextProps) {
  const segments = useMemo(() => splitSegments(text || ""), [text]);

  if (segments.length === 0 || segments.every((s) => s.type === "text")) {
    return (
      <span className={className} style={style}>
        {text}
      </span>
    );
  }

  return (
    <span className={className} style={style}>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: renderMath(seg.value, seg.display) }}
            style={{ display: seg.display ? "block" : "inline-block" }}
          />
        )
      )}
    </span>
  );
}

// True if text contains math markers — caller can use this to decide layout hints.
export function hasMath(text: string | undefined): boolean {
  return !!text && /\$[^$\n]+\$|\$\$[\s\S]+\$\$/.test(text);
}

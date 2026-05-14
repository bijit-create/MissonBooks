import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { gradeColor } from "../styles";
import type { ClassifiedQuestion } from "../classify";
import MathText, { hasMath } from "./MathText";

export interface EditableProps {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
  placeholder?: string;
}

/**
 * Editable text that renders KaTeX math when not focused. Click switches to
 * raw-source edit mode; blur commits and switches back to rendered view.
 */
export function Editable({
  value,
  onCommit,
  className,
  style,
  multiline,
}: EditableProps) {
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLSpanElement>(null);
  const containsMath = hasMath(value);

  // Sync DOM text with prop value when entering edit mode.
  useLayoutEffect(() => {
    if (editing && editRef.current) {
      if (editRef.current.innerText !== value) {
        editRef.current.innerText = value;
      }
      // Place cursor at end.
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing, value]);

  // Auto-focus when switching to edit.
  useEffect(() => {
    if (editing && editRef.current) editRef.current.focus();
  }, [editing]);

  if (editing) {
    return (
      <span
        ref={editRef}
        contentEditable
        suppressContentEditableWarning
        className={className}
        style={{
          outline: "none",
          whiteSpace: multiline ? "pre-wrap" : "normal",
          ...style,
        }}
        onBlur={(e) => {
          const next = e.currentTarget.innerText;
          setEditing(false);
          if (next !== value) onCommit(next);
        }}
        onKeyDown={(e) => {
          if (!multiline && e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
          }
          if (e.key === "Escape") {
            (e.currentTarget as HTMLElement).blur();
          }
        }}
      />
    );
  }

  // View mode: render KaTeX if math present, otherwise plain text.
  return (
    <span
      className={`editable-view ${className || ""}`}
      style={{ cursor: "text", ...style }}
      onClick={() => setEditing(true)}
      onFocus={() => setEditing(true)}
      tabIndex={0}
    >
      {containsMath ? <MathText text={value} /> : value || " "}
    </span>
  );
}

export interface CardShellProps {
  q: ClassifiedQuestion;
  gradeLevel: string;
  isHots?: boolean;
  children: React.ReactNode;
  innerPad?: string;
  bgColor?: string;
}

export function CardShell({
  q,
  gradeLevel,
  isHots,
  children,
  innerPad = "7pt 10pt",
  bgColor = "rgba(255,255,255,0.78)",
}: CardShellProps) {
  const color = gradeColor(gradeLevel);
  return (
    <div
      className="q-card"
      data-template={q.template}
      style={{
        position: "relative",
        padding: innerPad,
        borderRadius: "10pt",
        border: "0.75pt solid #c8c8c8",
        backgroundColor: bgColor,
        boxShadow: "0 0.5pt 1.5pt rgba(0,0,0,0.04)",
        breakInside: "avoid",
        height: "100%",
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        flex: 1,
      }}
    >
      <QNumberRow q={q} color={color} isHots={isHots} />
      <div style={{ marginTop: "4pt", flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
      {q.fixes.length > 0 ? (
        <div
          title={q.fixes.join("\n")}
          style={{
            position: "absolute",
            top: "4pt",
            right: "4pt",
            background: "#FFD166",
            color: "#5b3700",
            borderRadius: "9pt",
            fontSize: "7pt",
            fontWeight: 700,
            padding: "1pt 5pt",
            display: "flex",
            alignItems: "center",
            gap: "2pt",
            boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
            zIndex: 2,
          }}
        >
          <AlertTriangle size={8} /> auto-fixed
        </div>
      ) : null}
    </div>
  );
}

function QNumberRow({
  q,
  color,
  isHots,
}: {
  q: ClassifiedQuestion;
  color: string;
  isHots?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: "6pt",
        left: "6pt",
        display: "flex",
        alignItems: "center",
        gap: "3pt",
        zIndex: 1,
      }}
    >
      <div
        style={{
          width: "16pt",
          height: "16pt",
          borderRadius: "8pt",
          backgroundColor: color,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "9pt",
          fontWeight: 700,
        }}
      >
        {q.displayNo ?? q.Q_No}
      </div>
      {isHots ? (
        <div
          title="Higher-Order Thinking Skills"
          style={{
            width: "16pt",
            height: "16pt",
            borderRadius: "8pt",
            backgroundColor: "#FFD166",
            color: "#5b3700",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10pt",
            fontWeight: 800,
          }}
        >
          ?
        </div>
      ) : null}
    </div>
  );
}

export interface StemProps {
  q: ClassifiedQuestion;
  onUpdate: (field: string, value: string) => void;
  fontSize?: string;
  paddingLeft?: string;
}

export function Stem({
  q,
  onUpdate,
  fontSize = "9.5pt",
  paddingLeft = "26pt",
}: StemProps) {
  return (
    <div
      style={{
        fontSize,
        lineHeight: 1.35,
        paddingLeft,
        minHeight: "16pt",
      }}
    >
      <Editable
        value={q.Question_Text || ""}
        onCommit={(v) => onUpdate("Question_Text", v)}
        multiline
      />
    </div>
  );
}

export function getOpts(q: ClassifiedQuestion): { key: string; value: string; label: string }[] {
  return [
    { key: "Option_A", label: "a", value: (q.Option_A || "") },
    { key: "Option_B", label: "b", value: (q.Option_B || "") },
    { key: "Option_C", label: "c", value: (q.Option_C || "") },
    { key: "Option_D", label: "d", value: (q.Option_D || "") },
  ].filter((o) => o.value.length > 0);
}

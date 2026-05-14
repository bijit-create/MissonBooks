import React from "react";
import { CardShell, Editable, Stem } from "./shared";
import { gradeColor } from "../styles";
import type { TemplateProps } from "./types";

function splitSubparts(stem: string): { label: string; text: string }[] {
  const matches = [...stem.matchAll(/\b([a-eA-E])[.)]\s*([^\n]*)/g)];
  if (matches.length === 0) return [];
  return matches.map((m) => ({ label: m[1].toLowerCase(), text: m[2].trim() }));
}

function stemBeforeSubparts(stem: string): string {
  const m = stem.match(/^([\s\S]*?)(?=\b[a-eA-E][.)]\s)/);
  return (m ? m[1] : stem).trim();
}

export function FibSingle(p: TemplateProps) {
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Stem q={p.q} onUpdate={p.onUpdate} />
        <div style={{ flex: 1, minHeight: "8pt" }} />
        <div
          style={{
            marginTop: "8pt",
            borderBottom: "0.8pt solid #9a9a9a",
            height: "14pt",
          }}
        />
      </div>
    </CardShell>
  );
}

export function FibMultiIndent(p: TemplateProps) {
  const lead = stemBeforeSubparts(p.q.Question_Text || "");
  const parts = splitSubparts(p.q.Question_Text || "");
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      {lead ? (
        <div
          style={{
            fontSize: "9.5pt",
            lineHeight: 1.35,
            paddingLeft: "26pt",
            marginBottom: "4pt",
          }}
        >
          <Editable
            value={lead}
            onCommit={(v) => {
              const tail = (p.q.Question_Text || "").slice(lead.length);
              p.onUpdate("Question_Text", v + tail);
            }}
            multiline
          />
        </div>
      ) : (
        <Stem q={p.q} onUpdate={p.onUpdate} />
      )}
      <div style={{ paddingLeft: "26pt", marginTop: "4pt" }}>
        {parts.map((part) => (
          <div
            key={part.label}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "6pt",
              fontSize: "9pt",
              marginBottom: "3pt",
            }}
          >
            <span style={{ width: "12pt", flexShrink: 0 }}>{part.label})</span>
            <span style={{ flex: 1 }}>
              <Editable value={part.text} onCommit={() => { /* edits propagate via parent stem */ }} />
            </span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

export function FibMultiPill(p: TemplateProps) {
  const color = gradeColor(p.gradeLevel);
  const lead = stemBeforeSubparts(p.q.Question_Text || "");
  const parts = splitSubparts(p.q.Question_Text || "");
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      {lead ? (
        <div
          style={{
            fontSize: "9.5pt",
            lineHeight: 1.35,
            paddingLeft: "26pt",
            marginBottom: "4pt",
          }}
        >
          <Editable
            value={lead}
            onCommit={(v) => {
              const tail = (p.q.Question_Text || "").slice(lead.length);
              p.onUpdate("Question_Text", v + tail);
            }}
            multiline
          />
        </div>
      ) : (
        <Stem q={p.q} onUpdate={p.onUpdate} />
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4pt",
          marginTop: "5pt",
        }}
      >
        {parts.map((part) => (
          <div
            key={part.label}
            style={{
              border: `1pt solid ${color}`,
              borderRadius: "12pt",
              padding: "3pt 10pt",
              fontSize: "9pt",
              backgroundColor: "rgba(255,255,255,0.85)",
            }}
          >
            <span style={{ fontWeight: 700, color }}>{part.label})</span>{" "}
            <Editable value={part.text} onCommit={() => { /* propagate via parent stem */ }} />
          </div>
        ))}
      </div>
    </CardShell>
  );
}

import React from "react";
import { CardShell, Editable, EditableQuestionImage, Stem, getOpts } from "./shared";
import MathText from "./MathText";
import { gradeColor } from "../styles";
import type { TemplateProps } from "./types";

function splitLetteredClues(stem: string): { letter: string; text: string }[] {
  const matches = [...stem.matchAll(/\b([A-C])[:.]\s*([^\n]+?)(?=\n\s*[A-C][:.]|\n\n|$)/gs)];
  return matches.map((m) => ({ letter: m[1], text: m[2].trim() }));
}

export function VerticalClueList(p: TemplateProps) {
  const color = gradeColor(p.gradeLevel);
  const clues = splitLetteredClues(p.q.Question_Text || "");
  const lead = (p.q.Question_Text || "").split(/\n\s*[A-C][:.]/)[0]?.trim() || "";
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      {lead ? (
        <div
          style={{
            fontSize: "9.5pt",
            lineHeight: 1.35,
            paddingLeft: "26pt",
            marginBottom: "6pt",
          }}
        >
          <Editable
            value={lead}
            onCommit={(v) => p.onUpdate("Question_Text", v + "\n" + clues.map((c) => `${c.letter}: ${c.text}`).join("\n"))}
            multiline
          />
        </div>
      ) : (
        <Stem q={p.q} onUpdate={p.onUpdate} />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "4pt", marginTop: "4pt" }}>
        {clues.map((c) => (
          <div
            key={c.letter}
            style={{
              display: "flex",
              alignItems: "stretch",
              gap: "6pt",
              border: `0.8pt solid ${color}`,
              borderRadius: "12pt",
              overflow: "hidden",
              backgroundColor: "rgba(255,255,255,0.85)",
            }}
          >
            <div
              style={{
                width: "22pt",
                background: color,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10pt",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {c.letter}
            </div>
            <div
              style={{
                flex: 1,
                fontSize: "9pt",
                padding: "4pt 8pt",
                lineHeight: 1.3,
              }}
            >
              <Editable value={c.text} onCommit={() => { /* parent owns stem */ }} multiline />
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function splitGroups(stem: string): { name: string; items: string[] }[] {
  const matches = [...stem.matchAll(/Group\s+([A-Z])[:.]?\s*([\s\S]*?)(?=Group\s+[A-Z][:.]?|$)/g)];
  return matches.map((m) => ({
    name: m[1],
    items: m[2]
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean),
  }));
}

export function CompareGroups(p: TemplateProps) {
  const color = gradeColor(p.gradeLevel);
  const groups = splitGroups(p.q.Question_Text || "");
  const lead = (p.q.Question_Text || "").split(/Group\s+[A-Z][:.]?/)[0]?.trim() || "";
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      {lead ? (
        <div
          style={{
            fontSize: "9.5pt",
            lineHeight: 1.35,
            paddingLeft: "26pt",
            marginBottom: "6pt",
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
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(groups.length, 2)}, 1fr)`,
          gap: "10pt",
          marginTop: "4pt",
        }}
      >
        {groups.map((g) => (
          <div
            key={g.name}
            style={{
              padding: "8pt 10pt",
              borderRadius: "10pt",
              border: `1pt solid ${color}`,
              backgroundColor: "rgba(255, 240, 220, 0.55)",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "9.5pt", color, marginBottom: "4pt" }}>
              Group {g.name}
            </div>
            <div style={{ fontSize: "8.5pt", lineHeight: 1.4 }}>
              {g.items.map((it, i) => (
                <div key={i}>{it}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

export function WordSearch(p: TemplateProps) {
  // The LLM doesn't currently emit a real grid; show the image (if any) plus stem sub-parts.
  const hasImage = p.q.Has_Image === "Yes" && !!p.q.ImageData;
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      <div style={{ display: "flex", gap: "12pt", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Stem q={p.q} onUpdate={p.onUpdate} />
        </div>
        {hasImage ? (
          <div style={{ flexShrink: 0, maxWidth: "45%" }}>
            <EditableQuestionImage
              imageData={p.q.ImageData || ""}
              qNo={p.q.Q_No}
              onUpdate={p.onUpdate}
              maxHeight="180pt"
            />
          </div>
        ) : (
          <div
            style={{
              flexShrink: 0,
              width: "150pt",
              height: "150pt",
              border: "0.8pt solid #cfa37a",
              borderRadius: "4pt",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "8pt",
              color: "#999",
              backgroundColor: "rgba(255, 245, 230, 0.45)",
            }}
          >
            (letter grid)
          </div>
        )}
      </div>
    </CardShell>
  );
}

export function HotsText(p: TemplateProps) {
  const opts = getOpts(p.q);
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel} isHots>
      <Stem q={p.q} onUpdate={p.onUpdate} />
      {opts.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            columnGap: "10pt",
            rowGap: "2pt",
            marginTop: "5pt",
          }}
        >
          {opts.map((o) => (
            <div key={o.key} style={{ fontSize: "9pt", lineHeight: 1.25 }}>
              ({o.label}){" "}
              <Editable value={o.value} onCommit={(v) => p.onUpdate(o.key, v)} />
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            marginTop: "8pt",
            borderBottom: "0.8pt solid #9a9a9a",
            height: "14pt",
          }}
        />
      )}
    </CardShell>
  );
}

interface ArrangeSteps {
  lead: string;
  steps: { label: string; text: string }[];
}

function parseArrangeSteps(stem: string): ArrangeSteps | null {
  // Find (I), (II), (III), (IV), (V) — Roman numerals up to V.
  const re = /\(([IV]{1,3})\)\s*([^()]*?)(?=\s*\(([IV]{1,3})\)|$)/g;
  const steps: { label: string; text: string }[] = [];
  let firstIdx = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stem)) !== null) {
    if (firstIdx === -1) firstIdx = m.index;
    steps.push({ label: m[1], text: m[2].trim().replace(/[.\s]+$/, "") });
  }
  if (steps.length < 2) return null;
  const lead = stem.slice(0, firstIdx).replace(/[:.\s]+$/, "").trim();
  return { lead, steps };
}

export function ArrangeSequence(p: TemplateProps) {
  const opts = getOpts(p.q);
  const parsed = parseArrangeSteps(p.q.Question_Text || "");
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      {parsed ? (
        <>
          <div
            style={{
              fontSize: "9.5pt",
              lineHeight: 1.35,
              paddingLeft: "26pt",
              marginBottom: "4pt",
            }}
          >
            <Editable
              value={parsed.lead}
              onCommit={(v) => {
                const tail = (p.q.Question_Text || "").slice(parsed.lead.length);
                p.onUpdate("Question_Text", v + tail);
              }}
              multiline
            />
          </div>
          <div style={{ paddingLeft: "26pt", marginTop: "2pt" }}>
            {parsed.steps.map((step) => (
              <div
                key={step.label}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "6pt",
                  fontSize: "9pt",
                  lineHeight: 1.35,
                  marginBottom: "3pt",
                }}
              >
                <span style={{ fontWeight: 700, minWidth: "22pt", flexShrink: 0 }}>
                  ({step.label})
                </span>
                <span style={{ flex: 1 }}>
                  <MathText text={step.text} />
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Stem q={p.q} onUpdate={p.onUpdate} />
      )}
      {opts.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            columnGap: "10pt",
            rowGap: "2pt",
            marginTop: "6pt",
          }}
        >
          {opts.map((o) => (
            <div key={o.key} style={{ fontSize: "9pt", lineHeight: 1.3 }}>
              ({o.label}){" "}
              <Editable value={o.value} onCommit={(v) => p.onUpdate(o.key, v)} />
            </div>
          ))}
        </div>
      ) : null}
    </CardShell>
  );
}

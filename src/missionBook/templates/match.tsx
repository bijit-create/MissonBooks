import React from "react";
import { CardShell, Editable, Stem, getOpts } from "./shared";
import MathText from "./MathText";
import { gradeColor } from "../styles";
import type { TemplateProps } from "./types";

function parsePair(raw: string): { left: string; right: string } {
  const m = raw.match(/^\s*([^-–:]+?)\s*[-–:]\s*(.+)$/);
  return m ? { left: m[1].trim(), right: m[2].trim() } : { left: raw, right: "" };
}

export function MatchTable(p: TemplateProps) {
  const color = gradeColor(p.gradeLevel);
  const opts = getOpts(p.q);
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      <Stem q={p.q} onUpdate={p.onUpdate} />
      <div
        style={{
          marginTop: "6pt",
          borderRadius: "4pt",
          overflow: "hidden",
          border: `0.6pt solid ${color}`,
        }}
      >
        <div style={{ display: "flex", backgroundColor: color }}>
          <div style={headerCell}>Column A</div>
          <div style={{ ...headerCell, borderLeft: "0.5pt solid rgba(255,255,255,0.6)" }}>
            Column B
          </div>
        </div>
        {opts.map((o, i) => {
          const pair = parsePair(o.value);
          return (
            <div
              key={o.key}
              style={{
                display: "flex",
                borderTop: "0.5pt solid #e5d0bb",
                backgroundColor: i % 2 === 1 ? "rgba(255, 230, 200, 0.45)" : "#fff",
              }}
            >
              <div style={bodyCell}>
                <Editable
                  value={pair.left}
                  onCommit={(v) => p.onUpdate(o.key, `${v} - ${pair.right}`)}
                />
              </div>
              <div style={{ ...bodyCell, borderLeft: "0.5pt solid #e5d0bb" }}>
                <Editable
                  value={pair.right}
                  onCommit={(v) => p.onUpdate(o.key, `${pair.left} - ${v}`)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

const headerCell: React.CSSProperties = {
  flex: 1,
  padding: "4pt 8pt",
  fontSize: "9.5pt",
  fontWeight: 700,
  color: "#fff",
};
const bodyCell: React.CSSProperties = {
  flex: 1,
  padding: "4pt 8pt",
  fontSize: "9pt",
};

interface ParsedColumns {
  lead: string;
  colILabel: string;
  colIILabel: string;
  colI: string[];
  colII: string[];
}

function parseColumns(stem: string): ParsedColumns | null {
  return parseWithColumnHeaders(stem) || parseWithoutHeaders(stem);
}

function parseWithColumnHeaders(stem: string): ParsedColumns | null {
  // Anchor on the LAST occurrence of each "Column X" header. The colon/dash
  // is optional — the LLM sometimes writes "Column I a) ..." directly.
  // findLast picks the section divider over the inline phrase.
  const colIHeaderRe = /\bColumn\s+(I|A|1)\b\s*[:–\-]?/gi;
  const colIIHeaderRe = /\bColumn\s+(II|B|2)\b\s*[:–\-]?/gi;

  const findLast = (re: RegExp): RegExpExecArray | null => {
    let m: RegExpExecArray | null;
    let last: RegExpExecArray | null = null;
    while ((m = re.exec(stem)) !== null) {
      last = m;
    }
    return last;
  };

  const colIHeader = findLast(colIHeaderRe);
  const colIIHeader = findLast(colIIHeaderRe);
  if (!colIHeader || !colIIHeader) return null;

  const iStart = colIHeader.index;
  const iiStart = colIIHeader.index;
  if (iiStart < iStart) return null;

  const lead = stem.slice(0, iStart).trim();
  const colILabel = `Column ${colIHeader[1].toUpperCase()}`;
  const colIILabel = `Column ${colIIHeader[1].toUpperCase()}`;
  const colIRaw = stem.slice(iStart + colIHeader[0].length, iiStart).trim();
  const colIIRaw = stem.slice(iiStart + colIIHeader[0].length).trim();

  return {
    lead,
    colILabel,
    colIILabel,
    colI: splitItems(colIRaw),
    colII: splitItems(colIIRaw),
  };
}

/**
 * Fallback parser: stems like
 *   "Match X: 1. one 2. two 3. three 4. four A. apple B. banana C. cherry D. donut"
 * have no explicit "Column" header. Detect two distinct labeled runs:
 *   - numeric labels: 1./2./3./4.
 *   - alpha labels:   A./B./C./D.
 * Split where the runs meet.
 */
function parseWithoutHeaders(stem: string): ParsedColumns | null {
  // Find the boundary where numeric items end and alpha items start (or vice versa).
  const NUM_LABEL_RE = /\b\d{1,2}[.)]\s/g;
  const ALPHA_LABEL_RE = /\b[A-Z][.)]\s/g;

  const numHits: number[] = [];
  const alphaHits: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = NUM_LABEL_RE.exec(stem)) !== null) numHits.push(m.index);
  while ((m = ALPHA_LABEL_RE.exec(stem)) !== null) alphaHits.push(m.index);

  if (numHits.length < 2 || alphaHits.length < 2) return null;

  const firstNum = numHits[0];
  const firstAlpha = alphaHits[0];

  // Whichever runs first is Column I; the other is Column II.
  let leadEnd: number;
  let pivot: number;
  let colIRaw: string;
  let colIIRaw: string;
  let colILabel: string;
  let colIILabel: string;
  if (firstNum < firstAlpha) {
    leadEnd = firstNum;
    pivot = firstAlpha;
    colIRaw = stem.slice(firstNum, pivot).trim();
    colIIRaw = stem.slice(pivot).trim();
    colILabel = "Column I";
    colIILabel = "Column II";
  } else {
    leadEnd = firstAlpha;
    pivot = firstNum;
    colIRaw = stem.slice(firstAlpha, pivot).trim();
    colIIRaw = stem.slice(pivot).trim();
    colILabel = "Column I";
    colIILabel = "Column II";
  }

  const lead = stem.slice(0, leadEnd).replace(/[:.\s]+$/, "").trim();
  return {
    lead,
    colILabel,
    colIILabel,
    colI: splitItems(colIRaw),
    colII: splitItems(colIIRaw),
  };
}

/**
 * Find labels like (i), (ii), (a), (1), i., 1., A), etc. and break the string
 * into one item per label. Tolerates missing whitespace and mixed labelling.
 */
function splitItems(raw: string): string[] {
  if (!raw) return [];
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return [];

  // Mark a break before each plausible label. Sentinel \x01 is unlikely in
  // real content. Two patterns:
  //   (i), (ii), (iii), (iv), (v), (a)–(d), (A)–(D), (1)–(20) — parenthesized
  //   i. / ii. / a. / A. / 1. / a) / A) / 1) / i) — terminator after label
  // Allow any single letter (P, Q, R, S, A–D, a–e, …) for parenthesized AND
  // terminator-style labels. Restrict unparenthesized to 1–3 chars to avoid
  // matching every period-terminated word in a sentence.
  const withBreaks = trimmed
    .replace(/\s+(?=\((?:[ivxIVX]{1,5}|[a-zA-Z]|\d{1,2})\))/g, "\x01")
    .replace(/\s+(?=(?:[ivxIVX]{1,5}|[a-zA-Z]|\d{1,2})[.)]\s)/g, "\x01");

  const items = withBreaks.split("\x01").map((s) => s.trim()).filter(Boolean);
  if (items.length > 1) return items;

  // Last-resort: newlines, semicolons, or just the raw trimmed string.
  const byLine = trimmed.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
  return byLine.length > 1 ? byLine : [trimmed];
}

export function MatchListPair(p: TemplateProps) {
  const color = gradeColor(p.gradeLevel);
  const parsed = parseColumns(p.q.Question_Text || "");

  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      {parsed ? (
        <>
          <div
            style={{
              fontSize: "9.5pt",
              lineHeight: 1.35,
              paddingLeft: "26pt",
              marginBottom: "6pt",
            }}
          >
            <Editable
              value={parsed.lead}
              onCommit={(v) => {
                // Preserve column markers in the stored stem
                const tail = (p.q.Question_Text || "").slice(parsed.lead.length);
                p.onUpdate("Question_Text", v + tail);
              }}
              multiline
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 0,
              marginTop: "4pt",
              border: `0.6pt solid ${color}`,
              borderRadius: "4pt",
              overflow: "hidden",
              width: "100%",
            }}
          >
            <div
              style={{
                ...colHeaderStyle,
                backgroundColor: color,
                borderRight: "0.5pt solid rgba(255,255,255,0.5)",
              }}
            >
              {parsed.colILabel}
            </div>
            <div style={{ ...colHeaderStyle, backgroundColor: color }}>
              {parsed.colIILabel}
            </div>
            {Array.from({ length: Math.max(parsed.colI.length, parsed.colII.length) }).map(
              (_, i) => {
                const altBg = i % 2 === 1 ? "rgba(255, 230, 200, 0.45)" : "#fff";
                return (
                  <React.Fragment key={i}>
                    <div
                      style={{
                        ...colCellStyle,
                        backgroundColor: altBg,
                        borderRight: "0.5pt solid #e5d0bb",
                        borderTop: "0.5pt solid #e5d0bb",
                      }}
                    >
                      <MathText text={parsed.colI[i] || ""} />
                    </div>
                    <div
                      style={{
                        ...colCellStyle,
                        backgroundColor: altBg,
                        borderTop: "0.5pt solid #e5d0bb",
                      }}
                    >
                      <MathText text={parsed.colII[i] || ""} />
                    </div>
                  </React.Fragment>
                );
              }
            )}
          </div>
        </>
      ) : (
        <Stem q={p.q} onUpdate={p.onUpdate} />
      )}
      {/* MATCH is matched by drawing lines — no MCQ options shown. */}
    </CardShell>
  );
}

const colHeaderStyle: React.CSSProperties = {
  padding: "4pt 8pt",
  fontSize: "9.5pt",
  fontWeight: 700,
  color: "#fff",
};
const colCellStyle: React.CSSProperties = {
  padding: "4pt 8pt",
  fontSize: "9pt",
};

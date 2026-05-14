import React from "react";
import { CardShell, Editable, Stem, getOpts } from "./shared";
import { gradeColor } from "../styles";
import type { TemplateProps } from "./types";

function OptionsGrid({
  q,
  onUpdate,
  columns,
}: TemplateProps & { columns: 1 | 2 }) {
  const opts = getOpts(q);
  if (opts.length === 0) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns === 2 ? "1fr 1fr" : "1fr",
        columnGap: "10pt",
        rowGap: "2pt",
        marginTop: "5pt",
      }}
    >
      {opts.map((o) => (
        <div key={o.key} style={{ fontSize: "9pt", lineHeight: 1.25 }}>
          ({o.label}){" "}
          <Editable value={o.value} onCommit={(v) => onUpdate(o.key, v)} />
        </div>
      ))}
    </div>
  );
}

export function McqTextNarrow(p: TemplateProps) {
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      <Stem q={p.q} onUpdate={p.onUpdate} />
      <OptionsGrid {...p} columns={1} />
    </CardShell>
  );
}

export function McqTextHalf(p: TemplateProps) {
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      <Stem q={p.q} onUpdate={p.onUpdate} />
      <OptionsGrid {...p} columns={2} />
    </CardShell>
  );
}

export function McqTextWide(p: TemplateProps) {
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      <Stem q={p.q} onUpdate={p.onUpdate} />
      <OptionsGrid {...p} columns={2} />
    </CardShell>
  );
}

export function McqWithFigure(p: TemplateProps) {
  const hasImage = p.q.Has_Image === "Yes" && !!p.q.ImageData;
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      <div style={{ display: "flex", gap: "10pt", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Stem q={p.q} onUpdate={p.onUpdate} />
        </div>
        {hasImage ? (
          <div
            style={{
              flexShrink: 0,
              maxWidth: "40%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={`data:image/png;base64,${p.q.ImageData}`}
              alt={`Q${p.q.Q_No}`}
              style={{ maxWidth: "100%", maxHeight: "110pt", objectFit: "contain" }}
            />
          </div>
        ) : null}
      </div>
      <OptionsGrid {...p} columns={2} />
    </CardShell>
  );
}

export function McqImageOptions(p: TemplateProps) {
  const opts = getOpts(p.q);
  const hasImage = p.q.Has_Image === "Yes" && !!p.q.ImageData;
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      <Stem q={p.q} onUpdate={p.onUpdate} />
      {hasImage ? (
        <div style={{ display: "flex", justifyContent: "center", margin: "5pt 0" }}>
          <img
            src={`data:image/png;base64,${p.q.ImageData}`}
            alt={`Q${p.q.Q_No}`}
            style={{ maxWidth: "100%", maxHeight: "160pt", objectFit: "contain" }}
          />
        </div>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(opts.length, 4)}, 1fr)`,
          gap: "8pt",
          marginTop: "5pt",
          textAlign: "center",
          fontSize: "9pt",
          fontWeight: 600,
        }}
      >
        {opts.map((o) => (
          <div key={o.key}>
            ({o.label}){" "}
            <Editable value={o.value} onCommit={(v) => p.onUpdate(o.key, v)} />
          </div>
        ))}
      </div>
    </CardShell>
  );
}

export function McqTrueFalse(p: TemplateProps) {
  const color = gradeColor(p.gradeLevel);
  const opts = getOpts(p.q);
  const tfLabels = opts.length === 0
    ? [{ key: "_t", value: "TRUE", label: "" }, { key: "_f", value: "FALSE", label: "" }]
    : opts;
  const hasImage = p.q.Has_Image === "Yes" && !!p.q.ImageData;
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      <div style={{ display: "flex", gap: "10pt", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Stem q={p.q} onUpdate={p.onUpdate} />
          <div style={{ display: "flex", gap: "10pt", marginTop: "6pt", flexWrap: "wrap" }}>
            {tfLabels.map((o) => (
              <div
                key={o.key}
                style={{
                  padding: "3pt 14pt",
                  borderRadius: "12pt",
                  border: `0.8pt solid ${color}`,
                  fontSize: "9pt",
                  fontWeight: 700,
                  color: "#1a1a1a",
                }}
              >
                {opts.length === 0 ? (
                  o.value
                ) : (
                  <Editable
                    value={o.value}
                    onCommit={(v) => p.onUpdate(o.key, v)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        {hasImage ? (
          <div style={{ flexShrink: 0, maxWidth: "38%" }}>
            <img
              src={`data:image/png;base64,${p.q.ImageData}`}
              alt={`Q${p.q.Q_No}`}
              style={{ maxWidth: "100%", maxHeight: "110pt", objectFit: "contain" }}
            />
          </div>
        ) : null}
      </div>
    </CardShell>
  );
}

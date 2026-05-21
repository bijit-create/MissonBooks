import React from "react";
import { CardShell, EditableQuestionImage, Stem } from "./shared";
import type { TemplateProps } from "./types";

export function ImageGridIdentify(p: TemplateProps) {
  const hasImage = p.q.Has_Image === "Yes" && !!p.q.ImageData;
  // The LLM gives us a single image that may itself contain a grid; we treat the
  // image as the whole grid. Labels a)-h) live in the stem.
  const labels = Array.from({ length: 8 }, (_, i) => String.fromCharCode(97 + i));
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      <Stem q={p.q} onUpdate={p.onUpdate} />
      {hasImage ? (
        <div style={{ display: "flex", justifyContent: "center", margin: "6pt 0" }}>
          <EditableQuestionImage
            imageData={p.q.ImageData || ""}
            qNo={p.q.Q_No}
            onUpdate={p.onUpdate}
            maxHeight="180pt"
          />
        </div>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "3pt 10pt",
          marginTop: "4pt",
          fontSize: "9pt",
          textAlign: "center",
        }}
      >
        {labels.slice(0, 4).map((l) => (
          <div key={l}>{l})</div>
        ))}
      </div>
    </CardShell>
  );
}

export function ImageWithBlanks(p: TemplateProps) {
  const hasImage = p.q.Has_Image === "Yes" && !!p.q.ImageData;
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      <Stem q={p.q} onUpdate={p.onUpdate} />
      {hasImage ? (
        <div style={{ display: "flex", justifyContent: "center", margin: "6pt 0" }}>
          <EditableQuestionImage
            imageData={p.q.ImageData || ""}
            qNo={p.q.Q_No}
            onUpdate={p.onUpdate}
            maxHeight="130pt"
          />
        </div>
      ) : null}
      <div
        style={{
          marginTop: "6pt",
          borderBottom: "0.8pt solid #9a9a9a",
          height: "14pt",
        }}
      />
    </CardShell>
  );
}

export function FigureQuestion(p: TemplateProps) {
  const hasImage = p.q.Has_Image === "Yes" && !!p.q.ImageData;
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      <div style={{ display: "flex", gap: "10pt", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Stem q={p.q} onUpdate={p.onUpdate} />
        </div>
        {hasImage ? (
          <div style={{ flexShrink: 0, maxWidth: "45%" }}>
            <EditableQuestionImage
              imageData={p.q.ImageData || ""}
              qNo={p.q.Q_No}
              onUpdate={p.onUpdate}
              maxHeight="130pt"
            />
          </div>
        ) : null}
      </div>
    </CardShell>
  );
}

export function FigureQuestionMultipart(p: TemplateProps) {
  const hasImage = p.q.Has_Image === "Yes" && !!p.q.ImageData;
  return (
    <CardShell q={p.q} gradeLevel={p.gradeLevel}>
      <Stem q={p.q} onUpdate={p.onUpdate} />
      {hasImage ? (
        <div style={{ display: "flex", justifyContent: "center", margin: "6pt 0" }}>
          <EditableQuestionImage
            imageData={p.q.ImageData || ""}
            qNo={p.q.Q_No}
            onUpdate={p.onUpdate}
            maxHeight="150pt"
          />
        </div>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "4pt 10pt",
          marginTop: "4pt",
          fontSize: "9pt",
          textAlign: "center",
        }}
      >
        <div>a)</div>
        <div>b)</div>
        <div>c)</div>
      </div>
    </CardShell>
  );
}

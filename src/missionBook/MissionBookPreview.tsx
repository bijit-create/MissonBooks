import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Download, X, Loader2 } from "lucide-react";
import { saveAs } from "file-saver";
import { gradeColor, gradeAssetUrl } from "./styles";
import { getMonster } from "./monsters";
import { classifyQuestions } from "./classify";
import type { ClassifiedQuestion, GridSpan, Template } from "./classify";
import { TEMPLATE_REGISTRY } from "./templates";
import { Editable } from "./templates/shared";
import { exportPagesToPdf } from "./exportPdf";
import { normalizeMath } from "./normalizeMath";
import { packIntoPages } from "./packer";
import { callApi, parseLooseJson } from "./api";
import type { PackedPage } from "./packer";
import { getHeaderLayout } from "./headerLayouts";
import type { MissionBookQuestion, SolvedExample } from "./MissionBookDocument";

export interface MissionBookPreviewProps {
  gradeLevel: string;
  lessonTitle: string;
  lessonCode: string;
  loCode?: string;
  monsterName?: string;
  monsterImage?: string | null;
  solvedExample: SolvedExample | null;
  questions: MissionBookQuestion[];
  /** Subject (e.g., "Mathematics"), used for on-the-fly question regen. */
  subject?: string;
  /** Raw learning outcome string from the config, used for regen prompts. */
  learningOutcome?: string;
  /** PDF inline-data parts forwarded to the LLM during regen. */
  referenceParts?: any[];
  onClose: () => void;
}

const ALL_TEMPLATES: Template[] = [
  "mcq-text-narrow",
  "mcq-text-half",
  "mcq-text-wide",
  "mcq-with-figure",
  "mcq-image-options",
  "mcq-true-false",
  "arrange-sequence",
  "match-table",
  "match-list-pair",
  "fib-single",
  "fib-multi-indent",
  "fib-multi-pill",
  "image-grid-identify",
  "image-with-blanks",
  "figure-question",
  "figure-question-multipart",
  "vertical-clue-list",
  "compare-groups",
  "word-search",
  "hots-text",
];

interface CardToolbarProps {
  qNo: number;
  template: Template;
  span: GridSpan;
  onCycleSpan: () => void;
  onMovePage: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSetTemplate: (t: Template) => void;
}

function CardToolbar(p: CardToolbarProps) {
  const spanLabel = p.span === 2 ? "1/3" : p.span === 3 ? "1/2" : "full";
  return (
    <div
      className="card-toolbar"
      data-screen-only
      style={{
        position: "absolute",
        top: "2pt",
        right: "2pt",
        display: "flex",
        alignItems: "center",
        gap: "2pt",
        padding: "2pt 4pt",
        background: "rgba(255,255,255,0.95)",
        border: "0.6pt solid #c8c8c8",
        borderRadius: "4pt",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        fontSize: "8pt",
        opacity: 0,
        pointerEvents: "none",
        transition: "opacity 120ms",
        zIndex: 10,
      }}
    >
      <button
        type="button"
        title={`Span: ${spanLabel} (click to cycle)`}
        onClick={p.onCycleSpan}
        style={toolbarBtn}
      >
        {spanLabel}
      </button>
      <button
        type="button"
        title="Move up"
        onClick={p.onMoveUp}
        style={toolbarBtn}
      >
        ↑
      </button>
      <button
        type="button"
        title="Move down"
        onClick={p.onMoveDown}
        style={toolbarBtn}
      >
        ↓
      </button>
      <button
        type="button"
        title="Move to other page"
        onClick={p.onMovePage}
        style={toolbarBtn}
      >
        ⇄
      </button>
      <select
        value={p.template}
        onChange={(e) => p.onSetTemplate(e.target.value as Template)}
        title="Template"
        style={{
          ...toolbarBtn,
          padding: "1pt 2pt",
          maxWidth: "84pt",
        }}
      >
        {ALL_TEMPLATES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}

const nudgeBtn: React.CSSProperties = {
  background: "#fff",
  border: "0.5pt solid #c8c8c8",
  borderRadius: "3pt",
  padding: "1pt 5pt",
  fontSize: "9pt",
  cursor: "pointer",
  color: "#1a1a1a",
  minWidth: "16pt",
};

const toolbarBtn: React.CSSProperties = {
  background: "#fff",
  border: "0.5pt solid #c8c8c8",
  borderRadius: "3pt",
  padding: "1pt 4pt",
  fontSize: "8pt",
  cursor: "pointer",
  color: "#1a1a1a",
};

interface BankPickerProps {
  unusedBank: ClassifiedQuestion[];
  canRegen: boolean;
  regenLoading: boolean;
  onPick: (qNo: number) => void;
  onRegen: (type: string) => void;
  onCancel: () => void;
}

function BankPicker(p: BankPickerProps) {
  return (
    <div
      data-screen-only
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        marginTop: "6pt",
        background: "#fff",
        border: "1pt solid #c8c8c8",
        borderRadius: "8pt",
        boxShadow: "0 4pt 12pt rgba(0,0,0,0.18)",
        padding: "10pt 12pt",
        zIndex: 100,
        maxHeight: "260pt",
        overflowY: "auto",
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontSize: "10pt",
          fontWeight: 700,
          marginBottom: "6pt",
          color: "#1a1a1a",
        }}
      >
        Pick a question to add
      </div>
      {p.unusedBank.length === 0 ? (
        <div
          style={{
            fontSize: "9pt",
            color: "#888",
            marginBottom: "8pt",
          }}
        >
          No unused questions in the bank.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4pt", marginBottom: "10pt" }}>
          {p.unusedBank.map((q) => (
            <button
              key={q.Q_No}
              onClick={() => p.onPick(q.Q_No)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "6pt",
                padding: "6pt 8pt",
                background: "#f7f8fa",
                border: "0.5pt solid #e3e6ec",
                borderRadius: "5pt",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  fontSize: "7.5pt",
                  fontWeight: 700,
                  padding: "1pt 5pt",
                  borderRadius: "3pt",
                  background: "#dde2eb",
                  color: "#3a4150",
                  flexShrink: 0,
                }}
              >
                {q.Question_Type || "MCQ"}
              </span>
              <span style={{ fontSize: "9pt", color: "#1a1a1a", flex: 1, lineHeight: 1.25 }}>
                {(q.Question_Text || "").slice(0, 100) || "(empty)"}
                {(q.Question_Text || "").length > 100 ? "…" : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      {p.canRegen && (
        <div
          style={{
            borderTop: "0.5pt solid #e3e6ec",
            paddingTop: "8pt",
            marginTop: p.unusedBank.length > 0 ? "0" : "4pt",
          }}
        >
          <div style={{ fontSize: "9pt", color: "#6a7480", marginBottom: "5pt" }}>
            Or generate a new question of type:
          </div>
          <div style={{ display: "flex", gap: "4pt", flexWrap: "wrap" }}>
            {["MCQ", "FIB", "MATCH", "ARR", "HOTS"].map((t) => (
              <button
                key={t}
                disabled={p.regenLoading}
                onClick={() => p.onRegen(t)}
                style={{
                  padding: "4pt 10pt",
                  fontSize: "9pt",
                  fontWeight: 600,
                  border: "0.5pt solid #c8c8c8",
                  borderRadius: "4pt",
                  background: p.regenLoading ? "#f0f0f0" : "#fff",
                  cursor: p.regenLoading ? "wait" : "pointer",
                  color: "#1a1a1a",
                }}
              >
                {t}
              </button>
            ))}
            {p.regenLoading && (
              <span style={{ fontSize: "9pt", color: "#888", padding: "4pt" }}>
                Generating…
              </span>
            )}
          </div>
        </div>
      )}
      <div style={{ marginTop: "10pt", textAlign: "right" }}>
        <button
          onClick={p.onCancel}
          style={{
            padding: "4pt 12pt",
            fontSize: "9pt",
            background: "none",
            border: "none",
            color: "#6a7480",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function shortenTitle(s: string, max = 50): string {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > 24 ? cut.slice(0, space) : cut).trim() + "…";
}

const PAGE_W_PT = 595;
const PAGE_H_PT = 842;
const CONTENT_TOP_PT = 100;
const CONTENT_BOTTOM_PT = 30;
const CONTENT_LEFT_PT = 28;
const CONTENT_RIGHT_PT = 28;
const PAGE_CONTENT_WIDTH_PT = PAGE_W_PT - CONTENT_LEFT_PT - CONTENT_RIGHT_PT;
const PAGE_CONTENT_HEIGHT_PT = PAGE_H_PT - CONTENT_TOP_PT - CONTENT_BOTTOM_PT;
const ROW_GAP_PT = 8;
const PAGE2_TOP_OFFSET_PT = 14;

function estimateSolvedHeight(ex: SolvedExample | null): number {
  if (!ex) return 0;
  // Char-counts → rough lines × line height. Tuned empirically.
  const charsPerLine = 100;
  const probLines = Math.max(1, Math.ceil((ex.problem || "").length / charsPerLine));
  const explLines = Math.max(1, Math.ceil((ex.explanation || "").length / charsPerLine));
  return Math.ceil(28 + (probLines + explLines) * 14 + 24);
}

export default function MissionBookPreview(props: MissionBookPreviewProps) {
  const {
    gradeLevel,
    lessonTitle,
    lessonCode,
    loCode,
    monsterName,
    monsterImage,
    solvedExample,
    questions,
    subject,
    learningOutcome,
    referenceParts,
    onClose,
  } = props;

  const classifiedInit = useMemo(() => classifyQuestions(questions), [questions]);
  const [edited, setEdited] = useState<ClassifiedQuestion[]>(classifiedInit);
  const [editedTitle, setEditedTitle] = useState(lessonTitle);
  const [editedMonsterName, setEditedMonsterName] = useState<string>(() => {
    const fallback = getMonster(loCode, gradeLevel);
    return monsterName?.trim() || fallback.name;
  });
  const [editedSolved, setEditedSolved] = useState<SolvedExample | null>(() =>
    solvedExample
      ? {
          problem: normalizeMath(solvedExample.problem),
          explanation: normalizeMath(solvedExample.explanation),
          answer: normalizeMath(solvedExample.answer),
        }
      : null
  );
  const [exporting, setExporting] = useState(false);
  const [monsterImgOk, setMonsterImgOk] = useState(true);

  // Bank picker state — which page's "+ Add" popover is open + regen spinner.
  const [addPickerOpen, setAddPickerOpen] = useState<{ pageIdx: number } | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);

  // Per-session positional overrides for the monster image + name pill.
  // Null = use the headerLayout defaults. Arrow buttons in the screen-only
  // toolbar nudge by 2pt each press.
  const [monsterPos, setMonsterPos] = useState<{
    top: number;
    left: number;
    size: number;
  } | null>(null);
  const [monsterNamePos, setMonsterNamePos] = useState<{
    top: number;
    left: number;
    width?: number;   // maxWidth override (also raises minWidth)
    height?: number;
  } | null>(null);

  const nudgeMonster = (dx: number, dy: number, dsize = 0) => {
    const layout = getHeaderLayout(gradeLevel);
    setMonsterPos((prev) => {
      const cur =
        prev ?? {
          top: layout.monsterCircle.top,
          left: layout.monsterCircle.left,
          size: layout.monsterCircle.size,
        };
      return {
        top: cur.top + dy,
        left: cur.left + dx,
        size: Math.max(20, Math.min(140, cur.size + dsize)),
      };
    });
  };
  const nudgeMonsterName = (dx: number, dy: number) => {
    const layout = getHeaderLayout(gradeLevel);
    setMonsterNamePos((prev) => {
      const cur =
        prev ?? {
          top: layout.monsterNamePill.top,
          left: layout.monsterNamePill.left,
        };
      return { ...cur, top: cur.top + dy, left: cur.left + dx };
    });
  };
  const nudgeMonsterNameSize = (dw: number, dh: number) => {
    const layout = getHeaderLayout(gradeLevel);
    setMonsterNamePos((prev) => {
      const cur =
        prev ?? {
          top: layout.monsterNamePill.top,
          left: layout.monsterNamePill.left,
          width: layout.monsterNamePill.maxWidth,
          height: layout.monsterNamePill.height,
        };
      return {
        ...cur,
        width: Math.max(40, Math.min(220, (cur.width ?? layout.monsterNamePill.maxWidth) + dw)),
        height: Math.max(10, Math.min(48, (cur.height ?? layout.monsterNamePill.height) + dh)),
      };
    });
  };
  const resetMonsterPositions = () => {
    setMonsterPos(null);
    setMonsterNamePos(null);
  };

  const [phase, setPhase] = useState<"measuring" | "packed">("measuring");
  const [packed, setPacked] = useState<PackedPage[]>(() => [
    { cards: edited },
    { cards: [] },
  ]);
  // One-shot flag so the post-pack overflow check runs exactly once per pack.
  const overflowCheckedRef = useRef(false);

  const measurementHostRef = useRef<HTMLDivElement | null>(null);
  const measurementCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const headerLayout = useMemo(() => getHeaderLayout(gradeLevel), [gradeLevel]);
  const color = gradeColor(gradeLevel);
  const monsterAsset =
    monsterImage !== undefined && monsterImage !== null
      ? monsterImage
      : getMonster(loCode, gradeLevel).asset;

  // Reset the load-OK flag when the asset path changes so a fresh upload
  // re-tries instead of staying hidden from a prior 404.
  useEffect(() => {
    setMonsterImgOk(true);
  }, [monsterAsset]);

  // Measurement → pack pipeline.
  useLayoutEffect(() => {
    if (phase !== "measuring") return;
    const host = measurementHostRef.current;
    if (!host) return;

    const hostWidthPx = host.getBoundingClientRect().width;
    const pxPerPt = hostWidthPx / PAGE_CONTENT_WIDTH_PT;
    if (!isFinite(pxPerPt) || pxPerPt <= 0) return;

    const heights: Record<number, number> = {};
    for (const c of edited) {
      const el = measurementCardRefs.current[c.Q_No];
      if (el) {
        heights[c.Q_No] = el.getBoundingClientRect().height / pxPerPt;
      } else {
        heights[c.Q_No] = 60;
      }
    }

    const packedPages = packIntoPages({
      cards: edited,
      heights,
      solvedHeight: estimateSolvedHeight(editedSolved),
      pageContentHeightPt: PAGE_CONTENT_HEIGHT_PT,
      rowGapPt: ROW_GAP_PT,
      page2TopOffsetPt: PAGE2_TOP_OFFSET_PT,
    });

    setPacked(packedPages);
    setPhase("packed");
    overflowCheckedRef.current = false;
  }, [phase, edited, editedSolved]);

  // Post-render overflow check: after the visible pages render, measure
  // page 1's actual rendered height. If it exceeds the content-area budget,
  // pop trailing cards into page 2's head until it fits.
  useLayoutEffect(() => {
    if (phase !== "packed") return;
    if (overflowCheckedRef.current) return;
    const page1El = pageRefs.current[0];
    if (!page1El) return;

    // Find the content grid container by walking down from the page element.
    // It's the descendant with grid-template-columns containing "repeat(6".
    let contentEl: HTMLElement | null = null;
    const candidates = page1El.querySelectorAll<HTMLElement>("div");
    for (const c of Array.from(candidates)) {
      if ((c.style.display || "").includes("grid") && (c.style.gridTemplateColumns || "").includes("1fr")) {
        contentEl = c;
        break;
      }
    }
    if (!contentEl) return;

    const contentWidthPx = contentEl.getBoundingClientRect().width;
    const pxPerPt = contentWidthPx / (PAGE_W_PT - CONTENT_LEFT_PT - CONTENT_RIGHT_PT);
    if (!isFinite(pxPerPt) || pxPerPt <= 0) return;

    const actualHeightPx = contentEl.scrollHeight;
    const actualHeightPt = actualHeightPx / pxPerPt;
    const budgetPt = PAGE_CONTENT_HEIGHT_PT;
    const overflowPt = actualHeightPt - budgetPt;

    if (overflowPt > 4 && packed[0].cards.length > 0) {
      // Bump the last card(s) of page 1 to page 2's head until we fit.
      const p1 = [...packed[0].cards];
      const p2 = [...(packed[1]?.cards ?? [])];
      while (p1.length > 0) {
        const moved = p1.pop()!;
        p2.unshift(moved);
        // Estimate the height saved by removing 'moved'. We don't have its
        // measured height handy here; assume one popped card releases ~80pt.
        // We re-check by triggering one more measurement cycle.
        const stillOverflowing = actualHeightPt - 80 * (packed[0].cards.length - p1.length) > budgetPt;
        if (!stillOverflowing) break;
      }
      // Re-assign sequential displayNo over the new arrangement.
      let n = 1;
      const renumber = (cards: ClassifiedQuestion[]) =>
        cards.map((c) => ({ ...c, displayNo: n++ }));
      setPacked([{ cards: renumber(p1) }, { cards: renumber(p2) }]);
    }

    overflowCheckedRef.current = true;
  }, [phase, packed]);

  const updateField = (qNo: number, field: string, value: string) => {
    setEdited((prev) =>
      prev.map((x) => (x.Q_No === qNo ? { ...x, [field]: value } : x))
    );
  };

  // ---- Layer 1: Page layout mutators (drag/drop + arrow buttons) ----
  const renumberAcrossPages = (pages: PackedPage[]): PackedPage[] => {
    let n = 1;
    return pages.map((p) => ({
      cards: p.cards.map((c) => ({ ...c, displayNo: n++ })),
    }));
  };

  const moveCardToPage = (qNo: number, targetPageIdx: number) => {
    setPacked((prev) => {
      let foundCard: ClassifiedQuestion | null = null;
      let sourcePageIdx = -1;
      for (let i = 0; i < prev.length; i++) {
        const idx = prev[i].cards.findIndex((c) => c.Q_No === qNo);
        if (idx >= 0) {
          foundCard = prev[i].cards[idx];
          sourcePageIdx = i;
          break;
        }
      }
      if (!foundCard || sourcePageIdx === targetPageIdx) return prev;
      const next = prev.map((p) => ({ cards: p.cards.filter((c) => c.Q_No !== qNo) }));
      next[targetPageIdx] = {
        cards: [...next[targetPageIdx].cards, foundCard],
      };
      return renumberAcrossPages(next);
    });
  };

  const moveCardWithinPage = (qNo: number, direction: -1 | 1) => {
    setPacked((prev) => {
      const next = prev.map((p) => ({ cards: [...p.cards] }));
      for (const page of next) {
        const idx = page.cards.findIndex((c) => c.Q_No === qNo);
        if (idx < 0) continue;
        const target = idx + direction;
        if (target < 0 || target >= page.cards.length) return prev;
        [page.cards[idx], page.cards[target]] = [page.cards[target], page.cards[idx]];
        break;
      }
      return renumberAcrossPages(next);
    });
  };

  // ---- Layer 2: Card layout mutators (span + template per card) ----
  const SPAN_CYCLE: GridSpan[] = [2, 3, 6];
  const cycleSpan = (qNo: number) => {
    setPacked((prev) =>
      prev.map((p) => ({
        cards: p.cards.map((c) => {
          if (c.Q_No !== qNo) return c;
          const i = SPAN_CYCLE.indexOf(c.span);
          const nextSpan = SPAN_CYCLE[(i + 1) % SPAN_CYCLE.length];
          return { ...c, span: nextSpan };
        }),
      }))
    );
  };

  const setCardTemplate = (qNo: number, template: ClassifiedQuestion["template"]) => {
    setPacked((prev) =>
      prev.map((p) => ({
        cards: p.cards.map((c) =>
          c.Q_No === qNo ? { ...c, template } : c
        ),
      }))
    );
  };

  // ---- Bank-driven question add ----
  // Bank = questions in `edited` that aren't currently placed on any page
  // (typically because the packer dropped them to fit 2 pages).
  const packedQNos = useMemo(
    () => new Set(packed.flatMap((p) => p.cards.map((c) => c.Q_No))),
    [packed]
  );
  const unusedBank = useMemo(
    () => edited.filter((q) => !packedQNos.has(q.Q_No)),
    [edited, packedQNos]
  );
  const canRegen = Boolean(
    subject && learningOutcome && gradeLevel
  );

  const addFromBank = (qNo: number, pageIdx: number) => {
    const q = edited.find((x) => x.Q_No === qNo);
    if (!q) return;
    setPacked((prev) => {
      const next = prev.map((p) => ({ cards: [...p.cards] }));
      if (!next[pageIdx]) next[pageIdx] = { cards: [] };
      next[pageIdx].cards.push(q);
      return renumberAcrossPages(next);
    });
    setAddPickerOpen(null);
  };

  const buildOneShotPrompt = (qType: string): string => {
    const cleanedLO = (learningOutcome || "").trim();
    return `You are an expert NCERT question-paper setter. Generate EXACTLY 1 question.
Grade: ${gradeLevel}
Subject: ${subject || ""}
Learning Outcome: ${cleanedLO}
Question type: ${qType}

MATH FORMATTING:
- Write fractions as plain numerator/denominator: "1/2", "3/4". A post-processor will render them.
- Use Unicode operators in plain text: × ÷ ° ². No LaTeX commands (no \\frac, no $).

Return a JSON array with one object, fields:
Q_No, Question_Type, Difficulty, Question_Text, Option_A, Option_B, Option_C, Option_D,
Correct_Answer, Has_Image, Image_Description, Image_Prompt, Skill_Mapped, LO_Code,
NCERT_Reference, Marks, Hint, Template.

Has_Image must be "No" for this regen.
Template is the visual layout (e.g., mcq-text-half, fib-single, match-list-pair,
arrange-sequence, hots-text, etc.). Pick the most appropriate.

Output ONLY the JSON array, no prose.`;
  };

  const regenAndAdd = async (qType: string, pageIdx: number) => {
    if (!canRegen) return;
    setRegenLoading(true);
    try {
      const prompt = buildOneShotPrompt(qType);
      const resp = await callApi<{ text: string }>("/api/generate-questions", {
        prompt,
        referenceParts: referenceParts || [],
      });
      const arr = parseLooseJson<any[]>(resp.text || "[]");
      if (!Array.isArray(arr) || arr.length === 0) {
        throw new Error("LLM returned no question");
      }
      const raw = arr[0];
      const nextQNo = Math.max(0, ...edited.map((q) => q.Q_No)) + 1;
      raw.Q_No = nextQNo;
      raw.Has_Image = raw.Has_Image || "No";
      const classified = classifyQuestions([raw])[0];
      setEdited((prev) => [...prev, classified]);
      setPacked((prev) => {
        const next = prev.map((p) => ({ cards: [...p.cards] }));
        if (!next[pageIdx]) next[pageIdx] = { cards: [] };
        next[pageIdx].cards.push(classified);
        return renumberAcrossPages(next);
      });
      setAddPickerOpen(null);
    } catch (err: any) {
      console.error("[regenAndAdd] failed:", err);
      alert("Failed to generate question: " + (err?.message || "Unknown error"));
    } finally {
      setRegenLoading(false);
    }
  };

  const totalFixes = edited.reduce((s, q) => s + q.fixes.length, 0);

  const handleDownload = async () => {
    setExporting(true);
    // Tag the body so the toolbar's data-screen-only style hides during capture.
    document.body.classList.add("mission-book-exporting");
    try {
      const pages = pageRefs.current.filter(Boolean) as HTMLElement[];
      const blob = await exportPagesToPdf(pages);
      saveAs(blob, "mission_book.pdf");
    } catch (err: any) {
      console.error("[MissionBookPreview] export failed:", err);
      alert("Export failed: " + (err?.message || "Unknown error"));
    } finally {
      document.body.classList.remove("mission-book-exporting");
      setExporting(false);
    }
  };

  const renderCard = (c: ClassifiedQuestion, opts: { measurement?: boolean } = {}) => {
    const Component = TEMPLATE_REGISTRY[c.template];
    if (!Component) return null;
    const liveQ = edited.find((x) => x.Q_No === c.Q_No) ?? c;
    // Merge displayNo + template metadata from the packed card onto the live
    // (edited) data so CardShell renders the sequential 1..N badge.
    const merged: ClassifiedQuestion = {
      ...liveQ,
      template: c.template,
      span: c.span,
      fixes: c.fixes,
      displayNo: c.displayNo,
    };
    return (
      <div
        key={c.Q_No}
        ref={
          opts.measurement
            ? (el) => {
                measurementCardRefs.current[c.Q_No] = el;
              }
            : undefined
        }
        data-qno={c.Q_No}
        draggable={!opts.measurement}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", String(c.Q_No));
          e.dataTransfer.effectAllowed = "move";
        }}
        style={{
          gridColumn: `span ${c.span}`,
          minWidth: 0,
          display: "flex",
          alignSelf: "stretch",
          position: "relative",
        }}
        className="q-card-wrap"
      >
        <Component
          q={merged}
          gradeLevel={gradeLevel}
          onUpdate={(field, value) => updateField(c.Q_No, field, value)}
        />
        {!opts.measurement && (
          <CardToolbar
            qNo={c.Q_No}
            template={c.template}
            span={c.span}
            onCycleSpan={() => cycleSpan(c.Q_No)}
            onMovePage={() => {
              // Toggle between page 0 and 1
              const onPage = packed.findIndex((p) =>
                p.cards.some((x) => x.Q_No === c.Q_No)
              );
              const target = onPage === 0 ? 1 : 0;
              moveCardToPage(c.Q_No, target);
            }}
            onMoveUp={() => moveCardWithinPage(c.Q_No, -1)}
            onMoveDown={() => moveCardWithinPage(c.Q_No, 1)}
            onSetTemplate={(t) => setCardTemplate(c.Q_No, t)}
          />
        )}
      </div>
    );
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border-b border-border flex items-center gap-4 px-6 py-3 shrink-0">
        <div className="flex-1">
          <h2 className="text-sm font-bold leading-none">Mission Book Preview</h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            Click any text to edit • {packed.length} A4 page
            {packed.length === 1 ? "" : "s"}
            {totalFixes > 0
              ? ` • ${totalFixes} auto-fix${totalFixes === 1 ? "" : "es"} applied`
              : ""}
            {phase === "measuring" ? " • Measuring layout…" : ""}
          </p>
        </div>
        <p className="text-[10px] text-text-muted italic max-w-[260px] text-right">
          Exported PDF is a high-resolution image, not selectable text.
        </p>
        <button
          onClick={handleDownload}
          disabled={exporting || phase === "measuring"}
          className="btn-sleek btn-sleek-primary flex items-center gap-2 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? "Exporting…" : "Download PDF"}
        </button>
        <button onClick={onClose} className="btn-sleek btn-sleek-outline flex items-center gap-2">
          <X className="w-4 h-4" /> Close
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8 flex flex-col items-center gap-8">
        {/* Off-screen measurement zone */}
        {phase === "measuring" && (
          <div
            ref={measurementHostRef}
            aria-hidden
            style={{
              position: "fixed",
              top: -99999,
              left: -99999,
              width: `${PAGE_CONTENT_WIDTH_PT}pt`,
              visibility: "hidden",
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: `${ROW_GAP_PT}pt`,
              alignContent: "start",
              fontSize: "9.5pt",
              color: "#1a1a1a",
            }}
          >
            {edited.map((c) => renderCard(c, { measurement: true }))}
          </div>
        )}

        {/* Visible pages */}
        {packed.map((page, pi) => (
          <div
            key={pi}
            ref={(el) => {
              pageRefs.current[pi] = el;
            }}
            className="mission-book-page"
          >
            <img
              src={gradeAssetUrl(gradeLevel)}
              alt=""
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                pointerEvents: "none",
              }}
            />

            {(() => {
              const mc = {
                top: monsterPos?.top ?? headerLayout.monsterCircle.top,
                left: monsterPos?.left ?? headerLayout.monsterCircle.left,
                size: monsterPos?.size ?? headerLayout.monsterCircle.size,
              };
              return monsterAsset && monsterImgOk ? (
                <img
                  src={monsterAsset}
                  alt="monster"
                  onError={() => setMonsterImgOk(false)}
                  style={{
                    position: "absolute",
                    top: `${mc.top}pt`,
                    left: `${mc.left}pt`,
                    width: `${mc.size}pt`,
                    height: `${mc.size}pt`,
                    objectFit: "contain",
                    pointerEvents: "none",
                  }}
                />
              ) : null;
            })()}

            {(() => {
              const mn = {
                top: monsterNamePos?.top ?? headerLayout.monsterNamePill.top,
                left: monsterNamePos?.left ?? headerLayout.monsterNamePill.left,
                width: monsterNamePos?.width ?? headerLayout.monsterNamePill.maxWidth,
                height: monsterNamePos?.height ?? headerLayout.monsterNamePill.height,
              };
              return (
            <div
              style={{
                position: "absolute",
                top: `${mn.top}pt`,
                left: `${mn.left}pt`,
                minWidth: `${Math.min(headerLayout.monsterNamePill.minWidth, mn.width)}pt`,
                maxWidth: `${mn.width}pt`,
                height: `${mn.height}pt`,
                padding: "0 6pt",
                borderRadius: `${mn.height / 2}pt`,
                backgroundColor: color,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "9pt",
                lineHeight: 1,
                fontWeight: 700,
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              <Editable
                value={editedMonsterName}
                onCommit={setEditedMonsterName}
                style={{ color: "#fff" }}
              />
            </div>
              );
            })()}

            {/* Nudge controls for monster + name (screen only). */}
            <div
              data-screen-only
              style={{
                position: "absolute",
                top: "4pt",
                right: "100pt",
                display: "flex",
                alignItems: "center",
                gap: "3pt",
                padding: "3pt 6pt",
                background: "rgba(255,255,255,0.92)",
                border: "0.6pt solid #c8c8c8",
                borderRadius: "6pt",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                fontSize: "8pt",
                zIndex: 50,
              }}
            >
              <span style={{ fontWeight: 700, color: "#444" }}>Monster:</span>
              <button onClick={() => nudgeMonster(-2, 0)} style={nudgeBtn} title="Left">←</button>
              <button onClick={() => nudgeMonster(2, 0)} style={nudgeBtn} title="Right">→</button>
              <button onClick={() => nudgeMonster(0, -2)} style={nudgeBtn} title="Up">↑</button>
              <button onClick={() => nudgeMonster(0, 2)} style={nudgeBtn} title="Down">↓</button>
              <button onClick={() => nudgeMonster(0, 0, 2)} style={nudgeBtn} title="Bigger">＋</button>
              <button onClick={() => nudgeMonster(0, 0, -2)} style={nudgeBtn} title="Smaller">－</button>
              <span style={{ width: "1px", background: "#ddd", alignSelf: "stretch", margin: "0 2pt" }} />
              <span style={{ fontWeight: 700, color: "#444" }}>Name:</span>
              <button onClick={() => nudgeMonsterName(-2, 0)} style={nudgeBtn} title="Name left">←</button>
              <button onClick={() => nudgeMonsterName(2, 0)} style={nudgeBtn} title="Name right">→</button>
              <button onClick={() => nudgeMonsterName(0, -2)} style={nudgeBtn} title="Name up">↑</button>
              <button onClick={() => nudgeMonsterName(0, 2)} style={nudgeBtn} title="Name down">↓</button>
              <button onClick={() => nudgeMonsterNameSize(4, 0)} style={nudgeBtn} title="Wider">W＋</button>
              <button onClick={() => nudgeMonsterNameSize(-4, 0)} style={nudgeBtn} title="Narrower">W－</button>
              <button onClick={() => nudgeMonsterNameSize(0, 2)} style={nudgeBtn} title="Taller">H＋</button>
              <button onClick={() => nudgeMonsterNameSize(0, -2)} style={nudgeBtn} title="Shorter">H－</button>
              <span style={{ width: "1px", background: "#ddd", alignSelf: "stretch", margin: "0 2pt" }} />
              <button
                onClick={resetMonsterPositions}
                style={{ ...nudgeBtn, padding: "1pt 6pt" }}
                title="Reset"
              >
                Reset
              </button>
            </div>

            <div
              style={{
                position: "absolute",
                top: `${headerLayout.titlePill.top}pt`,
                left: `${headerLayout.titlePill.left}pt`,
                width: `${headerLayout.titlePill.width}pt`,
                height: `${headerLayout.titlePill.height}pt`,
                padding: "0 14pt",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "15pt",
                fontWeight: 700,
                color,
              }}
            >
              <Editable value={shortenTitle(editedTitle)} onCommit={setEditedTitle} />
            </div>

            <div
              style={{
                position: "absolute",
                top: `${headerLayout.codePill.top}pt`,
                right: `${headerLayout.codePill.right}pt`,
                width: `${headerLayout.codePill.width}pt`,
                height: `${headerLayout.codePill.height}pt`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14pt",
                fontWeight: 700,
                color,
              }}
            >
              {lessonCode}
            </div>

            <div
              style={{
                position: "absolute",
                // Page 2 starts lower than page 1 so cards sit inside the
                // template's white area (where solved example begins on page 1).
                top: `${pi === 0 ? CONTENT_TOP_PT : CONTENT_TOP_PT + PAGE2_TOP_OFFSET_PT}pt`,
                left: `${CONTENT_LEFT_PT}pt`,
                right: `${CONTENT_RIGHT_PT}pt`,
                bottom: `${CONTENT_BOTTOM_PT}pt`,
                // Hard visual clip — no card may escape the template's white
                // safe zone, regardless of packer estimate errors.
                overflow: "hidden",
                fontSize: "9.5pt",
                color: "#1a1a1a",
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gridAutoRows: "min-content",
                gap: `${ROW_GAP_PT}pt`,
                // Both pages top-aligned. Cards stack from the top; if
                // there's leftover vertical space on page 2 we accept the
                // empty bottom rather than distribute weird gaps.
                alignContent: "start",
                alignItems: "stretch",
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData("text/plain");
                const qNo = parseInt(raw, 10);
                if (!Number.isNaN(qNo)) {
                  moveCardToPage(qNo, pi);
                }
              }}
            >
              {pi === 0 ? (
                <>
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      fontSize: "10pt",
                      fontWeight: 700,
                      letterSpacing: "1.2pt",
                      textTransform: "uppercase",
                      color: "#c75a3a",
                      marginBottom: "-2pt",
                    }}
                  >
                    Practice Question
                  </div>
                  {editedSolved ? (
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        padding: "8pt 10pt",
                        borderRadius: "10pt",
                        backgroundColor: "#ECECEC",
                      }}
                    >
                      <div style={{ fontSize: "10.5pt", fontWeight: 700 }}>SOLVED EXAMPLE:</div>
                      <div style={{ fontSize: "10pt", lineHeight: 1.4, marginTop: "2pt" }}>
                        <Editable
                          value={editedSolved.problem}
                          multiline
                          onCommit={(v) =>
                            setEditedSolved((prev) => (prev ? { ...prev, problem: v } : prev))
                          }
                        />
                      </div>
                      <div style={{ fontSize: "10.5pt", fontWeight: 700, marginTop: "4pt" }}>
                        EXPLANATION:
                      </div>
                      <div style={{ fontSize: "10pt", lineHeight: 1.4, marginTop: "2pt" }}>
                        <Editable
                          value={editedSolved.explanation}
                          multiline
                          onCommit={(v) =>
                            setEditedSolved((prev) => (prev ? { ...prev, explanation: v } : prev))
                          }
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4pt" }}>
                        <div
                          style={{
                            padding: "4pt 12pt",
                            borderRadius: "12pt",
                            backgroundColor: color,
                            fontWeight: 700,
                            fontSize: "10pt",
                          }}
                        >
                          Answer:{" "}
                          <Editable
                            value={editedSolved.answer}
                            onCommit={(v) =>
                              setEditedSolved((prev) => (prev ? { ...prev, answer: v } : prev))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {page.cards.map((c) => renderCard(c))}
              {(unusedBank.length > 0 || canRegen) && (
                <div
                  data-screen-only
                  style={{ gridColumn: "1 / -1", position: "relative" }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setAddPickerOpen((cur) =>
                        cur?.pageIdx === pi ? null : { pageIdx: pi }
                      )
                    }
                    style={{
                      width: "100%",
                      padding: "10pt 14pt",
                      border: "1pt dashed #b8c4d4",
                      borderRadius: "10pt",
                      backgroundColor:
                        addPickerOpen?.pageIdx === pi
                          ? "rgba(79,70,229,0.08)"
                          : "rgba(255,255,255,0.5)",
                      color: "#6a7480",
                      fontSize: "9.5pt",
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    + Add a question to page {pi + 1}
                    {unusedBank.length > 0
                      ? ` (${unusedBank.length} unused available)`
                      : ""}
                  </button>
                  {addPickerOpen?.pageIdx === pi && (
                    <BankPicker
                      unusedBank={unusedBank}
                      canRegen={canRegen}
                      regenLoading={regenLoading}
                      onPick={(qNo) => addFromBank(qNo, pi)}
                      onRegen={(type) => regenAndAdd(type, pi)}
                      onCancel={() => setAddPickerOpen(null)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}

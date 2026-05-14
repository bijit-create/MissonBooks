import type { MissionBookQuestion, SolvedExample } from "./MissionBookDocument";

export type LayoutHint = "narrow" | "normal" | "wide" | "table" | "image-block";

export interface PackedCard {
  q: MissionBookQuestion;
  width: number;
  hint: LayoutHint;
  estimatedHeight: number;
}

export interface PackedRow {
  cards: PackedCard[];
  height: number;
}

export interface PackedPage {
  rows: PackedRow[];
}

export interface PackResult {
  pages: PackedPage[];
  overflow: boolean;
}

export const LAYOUT = {
  pageContentHeight: 640,
  pageContentWidth: 539,
  rowGap: 6,
  cardPaddingV: 12,
  cardPaddingH: 16,
  stemFontSize: 9.5,
  stemLineHeight: 12.5,
  optionFontSize: 9,
  optionLineHeight: 11.3,
  imageBlockHeight: 96,
  imageBlockHeightFull: 140,
  matchRowHeight: 17,
  matchHeaderHeight: 18,
  fibBlankHeight: 16,
  qNumberRowExtra: 6,
};

const VALID_HINTS: ReadonlySet<LayoutHint> = new Set([
  "narrow",
  "normal",
  "wide",
  "table",
  "image-block",
]);

export function resolveHint(q: MissionBookQuestion): LayoutHint {
  const raw = (q as any).Layout_Hint;
  if (typeof raw === "string" && VALID_HINTS.has(raw as LayoutHint)) {
    return raw as LayoutHint;
  }
  const type = (q.Question_Type || "MCQ").toUpperCase();
  const stem = q.Question_Text || "";
  const opts = [q.Option_A, q.Option_B, q.Option_C, q.Option_D].filter(Boolean) as string[];
  const maxOpt = opts.reduce((m, o) => Math.max(m, o.length), 0);
  const hasImage = q.Has_Image === "Yes" && !!q.ImageData;
  const stemLen = stem.length;

  if (type === "MATCH") return "table";

  const subPartCount = (stem.match(/\b[a-eA-E]\)/g) || []).length;
  if (subPartCount >= 4 || stemLen > 240) return "image-block";

  if (hasImage || stemLen > 120 || maxOpt > 50) return "wide";
  if (stemLen <= 70 && maxOpt <= 22 && opts.length >= 2) return "narrow";
  return "normal";
}

export function hintToWidth(hint: LayoutHint): number {
  switch (hint) {
    case "narrow":      return 1 / 3;
    case "normal":      return 1 / 2;
    case "wide":        return 1;
    case "table":       return 1;
    case "image-block": return 1;
  }
}

function charsPerLine(widthFraction: number, fontSize: number): number {
  const availPx = LAYOUT.pageContentWidth * widthFraction - LAYOUT.cardPaddingH * 2;
  const avgCharPx = fontSize * 0.52;
  return Math.max(8, Math.floor(availPx / avgCharPx));
}

function linesFor(text: string, widthFraction: number, fontSize: number): number {
  if (!text) return 0;
  const cpl = charsPerLine(widthFraction, fontSize);
  const lines = text
    .split(/\n+/)
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / cpl)), 0);
  return Math.max(1, lines);
}

export function estimateHeight(q: MissionBookQuestion, hint: LayoutHint): number {
  const width = hintToWidth(hint);
  const type = (q.Question_Type || "MCQ").toUpperCase();
  const stem = q.Question_Text || "";
  const hasImage = q.Has_Image === "Yes" && !!q.ImageData;

  let h = LAYOUT.cardPaddingV * 2 + LAYOUT.qNumberRowExtra;
  h += linesFor(stem, width, LAYOUT.stemFontSize) * LAYOUT.stemLineHeight;

  if (hasImage) {
    h += hint === "image-block" || hint === "wide"
      ? LAYOUT.imageBlockHeightFull
      : LAYOUT.imageBlockHeight;
  }

  if (type === "MATCH") {
    const opts = [q.Option_A, q.Option_B, q.Option_C, q.Option_D].filter(Boolean) as string[];
    h += LAYOUT.matchHeaderHeight + opts.length * LAYOUT.matchRowHeight + 4;
  } else if (type === "FIB") {
    const subParts = Math.max(1, (stem.match(/\b[a-eA-E]\)/g) || []).length);
    h += subParts * LAYOUT.fibBlankHeight + 4;
  } else {
    const opts = [q.Option_A, q.Option_B, q.Option_C, q.Option_D].filter(Boolean) as string[];
    if (opts.length) {
      const perOpt = width >= 1 ? width / 2 : width;
      const optColumns = width >= 1 ? 2 : 1;
      const rows = Math.ceil(opts.length / optColumns);
      const longestPerOpt = opts.reduce((m, o) => {
        const ls = linesFor(o, perOpt, LAYOUT.optionFontSize);
        return Math.max(m, ls);
      }, 1);
      h += rows * longestPerOpt * LAYOUT.optionLineHeight + 4;
    }
  }

  return Math.ceil(h);
}

export function estimateSolvedExampleHeight(ex: SolvedExample | null): number {
  if (!ex) return 0;
  const w = 1;
  const lines =
    linesFor(ex.problem || "", w, 10) +
    linesFor(ex.explanation || "", w, 10);
  return Math.ceil(20 + lines * 13 + 28 + 16);
}

interface PendingRow {
  cards: PackedCard[];
  width: number;
  height: number;
}

function flushRow(pages: PackedPage[], page: { idx: number; remaining: number[] }, row: PendingRow, hardLimit: number): boolean {
  if (row.cards.length === 0) return true;
  const need = row.height + LAYOUT.rowGap;
  if (page.remaining[page.idx] < need) {
    page.idx++;
    if (page.idx >= hardLimit) return false;
    while (pages.length <= page.idx) pages.push({ rows: [] });
  }
  page.remaining[page.idx] -= need;
  pages[page.idx].rows.push({ cards: row.cards, height: row.height });
  return true;
}

interface PackOptions {
  pages?: number;
  solvedExampleHeight?: number;
  hintsOverride?: Map<number, LayoutHint>;
}

function packOnce(
  questions: MissionBookQuestion[],
  opts: Required<Pick<PackOptions, "pages" | "solvedExampleHeight">> & { hintsOverride?: Map<number, LayoutHint> }
): PackResult {
  const pageCount = opts.pages;
  const remaining = new Array(pageCount).fill(LAYOUT.pageContentHeight);
  remaining[0] -= opts.solvedExampleHeight + LAYOUT.rowGap;

  const pages: PackedPage[] = Array.from({ length: pageCount }, () => ({ rows: [] }));
  const cursor = { idx: 0, remaining };

  let row: PendingRow = { cards: [], width: 0, height: 0 };

  for (const q of questions) {
    const hint = opts.hintsOverride?.get(q.Q_No) ?? resolveHint(q);
    const w = hintToWidth(hint);
    const h = estimateHeight(q, hint);
    const card: PackedCard = { q, width: w, hint, estimatedHeight: h };

    if (row.width + w > 1.0001 && row.cards.length > 0) {
      if (!flushRow(pages, cursor, row, pageCount)) {
        return { pages, overflow: true };
      }
      row = { cards: [], width: 0, height: 0 };
    }

    row.cards.push(card);
    row.width += w;
    row.height = Math.max(row.height, h);

    if (row.width >= 1 - 0.0001) {
      if (!flushRow(pages, cursor, row, pageCount)) {
        return { pages, overflow: true };
      }
      row = { cards: [], width: 0, height: 0 };
    }
  }

  if (row.cards.length > 0) {
    if (!flushRow(pages, cursor, row, pageCount)) {
      return { pages, overflow: true };
    }
  }

  return { pages, overflow: false };
}

export function packIntoPages(
  questions: MissionBookQuestion[],
  opts: PackOptions = {}
): PackResult {
  const pages = opts.pages ?? 2;
  const solvedExampleHeight = opts.solvedExampleHeight ?? 0;
  const base = { pages, solvedExampleHeight };

  let result = packOnce(questions, base);
  if (!result.overflow) return result;

  const overrides = new Map<number, LayoutHint>();
  for (const q of questions) {
    const h = resolveHint(q);
    if (h === "normal") overrides.set(q.Q_No, "narrow");
  }
  result = packOnce(questions, { ...base, hintsOverride: overrides });
  if (!result.overflow) return result;

  const overrides2 = new Map<number, LayoutHint>(overrides);
  for (const q of questions) {
    const h = resolveHint(q);
    if (h === "wide" && !overrides2.has(q.Q_No)) {
      const stem = q.Question_Text || "";
      const hasImage = q.Has_Image === "Yes" && !!q.ImageData;
      if (!hasImage && stem.length <= 160) overrides2.set(q.Q_No, "normal");
    }
  }
  result = packOnce(questions, { ...base, hintsOverride: overrides2 });

  return result;
}

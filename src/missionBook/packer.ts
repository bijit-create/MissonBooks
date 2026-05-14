import type { ClassifiedQuestion } from "./classify";

export interface PackInput {
  cards: ClassifiedQuestion[];
  heights: Record<number, number>;
  solvedHeight: number;
  pageContentHeightPt: number;
  rowGapPt: number;
  /** Extra top offset on page 2 (e.g. visual padding to clear template border). */
  page2TopOffsetPt?: number;
}

export interface PackedPage {
  cards: ClassifiedQuestion[];
}

const COLS = 6;

interface SimulatedLayout {
  totalHeight: number;
  rowCount: number;
}

function simulateLayout(
  ordering: ClassifiedQuestion[],
  heights: Record<number, number>,
  rowGap: number
): SimulatedLayout {
  let remainingInRow = COLS;
  let rowHeight = 0;
  let totalHeight = 0;
  let rowCount = 0;
  for (const c of ordering) {
    const h = heights[c.Q_No] || 60;
    if (c.span > remainingInRow) {
      totalHeight += rowHeight + (rowCount > 0 ? rowGap : 0);
      rowCount += 1;
      rowHeight = 0;
      remainingInRow = COLS;
    }
    rowHeight = Math.max(rowHeight, h);
    remainingInRow -= c.span;
  }
  if (remainingInRow < COLS) {
    totalHeight += rowHeight + (rowCount > 0 ? rowGap : 0);
    rowCount += 1;
  }
  return { totalHeight, rowCount };
}

/**
 * Split an ordering into page-1 and page-2 buckets so page-1 stays within
 * its budget while filling as much as possible.
 */
function splitOrdering(
  ordering: ClassifiedQuestion[],
  heights: Record<number, number>,
  budgetP1: number,
  rowGap: number
): { p1: ClassifiedQuestion[]; p2: ClassifiedQuestion[] } {
  const p1: ClassifiedQuestion[] = [];
  for (let i = 0; i < ordering.length; i++) {
    const candidate = [...p1, ordering[i]];
    const sim = simulateLayout(candidate, heights, rowGap);
    if (sim.totalHeight > budgetP1) {
      return { p1, p2: ordering.slice(i) };
    }
    p1.push(ordering[i]);
  }
  return { p1, p2: [] };
}

function utilityScore(
  p1: ClassifiedQuestion[],
  p2: ClassifiedQuestion[],
  heights: Record<number, number>,
  budgetP1: number,
  budgetP2: number,
  rowGap: number
): number {
  const layoutP1 = simulateLayout(p1, heights, rowGap);
  const layoutP2 = simulateLayout(p2, heights, rowGap);

  const usedP1 = Math.min(layoutP1.totalHeight, budgetP1);
  const usedP2 = Math.min(layoutP2.totalHeight, budgetP2);
  const utilP1 = budgetP1 > 0 ? usedP1 / budgetP1 : 0;
  const utilP2 = budgetP2 > 0 ? usedP2 / budgetP2 : 0;

  // Reward total fill across both pages, and prefer balanced pages so we
  // don't end up with page 1 maxed and page 2 half-empty.
  let score = (utilP1 + utilP2) * 50;
  score -= Math.abs(utilP1 - utilP2) * 60;

  // Penalize overflow.
  if (layoutP1.totalHeight > budgetP1) score -= (layoutP1.totalHeight - budgetP1) * 0.5;
  if (layoutP2.totalHeight > budgetP2) score -= (layoutP2.totalHeight - budgetP2) * 0.5;

  // Penalize zero-card pages (always want both pages populated).
  if (p1.length === 0) score -= 80;
  if (p2.length === 0) score -= 80;

  return score;
}

function generateOrderings(others: ClassifiedQuestion[]): ClassifiedQuestion[][] {
  const original = [...others];
  const byHeightDesc = [...others].sort((a, b) => (b.Q_No || 0) - (a.Q_No || 0));
  const bySpanDesc = [...others].sort((a, b) => b.span - a.span);
  // "Compact" coalescence: prefer same-span cards adjacent so rows fill.
  const compact = [
    ...others.filter((c) => c.span === 6),
    ...others.filter((c) => c.span === 3),
    ...others.filter((c) => c.span === 2),
  ];
  return [original, byHeightDesc, bySpanDesc, compact];
}

const MIN_QUESTIONS = 10;

function cardsLikelyFit(
  cards: ClassifiedQuestion[],
  hots: ClassifiedQuestion | undefined,
  input: PackInput
): boolean {
  const others = cards.filter((c) => c !== hots);
  const compact = [
    ...others.filter((c) => c.span === 6),
    ...others.filter((c) => c.span === 3),
    ...others.filter((c) => c.span === 2),
  ];
  const budgetP1 = input.pageContentHeightPt - input.solvedHeight - input.rowGapPt;
  const hotsHeight = hots ? (input.heights[hots.Q_No] || 80) : 0;
  const page2Offset = input.page2TopOffsetPt || 0;
  // Smaller buffer — 18pt was over-correcting for KaTeX font drift. Real
  // drift on tested content is ~6pt; post-render measurement catches edge cases.
  const SAFETY_BUFFER = 6;
  const budgetP2 =
    input.pageContentHeightPt
    - page2Offset
    - SAFETY_BUFFER
    - (hots ? hotsHeight + input.rowGapPt : 0);
  const { p1, p2 } = splitOrdering(compact, input.heights, budgetP1, input.rowGapPt);
  const layoutP2 = simulateLayout(p2, input.heights, input.rowGapPt);
  // Allow up to 24pt of soft overflow on page 2 before declaring "won't fit".
  // The render-time overflow:hidden clip plus post-render measurement absorb this.
  const SOFT_OVERFLOW_TOLERANCE = 24;
  return (
    p1.length + p2.length === others.length &&
    layoutP2.totalHeight <= budgetP2 + SOFT_OVERFLOW_TOLERANCE
  );
}

/**
 * Smart 2D bin-pack with reorder. Pins:
 *  - Solved example is handled OUTSIDE this packer (always page-1 top).
 *  - HOTS card (if present) goes last on page 2.
 *  - All other cards may be freely reordered to maximize page-1 fill.
 *  - If 15 cards don't fit in 2 pages, drop the tallest non-HOTS cards
 *    until they fit, down to a floor of 10 total cards.
 */
export function packIntoPages(input: PackInput): PackedPage[] {
  const hots = input.cards.find(
    (c) => (c.Question_Type || "").toUpperCase() === "HOTS"
  );
  let working: ClassifiedQuestion[] = input.cards.slice();
  let drops: ClassifiedQuestion[] = [];

  // Pre-flight: drop tallest non-HOTS cards until total estimated layout
  // would plausibly fit. Keep ≥ MIN_QUESTIONS.
  while (working.length > MIN_QUESTIONS && !cardsLikelyFit(working, hots, input)) {
    // Drop the tallest non-HOTS card.
    const dropCandidate = [...working]
      .filter((c) => c !== hots)
      .sort((a, b) => (input.heights[b.Q_No] || 0) - (input.heights[a.Q_No] || 0))[0];
    if (!dropCandidate) break;
    drops.push(dropCandidate);
    working = working.filter((c) => c !== dropCandidate);
  }
  if (drops.length > 0) {
    console.warn(
      `[packer] Dropped ${drops.length} questions to fit 2 pages: ${drops.map((d) => d.Q_No).join(", ")}`
    );
  }

  const others = working.filter((c) => c !== hots);

  const budgetP1 = input.pageContentHeightPt - input.solvedHeight - input.rowGapPt;
  const hotsHeight = hots ? (input.heights[hots.Q_No] || 80) : 0;
  const page2Offset = input.page2TopOffsetPt || 0;
  // Smaller buffer — 18pt was over-correcting. Post-render measurement
  // catches genuine overflows.
  const SAFETY_BUFFER = 6;
  const budgetP2 =
    input.pageContentHeightPt
    - page2Offset
    - SAFETY_BUFFER
    - (hots ? hotsHeight + input.rowGapPt : 0);

  const orderings = generateOrderings(others);

  let best: {
    score: number;
    p1: ClassifiedQuestion[];
    p2: ClassifiedQuestion[];
  } | null = null;

  for (const ordering of orderings) {
    // Try the natural split for this ordering with heights.
    const { p1, p2 } = splitOrdering(ordering, input.heights, budgetP1, input.rowGapPt);
    const layoutP2 = simulateLayout(p2, input.heights, input.rowGapPt);
    if (layoutP2.totalHeight > budgetP2) {
      // Page 2 overflows in this ordering — skip
      continue;
    }
    const score = utilityScore(
      p1,
      p2,
      input.heights,
      budgetP1,
      budgetP2,
      input.rowGapPt
    );
    if (!best || score > best.score) best = { score, p1, p2 };
  }

  // Fallback: if every ordering overflowed page 2 (lots of huge cards),
  // pick the original ordering anyway and let it overflow visually.
  if (!best) {
    const { p1, p2 } = splitOrdering(
      orderings[0],
      input.heights,
      budgetP1,
      input.rowGapPt
    );
    best = { score: 0, p1, p2 };
  }

  // Backfill: pull small cards from page-2 head into page-1 if they fit.
  let { p1: p1Pre, p2: p2Pre } = backfillPage1(
    best.p1,
    best.p2,
    input.heights,
    budgetP1,
    input.rowGapPt
  );

  const p1Final = promoteOrphans(p1Pre);
  const p2Final = promoteOrphans(hots ? [...p2Pre, hots] : p2Pre);

  // Sequential numbering across pages.
  let n = 1;
  const number = (cards: ClassifiedQuestion[]) =>
    cards.map((c) => ({ ...c, displayNo: n++ }));

  return [{ cards: number(p1Final) }, { cards: number(p2Final) }];
}

/**
 * After the linear split, walk page 2's cards in height-ascending order and
 * move any that still fit on page 1 over to page 1. This eliminates the
 * "huge blank below the last page-1 card" problem when the next-in-order
 * card happens to be tall.
 */
function backfillPage1(
  p1: ClassifiedQuestion[],
  p2: ClassifiedQuestion[],
  heights: Record<number, number>,
  budgetP1: number,
  rowGap: number
): { p1: ClassifiedQuestion[]; p2: ClassifiedQuestion[] } {
  const out1 = [...p1];
  const out2 = [...p2];
  // Try candidates sorted by height ascending (smallest first → tightest fit).
  const candidates = [...out2]
    .map((c, idx) => ({ c, idx, h: heights[c.Q_No] || 60 }))
    .sort((a, b) => a.h - b.h);

  for (const cand of candidates) {
    const trial = [...out1, cand.c];
    const sim = simulateLayout(trial, heights, rowGap);
    if (sim.totalHeight <= budgetP1) {
      out1.push(cand.c);
      const removeAt = out2.indexOf(cand.c);
      if (removeAt >= 0) out2.splice(removeAt, 1);
    }
  }
  return { p1: out1, p2: out2 };
}

/**
 * If a card sits alone in a row (no neighbor with matching span fills the row),
 * promote it to full width so we don't show a dangling half-empty row.
 */
function promoteOrphans(cards: ClassifiedQuestion[]): ClassifiedQuestion[] {
  const rows: ClassifiedQuestion[][] = [];
  let current: ClassifiedQuestion[] = [];
  let currentSpan = 0;
  for (const c of cards) {
    if (currentSpan + c.span > COLS) {
      rows.push(current);
      current = [c];
      currentSpan = c.span;
    } else {
      current.push(c);
      currentSpan += c.span;
    }
  }
  if (current.length) rows.push(current);

  const out: ClassifiedQuestion[] = [];
  for (const row of rows) {
    const sum = row.reduce((s, c) => s + c.span, 0);
    if (sum < COLS && row.length === 1) {
      // Orphan: promote to full width.
      out.push({ ...row[0], span: 6 });
    } else if (sum < COLS && row.length > 1) {
      // Partial row with mismatched cards (e.g., 3+2=5). Leave as-is but
      // the trailing empty col is unavoidable without re-ordering.
      out.push(...row);
    } else {
      out.push(...row);
    }
  }
  return out;
}

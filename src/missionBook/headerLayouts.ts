/**
 * Per-grade header overlay positions for the Mission Book template PNGs.
 * Each Grade-N.png has a slightly different white-slot position for the
 * title pill and code badge; these constants line our overlays up so the
 * editable text sits cleanly INSIDE the baked white slot (no double-edge).
 *
 * Coordinates are in PDF points (1pt = 1.333px at standard CSS DPI).
 */

export interface HeaderLayout {
  /** Centered title pill (Lesson title text). */
  titlePill: { top: number; left: number; width: number; height: number };
  /** Right L{n} badge. */
  codePill: { top: number; right: number; width: number; height: number };
  /** Top-left monster image circle. */
  monsterCircle: { top: number; left: number; size: number };
  /** Below-monster colored name pill ("Crossangle", "Muncher"). */
  monsterNamePill: { top: number; left: number; minWidth: number; maxWidth: number; height: number };
}

const DEFAULT: HeaderLayout = {
  titlePill: { top: 24, left: 122, width: 340, height: 38 },
  codePill: { top: 24, right: 42, width: 36, height: 28 },
  // Monster: pushed further right so it lands at the visual center of the
  // template's blue decorative circle (which is offset right of the page edge).
  monsterCircle: { top: 6, left: 30, size: 70 },
  // Name pill: taller default (18pt) so the text isn't clipped by the
  // pill's overflow:hidden — descenders fit comfortably.
  monsterNamePill: { top: 78, left: 27, minWidth: 64, maxWidth: 90, height: 18 },
};

const PER_GRADE: Partial<Record<number, Partial<HeaderLayout>>> = {
  // Grade-3 (peach/pink): title slot is slightly higher, code badge a touch lower
  3: {
    titlePill: { top: 22, left: 120, width: 344, height: 40 },
  },
  // Grade-7 (blue): title slot is a bit longer
  7: {
    titlePill: { top: 24, left: 120, width: 346, height: 38 },
    codePill: { top: 22, right: 44, width: 38, height: 30 },
  },
};

export function getHeaderLayout(gradeLevel: string | number): HeaderLayout {
  const n = parseInt(String(gradeLevel), 10);
  const override = PER_GRADE[n];
  if (!override) return DEFAULT;
  return {
    titlePill: { ...DEFAULT.titlePill, ...override.titlePill },
    codePill: { ...DEFAULT.codePill, ...override.codePill },
    monsterCircle: { ...DEFAULT.monsterCircle, ...override.monsterCircle },
    monsterNamePill: { ...DEFAULT.monsterNamePill, ...override.monsterNamePill },
  };
}

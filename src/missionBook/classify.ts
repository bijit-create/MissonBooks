import type { MissionBookQuestion } from "./MissionBookDocument";
import { normalizeMath } from "./normalizeMath";

export type Template =
  | "mcq-text-narrow"
  | "mcq-text-half"
  | "mcq-text-wide"
  | "mcq-with-figure"
  | "mcq-image-options"
  | "mcq-true-false"
  | "arrange-sequence"
  | "match-table"
  | "match-list-pair"
  | "fib-single"
  | "fib-multi-indent"
  | "fib-multi-pill"
  | "image-grid-identify"
  | "image-with-blanks"
  | "figure-question"
  | "figure-question-multipart"
  | "vertical-clue-list"
  | "compare-groups"
  | "word-search"
  | "hots-text";

export type GridSpan = 2 | 3 | 6;

export interface Classification {
  template: Template;
  span: GridSpan;
  fixes: string[];
}

export interface ClassifiedQuestion extends MissionBookQuestion {
  template: Template;
  span: GridSpan;
  fixes: string[];
  displayNo?: number;
}

const VALID_TEMPLATES: ReadonlySet<Template> = new Set<Template>([
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
]);

const DEFAULT_SPAN: Record<Template, GridSpan> = {
  "mcq-text-narrow": 2,
  "mcq-text-half": 3,
  "mcq-text-wide": 6,
  "mcq-with-figure": 3,
  "mcq-image-options": 6,
  "mcq-true-false": 3,
  "arrange-sequence": 6,
  "match-table": 6,
  "match-list-pair": 6,
  "fib-single": 3,
  "fib-multi-indent": 6,
  "fib-multi-pill": 3,
  "image-grid-identify": 6,
  "image-with-blanks": 3,
  "figure-question": 3,
  "figure-question-multipart": 6,
  "vertical-clue-list": 3,
  "compare-groups": 6,
  "word-search": 6,
  "hots-text": 3,
};

function opts(q: MissionBookQuestion): string[] {
  return [q.Option_A, q.Option_B, q.Option_C, q.Option_D].filter(
    (o): o is string => typeof o === "string" && o.length > 0
  );
}

function commaCount(s: string): number {
  return (s.match(/[,;]/g) || []).length;
}

function countSubparts(s: string): number {
  return (s.match(/\b[a-eA-E][.)]/g) || []).length;
}

function hasRomanList(s: string): boolean {
  return /\b\((?:I|II|III|IV|V)\)/i.test(s) || /\b(?:I|II|III|IV|V)\.\s/.test(s);
}

function looksLikeMatchPair(s: string): boolean {
  return /^\s*[A-Za-z0-9]+\s*[-–:]\s*[A-Za-z0-9 ,]+$/.test(s);
}

const TF_PATTERN = /\bTRUE\b.*\bFALSE\b|\bYes\b.*\bNo\b|state\s+true\s+or\s+false/i;
const GROUP_PATTERN = /\bGroup\s+A\b[\s\S]*\bGroup\s+B\b/i;
const WORD_GRID_PATTERN = /(find|hidden).*(grid|word\s+search)/i;
const IMAGE_GRID_PATTERN =
  /(name|identify)\s+(the\s+)?(food|vegetab|animal|object|item|fruit|shape|figure|picture)/i;
const CLUE_LIST_PATTERN = /\b(I am|who am I|name the animal)\b/i;
const COLUMN_LIST_PATTERN =
  /\bcolumn\s*(I|II|A|B)\b[\s\S]+\bcolumn\s*(II|I|B|A)\b/i;

function fitMcqTextByWidth(q: MissionBookQuestion): {
  template: Template;
  span: GridSpan;
} {
  const stem = q.Question_Text || "";
  const o = opts(q);
  const maxOpt = o.reduce((m, s) => Math.max(m, s.length), 0);
  const stemLen = stem.length;

  if (stemLen <= 70 && maxOpt <= 22 && o.length >= 2) {
    return { template: "mcq-text-narrow", span: 2 };
  }
  if (stemLen <= 160 && maxOpt <= 60) {
    return { template: "mcq-text-half", span: 3 };
  }
  return { template: "mcq-text-wide", span: 6 };
}

export function classifyQuestion(q: MissionBookQuestion): Classification {
  const fixes: string[] = [];
  const type = (q.Question_Type || "MCQ").toUpperCase();
  const stem = q.Question_Text || "";
  const o = opts(q);
  const hasImage = q.Has_Image === "Yes" && !!q.ImageData;

  // First: trust the LLM's Template field if it picked a valid name.
  // This avoids the recurring "detect template from messy stem text" bugs.
  const llmTemplate = q.Template;
  if (llmTemplate && VALID_TEMPLATES.has(llmTemplate as Template)) {
    const t = llmTemplate as Template;
    return { template: t, span: DEFAULT_SPAN[t], fixes };
  }
  if (llmTemplate && !VALID_TEMPLATES.has(llmTemplate as Template)) {
    fixes.push(`Ignored invalid Template "${llmTemplate}"; using heuristic`);
  }

  if (type === "HOTS") {
    const span: GridSpan = stem.length > 160 ? 6 : 3;
    return { template: "hots-text", span, fixes };
  }

  if (WORD_GRID_PATTERN.test(stem)) {
    return { template: "word-search", span: 6, fixes };
  }
  if (GROUP_PATTERN.test(stem)) {
    return { template: "compare-groups", span: 6, fixes };
  }

  // Column-pattern detection runs BEFORE ARR/Roman-list check, because
  // "Column I" and "Column II" in a stem also looks Roman-numeral-like but
  // it's actually a MATCH question.
  if (type === "MATCH" || COLUMN_LIST_PATTERN.test(stem)) {
    if (type !== "MATCH") fixes.push("Routed to MATCH from column pattern in stem");
    return { template: "match-list-pair", span: 6, fixes };
  }

  if (type === "ARR" || hasRomanList(stem)) {
    // Arrange-sequence always full-width — the multi-line steps deserve room.
    return { template: "arrange-sequence", span: 6, fixes };
  }

  if (type === "FIB") {
    const subParts = countSubparts(stem);
    if (subParts === 0) {
      if (!/_{3,}/.test(stem)) fixes.push("Added missing blank to FIB stem");
      const span: GridSpan = stem.length > 140 ? 3 : 2;
      const template: Template = stem.length > 140 ? "fib-multi-indent" : "fib-single";
      return { template, span, fixes };
    }
    if (subParts <= 4 && stem.length <= 180) {
      return { template: "fib-multi-pill", span: 3, fixes };
    }
    const span: GridSpan = subParts > 4 || stem.length > 280 ? 6 : 3;
    return { template: "fib-multi-indent", span, fixes };
  }

  if (CLUE_LIST_PATTERN.test(stem) && /\b[A-C]\b/.test(stem)) {
    return { template: "vertical-clue-list", span: 3, fixes };
  }

  if (type === "MCQ") {
    if (TF_PATTERN.test(stem)) {
      const span: GridSpan = hasImage ? 3 : stem.length > 160 ? 6 : 3;
      return { template: "mcq-true-false", span, fixes };
    }

    const imageDesc = (q as any).Image_Description as string | undefined;
    const looksLikeImageOptions =
      imageDesc && /labeled|labelled|figure[s]?\s+a\)|three figures|four figures/i.test(imageDesc);
    if (hasImage && looksLikeImageOptions && o.length >= 2) {
      return { template: "mcq-image-options", span: 6, fixes };
    }

    if (IMAGE_GRID_PATTERN.test(stem) && hasImage) {
      return { template: "image-grid-identify", span: 6, fixes };
    }

    if (hasImage) {
      if (countSubparts(stem) >= 2) {
        return { template: "image-with-blanks", span: 3, fixes };
      }
      if (o.length === 0) {
        const span: GridSpan = stem.length > 140 ? 6 : 3;
        return { template: "figure-question", span, fixes };
      }
      const span: GridSpan = stem.length > 140 || o.some((s) => s.length > 30) ? 6 : 3;
      return { template: "mcq-with-figure", span, fixes };
    }

    return { ...fitMcqTextByWidth(q), fixes };
  }

  return { ...fitMcqTextByWidth(q), fixes };
}

export function classifyQuestions(questions: MissionBookQuestion[]): ClassifiedQuestion[] {
  return questions.map((q) => {
    const c = classifyQuestion(q);
    let stem = q.Question_Text || "";
    if (c.template === "fib-single" && !/_{3,}/.test(stem)) {
      stem = stem.replace(/[.?!]+\s*$/, "") + " ___________.";
    }
    return {
      ...q,
      Question_Text: normalizeMath(stem),
      Option_A: q.Option_A !== undefined ? normalizeMath(q.Option_A) : q.Option_A,
      Option_B: q.Option_B !== undefined ? normalizeMath(q.Option_B) : q.Option_B,
      Option_C: q.Option_C !== undefined ? normalizeMath(q.Option_C) : q.Option_C,
      Option_D: q.Option_D !== undefined ? normalizeMath(q.Option_D) : q.Option_D,
      template: c.template,
      span: c.span,
      fixes: c.fixes,
    };
  });
}

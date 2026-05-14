import type { MissionBookQuestion } from "./MissionBookDocument";
import type { LayoutHint } from "./layout";
import { resolveHint } from "./layout";

export type RenderAs = "mcq" | "match-table" | "fib" | "image-block";

export interface ValidatedQuestion extends MissionBookQuestion {
  Layout_Hint: LayoutHint;
  renderAs: RenderAs;
  _autoFixes: string[];
}

const MATCH_PAIR_PATTERN = /^\s*[A-Za-z0-9]+\s*[-–:]\s*[A-Za-z0-9]+\s*$/;

function optionsList(q: MissionBookQuestion): string[] {
  return [q.Option_A, q.Option_B, q.Option_C, q.Option_D].filter(
    (o): o is string => typeof o === "string" && o.length > 0
  );
}

function looksLikeSequenceOption(opt: string): boolean {
  const commas = (opt.match(/,/g) || []).length;
  return commas >= 2;
}

function normalizeMatchQuestion(
  q: MissionBookQuestion
): { renderAs: RenderAs; layoutHint: LayoutHint; fix?: string } | null {
  const type = (q.Question_Type || "").toUpperCase();
  if (type !== "MATCH") return null;
  const opts = optionsList(q);
  if (opts.length === 0) return { renderAs: "match-table", layoutHint: "table" };

  const sequenceOptionCount = opts.filter(looksLikeSequenceOption).length;
  if (sequenceOptionCount >= Math.ceil(opts.length / 2)) {
    return {
      renderAs: "mcq",
      layoutHint: "wide",
      fix: "Rendered as MCQ (LLM emitted sequence-style options for MATCH)",
    };
  }

  const allLookLikePairs = opts.every((o) => MATCH_PAIR_PATTERN.test(o));
  if (!allLookLikePairs) {
    return {
      renderAs: "mcq",
      layoutHint: "wide",
      fix: "Rendered as MCQ (options not in 'X-Y' pair format)",
    };
  }

  return { renderAs: "match-table", layoutHint: "table" };
}

function validateLayoutHint(
  q: MissionBookQuestion,
  claimed: LayoutHint
): { hint: LayoutHint; fix?: string } {
  const stem = q.Question_Text || "";
  const opts = optionsList(q);
  const stemLen = stem.length;
  const maxOpt = opts.reduce((m, o) => Math.max(m, o.length), 0);
  const hasImage = q.Has_Image === "Yes" && !!q.ImageData;

  if (claimed === "narrow" && (stemLen > 70 || maxOpt > 22 || hasImage)) {
    const next: LayoutHint = stemLen > 140 || hasImage ? "wide" : "normal";
    return {
      hint: next,
      fix: `Layout corrected from narrow → ${next} (stem ${stemLen} chars${
        hasImage ? ", has image" : ""
      })`,
    };
  }
  if (claimed === "normal" && (stemLen > 160 || maxOpt > 60 || hasImage)) {
    return {
      hint: "wide",
      fix: `Layout corrected from normal → wide (content too dense)`,
    };
  }
  return { hint: claimed };
}

function repairFib(q: MissionBookQuestion): { stem: string; fix?: string } {
  if ((q.Question_Type || "").toUpperCase() !== "FIB") {
    return { stem: q.Question_Text || "" };
  }
  const stem = q.Question_Text || "";
  if (/_{3,}/.test(stem)) return { stem };
  const cleaned = stem.replace(/[.?!]+\s*$/, "");
  return {
    stem: `${cleaned} ___________.`,
    fix: "Added missing blank to FIB stem",
  };
}

export function validateQuestions(
  questions: MissionBookQuestion[]
): ValidatedQuestion[] {
  return questions.map((raw) => {
    const fixes: string[] = [];
    const type = (raw.Question_Type || "MCQ").toUpperCase();

    let layoutHint: LayoutHint = resolveHint(raw);
    let renderAs: RenderAs = "mcq";

    const matchInfo = normalizeMatchQuestion(raw);
    if (matchInfo) {
      renderAs = matchInfo.renderAs;
      layoutHint = matchInfo.layoutHint;
      if (matchInfo.fix) fixes.push(matchInfo.fix);
    } else if (type === "FIB") {
      renderAs = "fib";
    } else if (layoutHint === "image-block") {
      renderAs = "image-block";
    }

    if (renderAs === "mcq" || renderAs === "fib" || renderAs === "image-block") {
      const result = validateLayoutHint(raw, layoutHint);
      if (result.fix) fixes.push(result.fix);
      layoutHint = result.hint;
    }

    let stem = raw.Question_Text || "";
    if (renderAs === "fib") {
      const fib = repairFib(raw);
      stem = fib.stem;
      if (fib.fix) fixes.push(fib.fix);
    }

    return {
      ...raw,
      Question_Text: stem,
      Layout_Hint: layoutHint,
      renderAs,
      _autoFixes: fixes,
    };
  });
}

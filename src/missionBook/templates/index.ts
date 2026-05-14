import type { Template } from "../classify";
import type { TemplateComponent } from "./types";
import {
  McqTextNarrow,
  McqTextHalf,
  McqTextWide,
  McqWithFigure,
  McqImageOptions,
  McqTrueFalse,
} from "./mcq";
import { MatchTable, MatchListPair } from "./match";
import { FibSingle, FibMultiIndent, FibMultiPill } from "./fib";
import {
  ImageGridIdentify,
  ImageWithBlanks,
  FigureQuestion,
  FigureQuestionMultipart,
} from "./image";
import {
  VerticalClueList,
  CompareGroups,
  WordSearch,
  HotsText,
  ArrangeSequence,
} from "./special";

export const TEMPLATE_REGISTRY: Record<Template, TemplateComponent> = {
  "mcq-text-narrow": McqTextNarrow,
  "mcq-text-half": McqTextHalf,
  "mcq-text-wide": McqTextWide,
  "mcq-with-figure": McqWithFigure,
  "mcq-image-options": McqImageOptions,
  "mcq-true-false": McqTrueFalse,
  "arrange-sequence": ArrangeSequence,
  "match-table": MatchTable,
  "match-list-pair": MatchListPair,
  "fib-single": FibSingle,
  "fib-multi-indent": FibMultiIndent,
  "fib-multi-pill": FibMultiPill,
  "image-grid-identify": ImageGridIdentify,
  "image-with-blanks": ImageWithBlanks,
  "figure-question": FigureQuestion,
  "figure-question-multipart": FigureQuestionMultipart,
  "vertical-clue-list": VerticalClueList,
  "compare-groups": CompareGroups,
  "word-search": WordSearch,
  "hots-text": HotsText,
};

export type { TemplateProps, TemplateComponent } from "./types";

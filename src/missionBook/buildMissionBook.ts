import { pdf } from "@react-pdf/renderer";
import MissionBookDocument from "./MissionBookDocument";
import type { MissionBookQuestion, SolvedExample } from "./MissionBookDocument";
import { packIntoPages, estimateSolvedExampleHeight } from "./layout";
import type { PackResult } from "./layout";

export interface BuildMissionBookInput {
  gradeLevel: string;
  subject: string;
  lessonTitle: string;
  lessonCode: string;
  loCode?: string;
  monsterOverride?: { name?: string; asset?: string | null };
  solvedExample: SolvedExample | null;
  questions: MissionBookQuestion[];
}

export interface BuildMissionBookResult {
  blob: Blob;
  pack: PackResult;
}

export async function buildMissionBook(
  input: BuildMissionBookInput
): Promise<BuildMissionBookResult> {
  const pack = packIntoPages(input.questions, {
    pages: 2,
    solvedExampleHeight: estimateSolvedExampleHeight(input.solvedExample),
  });

  let blob: Blob;
  try {
    const instance = pdf(
      MissionBookDocument({
        gradeLevel: input.gradeLevel,
        subject: input.subject,
        lessonTitle: input.lessonTitle,
        lessonCode: input.lessonCode,
        loCode: input.loCode,
        monsterOverride: input.monsterOverride,
        solvedExample: input.solvedExample,
        packedPages: pack.pages,
      }) as any
    );
    blob = await instance.toBlob();
  } catch (err) {
    console.error("[buildMissionBook] render failed:", err);
    console.error("[buildMissionBook] pack:", pack);
    console.error("[buildMissionBook] questions sample:", input.questions.slice(0, 3));
    throw err;
  }
  return { blob, pack };
}

export type { MissionBookQuestion, SolvedExample } from "./MissionBookDocument";

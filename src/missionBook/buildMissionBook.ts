import { pdf } from "@react-pdf/renderer";
import MissionBookDocument from "./MissionBookDocument";
import type { MissionBookInput } from "./MissionBookDocument";

export async function buildMissionBook(input: MissionBookInput): Promise<Blob> {
  const instance = pdf(MissionBookDocument(input) as any);
  const blob = await instance.toBlob();
  return blob;
}

export type { MissionBookInput, MissionBookQuestion, SolvedExample } from "./MissionBookDocument";

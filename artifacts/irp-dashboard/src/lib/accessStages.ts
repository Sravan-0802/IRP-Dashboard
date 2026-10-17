import {
  L1_ACCESS_STAGES,
  L1_ACCESS_STAGE_LABELS,
  type L1AccessStage,
} from "@/lib/l1StageAccessMatrix";

/** GenAI Track grant stages. Mirrors API `GENAI_ACCESS_STAGES`; separate from the MERN L1 pipeline. */
export const GENAI_ACCESS_STAGES = ["genai_assessment", "genai_ai_interview"] as const;
export type GenaiAccessStage = (typeof GENAI_ACCESS_STAGES)[number];

export const ACCESS_STAGES = [...L1_ACCESS_STAGES, ...GENAI_ACCESS_STAGES] as const;
export type AccessStage = L1AccessStage | GenaiAccessStage;

export const ACCESS_STAGE_LABELS: Record<AccessStage, string> = {
  ...L1_ACCESS_STAGE_LABELS,
  genai_assessment: "GenAI Assessment",
  genai_ai_interview: "GenAI AI Interview",
};

export function isGenaiAccessStage(stage: string): stage is GenaiAccessStage {
  return (GENAI_ACCESS_STAGES as readonly string[]).includes(stage);
}

export function accessStageLabel(stage: string): string {
  return ACCESS_STAGE_LABELS[stage as AccessStage] ?? stage;
}

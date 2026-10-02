/**
 * Pipeline stage definitions and streaming event protocol.
 * Client-safe — imported by progress UI and server pipeline.
 */

export const CATALOG_STAGES = [
  { id: "analyze", label: "Analyzing course requirements", weight: 5 },
  { id: "objectives", label: "Defining learning objectives", weight: 4 },
  { id: "curriculum", label: "Designing the curriculum", weight: 8 },
  { id: "modules", label: "Structuring modules", weight: 11 },
  { id: "lessons", label: "Writing lesson content", weight: 40 },
  { id: "activities", label: "Creating scenarios and assignments", weight: 11 },
  { id: "quizzes", label: "Building quizzes", weight: 13 },
  { id: "assessment", label: "Composing the final assessment", weight: 4 },
  { id: "quality", label: "Running the quality check", weight: 4 },
] as const;

export type CatalogStageId = (typeof CATALOG_STAGES)[number]["id"];

export type CatalogSkeletonModule = {
  title: string;
  lessons: { title: string; type: string }[];
};

export type CatalogPipelineEvent =
  | {
      type: "stage";
      stage: CatalogStageId;
      status: "active" | "done" | "failed";
      detail?: string;
      progress?: number;
    }
  | { type: "skeleton"; programName: string; modules: CatalogSkeletonModule[] }
  /** Draft row exists (bodies saved) — quizzes may still be running. */
  | { type: "checkpoint"; programId: string; programName: string }
  | { type: "done"; programId: string; programName: string; elapsedMs: number }
  | { type: "error"; message: string; code?: string };

export type CatalogEmit = (event: CatalogPipelineEvent) => void;

export function overallStageProgress(
  stages: Record<CatalogStageId, { status: string; progress?: number }>,
): number {
  const totalWeight = CATALOG_STAGES.reduce((sum, stage) => sum + stage.weight, 0);
  let done = 0;
  for (const stage of CATALOG_STAGES) {
    const state = stages[stage.id];
    if (state.status === "done" || state.status === "failed") done += stage.weight;
    else if (state.status === "active") done += stage.weight * (state.progress ?? 0.12);
  }
  return (done / totalWeight) * 100;
}

export function initialStageMap(): Record<
  CatalogStageId,
  { status: "pending" | "active" | "done" | "failed"; detail?: string; progress?: number }
> {
  return Object.fromEntries(
    CATALOG_STAGES.map((stage) => [stage.id, { status: "pending" }]),
  ) as Record<
    CatalogStageId,
    { status: "pending" | "active" | "done" | "failed"; detail?: string; progress?: number }
  >;
}

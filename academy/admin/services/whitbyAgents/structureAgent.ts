import "server-only";

import type { PersistedProgramDraft } from "../catalogPersistence";
import { emptyPersistedModule, placeLessonsOp } from "./apply";
import { generateLessonDraft } from "./content";
import type { WhitbyAgentResult, WhitbyPlan } from "./types";

export async function runLessonAgent(
  draft: PersistedProgramDraft,
  plan: WhitbyPlan,
): Promise<WhitbyAgentResult> {
  const moduleIndex = plan.moduleIndex ?? Math.max(0, draft.modules.length - 1);
  const module = draft.modules[moduleIndex];
  if (!module) {
    return { ops: [], summary: "No module is available for a lesson yet.", agent: "lesson" };
  }

  const count = Math.min(plan.count, 6);
  const type = plan.lessonType && plan.lessonType !== "quiz" ? plan.lessonType : "reading";
  const existingTitles = draft.modules.flatMap((entry) => entry.lessons.map((lesson) => lesson.title));
  const lessons = [];
  const usedTitles: string[] = [...existingTitles];

  for (let index = 0; index < count; index += 1) {
    const lesson = await generateLessonDraft({
      programName: draft.name,
      moduleTitle: module.title,
      instruction: plan.notes,
      type,
      titleHint:
        count === 1
          ? type === "scenario"
            ? "Applied scenario"
            : type === "resource"
              ? "Resource lesson"
              : undefined
          : `Distinct topic ${module.lessons.length + index + 1} — not a repeat of prior lessons`,
      avoidTitles: usedTitles,
    });
    usedTitles.push(lesson.title);
    lessons.push(lesson);
  }

  const afterIndex = plan.lessonIndex;
  const where =
    afterIndex != null
      ? ` after ${moduleIndex + 1}.${afterIndex + 1}`
      : ` to “${module.title}”`;

  return {
    agent: "lesson",
    summary:
      lessons.length === 1
        ? `Added “${lessons[0]?.title ?? "a lesson"}”${where}.`
        : `Added ${lessons.length} ${type} lessons${where}.`,
    ops: [placeLessonsOp(moduleIndex, lessons, afterIndex)],
  };
}

export async function runStructureAgent(
  draft: PersistedProgramDraft,
  plan: WhitbyPlan,
): Promise<WhitbyAgentResult> {
  const count = Math.min(plan.count, 3);
  const modules = [];

  for (let index = 0; index < count; index += 1) {
    const title = count === 1 ? "New module" : `New module ${draft.modules.length + index + 1}`;
    const reading = await generateLessonDraft({
      programName: draft.name,
      moduleTitle: title,
      instruction: plan.notes,
      type: "reading",
    });
    modules.push(emptyPersistedModule(reading.title.replace(/:.+$/, "").trim() || title, [reading]));
  }

  return {
    agent: "structure",
    summary:
      modules.length === 1
        ? `Added module “${modules[0]?.title ?? "New module"}”.`
        : `Added ${modules.length} modules.`,
    ops: [{ kind: "append_modules", modules }],
  };
}

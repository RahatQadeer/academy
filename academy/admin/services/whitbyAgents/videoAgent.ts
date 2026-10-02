import "server-only";

import type { PersistedProgramDraft } from "../catalogPersistence";
import { generateLessonDraft } from "./content";
import { placeLessonsOp } from "./apply";
import type { WhitbyAgentResult, WhitbyPlan } from "./types";

export async function runVideoAgent(
  draft: PersistedProgramDraft,
  plan: WhitbyPlan,
): Promise<WhitbyAgentResult> {
  const moduleIndex = plan.moduleIndex ?? Math.max(0, draft.modules.length - 1);
  const module = draft.modules[moduleIndex];
  if (!module) {
    return { ops: [], summary: "No module is available for a video yet.", agent: "video" };
  }

  const count = Math.min(plan.count, 4);
  const lessons = [];
  for (let index = 0; index < count; index += 1) {
    lessons.push(
      await generateLessonDraft({
        programName: draft.name,
        moduleTitle: module.title,
        instruction: plan.notes,
        type: "video",
        titleHint: count === 1 ? "Video lesson" : `Video lesson ${index + 1}`,
        videoUrl: plan.videoUrl ?? undefined,
      }),
    );
  }

  return {
    agent: "video",
    summary:
      lessons.length === 1
        ? `Added a video lesson${plan.lessonIndex != null ? ` after ${moduleIndex + 1}.${plan.lessonIndex + 1}` : ` in “${module.title}”`}${plan.videoUrl ? " with your link" : ""}. Paste or confirm the video URL in the lesson.`
        : `Added ${lessons.length} video lessons in “${module.title}”.`,
    ops: [placeLessonsOp(moduleIndex, lessons, plan.lessonIndex)],
  };
}

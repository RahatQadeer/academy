import "server-only";

import type { WhitbyRefineContext } from "../../actions";
import type { PersistedProgramDraft } from "../catalogPersistence";
import { lessonLabel, moduleLabel, parseOutlineTargets, parseRenameTitle } from "./locator";
import type { WhitbyAgentResult, WhitbyPlan } from "./types";

type RemovedRef = { moduleIndex: number; lessonIndex: number | null };

/**
 * Concise, professional summary for a removal. Full titles for one or two
 * lessons; for three or more it collapses to a count plus a contiguous range
 * (e.g. "Removed 7 lessons (1.6–1.12)…") or a compact list of numbers, so a
 * bulk delete never becomes a repetitive wall of quoted titles.
 */
function describeRemovedLessons(draft: PersistedProgramDraft, removed: RemovedRef[]): string {
  const asc = [...removed]
    .filter((item) => item.lessonIndex != null)
    .sort((a, b) =>
      a.moduleIndex !== b.moduleIndex
        ? a.moduleIndex - b.moduleIndex
        : (a.lessonIndex as number) - (b.lessonIndex as number),
    );

  if (asc.length === 0) return "Removed the selected lessons.";

  if (asc.length <= 2) {
    const labels = asc.map((item) => lessonLabel(draft, item.moduleIndex, item.lessonIndex as number));
    return `Removed ${labels.join(" and ")}.`;
  }

  const numbers = asc.map((item) => `${item.moduleIndex + 1}.${(item.lessonIndex as number) + 1}`);
  const sameModule = asc.every((item) => item.moduleIndex === asc[0].moduleIndex);
  const contiguous =
    sameModule &&
    asc.every(
      (item, index) =>
        index === 0 || (item.lessonIndex as number) === (asc[index - 1].lessonIndex as number) + 1,
    );

  if (contiguous) {
    return `Removed ${asc.length} lessons (${numbers[0]}–${numbers[numbers.length - 1]}) from ${moduleLabel(draft, asc[0].moduleIndex)}.`;
  }
  return `Removed ${asc.length} lessons: ${numbers.join(", ")}.`;
}

function focusedLesson(
  draft: PersistedProgramDraft,
  plan: WhitbyPlan,
  context?: WhitbyRefineContext,
) {
  const moduleIndex = plan.moduleIndex ?? context?.moduleIndex ?? null;
  const lessonIndex = plan.lessonIndex ?? context?.lessonIndex ?? null;
  if (moduleIndex == null || lessonIndex == null) return null;
  if (!draft.modules[moduleIndex]?.lessons[lessonIndex]) return null;
  return { moduleIndex, lessonIndex };
}

export function runMutateAgent(
  draft: PersistedProgramDraft,
  plan: WhitbyPlan,
  context?: WhitbyRefineContext,
): WhitbyAgentResult {
  const targets = parseOutlineTargets(plan.notes, draft, context);
  const target = targets[0] ?? null;
  const thisLesson = /\b(this|the selected|current)\b/i.test(plan.notes);
  const focused = focusedLesson(draft, plan, context);

  if (plan.intents.includes("remove_lesson")) {
    const lessonTargets = targets.filter((item) => item.lessonIndex != null);
    const fallback =
      thisLesson || (context?.focus === "lesson" && focused) ? focused : null;
    const toRemove =
      lessonTargets.length > 0
        ? lessonTargets
        : fallback?.lessonIndex != null
          ? [fallback]
          : [];

    if (toRemove.length === 0) {
      return {
        agent: "structure",
        ops: [],
        summary: "Which lesson should I remove? Name the numbers, like 1.2 and 1.3.",
      };
    }

    const remainingLessons = draft.modules.reduce((sum, module) => sum + module.lessons.length, 0);
    if (remainingLessons - toRemove.length < 1) {
      return {
        agent: "structure",
        ops: [],
        summary: "I can’t remove every remaining lesson. Keep at least one, then try again.",
      };
    }

    const ordered = [...toRemove].sort((a, b) => {
      if (a.moduleIndex !== b.moduleIndex) return b.moduleIndex - a.moduleIndex;
      return (b.lessonIndex ?? 0) - (a.lessonIndex ?? 0);
    });

    const cascadeNotes = ordered
      .map((item) => {
        const lesson = draft.modules[item.moduleIndex]?.lessons[item.lessonIndex as number];
        if (!lesson) return null;
        const bits: string[] = [];
        if (lesson.quiz?.questions.length) bits.push(`${lesson.quiz.questions.length} quiz question${lesson.quiz.questions.length === 1 ? "" : "s"}`);
        if (lesson.assignment) bits.push("an assignment");
        if (lesson.videoUrl) bits.push("a video");
        if (bits.length === 0) return null;
        return `${lessonLabel(draft, item.moduleIndex, item.lessonIndex as number)} (also removes ${bits.join(" and ")})`;
      })
      .filter(Boolean);

    const base = describeRemovedLessons(draft, ordered);
    return {
      agent: "structure",
      ops: ordered.map((item) => ({
        kind: "remove_lesson" as const,
        moduleIndex: item.moduleIndex,
        lessonIndex: item.lessonIndex as number,
      })),
      summary:
        cascadeNotes.length > 0
          ? `${base} ${cascadeNotes.join("; ")}.`
          : base,
    };
  }

  if (plan.intents.includes("remove_assignment")) {
    const lessonTargets = targets.filter((item) => item.lessonIndex != null);
    const fallback =
      thisLesson || (context?.focus === "lesson" && focused) ? focused : null;
    const targetLesson =
      lessonTargets[0] ??
      (fallback?.lessonIndex != null ? fallback : null);

    if (!targetLesson || targetLesson.lessonIndex == null) {
      return {
        agent: "structure",
        ops: [],
        summary: "Which lesson’s assignment should I remove? Say “remove the assignment from 1.2”.",
      };
    }

    const existing = draft.modules[targetLesson.moduleIndex]?.lessons[targetLesson.lessonIndex];
    if (!existing) {
      return {
        agent: "structure",
        ops: [],
        summary: `I couldn’t find ${lessonLabel(draft, targetLesson.moduleIndex, targetLesson.lessonIndex)}.`,
      };
    }
    if (!existing.assignment) {
      return {
        agent: "structure",
        ops: [],
        summary: `${lessonLabel(draft, targetLesson.moduleIndex, targetLesson.lessonIndex)} has no assignment to remove.`,
      };
    }

    const nextType =
      existing.type === "assignment"
        ? existing.contentBody.trim()
          ? "reading"
          : existing.quiz
            ? "quiz"
            : existing.videoUrl
              ? "video"
              : "reading"
        : existing.type;

    return {
      agent: "structure",
      ops: [
        {
          kind: "replace_lesson",
          moduleIndex: targetLesson.moduleIndex,
          lessonIndex: targetLesson.lessonIndex,
          lesson: {
            ...existing,
            type: nextType,
            assignment: null,
          },
        },
      ],
      summary: `Removed the assignment from ${lessonLabel(draft, targetLesson.moduleIndex, targetLesson.lessonIndex)}. The lesson itself is unchanged.`,
    };
  }

  if (plan.intents.includes("remove_module")) {
    const moduleIndex = target?.moduleIndex ?? plan.moduleIndex;
    if (moduleIndex == null || !draft.modules[moduleIndex]) {
      return {
        agent: "structure",
        ops: [],
        summary: "Which module should I remove? Say “remove module 2” or name it.",
      };
    }
    if (draft.modules.length <= 1) {
      return {
        agent: "structure",
        ops: [],
        summary: "I can’t remove the last remaining module. Add another module first, then try again.",
      };
    }
    return {
      agent: "structure",
      ops: [{ kind: "remove_module", moduleIndex }],
      summary: `Removed ${moduleLabel(draft, moduleIndex)} and its lessons.`,
    };
  }

  if (plan.intents.includes("rename_item")) {
    const title = parseRenameTitle(plan.notes);
    if (!title) {
      return {
        agent: "structure",
        ops: [],
        summary: "What should I rename it to? For example: “rename 1.3 to Variables in practice”.",
      };
    }

    if (target?.lessonIndex != null || (context?.focus === "lesson" && focused && thisLesson)) {
      const lesson = target?.lessonIndex != null ? target : focused;
      if (!lesson || lesson.lessonIndex == null) {
        return {
          agent: "structure",
          ops: [],
          summary: "Which lesson should I rename? Include the number, like “rename 1.3 to …”.",
        };
      }
      return {
        agent: "structure",
        ops: [
          {
            kind: "rename_lesson",
            moduleIndex: lesson.moduleIndex,
            lessonIndex: lesson.lessonIndex,
            title,
          },
        ],
        summary: `Renamed ${lessonLabel(draft, lesson.moduleIndex, lesson.lessonIndex)} to “${title}”.`,
      };
    }

    const moduleIndex = target?.moduleIndex ?? plan.moduleIndex;
    if (moduleIndex == null || !draft.modules[moduleIndex]) {
      return {
        agent: "structure",
        ops: [],
        summary: "Which module should I rename? Say “rename module 2 to …”.",
      };
    }
    return {
      agent: "structure",
      ops: [{ kind: "rename_module", moduleIndex, title }],
      summary: `Renamed ${moduleLabel(draft, moduleIndex)} to “${title}”.`,
    };
  }

  return { agent: "structure", ops: [], summary: "I could not apply that outline change." };
}

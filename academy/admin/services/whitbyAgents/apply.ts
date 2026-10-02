import type { PersistedLesson, PersistedModule, PersistedProgramDraft } from "../catalogPersistence";
import type { OrchestratedRefine, WhitbyOp } from "./types";
import { parsePassingScorePercent } from "@/academy/lib/scorePercent";

export function cloneDraft(draft: PersistedProgramDraft): PersistedProgramDraft {
  return structuredClone(draft);
}

function hasTitle(lesson: PersistedLesson): boolean {
  return Boolean(lesson?.title?.trim());
}

function validQuestion(question: { questionText?: string }): boolean {
  return Boolean(question?.questionText?.trim());
}

function sortStructureOps(ops: WhitbyOp[]): WhitbyOp[] {
  const removes = ops.filter((op) => op.kind === "remove_lesson" || op.kind === "remove_module");
  const rest = ops.filter((op) => op.kind !== "remove_lesson" && op.kind !== "remove_module");
  const sortedRemoves = [...removes].sort((a, b) => {
    if (a.kind === "remove_module" && b.kind === "remove_module") {
      return b.moduleIndex - a.moduleIndex;
    }
    if (a.kind === "remove_lesson" && b.kind === "remove_lesson") {
      if (a.moduleIndex !== b.moduleIndex) return b.moduleIndex - a.moduleIndex;
      return b.lessonIndex - a.lessonIndex;
    }
    if (a.kind === "remove_module") return -1;
    if (b.kind === "remove_module") return 1;
    return 0;
  });
  return [...rest, ...sortedRemoves];
}

export function applyWhitbyOps(
  draft: PersistedProgramDraft,
  ops: WhitbyOp[],
  summary: string,
): OrchestratedRefine | null {
  if (ops.length === 0) return null;

  const next = cloneDraft(draft);
  // Track how many ops actually changed the draft. Every op below only
  // increments this after a real mutation, so a batch that targets stale
  // indices (or supplies blank content) reports honestly instead of leaving
  // the caller to show a success summary for a no-op.
  let applied = 0;

  for (const op of sortStructureOps(ops)) {
    if (op.kind === "set_overview") {
      const name = op.name?.trim();
      const description = op.description?.trim();
      const category = op.category?.trim();
      const type = op.type?.trim();
      if (name && name !== next.name) {
        next.name = name;
        applied += 1;
      }
      if (description && description !== next.description) {
        next.description = description;
        applied += 1;
      }
      if (category && category !== next.category) {
        next.category = category;
        applied += 1;
      }
      if (type && type !== next.type) {
        next.type = type;
        applied += 1;
      }
      continue;
    }

    if (op.kind === "append_modules") {
      const modules = op.modules.filter(
        (module) => module.title?.trim() && module.lessons.some(hasTitle),
      );
      if (modules.length === 0) continue;
      next.modules.push(...modules);
      applied += 1;
      continue;
    }

    if (op.kind === "append_lessons") {
      const module = next.modules[op.moduleIndex];
      if (!module) continue;
      const lessons = op.lessons.filter(hasTitle);
      if (lessons.length === 0) continue;
      module.lessons.push(...lessons);
      applied += 1;
      continue;
    }

    if (op.kind === "insert_lessons") {
      const module = next.modules[op.moduleIndex];
      if (!module) continue;
      const lessons = op.lessons.filter(hasTitle);
      if (lessons.length === 0) continue;
      const at = Math.min(module.lessons.length, Math.max(0, op.afterIndex + 1));
      module.lessons.splice(at, 0, ...lessons);
      applied += 1;
      continue;
    }

    if (op.kind === "replace_lesson") {
      const module = next.modules[op.moduleIndex];
      if (!module?.lessons[op.lessonIndex] || !hasTitle(op.lesson)) continue;
      module.lessons[op.lessonIndex] = op.lesson;
      applied += 1;
      continue;
    }

    if (op.kind === "append_quiz_questions") {
      const lesson = next.modules[op.moduleIndex]?.lessons[op.lessonIndex];
      if (!lesson) continue;
      const questions = op.questions.filter(validQuestion);
      if (questions.length === 0) continue;
      const existing = lesson.quiz?.questions ?? [];
      lesson.quiz = {
        passingScore: String(
          parsePassingScorePercent(op.passingScore || lesson.quiz?.passingScore || "80"),
        ),
        questions: [...existing, ...questions],
      };
      applied += 1;
      continue;
    }

    if (op.kind === "remove_lesson") {
      const module = next.modules[op.moduleIndex];
      if (!module?.lessons[op.lessonIndex]) continue;
      module.lessons.splice(op.lessonIndex, 1);
      applied += 1;
      continue;
    }

    if (op.kind === "remove_module") {
      if (!next.modules[op.moduleIndex]) continue;
      next.modules.splice(op.moduleIndex, 1);
      applied += 1;
      continue;
    }

    if (op.kind === "rename_lesson") {
      const lesson = next.modules[op.moduleIndex]?.lessons[op.lessonIndex];
      const title = op.title.trim();
      if (!lesson || !title || title === lesson.title) continue;
      lesson.title = title;
      applied += 1;
      continue;
    }

    if (op.kind === "rename_module") {
      const module = next.modules[op.moduleIndex];
      const title = op.title.trim();
      if (!module || !title || title === module.title) continue;
      module.title = title;
      applied += 1;
    }
  }

  // Nothing in the batch actually landed — report failure so the caller can
  // tell the instructor the truth instead of echoing an optimistic summary.
  if (applied === 0) return null;

  next.modules = next.modules.filter((module) => module.lessons.length > 0);

  if (next.modules.length === 0) {
    return null;
  }

  return { ...next, summary, mutated: true };
}

export function placeLessonsOp(
  moduleIndex: number,
  lessons: PersistedLesson[],
  afterIndex: number | null,
): WhitbyOp {
  if (afterIndex == null) {
    return { kind: "append_lessons", moduleIndex, lessons };
  }
  return { kind: "insert_lessons", moduleIndex, afterIndex, lessons };
}

export function emptyPersistedLesson(
  title: string,
  type: PersistedLesson["type"] = "reading",
): PersistedLesson {
  return {
    title,
    type,
    contentUrl: "",
    contentBody: "",
    contentSummary: "",
    learningObjectives: [],
    videoUrl: "",
    videoDurationSeconds: 0,
    resources: [],
    assignment: null,
    quiz: null,
  };
}

export function emptyPersistedModule(title: string, lessons: PersistedLesson[]): PersistedModule {
  return { title, lessons };
}

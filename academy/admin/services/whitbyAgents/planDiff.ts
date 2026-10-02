import type { PersistedModule, PersistedProgramDraft } from "../catalogPersistence";

// Turns a before → after draft into a short, human-readable list of the
// concrete changes an instructor is about to approve. Matching is title-based
// (a heuristic, but it reads naturally in a preview card): a module/lesson that
// exists only in `after` is an add, only in `before` is a remove. Same-title
// lessons that gain/lose an assignment are described as content ops (inside
// the lesson), never as before/after placement.

function quizCount(module: PersistedModule): number {
  return module.lessons.reduce((sum, lesson) => sum + (lesson.quiz?.questions.length ?? 0), 0);
}

function lessonKey(moduleTitle: string, lessonTitle: string) {
  return `${moduleTitle.trim()}::${lessonTitle.trim()}`;
}

export function describePlanSteps(
  before: PersistedProgramDraft,
  after: PersistedProgramDraft,
): string[] {
  const steps: string[] = [];

  if (before.name.trim() !== after.name.trim()) {
    steps.push(`Rename the program to “${after.name.trim()}”`);
  }
  if (before.description.trim() !== after.description.trim()) {
    steps.push("Update the program description");
  }
  if ((before.type ?? "").trim() !== (after.type ?? "").trim()) {
    steps.push("Change the program type");
  }
  if ((before.category ?? "").trim() !== (after.category ?? "").trim()) {
    steps.push("Change the program category");
  }

  const beforeByTitle = new Map(before.modules.map((module) => [module.title.trim(), module]));
  const afterByTitle = new Map(after.modules.map((module) => [module.title.trim(), module]));

  for (const module of after.modules) {
    const key = module.title.trim();
    if (!beforeByTitle.has(key)) {
      steps.push(
        `Add module “${module.title}” (${module.lessons.length} lesson${module.lessons.length === 1 ? "" : "s"})`,
      );
    }
  }

  for (const module of before.modules) {
    if (!afterByTitle.has(module.title.trim())) {
      steps.push(`Remove module “${module.title}” and its ${module.lessons.length} lesson${module.lessons.length === 1 ? "" : "s"}`);
    }
  }

  const beforeLessons = new Map(
    before.modules.flatMap((module, moduleIndex) =>
      module.lessons.map((lesson, lessonIndex) => [
        lessonKey(module.title, lesson.title),
        { module, moduleIndex, lesson, lessonIndex },
      ]),
    ),
  );
  const afterLessons = new Map(
    after.modules.flatMap((module, moduleIndex) =>
      module.lessons.map((lesson, lessonIndex) => [
        lessonKey(module.title, lesson.title),
        { module, moduleIndex, lesson, lessonIndex },
      ]),
    ),
  );

  for (const [key, afterRef] of afterLessons) {
    const beforeRef = beforeLessons.get(key);
    if (!beforeRef) continue;
    const hadAssignment = Boolean(beforeRef.lesson.assignment);
    const hasAssignment = Boolean(afterRef.lesson.assignment);
    if (!hadAssignment && hasAssignment) {
      steps.push(
        `Add an assignment inside lesson ${afterRef.moduleIndex + 1}.${afterRef.lessonIndex + 1} — “${afterRef.lesson.title}”`,
      );
    } else if (hadAssignment && !hasAssignment) {
      steps.push(
        `Remove the assignment from lesson ${afterRef.moduleIndex + 1}.${afterRef.lessonIndex + 1} — “${afterRef.lesson.title}”`,
      );
    }
  }

  // Lesson- and quiz-level changes for modules present on both sides.
  for (const afterModule of after.modules) {
    const beforeModule = beforeByTitle.get(afterModule.title.trim());
    if (!beforeModule) continue;

    const beforeLessonTitles = new Set(beforeModule.lessons.map((lesson) => lesson.title.trim()));
    const afterLessonTitles = new Set(afterModule.lessons.map((lesson) => lesson.title.trim()));
    const moduleIndex = after.modules.indexOf(afterModule);

    for (const lesson of afterModule.lessons) {
      if (!beforeLessonTitles.has(lesson.title.trim())) {
        const lessonIndex = afterModule.lessons.indexOf(lesson);
        if (lesson.type === "assignment") {
          steps.push(
            `Add assignment lesson ${moduleIndex + 1}.${lessonIndex + 1} — “${lesson.title}” to “${afterModule.title}”`,
          );
        } else {
          steps.push(`Add ${lesson.type} lesson “${lesson.title}” to “${afterModule.title}”`);
        }
      }
    }
    for (const lesson of beforeModule.lessons) {
      if (!afterLessonTitles.has(lesson.title.trim())) {
        const lessonIndex = beforeModule.lessons.indexOf(lesson);
        const bits: string[] = [];
        if (lesson.quiz?.questions.length) {
          bits.push(`${lesson.quiz.questions.length} quiz question${lesson.quiz.questions.length === 1 ? "" : "s"}`);
        }
        if (lesson.assignment) bits.push("assignment");
        if (lesson.videoUrl) bits.push("video");
        const cascade = bits.length ? ` (also removes its ${bits.join(", ")})` : "";
        steps.push(
          `Remove lesson ${moduleIndex + 1}.${lessonIndex + 1} — “${lesson.title}”${cascade}`,
        );
      }
    }

    const addedQuestions = quizCount(afterModule) - quizCount(beforeModule);
    if (addedQuestions > 0) {
      steps.push(`Add ${addedQuestions} quiz question${addedQuestions === 1 ? "" : "s"} in “${afterModule.title}”`);
    }
  }

  if (steps.length > 0) {
    steps.push("Nothing else will be changed.");
  }

  return steps;
}

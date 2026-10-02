import type { CatalogLesson, CatalogModule, CatalogProgramDetail } from "../types";

export function newClientId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function blankLesson(title = "New lesson"): CatalogLesson {
  return {
    id: newClientId("lesson"),
    title,
    type: "reading",
    contentUrl: "",
    contentBody: "",
    contentSummary: "",
    learningObjectives: [],
    videoUrl: "",
    videoDurationSeconds: 0,
    sortOrder: 0,
    resources: [],
    assignment: null,
    quiz: null,
  };
}

export function blankModule(index: number): CatalogModule {
  return {
    id: newClientId("module"),
    title: `Module ${index}`,
    sortOrder: index - 1,
    lessons: [blankLesson("New lesson")],
  };
}

function reindex(modules: CatalogModule[]): CatalogModule[] {
  return modules.map((module, moduleIndex) => ({
    ...module,
    sortOrder: moduleIndex,
    lessons: module.lessons.map((lesson, lessonIndex) => ({
      ...lesson,
      sortOrder: lessonIndex,
    })),
  }));
}

export function addModule(
  program: CatalogProgramDetail,
  afterModuleId?: string,
): { program: CatalogProgramDetail; module: CatalogModule } {
  const module = blankModule(program.modules.length + 1);
  const index = afterModuleId
    ? program.modules.findIndex((item) => item.id === afterModuleId)
    : -1;
  const modules =
    index >= 0
      ? [...program.modules.slice(0, index + 1), module, ...program.modules.slice(index + 1)]
      : [...program.modules, module];
  return { program: { ...program, modules: reindex(modules) }, module };
}

export function addLesson(
  program: CatalogProgramDetail,
  moduleId: string,
  afterLessonId?: string,
): { program: CatalogProgramDetail; lesson: CatalogLesson } {
  const lesson = blankLesson();
  return {
    lesson,
    program: {
      ...program,
      modules: reindex(
        program.modules.map((module) => {
          if (module.id !== moduleId) return module;
          const index = afterLessonId
            ? module.lessons.findIndex((item) => item.id === afterLessonId)
            : -1;
          const lessons =
            index >= 0
              ? [...module.lessons.slice(0, index + 1), lesson, ...module.lessons.slice(index + 1)]
              : [...module.lessons, lesson];
          return { ...module, lessons };
        }),
      ),
    },
  };
}

export function deleteModule(program: CatalogProgramDetail, moduleId: string): CatalogProgramDetail {
  return {
    ...program,
    modules: reindex(program.modules.filter((module) => module.id !== moduleId)),
  };
}

export function deleteLesson(
  program: CatalogProgramDetail,
  lessonId: string,
): CatalogProgramDetail {
  return {
    ...program,
    modules: reindex(
      program.modules.map((module) => ({
        ...module,
        lessons: module.lessons.filter((lesson) => lesson.id !== lessonId),
      })),
    ),
  };
}

export function parseDottedLessonRefs(text: string) {
  return [...text.matchAll(/\b(\d{1,2})\.(\d{1,2})\b/g)].map((match) => ({
    moduleNumber: Number(match[1]),
    lessonNumber: Number(match[2]),
  }));
}

export function deleteLessonsByNumbers(
  program: CatalogProgramDetail,
  refs: { moduleNumber: number; lessonNumber: number }[],
): CatalogProgramDetail {
  const ordered = [...refs].sort((a, b) => {
    if (a.moduleNumber !== b.moduleNumber) return b.moduleNumber - a.moduleNumber;
    return b.lessonNumber - a.lessonNumber;
  });
  let next = program;
  for (const ref of ordered) {
    const lesson = next.modules[ref.moduleNumber - 1]?.lessons[ref.lessonNumber - 1];
    if (!lesson) continue;
    next = deleteLesson(next, lesson.id);
  }
  return next;
}

export function renameModule(
  program: CatalogProgramDetail,
  moduleId: string,
  title: string,
): CatalogProgramDetail {
  return {
    ...program,
    modules: program.modules.map((module) =>
      module.id === moduleId ? { ...module, title } : module,
    ),
  };
}

export function moveModule(
  program: CatalogProgramDetail,
  moduleId: string,
  direction: -1 | 1,
): CatalogProgramDetail {
  const index = program.modules.findIndex((module) => module.id === moduleId);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= program.modules.length) return program;
  const modules = [...program.modules];
  const [item] = modules.splice(index, 1);
  modules.splice(next, 0, item);
  return { ...program, modules: reindex(modules) };
}

export function moveLesson(
  program: CatalogProgramDetail,
  moduleId: string,
  lessonId: string,
  direction: -1 | 1,
): CatalogProgramDetail {
  return {
    ...program,
    modules: reindex(
      program.modules.map((module) => {
        if (module.id !== moduleId) return module;
        const index = module.lessons.findIndex((lesson) => lesson.id === lessonId);
        const next = index + direction;
        if (index < 0 || next < 0 || next >= module.lessons.length) return module;
        const lessons = [...module.lessons];
        const [item] = lessons.splice(index, 1);
        lessons.splice(next, 0, item);
        return { ...module, lessons };
      }),
    ),
  };
}

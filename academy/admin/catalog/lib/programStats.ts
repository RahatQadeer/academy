import type { CatalogLesson, CatalogProgramDetail } from "../types";

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function lessonMinutes(lesson: CatalogLesson) {
  if (lesson.type === "assignment") {
    const parsed = Number(lesson.assignment?.estimatedMinutes);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return 45;
  }
  if (lesson.type === "quiz") {
    const questions = lesson.quiz?.questions.length ?? 0;
    return Math.max(8, questions * 2);
  }
  if (lesson.type === "video" && lesson.videoDurationSeconds > 0) {
    return Math.max(1, Math.ceil(lesson.videoDurationSeconds / 60));
  }
  const words = wordCount(`${lesson.contentSummary} ${lesson.contentBody}`);
  return Math.max(8, Math.min(40, Math.round(words / 140) || 12));
}

export function countLessons(program: CatalogProgramDetail) {
  return program.modules.reduce((sum, module) => sum + module.lessons.length, 0);
}

export function countQuestions(program: CatalogProgramDetail) {
  return program.modules.reduce(
    (sum, module) =>
      sum +
      module.lessons.reduce((inner, lesson) => inner + (lesson.quiz?.questions.length ?? 0), 0),
    0,
  );
}

export function totalMinutes(program: CatalogProgramDetail) {
  return program.modules.reduce(
    (sum, module) => sum + module.lessons.reduce((inner, lesson) => inner + lessonMinutes(lesson), 0),
    0,
  );
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function estimatedDuration(program: CatalogProgramDetail) {
  const weeks = Math.max(1, Math.round(countLessons(program) / 4));
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

export type QualityIssue = {
  severity: "critical" | "major" | "minor";
  area: string;
  detail: string;
};

export type ProgramQuality = {
  overall: number;
  dimensions: {
    structure: { score: number; notes: string };
    content: { score: number; notes: string };
    objectiveAlignment: { score: number; notes: string };
    assessment: { score: number; notes: string };
  };
  issues: QualityIssue[];
  strengths: string[];
};

export function programQuality(program: CatalogProgramDetail): ProgramQuality {
  const lessons = program.modules.flatMap((module) => module.lessons);
  const lessonCount = lessons.length;
  const moduleCount = program.modules.length;
  const questions = countQuestions(program);
  const richLessons = lessons.filter((lesson) => {
    if (lesson.type === "quiz") return (lesson.quiz?.questions.length ?? 0) >= 3;
    if (lesson.type === "assignment") return (lesson.assignment?.brief.trim().length ?? 0) >= 80;
    return lesson.contentBody.trim().length >= 1200;
  }).length;
  const withObjectives = lessons.filter((lesson) => lesson.learningObjectives.length > 0).length;
  const emptyModules = program.modules.filter((module) => module.lessons.length === 0).length;

  // No artificial floors — empty drafts must read as ~0%, not ~40%.
  const structure = Math.max(
    0,
    Math.min(100, moduleCount * 18 + Math.min(lessonCount, 16) * 4 - emptyModules * 18),
  );
  const content =
    lessonCount === 0 ? 0 : Math.round((richLessons / lessonCount) * 100);
  const objectiveAlignment =
    lessonCount === 0 ? 0 : Math.round((withObjectives / lessonCount) * 100);
  const assessment = Math.max(
    0,
    Math.min(100, questions === 0 ? 0 : questions * 6 + 20),
  );
  const overall = Math.max(
    0,
    Math.min(
      100,
      Math.round(structure * 0.25 + content * 0.35 + objectiveAlignment * 0.2 + assessment * 0.2),
    ),
  );

  const issues: QualityIssue[] = [];
  if (lessonCount === 0) {
    issues.push({
      severity: "critical",
      area: "structure",
      detail:
        moduleCount === 0
          ? "This course is empty. Add modules and lessons to begin."
          : "Modules exist but have no lessons yet. Add lesson content before publishing.",
    });
  }
  if (moduleCount < 2 && lessonCount > 0) {
    issues.push({
      severity: "major",
      area: "structure",
      detail: "Add at least two modules so the course has a clear sequence.",
    });
  }
  if (emptyModules > 0) {
    issues.push({
      severity: "major",
      area: "structure",
      detail: `${emptyModules} module${emptyModules === 1 ? "" : "s"} ha${emptyModules === 1 ? "s" : "ve"} no lessons.`,
    });
  }
  const thin = lessonCount - richLessons;
  if (thin > 0) {
    issues.push({
      severity: thin > 3 ? "major" : "minor",
      area: "content",
      detail: `${thin} lesson${thin === 1 ? "" : "s"} still look thin. Expand the body, assignment brief, or quiz.`,
    });
  }
  if (questions < 5) {
    issues.push({
      severity: "major",
      area: "assessment",
      detail: "Add at least five quiz questions so learners can check their understanding.",
    });
  }

  const strengths: string[] = [];
  if (moduleCount >= 3 && emptyModules === 0) {
    strengths.push("The module sequence is long enough to feel like a full course.");
  }
  if (richLessons >= 6) strengths.push("Most lessons already have publishable draft content.");
  if (questions >= 10) strengths.push("Assessments are substantial enough to measure the objectives.");

  return {
    overall,
    dimensions: {
      structure: {
        score: structure,
        notes: `${moduleCount} modules, ${lessonCount} lessons.`,
      },
      content: {
        score: content,
        notes:
          lessonCount === 0
            ? "No lessons yet — content depth is 0%."
            : `${richLessons} of ${lessonCount} lessons have substantial content.`,
      },
      objectiveAlignment: {
        score: objectiveAlignment,
        notes:
          lessonCount === 0
            ? "No lessons to align objectives to."
            : `${withObjectives} lessons list learning objectives.`,
      },
      assessment: {
        score: assessment,
        notes: `${questions} quiz questions across the course.`,
      },
    },
    issues,
    strengths,
  };
}

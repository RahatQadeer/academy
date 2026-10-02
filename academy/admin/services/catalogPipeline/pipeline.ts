import "server-only";

import type { CatalogEmit } from "@/academy/admin/catalog/lib/stages";
import { looksLikeGenericCourseGen, sourceMentionsGenericCourseGen } from "@/academy/admin/lib/courseAttachmentText";
import { teachingContentIsComplete } from "@/academy/admin/lib/courseAttachmentText";
import {
  generateContentQuizzesForModule,
  generateFinalAssessment,
  generateModuleQuizLesson,
} from "./assessments";
import {
  buildFallbackLessonPlans,
  generateLessonPlan,
  generateModulePlan,
} from "./curriculum";
import { generateJson, mapLimit } from "./deepseek";
import { contentWordCount, jsonDiscipline } from "./prompts";
import { generateAssignmentContent, generateLessonBody } from "./lessons";
import { parseModuleCount, toPersistedDraft } from "./mapper";
import { analyzeBrief, generateObjectives } from "./planner";
import { buildSourceKnowledge } from "./sourceDocument";
import { needsSourceRegeneration, sourceFidelityCheck } from "./sourceFidelity";
import { courseBodiesAreComplete, incompleteCourseLessons } from "./quality";
import type {
  CatalogGenerationRequest,
  LessonPlan,
  PipelineCourse,
  PipelineLesson,
  PipelineModule,
} from "./types";

const LESSON_CONCURRENCY = 4;
const BODY_ROUNDS = 2;
/** Parallel modules while building quizzes (DeepSeek-friendly). */
const QUIZ_MODULE_CONCURRENCY = 2;
/** Leave headroom before Vercel maxDuration for final assessment + DB save. */
const SAVE_HEADROOM_MS = 55_000;
const FINAL_ASSESSMENT_BUDGET_MS = 80_000;

export type CatalogPipelineOptions = {
  /** Absolute timestamp — when remaining time is low, quizzes thin or skip so the draft can still save. */
  deadlineAt?: number;
  /** Called once lesson bodies (+ activities) are complete, before quizzes. Use to checkpoint-persist. */
  onBodiesReady?: (course: PipelineCourse) => Promise<void>;
};

function remainingMs(deadlineAt?: number) {
  if (!deadlineAt) return Number.POSITIVE_INFINITY;
  return deadlineAt - Date.now();
}

/** Local assignment stub so a late deadline does not abort the whole pipeline. */
function fallbackAssignmentLesson(
  lesson: PipelineLesson,
  difficulty: string,
): PipelineLesson {
  const title = lesson.title.trim() || "Applied assignment";
  const outlineText = lesson.outline.map((line) => line.trim()).filter(Boolean).join(" ");
  const focus = lesson.summary.trim() || outlineText || title;
  const objectives =
    lesson.learningObjectives.length > 0
      ? lesson.learningObjectives.map((item) => `- ${item}`).join("\n")
      : `- Apply the core ideas from ${title}`;
  const body = [
    `This assignment asks you to put ${title} into practice at the ${difficulty} level.`,
    "",
    focus,
    "",
    "Start by reviewing the module lessons you just completed. Identify the concepts that matter most for this task, and note any constraints the scenario imposes on time, quality, cost, or risk. Capture those notes before you draft so your deliverable stays grounded in what the course actually taught.",
    "",
    "Define the audience for your deliverable. State what success looks like, what evidence you will use, and which trade-offs you are willing to accept. Keep the work concrete enough that another practitioner could follow your reasoning without a meeting or a follow-up email.",
    "",
    "Learning focus:",
    objectives,
    "",
    "Produce one reviewable artifact: a memo, checklist, plan, worked example, or short brief. Explain the approach you took, cite the lesson ideas you used, and call out open risks or assumptions. Avoid a bullet-only outline with no narrative judgment or named decisions.",
    "",
    "Structure your submission so an instructor can scan it quickly: opening context, method, result, and residual risks. Where numbers, thresholds, or criteria appear in the lessons, reuse them rather than inventing soft language.",
    "",
    "Quality bar: the submission should be specific enough that an instructor can grade accuracy, completeness, and professional judgment without guessing your intent. Prefer clear structure, named decisions, and evidence over vague claims or generic best-practice slogans.",
    "",
    "If the brief is ambiguous, state your interpretation in one short paragraph and continue. Do not stall waiting for perfect clarity — document the choice and keep moving.",
    "",
    "Before you submit, re-read your artifact once. Confirm it answers the brief, matches the difficulty level, uses lesson concepts explicitly, and would stand alone if the instructor had not watched you build it. Fix gaps, then submit the final version.",
  ].join("\n");
  const brief = [
    `Complete a ${difficulty}-level applied task for "${title}".`,
    focus,
    "Use the module readings and scenario as your source of truth. Produce one reviewable deliverable with clear reasoning and named trade-offs.",
  ].join("\n\n");
  return {
    ...lesson,
    contentBody: body,
    contentSummary: lesson.summary || `Applied practice for ${title}`,
    assignment: {
      brief,
      submissionInstructions:
        "Upload or paste your deliverable. Include a short note on the approach you took and any assumptions.",
      rubric:
        "Accuracy to lesson concepts (40%). Completeness of the deliverable (30%). Clarity and professional judgment (30%).",
      estimatedMinutes: String(lesson.durationMinutes || 45),
    },
  };
}

export async function runCatalogPipeline(
  input: {
    prompt: string;
    length: string;
    difficulty: string;
    type: string;
    attachments?: { name: string; content: string; kind?: string; pageCount?: number }[];
  },
  emit: CatalogEmit,
  signal?: AbortSignal,
  options: CatalogPipelineOptions = {},
): Promise<PipelineCourse> {
  const check = () => {
    if (signal?.aborted) throw new Error("Generation cancelled");
  };
  const { deadlineAt, onBodiesReady } = options;

  /* Stage 1 — analyze source, then brief */
  emit({
    type: "stage",
    stage: "analyze",
    status: "active",
    detail: input.attachments?.length ? "Reading source document…" : undefined,
  });
  const source = await buildSourceKnowledge(input.attachments, signal);
  const request: CatalogGenerationRequest = {
    prompt: input.prompt.trim(),
    length: input.length,
    difficulty: input.difficulty,
    type: input.type,
    moduleCount: parseModuleCount(input.length),
    programType: input.type,
    attachments: input.attachments,
    source,
  };

  const blueprint = await analyzeBrief(request, signal);
  emit({
    type: "stage",
    stage: "analyze",
    status: "done",
    detail: source.hasSource
      ? `${blueprint.title} · ${source.fileNames[0] || "source"}`
      : blueprint.title,
  });
  check();

  /* Stage 2 — objectives */
  emit({ type: "stage", stage: "objectives", status: "active" });
  const objectives = await generateObjectives(request, blueprint, signal);
  emit({
    type: "stage",
    stage: "objectives",
    status: "done",
    detail: `${objectives.learningObjectives.length} objectives`,
  });
  check();

  /* Stage 3 — curriculum */
  emit({ type: "stage", stage: "curriculum", status: "active" });
  let modulePlans = await generateModulePlan(request, blueprint, objectives, signal);
  if (
    source.hasSource &&
    !sourceMentionsGenericCourseGen(source.consolidated) &&
    modulePlans.some((plan) => looksLikeGenericCourseGen(`${plan.title} ${plan.focus}`))
  ) {
    modulePlans = await generateModulePlan(request, blueprint, objectives, signal);
  }
  // Length is a hard contract with the author — never drift after design.
  if (modulePlans.length !== request.moduleCount) {
    modulePlans = modulePlans.slice(0, request.moduleCount);
  }
  emit({
    type: "stage",
    stage: "curriculum",
    status: "done",
    detail: `${modulePlans.length} modules`,
  });
  check();

  let course: PipelineCourse = {
    name: blueprint.title,
    description: blueprint.description,
    category: input.type,
    type: input.type,
    learningObjectives: objectives.learningObjectives,
    outcomes: objectives.outcomes,
    modules: [],
  };

  /* Stage 4 — module lesson plans */
  emit({ type: "stage", stage: "modules", status: "active", progress: 0 });
  const plannedModules: PipelineModule[] = [];
  for (let index = 0; index < modulePlans.length; index += 1) {
    const plan = modulePlans[index];
    let lessonPlans: LessonPlan[];
    try {
      lessonPlans = await generateLessonPlan(
        request,
        blueprint,
        plan,
        {
          index,
          total: modulePlans.length,
          previousTitles: modulePlans.slice(0, index).map((m) => m.title),
        },
        signal,
      );
    } catch (error) {
      if (signal?.aborted) throw error;
      // Last-resort: never abort the whole generation on one module.
      console.warn(
        `[coursegen] structuring fallback for "${plan.title}":`,
        error instanceof Error ? error.message : error,
      );
      lessonPlans = buildFallbackLessonPlans(plan);
    }

    plannedModules.push({
      title: plan.title,
      description: plan.description,
      learningObjectives: plan.learningObjectives,
      lessons: lessonPlans.map((lp) => ({
        title: lp.title,
        summary: lp.summary,
        lessonKind: lp.lessonKind,
        learningObjectives: lp.learningObjectives,
        durationMinutes: lp.durationMinutes,
        outline: lp.outline,
        introduction: "",
        contentBody: "",
        contentSummary: lp.summary,
        resources: [],
        assignment: null,
        quiz: null,
      })),
    });

    emit({
      type: "stage",
      stage: "modules",
      status: "active",
      progress: (index + 1) / modulePlans.length,
      detail: `${index + 1} of ${modulePlans.length} modules structured`,
    });
  }

  course = { ...course, modules: plannedModules };
  const lessonTotal = plannedModules.reduce((sum, m) => sum + m.lessons.length, 0);

  emit({
    type: "stage",
    stage: "modules",
    status: "done",
    detail: `${plannedModules.length} modules · ${lessonTotal} lessons`,
  });

  emit({
    type: "skeleton",
    programName: course.name,
    modules: plannedModules.map((m) => ({
      title: m.title,
      lessons: m.lessons.map((l) => ({ title: l.title, type: l.lessonKind })),
    })),
  });
  check();

  /* Stage 5 — lesson bodies (markdown, then completeness retries) */
  emit({ type: "stage", stage: "lessons", status: "active", progress: 0 });
  const jobs = plannedModules.flatMap((module, moduleIndex) =>
    module.lessons.map((lesson, lessonIndex) => ({
      moduleIndex,
      lessonIndex,
      module,
      plan: {
        title: lesson.title,
        summary: lesson.summary,
        lessonKind: lesson.lessonKind,
        learningObjectives: lesson.learningObjectives,
        durationMinutes: lesson.durationMinutes,
        outline: lesson.outline,
      } satisfies LessonPlan,
    })),
  );

  const flatPlan = jobs.map((j) => ({ title: j.plan.title, summary: j.plan.summary }));

  const mergeLesson = (target: PipelineCourse, moduleIndex: number, lessonIndex: number, next: PipelineLesson) => ({
    ...target,
    modules: target.modules.map((module, mi) =>
      mi !== moduleIndex
        ? module
        : {
            ...module,
            lessons: module.lessons.map((lesson, li) => (li === lessonIndex ? next : lesson)),
          },
    ),
  });

  const keepBetter = (
    current: PipelineLesson,
    next: PipelineLesson,
    kind: PipelineLesson["lessonKind"],
  ) => {
    const nextOk = teachingContentIsComplete(next.contentBody, blueprint.difficulty, kind);
    const currentOk = teachingContentIsComplete(current.contentBody, blueprint.difficulty, kind);
    if (nextOk && !currentOk) return next;
    if (currentOk && !nextOk) return current;
    return contentWordCount(next.contentBody) >= contentWordCount(current.contentBody) ? next : current;
  };

  const emptyFromPlan = (plan: LessonPlan): PipelineLesson => ({
    title: plan.title,
    summary: plan.summary,
    lessonKind: plan.lessonKind,
    learningObjectives: plan.learningObjectives,
    durationMinutes: plan.durationMinutes,
    outline: plan.outline,
    introduction: "",
    contentBody: "",
    contentSummary: plan.summary,
    resources: [],
    assignment: null,
    quiz: null,
  });

  const bodyJobs = jobs.filter((job) => job.plan.lessonKind !== "quiz" && job.plan.lessonKind !== "assignment");
  let finished = 0;

  const writtenFirst = await mapLimit(bodyJobs, LESSON_CONCURRENCY, async (job) => {
    const result = await generateLessonBody(
      job.plan,
      {
        request,
        blueprint,
        moduleTitle: job.module.title,
        moduleIndex: job.moduleIndex,
        lessonIndex: job.lessonIndex,
        priorLessons: flatPlan.slice(0, jobs.indexOf(job)),
        nextLessonTitle: flatPlan[jobs.indexOf(job) + 1]?.title,
      },
      signal,
    ).catch(() => emptyFromPlan(job.plan));
    finished += 1;
    emit({
      type: "stage",
      stage: "lessons",
      status: "active",
      progress: finished / Math.max(bodyJobs.length, 1),
      detail: `${finished} of ${bodyJobs.length} lessons written`,
    });
    return { job, result };
  });

  for (const item of writtenFirst) {
    course = mergeLesson(course, item.job.moduleIndex, item.job.lessonIndex, item.result);
  }

  for (let round = 2; round <= BODY_ROUNDS; round += 1) {
    // Soft deadline: skip completeness retries so we still reach checkpoint + save.
    if (remainingMs(deadlineAt) < 100_000) {
      emit({
        type: "stage",
        stage: "lessons",
        status: "active",
        detail: "Saving headroom — skipping extra lesson polish",
      });
      break;
    }
    const incomplete = incompleteCourseLessons(course, blueprint.difficulty).filter(
      (item) => course.modules[item.moduleIndex].lessons[item.lessonIndex].lessonKind !== "assignment",
    );
    if (!incomplete.length) break;
    emit({
      type: "stage",
      stage: "lessons",
      status: "active",
      detail: `Finishing ${incomplete.length} incomplete lesson${incomplete.length === 1 ? "" : "s"} (round ${round})`,
    });
    const rewritten = await mapLimit(incomplete, LESSON_CONCURRENCY, async (item) => {
      const job = jobs.find((j) => j.moduleIndex === item.moduleIndex && j.lessonIndex === item.lessonIndex);
      if (!job) return item;
      const result = await generateLessonBody(
        job.plan,
        {
          request,
          blueprint,
          moduleTitle: job.module.title,
          moduleIndex: job.moduleIndex,
          lessonIndex: job.lessonIndex,
          priorLessons: flatPlan.slice(0, jobs.indexOf(job)),
          nextLessonTitle: flatPlan[jobs.indexOf(job) + 1]?.title,
        },
        signal,
      ).catch(() => item.lesson);
      return {
        ...item,
        lesson: keepBetter(item.lesson, result, job.plan.lessonKind),
      };
    });
    for (const item of rewritten) {
      course = mergeLesson(course, item.moduleIndex, item.lessonIndex, item.lesson);
    }
  }

  const stillOpen = incompleteCourseLessons(course, blueprint.difficulty).filter(
    (item) => course.modules[item.moduleIndex].lessons[item.lessonIndex].lessonKind !== "assignment",
  );
  if (stillOpen.length) {
    throw new Error(
      `Whitby could not finish ${stillOpen.length} lesson${stillOpen.length === 1 ? "" : "s"} at ${blueprint.difficulty} level (${stillOpen
        .slice(0, 3)
        .map((item) => item.lesson.title)
        .join(", ")}). Generate again — incomplete courses are not saved.`,
    );
  }

  emit({
    type: "stage",
    stage: "lessons",
    status: "done",
    detail: `${bodyJobs.length} complete ${blueprint.difficulty} lessons`,
  });
  check();

  /* Stage 6 — activities (assignments) */
  emit({ type: "stage", stage: "activities", status: "active", progress: 0 });
  const withActivities: PipelineModule[] = [];
  for (let index = 0; index < course.modules.length; index += 1) {
    check();
    const module = course.modules[index];
    const lessons: PipelineLesson[] = [];
    for (const lesson of module.lessons) {
      if (lesson.lessonKind === "assignment") {
        if (remainingMs(deadlineAt) < 40_000) {
          // Keep outline stub — checkpoint still needs a complete brief.
          // Prefer a fast local stub over aborting the whole run.
          lessons.push(fallbackAssignmentLesson(lesson, blueprint.difficulty));
        } else {
          try {
            lessons.push(
              await generateAssignmentContent(
                {
                  title: lesson.title,
                  summary: lesson.summary,
                  lessonKind: lesson.lessonKind,
                  learningObjectives: lesson.learningObjectives,
                  durationMinutes: lesson.durationMinutes,
                  outline: lesson.outline,
                },
                module.lessons,
                blueprint,
                signal,
              ),
            );
          } catch (error) {
            console.error("[runCatalogPipeline] assignment", lesson.title, error);
            lessons.push(fallbackAssignmentLesson(lesson, blueprint.difficulty));
          }
        }
      } else {
        lessons.push(lesson);
      }
    }
    withActivities.push({ ...module, lessons });
    emit({
      type: "stage",
      stage: "activities",
      status: "active",
      progress: (index + 1) / course.modules.length,
      detail: `${index + 1} of ${course.modules.length} modules`,
    });
  }
  course = { ...course, modules: withActivities };
  emit({ type: "stage", stage: "activities", status: "done" });
  check();

  if (!courseBodiesAreComplete(course, blueprint.difficulty)) {
    const missing = incompleteCourseLessons(course, blueprint.difficulty);
    throw new Error(
      `Whitby could not finish every lesson at ${blueprint.difficulty} level (${missing
        .slice(0, 3)
        .map((item) => item.lesson.title)
        .join(", ")}). Generate again — incomplete courses are not saved.`,
    );
  }

  // Checkpoint: persist teaching bodies before the long quiz phase so a Vercel
  // timeout cannot wipe the entire generation.
  if (onBodiesReady) {
    await onBodiesReady(course);
    check();
  }

  /* Stage 7 — quizzes (batched per module + parallel across modules) */
  emit({ type: "stage", stage: "quizzes", status: "active", progress: 0 });

  const quizBudget = remainingMs(deadlineAt) - SAVE_HEADROOM_MS;
  // full = content quizzes + module quizzes; module = synthesis quizzes only; skip = save now
  const quizMode: "full" | "module" | "skip" =
    quizBudget < 25_000 ? "skip" : quizBudget < 100_000 ? "module" : "full";

  if (quizMode === "skip") {
    emit({
      type: "stage",
      stage: "quizzes",
      status: "done",
      detail: "Saved progress — add quizzes in the builder if needed",
      progress: 1,
    });
  } else {
    let finishedModules = 0;
    const quizzedModules = await mapLimit(
      course.modules,
      QUIZ_MODULE_CONCURRENCY,
      async (module) => {
        check();
        if (remainingMs(deadlineAt) < SAVE_HEADROOM_MS + 20_000) {
          finishedModules += 1;
          emit({
            type: "stage",
            stage: "quizzes",
            status: "active",
            progress: finishedModules / Math.max(course.modules.length, 1),
            detail: "Wrapping up to save your draft…",
          });
          return module;
        }

        let next = module;
        try {
          if (quizMode === "full") {
            next = await generateContentQuizzesForModule(module, blueprint, signal);
          }

          const quizLesson = next.lessons.find((lesson) => lesson.lessonKind === "quiz");
          if (quizLesson) {
            const moduleQuiz = await generateModuleQuizLesson(next, blueprint, signal).catch(
              () => null,
            );
            if (moduleQuiz) {
              next = {
                ...next,
                lessons: next.lessons.map((lesson) =>
                  lesson.lessonKind === "quiz" ? moduleQuiz : lesson,
                ),
              };
            }
          }
        } catch {
          /* keep module without new quizzes — draft still saves */
        }

        finishedModules += 1;
        emit({
          type: "stage",
          stage: "quizzes",
          status: "active",
          progress: finishedModules / Math.max(course.modules.length, 1),
          detail: module.title,
        });
        return next;
      },
    );
    course = { ...course, modules: quizzedModules };
    emit({
      type: "stage",
      stage: "quizzes",
      status: "done",
      detail: quizMode === "module" ? "Module quizzes ready" : undefined,
    });
  }
  check();

  /* Stage 8 — final assessment (lesson inside last module — never an extra module) */
  emit({ type: "stage", stage: "assessment", status: "active" });
  const canFinal =
    remainingMs(deadlineAt) >= SAVE_HEADROOM_MS + FINAL_ASSESSMENT_BUDGET_MS * 0.35;
  const finalAssessment = canFinal
    ? await generateFinalAssessment(course.modules, blueprint, signal).catch(() => null)
    : null;
  if (finalAssessment?.quiz.questions.length && course.modules.length > 0) {
    const lastIndex = course.modules.length - 1;
    const lastModule = course.modules[lastIndex]!;
    course = {
      ...course,
      modules: course.modules.map((module, index) =>
        index !== lastIndex
          ? module
          : {
              ...lastModule,
              lessons: [
                ...lastModule.lessons,
                {
                  title: finalAssessment.title,
                  summary: "Final course assessment",
                  lessonKind: "quiz" as const,
                  learningObjectives: [],
                  durationMinutes: 45,
                  outline: [],
                  introduction: "",
                  contentBody: finalAssessment.contentBody,
                  contentSummary: "Final assessment",
                  resources: [],
                  assignment: null,
                  quiz: finalAssessment.quiz,
                },
              ],
            },
      ),
    };
  }
  emit({
    type: "stage",
    stage: "assessment",
    status: "done",
    detail: finalAssessment
      ? `${finalAssessment.quiz.questions.length} questions`
      : canFinal
        ? "skipped"
        : "Saved — finalize assessment in builder if needed",
  });
  check();

  const fidelity = sourceFidelityCheck(course, source, blueprint.difficulty);
  if (needsSourceRegeneration(fidelity)) {
    const renamed = await generateJson<{ title?: string; description?: string }>(
      "You retitle a course so it matches its source document. Return only JSON.",
      `The generated course drifted away from the source. Rename it.

SOURCE SUBJECT: ${source.subjectHint}
SOURCE FILES: ${source.fileNames.join(", ")}
SOURCE HEADINGS: ${source.headings.slice(0, 16).join("; ")}
CURRENT TITLE: ${course.name}
CURRENT DESCRIPTION: ${course.description}

Return JSON: { title, description } using the source subject. Do not mention CourseGen, prompts, or AI course generators.

${jsonDiscipline()}`,
      { temperature: 0.2, maxTokens: 1200, signal },
    ).catch(() => null);
    if (renamed?.title?.trim()) {
      course = {
        ...course,
        name: renamed.title.trim(),
        description: renamed.description?.trim() || course.description,
      };
    }
  }

  /* Stage 9 — quality UI is finished by the API route after the draft is saved.
     Do not emit quality/done here or the spinner restarts on “Saving draft…”. */
  emit({
    type: "stage",
    stage: "quality",
    status: "active",
    detail: fidelity.ok ? "Checking draft…" : "Checking source fidelity…",
    progress: 0.25,
  });

  return course;
}

export { toPersistedDraft, parseModuleCount };

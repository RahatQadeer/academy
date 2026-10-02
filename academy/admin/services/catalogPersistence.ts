import "server-only";

import { sanitizeLessonMarkdown } from "@/academy/admin/catalog/lib/lessonContentText";
import { stripQuizAnswerLeaks } from "@/academy/lib/quizQuestionText";
import { parsePassingScorePercent } from "@/academy/lib/scorePercent";
import {
  parseStoredQuizOptions,
  serializeQuizOptions,
  type StoredQuizOptions,
} from "@/academy/lib/questionBank/bankOrigin";

type PersistedQuestion = {
  questionText: string;
  type: "multiple_choice" | "true_false";
  options: string[];
  correctAnswer: string;
  fromBank?: boolean;
};

type PersistedResource = {
  title: string;
  resourceType: string;
  url: string;
  notes: string;
};

type PersistedAssignment = {
  brief: string;
  submissionInstructions: string;
  rubric: string;
  estimatedMinutes: string;
} | null;

export type PersistedLesson = {
  id?: string;
  title: string;
  type:
    | "reading"
    | "video"
    | "attachment"
    | "quiz"
    | "scenario"
    | "resource"
    | "assignment";
  contentUrl: string;
  contentBody: string;
  contentSummary: string;
  learningObjectives: string[];
  videoUrl: string;
  videoDurationSeconds: number;
  resources: PersistedResource[];
  assignment: PersistedAssignment;
  quiz:
    | {
        id?: string;
        passingScore: string;
        questions: PersistedQuestion[];
      }
    | null;
};

export type PersistedModule = {
  id?: string;
  title: string;
  lessons: PersistedLesson[];
};

export type PersistedProgramDraft = {
  name: string;
  description: string;
  category: string;
  type: string;
  modules: PersistedModule[];
};

export async function rewriteProgramDraft(
  supabase: {
    from: (table: string) => any;
  },
  programId: string,
  draft: PersistedProgramDraft,
) {
  // Insert the new tree first, then delete the old modules. Deleting first
  // risked an empty program shell when a later insert failed.
  const { data: existingModules } = await supabase
    .from("academy_modules")
    .select("id")
    .eq("program_id", programId);
  const oldModuleIds = ((existingModules ?? []) as { id: string }[]).map((module) => module.id);

  // Batch inserts — sequential per-row writes made large generations hang on
  // “Saving draft…” for a long time and left the quality spinner stuck.
  // Temporary high sort_order keeps old + new rows unique until we prune.
  const sortOffset = 10_000;
  const { data: createdModules, error: moduleError } = await supabase
    .from("academy_modules")
    .insert(
      draft.modules.map((module, moduleIndex) => ({
        program_id: programId,
        title: module.title,
        sort_order: sortOffset + moduleIndex,
      })),
    )
    .select("id, sort_order");
  if (moduleError || !createdModules?.length) {
    console.error("[rewriteProgramDraft] insert modules", moduleError);
    return { ok: false as const };
  }

  const newModuleIds = (createdModules as { id: string }[]).map((row) => row.id);
  const modulesByOrder = new Map(
    (createdModules as { id: string; sort_order: number }[]).map((row) => [
      row.sort_order - sortOffset,
      row.id,
    ]),
  );
  const rollbackNew = async () => {
    if (newModuleIds.length) await supabase.from("academy_modules").delete().in("id", newModuleIds);
  };
  const finalizeSuccess = async () => {
    if (oldModuleIds.length > 0) {
      await supabase.from("academy_modules").delete().in("id", oldModuleIds);
    }
    await Promise.all(
      draft.modules.map((_, moduleIndex) => {
        const moduleId = modulesByOrder.get(moduleIndex);
        if (!moduleId) return Promise.resolve();
        return supabase.from("academy_modules").update({ sort_order: moduleIndex }).eq("id", moduleId);
      }),
    );
    return { ok: true as const };
  };

  const lessonRows: {
    module_id: string;
    title: string;
    type: PersistedLesson["type"];
    content_url: string | null;
    content_body: string | null;
    content_summary: string | null;
    learning_objectives: string[];
    video_url: string | null;
    video_duration_seconds: number | null;
    sort_order: number;
    _moduleIndex: number;
    _lessonIndex: number;
  }[] = [];

  for (let moduleIndex = 0; moduleIndex < draft.modules.length; moduleIndex += 1) {
    const moduleId = modulesByOrder.get(moduleIndex);
    if (!moduleId) {
      console.error("[rewriteProgramDraft] missing module id", moduleIndex);
      await rollbackNew();
      return { ok: false as const };
    }
    const module = draft.modules[moduleIndex];
    for (let lessonIndex = 0; lessonIndex < module.lessons.length; lessonIndex += 1) {
      const lesson = module.lessons[lessonIndex];
      lessonRows.push({
        module_id: moduleId,
        title: lesson.title.trim() || `Lesson ${lessonIndex + 1}`,
        type: lesson.type,
        content_url: lesson.contentUrl || null,
        content_body: sanitizeLessonMarkdown(lesson.contentBody) || null,
        content_summary: lesson.contentSummary || null,
        learning_objectives: lesson.learningObjectives,
        video_url: lesson.videoUrl || null,
        video_duration_seconds: lesson.videoDurationSeconds || null,
        sort_order: lessonIndex,
        _moduleIndex: moduleIndex,
        _lessonIndex: lessonIndex,
      });
    }
  }

  if (lessonRows.length === 0) {
    return finalizeSuccess();
  }

  const { data: createdLessons, error: lessonError } = await supabase
    .from("academy_lessons")
    .insert(
      lessonRows.map(({ _moduleIndex: _m, _lessonIndex: _l, ...row }) => row),
    )
    .select("id, module_id, sort_order");
  if (lessonError || !createdLessons?.length) {
    console.error("[rewriteProgramDraft] insert lessons", lessonError);
    await rollbackNew();
    return { ok: false as const };
  }

  const lessonIdByKey = new Map(
    (createdLessons as { id: string; module_id: string; sort_order: number }[]).map((row) => [
      `${row.module_id}:${row.sort_order}`,
      row.id,
    ]),
  );

  const resourceRows: {
    lesson_id: string;
    title: string;
    resource_type: string;
    url: string | null;
    notes: string | null;
    sort_order: number;
  }[] = [];
  const assignmentRows: {
    lesson_id: string;
    brief: string;
    submission_instructions: string;
    rubric: string;
    estimated_minutes: number | null;
  }[] = [];
  const quizSources: {
    lessonId: string;
    passingScore: number;
    questions: PersistedQuestion[];
  }[] = [];

  for (const staged of lessonRows) {
    const lessonId = lessonIdByKey.get(`${staged.module_id}:${staged.sort_order}`);
    if (!lessonId) {
      console.error("[rewriteProgramDraft] missing lesson id", staged);
      await rollbackNew();
      return { ok: false as const };
    }
    const lesson = draft.modules[staged._moduleIndex].lessons[staged._lessonIndex];

    for (let resourceIndex = 0; resourceIndex < lesson.resources.length; resourceIndex += 1) {
      const resource = lesson.resources[resourceIndex];
      resourceRows.push({
        lesson_id: lessonId,
        title: resource.title,
        resource_type: resource.resourceType || "link",
        url: resource.url || null,
        notes: resource.notes || null,
        sort_order: resourceIndex,
      });
    }

    if (lesson.type === "assignment" && lesson.assignment) {
      assignmentRows.push({
        lesson_id: lessonId,
        brief: lesson.assignment.brief,
        submission_instructions: lesson.assignment.submissionInstructions,
        rubric: lesson.assignment.rubric,
        estimated_minutes: lesson.assignment.estimatedMinutes
          ? Number(lesson.assignment.estimatedMinutes)
          : null,
      });
    }

    if (lesson.quiz) {
      quizSources.push({
        lessonId,
        passingScore: parsePassingScorePercent(lesson.quiz.passingScore),
        questions: lesson.quiz.questions,
      });
    }
  }

  if (resourceRows.length > 0) {
    const { error: resourceError } = await supabase.from("academy_lesson_resources").insert(resourceRows);
    if (resourceError) {
      console.error("[rewriteProgramDraft] insert resources", resourceError);
      await rollbackNew();
      return { ok: false as const };
    }
  }

  if (assignmentRows.length > 0) {
    const { error: assignmentError } = await supabase.from("academy_assignments").insert(assignmentRows);
    if (assignmentError) {
      console.error("[rewriteProgramDraft] insert assignments", assignmentError);
      await rollbackNew();
      return { ok: false as const };
    }
  }

  if (quizSources.length > 0) {
    const { data: createdQuizzes, error: quizError } = await supabase
      .from("academy_quizzes")
      .insert(
        quizSources.map((quiz) => ({
          lesson_id: quiz.lessonId,
          passing_score: quiz.passingScore,
        })),
      )
      .select("id, lesson_id");
    if (quizError || !createdQuizzes?.length) {
      console.error("[rewriteProgramDraft] insert quizzes", quizError);
      await rollbackNew();
      return { ok: false as const };
    }

    const quizIdByLesson = new Map(
      (createdQuizzes as { id: string; lesson_id: string }[]).map((row) => [row.lesson_id, row.id]),
    );

    const questionRows: {
      quiz_id: string;
      question_text: string;
      type: PersistedQuestion["type"];
      options: StoredQuizOptions;
      correct_answer: string;
      sort_order: number;
    }[] = [];

    for (const quiz of quizSources) {
      const quizId = quizIdByLesson.get(quiz.lessonId);
      if (!quizId) {
        console.error("[rewriteProgramDraft] missing quiz id", quiz.lessonId);
        await rollbackNew();
        return { ok: false as const };
      }
      for (let questionIndex = 0; questionIndex < quiz.questions.length; questionIndex += 1) {
        const question = quiz.questions[questionIndex];
        questionRows.push({
          quiz_id: quizId,
          question_text: stripQuizAnswerLeaks(question.questionText),
          type: question.type,
          options: serializeQuizOptions(question.options, question.fromBank),
          correct_answer: question.correctAnswer,
          sort_order: questionIndex,
        });
      }
    }

    if (questionRows.length > 0) {
      const { error: questionError } = await supabase.from("academy_questions").insert(questionRows);
      if (questionError) {
        console.error("[rewriteProgramDraft] insert questions", questionError);
        await rollbackNew();
        return { ok: false as const };
      }
    }
  }

  return finalizeSuccess();
}

const PERSISTED_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AnyClient = { from: (table: string) => any };

function persistedId(value?: string | null) {
  const id = value?.trim() ?? "";
  return PERSISTED_ID.test(id) ? id : null;
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").trim() === (right ?? "").trim();
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/**
 * Update an existing catalog in place. Keeps lesson IDs so learner progress
 * is not wiped, and only writes rows that actually changed.
 */
export async function syncProgramDraft(
  supabase: AnyClient,
  programId: string,
  draft: PersistedProgramDraft,
  options?: { prune?: boolean },
) {
  const prune = options?.prune !== false;
  let inserted = false;
  const { data: existingModules, error: moduleLoadError } = await supabase
    .from("academy_modules")
    .select("id, title, sort_order")
    .eq("program_id", programId);
  if (moduleLoadError) return { ok: false as const };

  const moduleRows = (existingModules ?? []) as { id: string; title: string; sort_order: number }[];
  const moduleIds = moduleRows.map((row) => row.id);

  const { data: existingLessons } =
    moduleIds.length > 0
      ? await supabase
          .from("academy_lessons")
          .select(
            "id, module_id, title, type, content_url, content_body, content_summary, learning_objectives, video_url, video_duration_seconds, sort_order",
          )
          .in("module_id", moduleIds)
      : { data: [] };

  const lessonRows = (existingLessons ?? []) as {
    id: string;
    module_id: string;
    title: string;
    type: string;
    content_url: string | null;
    content_body: string | null;
    content_summary: string | null;
    learning_objectives: string[] | null;
    video_url: string | null;
    video_duration_seconds: number | null;
    sort_order: number;
  }[];
  const lessonById = new Map(lessonRows.map((row) => [row.id, row]));
  const lessonIds = lessonRows.map((row) => row.id);

  const [{ data: resourceRows }, { data: assignmentRows }, { data: quizRows }] = await Promise.all([
    lessonIds.length > 0
      ? supabase
          .from("academy_lesson_resources")
          .select("id, lesson_id, title, resource_type, url, notes, sort_order")
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length > 0
      ? supabase
          .from("academy_assignments")
          .select("id, lesson_id, brief, submission_instructions, rubric, estimated_minutes")
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length > 0
      ? supabase.from("academy_quizzes").select("id, lesson_id, passing_score").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
  ]);

  const resourcesByLesson = new Map<string, typeof resourceRows>();
  for (const row of (resourceRows ?? []) as {
    id: string;
    lesson_id: string;
    title: string;
    resource_type: string;
    url: string | null;
    notes: string | null;
    sort_order: number;
  }[]) {
    const list = resourcesByLesson.get(row.lesson_id) ?? [];
    list.push(row);
    resourcesByLesson.set(row.lesson_id, list);
  }

  const assignmentByLesson = new Map(
    ((assignmentRows ?? []) as {
      id: string;
      lesson_id: string;
      brief: string | null;
      submission_instructions: string | null;
      rubric: string | null;
      estimated_minutes: number | null;
    }[]).map((row) => [row.lesson_id, row]),
  );

  const quizByLesson = new Map(
    ((quizRows ?? []) as { id: string; lesson_id: string; passing_score: number }[]).map((row) => [
      row.lesson_id,
      row,
    ]),
  );
  const quizIds = [...quizByLesson.values()].map((row) => row.id);
  const { data: questionRows } =
    quizIds.length > 0
      ? await supabase
          .from("academy_questions")
          .select("id, quiz_id, question_text, type, options, correct_answer, sort_order")
          .in("quiz_id", quizIds)
      : { data: [] };

  const questionsByQuiz = new Map<string, NonNullable<typeof questionRows>>();
  for (const row of (questionRows ?? []) as {
    id: string;
    quiz_id: string;
    question_text: string;
    type: string;
    options: string[] | null;
    correct_answer: string | null;
    sort_order: number;
  }[]) {
    const list = questionsByQuiz.get(row.quiz_id) ?? [];
    list.push(row);
    questionsByQuiz.set(row.quiz_id, list);
  }

  const keepModuleIds = new Set<string>();
  const keepLessonIds = new Set<string>();

  for (let moduleIndex = 0; moduleIndex < draft.modules.length; moduleIndex += 1) {
    const module = draft.modules[moduleIndex];
    let moduleId = persistedId(module.id);
    const existingModule = moduleId ? moduleRows.find((row) => row.id === moduleId) : undefined;

    if (existingModule) {
      if (!sameText(existingModule.title, module.title) || existingModule.sort_order !== moduleIndex) {
        const { error } = await supabase
          .from("academy_modules")
          .update({ title: module.title, sort_order: moduleIndex })
          .eq("id", existingModule.id);
        if (error) return { ok: false as const };
      }
      moduleId = existingModule.id;
    } else {
      const { data: created, error } = await supabase
        .from("academy_modules")
        .insert({ program_id: programId, title: module.title, sort_order: moduleIndex })
        .select("id")
        .maybeSingle();
      if (error || !created) return { ok: false as const };
      moduleId = (created as { id: string }).id;
      inserted = true;
    }
    keepModuleIds.add(moduleId);

    for (let lessonIndex = 0; lessonIndex < module.lessons.length; lessonIndex += 1) {
      const lesson = module.lessons[lessonIndex];
      const synced = await syncLessonRow(supabase, {
        lesson,
        lessonIndex,
        moduleId,
        existing: persistedId(lesson.id) ? lessonById.get(persistedId(lesson.id)!) : undefined,
        resources: persistedId(lesson.id) ? (resourcesByLesson.get(persistedId(lesson.id)!) ?? []) : [],
        assignment: persistedId(lesson.id) ? assignmentByLesson.get(persistedId(lesson.id)!) : undefined,
        quiz: persistedId(lesson.id) ? quizByLesson.get(persistedId(lesson.id)!) : undefined,
        questions: (() => {
          const quiz = persistedId(lesson.id) ? quizByLesson.get(persistedId(lesson.id)!) : undefined;
          return quiz ? (questionsByQuiz.get(quiz.id) ?? []) : [];
        })(),
      });
      if (!synced.ok) return { ok: false as const };
      if (!persistedId(lesson.id) || synced.lessonId !== persistedId(lesson.id)) inserted = true;
      keepLessonIds.add(synced.lessonId);
    }
  }

  if (prune) {
    const leftoverLessons = lessonRows.filter((row) => !keepLessonIds.has(row.id)).map((row) => row.id);
    if (leftoverLessons.length > 0) {
      const { error: progressError } = await supabase
        .from("academy_lesson_progress")
        .delete()
        .in("lesson_id", leftoverLessons);
      if (progressError) return { ok: false as const };
      const { error } = await supabase.from("academy_lessons").delete().in("id", leftoverLessons);
      if (error) return { ok: false as const };
    }

    const leftoverModules = moduleRows.filter((row) => !keepModuleIds.has(row.id)).map((row) => row.id);
    if (leftoverModules.length > 0) {
      const { error } = await supabase.from("academy_modules").delete().in("id", leftoverModules);
      if (error) return { ok: false as const };
    }
  }

  return { ok: true as const, inserted };
}

async function syncLessonRow(
  supabase: AnyClient,
  input: {
    lesson: PersistedLesson;
    lessonIndex: number;
    moduleId: string;
    existing?: {
      id: string;
      module_id: string;
      title: string;
      type: string;
      content_url: string | null;
      content_body: string | null;
      content_summary: string | null;
      learning_objectives: string[] | null;
      video_url: string | null;
      video_duration_seconds: number | null;
      sort_order: number;
    };
    resources: {
      title: string;
      resource_type: string;
      url: string | null;
      notes: string | null;
      sort_order: number;
    }[];
    assignment?: {
      brief: string | null;
      submission_instructions: string | null;
      rubric: string | null;
      estimated_minutes: number | null;
    };
    quiz?: { id: string; passing_score: number };
    questions: {
      question_text: string;
      type: string;
      options: string[] | null;
      correct_answer: string | null;
      sort_order: number;
    }[];
  },
) {
  const lesson = input.lesson;
  const payload = {
    module_id: input.moduleId,
    title: lesson.title,
    type: lesson.type,
    content_url: lesson.contentUrl || null,
    content_body: sanitizeLessonMarkdown(lesson.contentBody) || null,
    content_summary: lesson.contentSummary || null,
    learning_objectives: lesson.learningObjectives,
    video_url: lesson.videoUrl || null,
    video_duration_seconds: lesson.videoDurationSeconds || null,
    sort_order: input.lessonIndex,
  };

  let lessonId = input.existing?.id ?? null;
  if (input.existing) {
    const unchanged =
      input.existing.module_id === payload.module_id &&
      sameText(input.existing.title, payload.title) &&
      input.existing.type === payload.type &&
      sameText(input.existing.content_url, payload.content_url) &&
      sameText(input.existing.content_body, payload.content_body) &&
      sameText(input.existing.content_summary, payload.content_summary) &&
      sameJson(input.existing.learning_objectives ?? [], payload.learning_objectives) &&
      sameText(input.existing.video_url, payload.video_url) &&
      (input.existing.video_duration_seconds || 0) === (payload.video_duration_seconds || 0) &&
      input.existing.sort_order === payload.sort_order;
    if (!unchanged) {
      const { error } = await supabase.from("academy_lessons").update(payload).eq("id", input.existing.id);
      if (error) return { ok: false as const };
    }
  } else {
    const { data: created, error } = await supabase.from("academy_lessons").insert(payload).select("id").maybeSingle();
    if (error || !created) return { ok: false as const };
    lessonId = (created as { id: string }).id;
  }

  if (!lessonId) return { ok: false as const };

  const extras = await syncLessonExtras(supabase, lessonId, lesson, input);
  if (!extras.ok) return { ok: false as const };
  return { ok: true as const, lessonId };
}

async function syncLessonExtras(
  supabase: AnyClient,
  lessonId: string,
  lesson: PersistedLesson,
  existing: {
    resources: {
      title: string;
      resource_type: string;
      url: string | null;
      notes: string | null;
      sort_order: number;
    }[];
    assignment?: {
      brief: string | null;
      submission_instructions: string | null;
      rubric: string | null;
      estimated_minutes: number | null;
    };
    quiz?: { id: string; passing_score: number };
    questions: {
      question_text: string;
      type: string;
      options: string[] | null;
      correct_answer: string | null;
      sort_order: number;
    }[];
  },
) {
  const nextResources = lesson.resources.map((resource, index) => ({
    title: resource.title,
    resource_type: resource.resourceType || "link",
    url: resource.url || null,
    notes: resource.notes || null,
    sort_order: index,
  }));
  const currentResources = [...existing.resources].sort((a, b) => a.sort_order - b.sort_order);
  if (!sameJson(
    currentResources.map((row) => [row.title, row.resource_type, row.url ?? "", row.notes ?? "", row.sort_order]),
    nextResources.map((row) => [row.title, row.resource_type, row.url ?? "", row.notes ?? "", row.sort_order]),
  )) {
    const { error: deleteError } = await supabase.from("academy_lesson_resources").delete().eq("lesson_id", lessonId);
    if (deleteError) return { ok: false as const };
    if (nextResources.length > 0) {
      const { error } = await supabase.from("academy_lesson_resources").insert(
        nextResources.map((resource) => ({ ...resource, lesson_id: lessonId })),
      );
      if (error) return { ok: false as const };
    }
  }

  if (lesson.type === "assignment" && lesson.assignment) {
    const minutes = lesson.assignment.estimatedMinutes
      ? Number(lesson.assignment.estimatedMinutes)
      : null;
    const next = {
      brief: lesson.assignment.brief,
      submission_instructions: lesson.assignment.submissionInstructions,
      rubric: lesson.assignment.rubric,
      estimated_minutes: Number.isFinite(minutes) ? minutes : null,
    };
    if (!existing.assignment) {
      const { error } = await supabase.from("academy_assignments").insert({ lesson_id: lessonId, ...next });
      if (error) return { ok: false as const };
    } else if (
      !sameText(existing.assignment.brief, next.brief) ||
      !sameText(existing.assignment.submission_instructions, next.submission_instructions) ||
      !sameText(existing.assignment.rubric, next.rubric) ||
      (existing.assignment.estimated_minutes ?? null) !== next.estimated_minutes
    ) {
      const { error } = await supabase.from("academy_assignments").update(next).eq("lesson_id", lessonId);
      if (error) return { ok: false as const };
    }
  } else if (existing.assignment) {
    const { error } = await supabase.from("academy_assignments").delete().eq("lesson_id", lessonId);
    if (error) return { ok: false as const };
  }

  if (lesson.quiz) {
    const passingScore = parsePassingScorePercent(lesson.quiz.passingScore);
    let quizId = existing.quiz?.id ?? null;
    if (!quizId) {
      const { data: created, error } = await supabase
        .from("academy_quizzes")
        .insert({ lesson_id: lessonId, passing_score: passingScore })
        .select("id")
        .maybeSingle();
      if (error || !created) return { ok: false as const };
      quizId = (created as { id: string }).id;
    } else if (existing.quiz && existing.quiz.passing_score !== passingScore) {
      const { error } = await supabase.from("academy_quizzes").update({ passing_score: passingScore }).eq("id", quizId);
      if (error) return { ok: false as const };
    }

    const nextQuestions = lesson.quiz.questions.map((question, index) => ({
      question_text: stripQuizAnswerLeaks(question.questionText),
      type: question.type,
      options: serializeQuizOptions(question.options, question.fromBank),
      correct_answer: question.correctAnswer,
      sort_order: index,
    }));
    const currentQuestions = [...existing.questions].sort((a, b) => a.sort_order - b.sort_order);
    if (!sameJson(
      currentQuestions.map((row) => [
        row.question_text,
        row.type,
        serializeQuizOptions(
          parseStoredQuizOptions(row.options).choices,
          parseStoredQuizOptions(row.options).fromBank,
        ),
        row.correct_answer ?? "",
        row.sort_order,
      ]),
      nextQuestions.map((row) => [row.question_text, row.type, row.options, row.correct_answer, row.sort_order]),
    )) {
      const { error: deleteError } = await supabase.from("academy_questions").delete().eq("quiz_id", quizId);
      if (deleteError) return { ok: false as const };
      if (nextQuestions.length > 0) {
        const { error } = await supabase.from("academy_questions").insert(
          nextQuestions.map((question) => ({ ...question, quiz_id: quizId })),
        );
        if (error) return { ok: false as const };
      }
    }
  } else if (existing.quiz) {
    const { error } = await supabase.from("academy_quizzes").delete().eq("id", existing.quiz.id);
    if (error) return { ok: false as const };
  }

  return { ok: true as const };
}

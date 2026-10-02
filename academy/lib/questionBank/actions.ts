"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canAccessInstructorArea,
  isAcademyAdmin,
  isInstructor,
} from "@/academy/lib/authorization";
import { appendManualQuestion } from "./appendManualQuestion";
import { appendPromptToAssignment } from "./appendPromptToAssignment";
import { copyBankQuestionsToQuiz } from "./copyBankQuestionsToQuiz";
import { createBankCourse } from "./createBankCourse";
import { ensureGeneralBankProgram } from "./generalBankProgram";
import { deleteCustomBankQuestion } from "./deleteCustomBankQuestion";
import { loadAuthoringQuestions } from "./loadAuthoringQuestions";
import { loadQuestionBank } from "./loadQuestionBank";
import { loadQuestionBankQuizTargets } from "./loadQuizTargets";
import {
  ADMIN_QUESTION_BANK_PATH,
  INSTRUCTOR_QUESTION_BANK_PATH,
} from "./href";
import type {
  AppendAssignmentPromptInput,
  AppendAssignmentPromptResult,
  AppendManualQuestionInput,
  AppendManualQuestionResult,
  AuthoringBankQuestion,
  CopyBankQuestionsInput,
  CopyBankQuestionsResult,
  DeleteCustomBankQuestionResult,
  QuestionBankAuthorScope,
  QuestionBankFilters,
  QuestionBankLoadResult,
  QuestionBankProgramTarget,
} from "./types";
import type { CreateBankCourseResult } from "./createBankCourse";

function revalidateAuthoring(programId: string, lessonId?: string) {
  revalidatePath(`/academy/admin/catalog/${programId}`);
  revalidatePath(`/academy/instructor/programs/${programId}`);
  if (lessonId) {
    revalidatePath(`/academy/instructor/programs/${programId}/quiz/${lessonId}`);
  }
}

function revalidateQuestionBankOnly() {
  revalidatePath(ADMIN_QUESTION_BANK_PATH);
  revalidatePath(INSTRUCTOR_QUESTION_BANK_PATH);
}

export async function loadQuestionBankAction(input: {
  scope: QuestionBankAuthorScope;
  filters: Partial<QuestionBankFilters>;
}): Promise<QuestionBankLoadResult> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, reason: "unauthorized" };

  const actor = { id: profile.user.id };
  if (input.scope === "admin") {
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };
  } else {
    const [area, instructor] = await Promise.all([
      canAccessInstructorArea(actor),
      isInstructor(actor),
    ]);
    if (!area || !instructor) return { ok: false, reason: "unauthorized" };
  }

  return loadQuestionBank({
    userId: profile.user.id,
    scope: input.scope,
    filters: input.filters,
  });
}

export async function appendManualQuestionAction(
  input: AppendManualQuestionInput,
): Promise<AppendManualQuestionResult> {
  const result = await appendManualQuestion(input);
  if (result.ok) revalidateQuestionBankOnly();
  return result;
}

/** One round-trip: optional general pool (or existing course) + save question. */
export async function saveBankQuestionAction(input: {
  programId?: string;
  /** Save into the shared General questions pool (no catalog course). */
  general?: boolean;
  /** @deprecated Prefer general — kept for older clients. */
  newCourseName?: string;
  questionText: string;
  type: string;
  options: { id: string; label: string }[];
  correctAnswer: string;
}): Promise<
  | {
      ok: true;
      questionId: string;
      programId: string;
      general?: boolean;
      createdCourse?: { programId: string; name: string };
    }
  | {
      ok: false;
      reason: "unauthorized" | "invalid" | "published" | "failed";
      message: string;
    }
> {
  let programId = (input.programId ?? "").trim().toLowerCase();
  let general = Boolean(input.general) || Boolean((input.newCourseName ?? "").trim());

  if (general) {
    const pool = await ensureGeneralBankProgram();
    if (!pool.ok) return pool;
    programId = pool.programId;
  }

  if (!programId) {
    return { ok: false, reason: "invalid", message: "Choose a course, or save as a general question." };
  }

  const result = await appendManualQuestion({
    programId,
    questionText: input.questionText,
    type: input.type,
    options: input.options,
    correctAnswer: input.correctAnswer,
  });
  if (!result.ok) return result;

  revalidateQuestionBankOnly();

  return { ok: true, questionId: result.questionId, programId, general };
}

export async function createBankCourseAction(input: {
  name: string;
}): Promise<CreateBankCourseResult> {
  const result = await createBankCourse(input);
  if (result.ok) {
    revalidateQuestionBankOnly();
    revalidatePath(`/academy/admin/catalog/${result.programId}`);
    revalidatePath(`/academy/instructor/programs/${result.programId}`);
  }
  return result;
}

export async function copyBankQuestionsToQuizAction(
  input: CopyBankQuestionsInput,
): Promise<CopyBankQuestionsResult> {
  const result = await copyBankQuestionsToQuiz(input);
  if (result.ok) revalidateAuthoring(input.programId, input.lessonId);
  return result;
}

export async function appendAssignmentPromptAction(
  input: AppendAssignmentPromptInput,
): Promise<AppendAssignmentPromptResult> {
  const result = await appendPromptToAssignment(input);
  if (result.ok) revalidateAuthoring(input.programId);
  return result;
}

export async function loadAuthoringQuestionsAction(input: {
  programId?: string;
  bankOnly?: boolean;
}): Promise<{ ok: true; items: AuthoringBankQuestion[] } | { ok: false; items: AuthoringBankQuestion[] }> {
  const result = await loadAuthoringQuestions(input);
  if (!result.ok) return { ok: false, items: [] };
  return result;
}

export async function loadQuestionBankQuizTargetsAction(input: {
  scope: QuestionBankAuthorScope;
  programId?: string;
}): Promise<{ ok: true; programs: QuestionBankProgramTarget[] } | { ok: false; programs: QuestionBankProgramTarget[] }> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, programs: [] };

  const actor = { id: profile.user.id };
  if (input.scope === "admin") {
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, programs: [] };
  } else {
    const [area, instructor] = await Promise.all([
      canAccessInstructorArea(actor),
      isInstructor(actor),
    ]);
    if (!area || !instructor) return { ok: false, programs: [] };
  }

  const result = await loadQuestionBankQuizTargets({
    userId: profile.user.id,
    scope: input.scope,
    programId: input.programId,
    lite: !input.programId,
  });
  if (!result.ok) return { ok: false, programs: [] };
  return result;
}

export async function deleteCustomBankQuestionAction(
  questionId: string,
): Promise<DeleteCustomBankQuestionResult> {
  const result = await deleteCustomBankQuestion(questionId);
  if (result.ok) {
    revalidatePath(ADMIN_QUESTION_BANK_PATH);
    revalidatePath(INSTRUCTOR_QUESTION_BANK_PATH);
  }
  return result;
}

"use server";

import { revalidatePath } from "next/cache";
import type { MarkLessonCompleteResult } from "./types";
import type { AssignmentWriteResult } from "@/academy/assignments/types";

function revalidateLesson(programId: string, lessonId: string) {
  revalidatePath("/academy");
  revalidatePath("/academy/learning", "layout");
  revalidatePath("/academy/credentials", "layout");
  revalidatePath("/academy/instructor/reviews", "layout");
  revalidatePath(`/academy/learning/${programId}`);
  revalidatePath(`/academy/learning/${programId}/${lessonId}`);
}

export async function markLessonCompleteAction(
  programId: string,
  lessonId: string,
): Promise<MarkLessonCompleteResult> {
  const { markLessonComplete } = await import("./services/markLessonComplete");
  const result = await markLessonComplete(programId, lessonId);

  if (result.status === "completed" || result.status === "already_completed") {
    revalidateLesson(programId, lessonId);
  }

  return result;
}

export async function submitAssignmentAction(formData: FormData): Promise<AssignmentWriteResult> {
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const programId = String(formData.get("programId") ?? "").trim();
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const fileValue = formData.get("file");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;

  const { submitLearnerAssignment } = await import("./services/submitAssignment");
  const result = await submitLearnerAssignment({
    assignmentId,
    programId,
    lessonId,
    body,
    file,
  });

  if (result.status === "ok") revalidateLesson(programId, lessonId);
  return result;
}

export async function saveAssignmentDraftAction(
  formData: FormData,
): Promise<AssignmentWriteResult> {
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const programId = String(formData.get("programId") ?? "").trim();
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const fileValue = formData.get("file");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;

  const { saveLearnerAssignmentDraft } = await import("./services/submitAssignment");
  const result = await saveLearnerAssignmentDraft({ assignmentId, body, file });
  if (result.status === "ok") revalidateLesson(programId, lessonId);
  return result;
}

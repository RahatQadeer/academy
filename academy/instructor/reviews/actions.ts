"use server";

import { revalidatePath } from "next/cache";
import type { AssignmentWriteResult } from "@/academy/assignments/types";

function revalidateReview(submissionId: string) {
  revalidatePath("/academy/instructor", "layout");
  revalidatePath("/academy/instructor/reviews", "layout");
  revalidatePath(`/academy/instructor/reviews/${submissionId}`);
  revalidatePath("/academy/credentials", "layout");
  revalidatePath("/academy/learning", "layout");
}

export async function gradeAssignmentAction(input: {
  submissionId: string;
  score: number;
  maxScore: number;
  feedback: string;
}): Promise<AssignmentWriteResult> {
  const { gradeInstructorAssignment } = await import("./services/gradeAssignment");
  const result = await gradeInstructorAssignment(input);
  if (result.status === "ok") revalidateReview(input.submissionId);
  return result;
}

export async function requestResubmissionAction(input: {
  submissionId: string;
  feedback: string;
}): Promise<AssignmentWriteResult> {
  const { requestInstructorResubmission } = await import("./services/gradeAssignment");
  const result = await requestInstructorResubmission(input);
  if (result.status === "ok") revalidateReview(input.submissionId);
  return result;
}

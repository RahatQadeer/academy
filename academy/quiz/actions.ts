"use server";

import { revalidatePath } from "next/cache";
import type { SubmitLearnerQuizResult } from "./types";

export async function submitLearnerQuizAction(input: {
  programId: string;
  lessonId: string;
  quizId: string;
  answers: { questionId: string; answer: string }[];
}): Promise<SubmitLearnerQuizResult> {
  const { submitLearnerQuiz } = await import("./services/submitQuiz");
  const result = await submitLearnerQuiz(input);

  if (result.status === "scored") {
    revalidatePath("/academy");
    revalidatePath("/academy/learning");
    revalidatePath(`/academy/learning/${input.programId}`);
    revalidatePath(`/academy/learning/${input.programId}/${input.lessonId}`);
  }

  return result;
}

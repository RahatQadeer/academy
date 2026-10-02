"use server";

import { revalidatePath } from "next/cache";
import type { SaveQuizDraftInput, SaveQuizDraftResult } from "./types";

export async function saveQuizDraftAction(input: SaveQuizDraftInput): Promise<SaveQuizDraftResult> {
  const { saveQuizDraft } = await import("./services/saveQuizDraft");
  const result = await saveQuizDraft(input);
  if (result.ok) {
    revalidatePath(`/academy/instructor/programs/${input.programId}`);
    revalidatePath(`/academy/instructor/programs/${input.programId}/quiz/${input.lessonId}`);
  }
  return result;
}

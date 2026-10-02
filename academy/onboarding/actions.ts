"use server";

import { revalidatePath } from "next/cache";
import { ACADEMY_INTERESTS, type AcademyInterestId } from "./lib/interests";

function asInterestIds(value: unknown): AcademyInterestId[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AcademyInterestId =>
    ACADEMY_INTERESTS.some((interest) => interest.id === item),
  );
}

export async function completeAcademyOnboardingAction(interestIds: AcademyInterestId[]) {
  const { saveOnboardingCompletion } = await import("./services/saveOnboardingCompletion");
  const result = await saveOnboardingCompletion(asInterestIds(interestIds));
  if (result.ok) {
    revalidatePath("/academy");
  }
  return result;
}

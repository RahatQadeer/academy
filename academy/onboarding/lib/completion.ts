import { ACADEMY_INTERESTS, type AcademyInterestId } from "./interests";

export const ACADEMY_ONBOARDING_COOKIE = "academy_learner_onboarding";

export type AcademyOnboardingRecord = {
  userId: string;
  completed: boolean;
  interestIds: AcademyInterestId[];
};

function isInterestId(value: unknown): value is AcademyInterestId {
  return (
    typeof value === "string" &&
    ACADEMY_INTERESTS.some((item) => item.id === value)
  );
}

export function parseOnboardingRecord(
  raw: string | undefined,
  userId: string,
): AcademyOnboardingRecord | null {
  if (!raw || !userId) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AcademyOnboardingRecord>;
    if (parsed.userId !== userId) return null;
    return {
      userId,
      completed: Boolean(parsed.completed),
      interestIds: Array.isArray(parsed.interestIds)
        ? parsed.interestIds.filter(isInterestId)
        : [],
    };
  } catch {
    return null;
  }
}

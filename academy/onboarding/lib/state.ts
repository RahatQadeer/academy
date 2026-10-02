import type { AcademyInterestId } from "./interests";

const STORAGE_KEY = "pa.academy.onboarding.v1";

export type AcademyOnboardingState = {
  userId: string;
  completed: boolean;
  interestIds: AcademyInterestId[];
};

function emptyState(userId: string): AcademyOnboardingState {
  return { userId, completed: false, interestIds: [] };
}

function readAll(): Record<string, AcademyOnboardingState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, AcademyOnboardingState>;
  } catch {
    return {};
  }
}

function writeAll(value: Record<string, AcademyOnboardingState>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function readOnboardingState(userId: string): AcademyOnboardingState {
  if (!userId) return emptyState("");
  const all = readAll();
  const current = all[userId];
  if (!current || current.userId !== userId) return emptyState(userId);
  return {
    userId,
    completed: Boolean(current.completed),
    interestIds: Array.isArray(current.interestIds) ? current.interestIds : [],
  };
}

export function writeOnboardingState(next: AcademyOnboardingState) {
  if (typeof window === "undefined" || !next.userId) return;
  const all = readAll();
  all[next.userId] = next;
  writeAll(all);
}

export function isOnboardingComplete(userId: string) {
  if (!userId) return false;
  return readOnboardingState(userId).completed;
}

export function markOnboardingComplete(
  userId: string,
  interestIds: AcademyInterestId[],
) {
  writeOnboardingState({ userId, completed: true, interestIds });
}

export function clearOnboardingComplete(userId: string) {
  if (!userId) return;
  const current = readOnboardingState(userId);
  writeOnboardingState({ ...current, completed: false });
}

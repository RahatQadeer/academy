import type { MarkLessonCompleteUnavailableReason } from "../types";

export function markLessonCompleteMessage(reason: MarkLessonCompleteUnavailableReason): string {
  if (reason === "unauthenticated") return "Sign in to mark this lesson complete.";
  if (reason === "no_academy_access") return "Academy access is required.";
  if (reason === "no_learner_capability") return "Learner access is required.";
  if (reason === "no_enrollment") return "You can only complete lessons in programs you are enrolled in.";
  if (reason === "payment_required") return "Complete payment to unlock this program's lessons.";
  if (reason === "mismatch") return "This lesson is not part of the selected program.";
  if (reason === "locked") return "This lesson is locked.";
  return "This lesson could not be marked complete. Try again in a moment.";
}

import type { LearnerQuizUnavailableReason } from "../types";

export function learnerQuizMessage(reason: LearnerQuizUnavailableReason): string {
  if (reason === "unauthenticated") return "Sign in to take this quiz.";
  if (reason === "no_academy_access") return "Academy access is required to take this quiz.";
  if (reason === "no_learner_capability") return "Learner access is required to take this quiz.";
  if (reason === "no_enrollment") {
    return "You can only take quizzes in programs you are enrolled in.";
  }
  if (reason === "locked") return "This quiz is locked.";
  if (reason === "mismatch" || reason === "not_found") {
    return "This quiz is not available for the selected lesson.";
  }
  if (reason === "malformed") return "This quiz cannot be taken in its current form.";
  if (reason === "empty") return "This quiz does not have any questions yet.";
  if (reason === "invalid") return "The submitted answers are not valid for this quiz.";
  return "This quiz could not be loaded. Try again in a moment.";
}

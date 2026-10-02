import type { CheckoutUnavailableReason, FreeEnrollmentUnavailableReason } from "../types";

export function freeEnrollmentMessage(reason: FreeEnrollmentUnavailableReason): string {
  if (reason === "unauthenticated") return "Sign in to enroll in this program.";
  if (reason === "no_academy_access") return "Academy access is required to enroll.";
  if (reason === "no_learner_capability") return "Learner access is required to enroll.";
  if (reason === "paid") return "This program requires purchase before you can start.";
  if (reason === "entitlement_required") {
    return "This program is assigned by your organization. Contact Academy Admin if you need access.";
  }
  if (reason === "prerequisite_unmet") return "A required prerequisite is not met yet.";
  if (reason === "unpublished" || reason === "not_found") {
    return "This course is not available.";
  }
  return "Enrollment could not be completed. Try again in a moment.";
}

export function checkoutMessage(reason: CheckoutUnavailableReason): string {
  if (reason === "free_program") {
    return "This program is not available for self-serve purchase. Use Start if it is included, or ask your Admin for access.";
  }
  if (reason === "already_paid") return "You already have access to this program.";
  if (reason === "checkout_expired") return "This checkout expired. Start purchase again.";
  if (reason === "checkout_not_pending") return "This checkout is no longer active.";
  if (reason === "amount_mismatch") return "The course price changed. Start checkout again.";
  return freeEnrollmentMessage(reason);
}

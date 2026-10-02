import type { AcademyEnrollment } from "@/academy/lib/domain";

export type FreeEnrollmentUnavailableReason =
  | "unauthenticated"
  | "no_academy_access"
  | "no_learner_capability"
  | "not_found"
  | "unpublished"
  | "paid"
  | "entitlement_required"
  | "prerequisite_unmet"
  | "failed";

export type FreeEnrollmentResult =
  | {
      status: "enrolled";
      enrollment: AcademyEnrollment;
    }
  | {
      status: "already_enrolled";
      enrollment: AcademyEnrollment;
    }
  | {
      status: "unavailable";
      reason: FreeEnrollmentUnavailableReason;
    };

export type AcademyCheckoutStatus = "pending" | "paid" | "expired" | "failed" | "canceled";

export type CheckoutUnavailableReason =
  | FreeEnrollmentUnavailableReason
  | "already_paid"
  | "free_program"
  | "amount_mismatch"
  | "checkout_expired"
  | "checkout_not_pending";

export type CheckoutSessionSummary = {
  id: string;
  programId: string;
  programName: string;
  amount: number;
  currency: string;
  status: AcademyCheckoutStatus;
  stripeCheckoutSessionId: string | null;
};

export type CreateCheckoutResult =
  | { status: "created"; checkout: CheckoutSessionSummary }
  | { status: "existing"; checkout: CheckoutSessionSummary }
  | { status: "already_enrolled"; enrollment: AcademyEnrollment }
  | { status: "unavailable"; reason: CheckoutUnavailableReason };

export type FulfillCheckoutResult =
  | { status: "paid"; enrollment: AcademyEnrollment; checkoutId: string }
  | { status: "already_paid"; enrollment: AcademyEnrollment; checkoutId: string }
  | { status: "unavailable"; reason: CheckoutUnavailableReason };

export type StartStripeCheckoutResult =
  | { status: "redirect"; url: string }
  | { status: "paid"; enrollment: AcademyEnrollment }
  | { status: "unavailable"; reason: CheckoutUnavailableReason };

export type CheckoutPageData = {
  checkout: CheckoutSessionSummary;
  programDescription: string | null;
  stripeEnabled: boolean;
};

export type LoadCheckoutResult =
  | { ok: true; data: CheckoutPageData }
  | { ok: false; reason: "unauthorized" | "not_found" | "failed" };

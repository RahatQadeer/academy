export type RenewalRequestStatus =
  | "pending_admin"
  | "awaiting_form"
  | "awaiting_payment"
  | "awaiting_form_and_payment"
  | "under_review"
  | "approved"
  | "denied"
  | "canceled";

export type RenewalAdminPath =
  | "approve_direct"
  | "request_info"
  | "require_payment"
  | "require_payment_and_form";

export type RenewalFormStatus = "none" | "pending" | "submitted" | "reviewed";
export type RenewalPaymentStatus = "none" | "pending" | "paid" | "failed" | "canceled";
export type RenewalQuestionType = "short_answer" | "long_answer" | "attachment";

export type RenewalFormQuestionDraft = {
  prompt: string;
  responseType: RenewalQuestionType;
  required: boolean;
};

export const OPEN_RENEWAL_STATUSES: RenewalRequestStatus[] = [
  "pending_admin",
  "awaiting_form",
  "awaiting_payment",
  "awaiting_form_and_payment",
  "under_review",
];

export function isOpenRenewalStatus(status: string): status is RenewalRequestStatus {
  return (OPEN_RENEWAL_STATUSES as string[]).includes(status);
}

export function renewalStatusLabel(status: RenewalRequestStatus): string {
  switch (status) {
    case "pending_admin":
      return "Awaiting admin review";
    case "awaiting_form":
      return "Additional information requested";
    case "awaiting_payment":
      return "Payment required";
    case "awaiting_form_and_payment":
      return "Form and payment required";
    case "under_review":
      return "Under admin review";
    case "approved":
      return "Renewed";
    case "denied":
      return "Denied";
    case "canceled":
      return "Canceled";
    default:
      return status;
  }
}

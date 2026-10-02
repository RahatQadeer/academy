import type { AcademyCredentialStatus, AcademyCredentialType } from "@/academy/lib/domain";

export const CREDENTIAL_LIMIT = 48;
export const REVIEW_NOTES_MAX = 2000;

export type AdminCredentialListItem = {
  id: string;
  learnerName: string;
  credentialName: string;
  type: AcademyCredentialType;
  status: AcademyCredentialStatus;
  awardedAt: string | null;
  expiresAt: string | null;
  /** When the learner clicked Request certificate; null if still waiting on that step. */
  certificateRequestedAt: string | null;
};

export type AdminCredentialsData = {
  pending: AdminCredentialListItem[];
  awarded: AdminCredentialListItem[];
  visible: AdminCredentialListItem[];
  truncatedPending: boolean;
  truncatedAwarded: boolean;
};

export type AdminCredentialsResult =
  | { ok: true; data: AdminCredentialsData }
  | { ok: false; reason: "unauthorized" | "failed" };

export type ChecklistItem = {
  id: string;
  title: string;
  detail: string;
  complete: boolean;
};

export type TimelineEvent = {
  id: string;
  label: string;
  at: string | null;
};

export type AppliedWorkSubmissionReview = {
  id: string;
  summary: string;
  status: string;
  submittedAt: string;
};

export type AdminCredentialReview = {
  id: string;
  learnerName: string;
  credentialName: string;
  type: AcademyCredentialType;
  status: AcademyCredentialStatus;
  awardedAt: string | null;
  expiresAt: string | null;
  termLabel: string;
  checklist: ChecklistItem[];
  timeline: TimelineEvent[];
  identityProvider: string;
  submissions: AppliedWorkSubmissionReview[];
  reviewNote: string | null;
  reviewNoteAction: "award" | "return" | null;
  certificateRequestedAt: string | null;
  /** Canonical 7-digit public certificate id when awarded. */
  certificateNumber: string | null;
};

export type AdminCredentialReviewResult =
  | { ok: true; data: AdminCredentialReview }
  | { ok: false; reason: "unauthorized" | "not_found" | "failed" };

export type AwardCredentialResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "not_found" | "invalid" | "failed"; message: string };

export type ReturnCredentialResult = AwardCredentialResult;

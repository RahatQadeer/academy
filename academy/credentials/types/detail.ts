import type { AcademyCredentialStatus, AcademyCredentialType } from "@/academy/lib/domain";

export type CredentialStepState = "complete" | "current" | "upcoming";

export type CredentialStep = {
  id: string;
  title: string;
  detail: string;
  state: CredentialStepState;
  action?: { label: string; href: string };
};

export type CredentialAssignmentEligibility = {
  total: number;
  submitted: number;
  reviewed: number;
  locked: boolean;
  lockReason: string | null;
};

export type CredentialAssignmentSlot = {
  lessonId: string;
  index: number;
  total: number;
  title: string;
  brief: string;
  submissionInstructions: string;
  submissionStatus: "missing" | "submitted" | "approved" | "returned";
};

export type CredentialDetailData = {
  id: string;
  programId: string;
  programName: string;
  type: AcademyCredentialType;
  status: AcademyCredentialStatus;
  learnerName: string;
  awardedAt: string | null;
  expiresAt: string | null;
  publicId: string;
  /** Canonical 7-digit id when awarded; null before award. */
  certificateNumber: string | null;
  steps: CredentialStep[];
  showIdentityCard: boolean;
  identityCardTitle: string;
  identityCardBody: string;
  termExpiresLabel: string | null;
  nextSubmission: CredentialAssignmentSlot | null;
  moduleCount: number;
  approvedSubmissions: number;
  totalAssignments: number;
  assignmentEligibility: CredentialAssignmentEligibility;
  /** Admin note when the credential was returned for more work. */
  reviewerNote: string | null;
  /** Admin note included when the certificate/credential was awarded. */
  awardNote: string | null;
  /** ISO timestamp when the learner requested certificate issuance; null if not yet requested. */
  certificateRequestedAt: string | null;
};

export type CredentialDetailResult =
  | { ok: true; data: CredentialDetailData }
  | { ok: false; reason: "not_found" | "unauthorized" | "failed" };

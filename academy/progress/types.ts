import type { AcademyEnrollmentStatus } from "@/academy/lib/domain";

export type EnrollmentProgressResult = {
  progressPercent: number;
  status: AcademyEnrollmentStatus;
  completedAt: string | null;
};

export type RecalculateEnrollmentProgressResult =
  | { ok: true; data: EnrollmentProgressResult }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "no_academy_access"
        | "no_learner_capability"
        | "unauthorized"
        | "not_found"
        | "failed";
    };

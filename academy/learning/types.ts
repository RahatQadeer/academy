import type {
  AcademyCredentialStatus,
  AcademyEnrollmentStatus,
  AcademyProgramType,
} from "@/academy/lib/domain";

export type LearningItemAction = {
  label: string;
  href: string;
  variant: "primary" | "secondary" | "muted";
};

export type LearningItem = {
  enrollmentId: string;
  programId: string;
  programName: string;
  programType: AcademyProgramType;
  category: string | null;
  description: string | null;
  status: AcademyEnrollmentStatus;
  progressPercent: number;
  enrolledAt: string;
  completedAt: string | null;
  progressHeadline: string | null;
  credentialId: string | null;
  credentialStatus: AcademyCredentialStatus | null;
  action: LearningItemAction;
  available: boolean;
};

export type MyLearningData = {
  items: LearningItem[];
  truncated: boolean;
};

export type MyLearningResult = { ok: true; data: MyLearningData } | { ok: false };

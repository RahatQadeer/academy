import type { AcademyEnrollmentStatus, AcademyProgramType } from "@/academy/lib/domain";

export type ContinueLearningItem = {
  enrollmentId: string;
  programId: string;
  programName: string;
  programType: AcademyProgramType;
  status: AcademyEnrollmentStatus;
  progressPercent: number;
  headline: string;
  completedLessons: number | null;
  totalLessons: number | null;
};

export type RecommendedProgram = {
  id: string;
  name: string;
  description: string | null;
  type: AcademyProgramType;
  action: "view" | "start";
};

export type DashboardStats = {
  coursesEnrolled: number;
  coursesCompleted: number;
  coursesInProgress: number;
  lessonsCompleted: number;
  programsInProgress: number;
  certificatesEarned: number;
  credentialsAwarded: number;
};

export type LearnerDashboardData = {
  continueLearning: ContinueLearningItem[];
  recommended: RecommendedProgram[];
  stats: DashboardStats;
};

export type DashboardLoadResult =
  | { ok: true; data: LearnerDashboardData }
  | { ok: false };

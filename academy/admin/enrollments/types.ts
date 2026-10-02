import type {
  AcademyEnrollmentStatus,
  AcademyProgramStatus,
  AcademyProgramType,
} from "@/academy/lib/domain";

export const PROGRAM_ROW_LIMIT = 48;
export const ENROLLMENT_SCAN_LIMIT = 2000;

export type EnrollmentKpis = {
  total: number;
  enrolled: number;
  inProgress: number;
  completed: number;
};

export type ProgramEnrollmentRow = {
  programId: string;
  programName: string;
  programType: AcademyProgramType;
  category: string;
  programStatus: AcademyProgramStatus;
  total: number;
  enrolled: number;
  inProgress: number;
  completed: number;
};

export type AdminEnrollmentsData = {
  kpis: EnrollmentKpis;
  programs: ProgramEnrollmentRow[];
  truncatedPrograms: boolean;
  truncatedScan: boolean;
};

export type AdminEnrollmentsResult =
  | { ok: true; data: AdminEnrollmentsData }
  | { ok: false; reason: "unauthorized" | "failed" };

export const PROGRAM_ENROLLMENT_LIMIT = 48;

export type ProgramEnrollmentListItem = {
  enrollmentId: string;
  displayName: string;
  email: string | null;
  status: AcademyEnrollmentStatus;
  progressPercent: number;
  enrolledAt: string;
};

export type ProgramEnrollmentListData = {
  programId: string;
  programName: string;
  items: ProgramEnrollmentListItem[];
  truncated: boolean;
};

export type ProgramEnrollmentListResult =
  | { ok: true; data: ProgramEnrollmentListData }
  | { ok: false; reason: "unauthorized" | "not_found" | "failed" };

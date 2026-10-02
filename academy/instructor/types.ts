import type {
  AcademyAssignmentPermission,
  AcademyProgramStatus,
  AcademyProgramType,
  AcademyPublishRequestStatus,
} from "@/academy/lib/domain";

export const INSTRUCTOR_PROGRAM_LIMIT = 48;

export type InstructorProgramItem = {
  assignmentId: string;
  programId: string;
  programName: string;
  programType: AcademyProgramType;
  category: string | null;
  permissionLevel: AcademyAssignmentPermission;
  programStatus: AcademyProgramStatus;
  updatedAt: string;
  moduleCount: number;
  lessonCount: number;
  publishRequestStatus: AcademyPublishRequestStatus | null;
  publishRequestedAt: string | null;
};

export type InstructorDashboardStats = {
  assigned: number;
  drafts: number;
  pendingApproval: number;
  published: number;
  pendingReviews: number;
};

export type InstructorDashboardData = {
  programs: InstructorProgramItem[];
  attention: InstructorProgramItem[];
  stats: InstructorDashboardStats;
  truncated: boolean;
};

export type InstructorDashboardResult =
  | { ok: true; data: InstructorDashboardData }
  | { ok: false };

import type {
  AcademyProgramStatus,
  AcademyProgramType,
} from "@/academy/lib/domain";

/** Shared staff profile list paging (Admin / Instructor detail). */
export const STAFF_PAGE_SIZE = 10;
export const STAFF_LIST_LIMIT = 100;

export type StaffCreatedProgram = {
  id: string;
  name: string;
  status: AcademyProgramStatus;
  type: AcademyProgramType;
  category: string;
  updatedAt: string | null;
};

export type StaffPublishRequest = {
  id: string;
  programId: string;
  programName: string;
  status: "pending" | "approved" | "rejected";
  at: string | null;
};

export type StaffPersonRef = {
  userId: string;
  displayName: string;
  email: string | null;
  at: string | null;
};

export type StaffAssignmentRef = {
  id: string;
  programId: string;
  programName: string;
  instructorUserId: string;
  instructorName: string;
  at: string | null;
};

export type AdminStaffMetrics = {
  coursesCreated: number;
  approvalsAccepted: number;
  approvalsReturned: number;
  instructorsGranted: number;
  instructorsRevoked: number;
  assignmentsMade: number;
};

export type InstructorStaffMetrics = {
  coursesCreated: number;
  publishRequestsSent: number;
  publishPending: number;
  publishApproved: number;
  publishReturned: number;
  programsAssigned: number;
};

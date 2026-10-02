import type {
  AcademyAssignmentPermission,
  AcademyProgramStatus,
  AcademyProgramType,
} from "@/academy/lib/domain";

export const INSTRUCTOR_LIMIT = 48;
export const PROGRAM_LIMIT = 48;
export const ASSIGNMENT_LIMIT = 48;
export const USER_SEARCH_LIMIT = 12;
export const USER_SEARCH_MIN = 2;

export type InstructorMembershipStatus = "active" | "suspended";

export type AdminInstructorListItem = {
  userId: string;
  displayName: string;
  email: string | null;
  membershipStatus: InstructorMembershipStatus;
  assignmentCount: number;
  assignmentSummary: string;
  assignedPrograms: string[];
  grantedAt: string | null;
};

export type InstructorActivityItem = {
  id: string;
  label: string;
  occurredAt: string;
};

export type InstructorProgramOption = {
  id: string;
  name: string;
  status: AcademyProgramStatus;
};

export type PendingInstructorInvite = {
  id: string;
  email: string;
  displayName: string;
  expiresAt: string | null;
  sentAt: string | null;
  expired: boolean;
};

export type AdminInstructorListData = {
  active: AdminInstructorListItem[];
  suspended: AdminInstructorListItem[];
  pendingInvites: PendingInstructorInvite[];
  truncatedActive: boolean;
  truncatedSuspended: boolean;
};

export type AdminInstructorListResult =
  | { ok: true; data: AdminInstructorListData }
  | { ok: false; reason: "unauthorized" | "failed" };

export type InstructorModuleOption = {
  id: string;
  title: string;
  sortOrder: number;
};

export type InstructorAssignmentItem = {
  id: string;
  programId: string;
  programName: string;
  programType: AcademyProgramType;
  category: string;
  programStatus: AcademyProgramStatus;
  permission: AcademyAssignmentPermission;
  canPublishWithoutApproval: boolean;
  moduleIds: string[];
  modules: InstructorModuleOption[];
  createdAt: string;
};

export type AssignableProgram = {
  id: string;
  name: string;
  status: AcademyProgramStatus;
};

export type InstructorAssignmentDetail = {
  userId: string;
  displayName: string;
  email: string | null;
  membershipStatus: InstructorMembershipStatus;
  grantedAt: string | null;
  assignments: InstructorAssignmentItem[];
  assignablePrograms: AssignableProgram[];
  recentActivity: InstructorActivityItem[];
  metrics: {
    coursesCreated: number;
    publishRequestsSent: number;
    publishPending: number;
    publishApproved: number;
    publishReturned: number;
    programsAssigned: number;
  };
  createdPrograms: {
    id: string;
    name: string;
    status: AcademyProgramStatus;
    type: AcademyProgramType;
    category: string;
    updatedAt: string | null;
  }[];
  publishRequests: {
    id: string;
    programId: string;
    programName: string;
    status: "pending" | "approved" | "rejected";
    at: string | null;
  }[];
};

export type InstructorAssignmentLoadResult =
  | { ok: true; data: InstructorAssignmentDetail }
  | { ok: false; reason: "unauthorized" | "not_instructor" | "not_found" | "failed" };

export type AssignInstructorInput = {
  userId: string;
  programId: string;
  permission: string;
  moduleIds?: string[];
  canPublishWithoutApproval?: boolean;
};

export type AssignInstructorResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "unauthorized"
        | "not_instructor"
        | "not_found"
        | "invalid"
        | "already_assigned"
        | "failed";
      message?: string;
    };

export type RevokeAssignmentResult =
  | { ok: true; userId: string; programId: string }
  | { ok: false; reason: "unauthorized" | "not_found" | "failed"; message?: string };

export type UpdateInstructorAssignmentInput = {
  assignmentId: string;
  permission: string;
  moduleIds: string[];
  canPublishWithoutApproval?: boolean;
};

export type UpdateInstructorAssignmentResult =
  | { ok: true; userId: string; programId: string }
  | {
      ok: false;
      reason: "unauthorized" | "not_found" | "invalid" | "failed";
      message?: string;
    };

export type InstructorGrantCandidate = {
  userId: string;
  displayName: string;
  email: string | null;
  instructorStatus: "none" | InstructorMembershipStatus;
  /** Other active Academy role that blocks granting Instructor. */
  conflictRole: "learner" | "admin" | "super_admin" | null;
};

export type UserSearchResult =
  | { ok: true; data: { query: string; users: InstructorGrantCandidate[] } }
  | { ok: false; reason: "unauthorized" | "invalid" | "failed"; message?: string };

export type GrantInstructorOutcome = "granted" | "reactivated" | "already_instructor";

export type GrantInstructorResult =
  | { ok: true; outcome: GrantInstructorOutcome; userId: string }
  | {
      ok: false;
      reason: "unauthorized" | "not_found" | "failed" | "role_conflict";
      message?: string;
      conflictRole?: "learner" | "instructor" | "admin" | "super_admin";
    };

export type RevokeInstructorRoleResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "unauthorized" | "not_found" | "failed"; message?: string };

export type GrantInstructorWithAssignmentsInput = {
  email: string;
  displayName: string;
  programIds: string[];
};

export type InviteInstructorResult =
  | {
      ok: true;
      displayName: string;
      email: string;
      mode: "existing" | "invited";
      emailSent: boolean;
      userId: string | null;
      programNames: string[];
    }
  | {
      ok: false;
      reason: "unauthorized" | "invalid" | "failed" | "email_failed";
      message?: string;
    };

export type GrantInstructorWithAssignmentsResult = InviteInstructorResult;

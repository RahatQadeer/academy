export const ADMIN_LIMIT = 48;
export const USER_SEARCH_LIMIT = 12;
export const USER_SEARCH_MIN = 2;

export type AcademyAdminMembershipStatus = "active" | "suspended";

export type AcademyAdminListItem = {
  userId: string;
  displayName: string;
  email: string | null;
  membershipStatus: AcademyAdminMembershipStatus;
};

export type PendingAdminInvite = {
  id: string;
  email: string;
  displayName: string;
  expiresAt: string | null;
  sentAt: string | null;
  expired: boolean;
};

export type AcademyAdminListData = {
  active: AcademyAdminListItem[];
  suspended: AcademyAdminListItem[];
  pendingInvites: PendingAdminInvite[];
  activeCount: number;
  truncatedActive: boolean;
  truncatedSuspended: boolean;
};

export type AcademyAdminListResult =
  | { ok: true; data: AcademyAdminListData }
  | { ok: false; reason: "unauthorized" | "failed" };

export type AdminGrantCandidate = {
  userId: string;
  displayName: string;
  email: string | null;
  adminStatus: "none" | AcademyAdminMembershipStatus;
  /** Other active Academy role that blocks granting Admin. */
  conflictRole: "learner" | "instructor" | "super_admin" | null;
};

export type AdminUserSearchResult =
  | { ok: true; data: { query: string; users: AdminGrantCandidate[] } }
  | { ok: false; reason: "unauthorized" | "invalid" | "failed"; message?: string };

export type GrantAcademyAdminOutcome = "granted" | "reactivated" | "already_admin";

export type GrantAcademyAdminResult =
  | { ok: true; outcome: GrantAcademyAdminOutcome; userId: string }
  | {
      ok: false;
      reason: "unauthorized" | "not_found" | "failed" | "role_conflict";
      message?: string;
      conflictRole?: "learner" | "instructor" | "admin" | "super_admin";
    };

export type InviteAcademyAdminResult =
  | {
      ok: true;
      displayName: string;
      email: string;
      mode: "existing" | "invited";
      emailSent: boolean;
      userId: string | null;
      message?: string;
    }
  | {
      ok: false;
      reason: "unauthorized" | "invalid" | "failed" | "email_failed";
      message?: string;
    };

export type RevokeAcademyAdminResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      reason: "unauthorized" | "not_found" | "last_admin" | "failed";
      message?: string;
    };

export type RevokeAcademyLearnerResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      reason: "unauthorized" | "not_found" | "failed";
      message?: string;
    };

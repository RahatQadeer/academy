export const USER_PAGE_SIZE = 20;
export const USER_SEARCH_MIN = 0; // empty query lists everyone

export type ManagedUserStatus = "active" | "suspended" | "deleted";

export type ManagedAcademyRole = "super_admin" | "admin" | "instructor" | "learner";

export type ManagedUser = {
  userId: string;
  displayName: string;
  email: string | null;
  status: ManagedUserStatus;
  academyRole: ManagedAcademyRole;
  /** Active Academy Super Admin — account actions blocked. */
  isAcademySuperAdmin: boolean;
};

export type ListManagedUsersInput = {
  page?: number;
  query?: string;
  status?: ManagedUserStatus | "all";
  role?: ManagedAcademyRole | "all";
};

export type ListManagedUsersResult =
  | {
      ok: true;
      data: {
        users: ManagedUser[];
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        query: string;
        status: ManagedUserStatus | "all";
        role: ManagedAcademyRole | "all";
      };
    }
  | {
      ok: false;
      reason: "unauthorized" | "unavailable" | "failed";
      message?: string;
    };

/** @deprecated Prefer listManagedUsers — kept for action typing compatibility. */
export type SearchManagedUsersResult = ListManagedUsersResult;

export type SetUserStatusAction = "suspend" | "restore" | "soft_delete" | "restore_deleted";

export type SetUserStatusResult =
  | { ok: true; userId: string; status: ManagedUserStatus }
  | {
      ok: false;
      reason:
        | "unauthorized"
        | "not_found"
        | "unavailable"
        | "failed"
        | "self"
        | "protected"
        | "invalid";
      message?: string;
    };

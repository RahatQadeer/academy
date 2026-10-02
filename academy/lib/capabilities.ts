import "server-only";

import {
  canAccessAdminArea,
  canAccessInstructorArea,
  canAccessLearnerArea,
  canAccessSuperAdminArea,
  isAcademyAdmin,
  isAcademySuperAdmin,
  isInstructor,
  isLearner,
} from "./authorization";
import {
  roleSetGrantsCapability,
  type AcademyCapability,
} from "./capabilityMatrix";
import { getActiveAcademyRoles } from "./membershipRoles";
import type { AcademyActor } from "./types";

export type { AcademyCapability } from "./capabilityMatrix";

/**
 * Backend capability check.
 * Area access keeps entitlement-aware helpers; privilege caps use the matrix
 * (Ticket 10) after confirming the matching area gate so Admins cannot escalate.
 */
export async function canPerform(
  user: AcademyActor,
  capability: AcademyCapability,
): Promise<boolean> {
  switch (capability) {
    case "learner.area":
      return canAccessLearnerArea(user);
    case "instructor.area":
      return canAccessInstructorArea(user);
    case "admin.area":
      return canAccessAdminArea(user);
    case "super_admin.area":
      return canAccessSuperAdminArea(user);
    case "settings.manage": {
      if (!(await canAccessAdminArea(user))) return false;
      const roles = await getActiveAcademyRoles(user.id);
      return roleSetGrantsCapability(roles, capability);
    }
    default: {
      // Privileged ops: Super Admin area + matrix (admins, users, roles, audit, permissions, global settings).
      if (!(await canAccessSuperAdminArea(user))) return false;
      const roles = await getActiveAcademyRoles(user.id);
      return roleSetGrantsCapability(roles, capability);
    }
  }
}

/** Convenience for routes that only need a role ladder summary. */
export async function academyAuthSummary(user: AcademyActor) {
  const [learner, instructor, admin, superAdmin] = await Promise.all([
    isLearner(user),
    isInstructor(user),
    isAcademyAdmin(user),
    isAcademySuperAdmin(user),
  ]);
  return {
    isLearner: learner,
    isInstructor: instructor,
    /** Includes Super Admin (inherits Admin). */
    isAcademyAdmin: admin,
    isAcademySuperAdmin: superAdmin,
  };
}

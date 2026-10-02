import type { AcademyRole } from "./types";

const ROLE_LABEL: Record<AcademyRole, string> = {
  learner: "Learner",
  instructor: "Instructor",
  admin: "Academy Admin",
  super_admin: "Academy Super Admin",
};

/**
 * One email / user may hold only one active Academy role.
 * Priority: super_admin > admin > instructor > learner.
 */
export function pickExclusiveAcademyRole(roles: Iterable<AcademyRole>): AcademyRole | null {
  const set = roles instanceof Set ? roles : new Set(roles);
  if (set.has("super_admin")) return "super_admin";
  if (set.has("admin")) return "admin";
  if (set.has("instructor")) return "instructor";
  if (set.has("learner")) return "learner";
  return null;
}

export function academyRoleLabel(role: AcademyRole) {
  return ROLE_LABEL[role];
}

export function exclusiveRoleConflictMessage(intended: AcademyRole, activeOther: AcademyRole) {
  return `This email already has an active ${ROLE_LABEL[activeOther]} role. One email can hold only one Academy role. Remove the ${ROLE_LABEL[activeOther]} role first, then grant ${ROLE_LABEL[intended]} — or create a separate account with a different email.`;
}

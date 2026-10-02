/**
 * Academy capability matrix — single source of truth for which exclusive
 * Academy role grants which capability (Ticket 10).
 *
 * Permissions are role-bound. Super Admins change who holds them by granting
 * or suspending Admin / Super Admin memberships — not via a separate grants table.
 */

import type { AcademyRole } from "./types";

export type AcademyCapability =
  | "learner.area"
  | "instructor.area"
  | "admin.area"
  | "super_admin.area"
  | "admins.view"
  | "admins.create"
  | "admins.update"
  | "admins.suspend"
  | "admins.delete"
  | "users.view"
  | "users.suspend"
  | "users.delete"
  | "roles.manage"
  | "settings.manage"
  | "settings.manage_global"
  | "audit_logs.view"
  | "permissions.view"
  | "permissions.manage";

export type CapabilityGroup =
  | "areas"
  | "admins"
  | "users"
  | "roles"
  | "settings"
  | "audit"
  | "permissions";

export type CapabilityDefinition = {
  id: AcademyCapability;
  label: string;
  description: string;
  group: CapabilityGroup;
  /** Exclusive roles that grant this capability. Super Admin inherits Admin caps. */
  roles: AcademyRole[];
};

export const ACADEMY_CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = [
  {
    id: "learner.area",
    label: "Learner area",
    description: "Access learner dashboard, learning, and explore.",
    group: "areas",
    roles: ["learner"],
  },
  {
    id: "instructor.area",
    label: "Instructor area",
    description: "Access instructor tools and assigned programs.",
    group: "areas",
    roles: ["instructor"],
  },
  {
    id: "admin.area",
    label: "Admin area",
    description: "Access the Academy Admin dashboard and catalog ops.",
    group: "areas",
    roles: ["admin", "super_admin"],
  },
  {
    id: "super_admin.area",
    label: "Super Admin area",
    description: "Access privileged Super Admin surfaces.",
    group: "areas",
    roles: ["super_admin"],
  },
  {
    id: "admins.view",
    label: "View Admins",
    description: "List Academy Admins.",
    group: "admins",
    roles: ["super_admin"],
  },
  {
    id: "admins.create",
    label: "Create Admins",
    description: "Grant the Academy Admin role.",
    group: "admins",
    roles: ["super_admin"],
  },
  {
    id: "admins.update",
    label: "Update Admins",
    description: "Change Academy Admin membership state.",
    group: "admins",
    roles: ["super_admin"],
  },
  {
    id: "admins.suspend",
    label: "Suspend Admins",
    description: "Suspend Academy Admin access.",
    group: "admins",
    roles: ["super_admin"],
  },
  {
    id: "admins.delete",
    label: "Remove Admin access",
    description: "Revoke Academy Admin membership.",
    group: "admins",
    roles: ["super_admin"],
  },
  {
    id: "users.view",
    label: "View users",
    description: "Search the privileged user directory.",
    group: "users",
    roles: ["super_admin"],
  },
  {
    id: "users.suspend",
    label: "Suspend users",
    description: "Suspend or restore accounts.",
    group: "users",
    roles: ["super_admin"],
  },
  {
    id: "users.delete",
    label: "Soft-delete users",
    description: "Soft-delete or restore soft-deleted accounts.",
    group: "users",
    roles: ["super_admin"],
  },
  {
    id: "roles.manage",
    label: "Manage roles",
    description: "Grant or suspend Academy Super Admin.",
    group: "roles",
    roles: ["super_admin"],
  },
  {
    id: "settings.manage",
    label: "Manage settings",
    description: "Change operational Academy settings.",
    group: "settings",
    roles: ["admin", "super_admin"],
  },
  {
    id: "settings.manage_global",
    label: "Manage platform settings",
    description: "Change identity verification and other Super-Admin-only settings.",
    group: "settings",
    roles: ["super_admin"],
  },
  {
    id: "audit_logs.view",
    label: "View audit logs",
    description: "Read sensitive administrative audit events.",
    group: "audit",
    roles: ["super_admin"],
  },
  {
    id: "permissions.view",
    label: "View permissions",
    description: "View the Academy capability matrix.",
    group: "permissions",
    roles: ["super_admin"],
  },
  {
    id: "permissions.manage",
    label: "Manage permissions",
    description:
      "Change who holds Admin and Super Admin capabilities by assigning roles (not free-form grants).",
    group: "permissions",
    roles: ["super_admin"],
  },
] as const;

const BY_ID = new Map(
  ACADEMY_CAPABILITY_DEFINITIONS.map((item) => [item.id, item] as const),
);

export function capabilityDefinition(id: AcademyCapability): CapabilityDefinition | undefined {
  return BY_ID.get(id);
}

/** True when any of the actor's active roles grants the capability. */
export function roleSetGrantsCapability(
  roles: Iterable<AcademyRole>,
  capability: AcademyCapability,
): boolean {
  const def = BY_ID.get(capability);
  if (!def) return false;
  const set = roles instanceof Set ? roles : new Set(roles);
  return def.roles.some((role) => set.has(role));
}

export function capabilitiesForRole(role: AcademyRole): AcademyCapability[] {
  return ACADEMY_CAPABILITY_DEFINITIONS.filter((item) => item.roles.includes(role)).map(
    (item) => item.id,
  );
}

export const CAPABILITY_GROUP_LABEL: Record<CapabilityGroup, string> = {
  areas: "Areas",
  admins: "Admins",
  users: "Users",
  roles: "Roles",
  settings: "Settings",
  audit: "Audit",
  permissions: "Permissions",
};

export const MATRIX_ROLES: AcademyRole[] = [
  "learner",
  "instructor",
  "admin",
  "super_admin",
];

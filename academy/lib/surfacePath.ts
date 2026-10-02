import { ACADEMY_ROLE_THEME } from "./roleTheme";
import type { AcademyRole } from "./types";

export function academyPathFromSlug(slug?: string[]) {
  const rest = (slug ?? []).filter(Boolean).join("/");
  return rest ? `/academy/${rest}` : "/academy";
}

function hasAdminSurface(roles: Set<AcademyRole>) {
  return roles.has("admin") || roles.has("super_admin");
}

export function academyContextFromPath(pathname: string, roles: Set<AcademyRole>): AcademyRole {
  if (pathname.startsWith("/academy/admin") && hasAdminSurface(roles)) {
    return roles.has("super_admin") ? "super_admin" : "admin";
  }
  if (
    (pathname.startsWith("/academy/instructor") || pathname.startsWith("/academy/lms")) &&
    roles.has("instructor")
  ) {
    return "instructor";
  }
  if (roles.has("super_admin")) return "super_admin";
  if (roles.has("admin")) return "admin";
  if (roles.has("instructor")) return "instructor";
  if (roles.has("learner")) return "learner";
  // Default shell before membership resolves — new accounts are Learners.
  return "learner";
}

export function academyHomeForRole(role: AcademyRole) {
  if (role === "super_admin" || role === "admin") return "/academy/admin";
  if (role === "instructor") return "/academy/instructor";
  return "/academy";
}

export function academyRoleTag(role: AcademyRole) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  if (role === "instructor") return "Instructor";
  return "Learner";
}

export function academyRoleTagStyle(role: AcademyRole) {
  const theme = ACADEMY_ROLE_THEME[role];
  return { background: theme.tint, color: theme.accent };
}

/** Shared shell accents — follow the active Academy role palette. */
export const ACADEMY_SHELL = {
  activeBg: "var(--accent-tint)",
  activeFg: "var(--accent)",
  activeBorder: "var(--accent)",
  badgeBg: "var(--accent)",
} as const;

import "server-only";

import type { NavItem } from "@/base/components/Sidebar";
import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import type { AcademyRole } from "./types";
import { academyContextFromPath } from "./surfacePath";
import type { AcademyNavGroup } from "./navTypes";
import { getActiveAcademyRoles } from "./membershipRoles";
import { ensureAcademyEntitlement, ensureLearnerMembership } from "./provision";

const LEARNER_NAV_GROUPS: AcademyNavGroup[] = [
  {
    label: "Study",
    items: [
      { href: "/academy", label: "Dashboard" },
      { href: "/academy/learning", label: "My Learning" },
      { href: "/academy/explore", label: "Explore" },
    ],
  },
  {
    label: "Outcomes",
    items: [
      { href: "/academy/credentials", label: "Certificates" },
      { href: "/academy/verify", label: "Verify" },
      { href: "/academy/resources", label: "Resources" },
    ],
  },
];

const INSTRUCTOR_NAV_GROUPS: AcademyNavGroup[] = [
  {
    label: "Teach",
    items: [
      { href: "/academy/instructor", label: "Dashboard" },
      { href: "/academy/instructor/programs", label: "Programs" },
      { href: "/academy/instructor/question-bank", label: "Question bank" },
      {
        href: "/academy/instructor/reviews?status=submitted",
        label: "Reviews",
        badgeKey: "pendingReviews",
      },
    ],
  },
];

const ADMIN_NAV_GROUPS: AcademyNavGroup[] = [
  {
    label: "Manage",
    items: [
      { href: "/academy/admin", label: "Dashboard" },
      { href: "/academy/admin/programs", label: "Programs" },
      { href: "/academy/admin/question-bank", label: "Question bank" },
      { href: "/academy/admin/enrollments", label: "Learners", badgeKey: "enrollments" },
      { href: "/academy/admin/instructors", label: "Instructors" },
      { href: "/academy/admin/approvals", label: "Publish Approvals", badgeKey: "pendingApprovals" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/academy/admin/credentials", label: "Certificates", badgeKey: "credentialReview" },
      { href: "/academy/admin/settings", label: "Settings" },
    ],
  },
];

const SUPER_ADMIN_NAV_GROUPS: AcademyNavGroup[] = [
  {
    label: "People",
    items: [
      { href: "/academy/admin", label: "Dashboard" },
      { href: "/academy/admin/users", label: "Users" },
      { href: "/academy/admin/instructors", label: "Instructors" },
      { href: "/academy/admin/admins", label: "Admins" },
      { href: "/academy/admin/enrollments", label: "Learners", badgeKey: "enrollments" },
    ],
  },
  {
    label: "Workspace",
    items: [{ href: "/academy/admin/audit", label: "Activity log" }],
  },
];

function flattenGroups(groups: AcademyNavGroup[]): NavItem[] {
  return groups.flatMap((group) =>
    group.items.map((item) => ({ href: item.href, label: item.label })),
  );
}

export type AcademyNavResult = {
  items: NavItem[];
  groups: AcademyNavGroup[] | null;
  context: AcademyRole;
  roles: AcademyRole[];
};

export async function buildAcademyNav(pathname: string): Promise<AcademyNavResult> {
  let roles = new Set<AcademyRole>();
  if (isSupabaseConfigured()) {
    const profile = await getSessionProfile();
    if (profile) {
      const user = { id: profile.user.id };
      if (await ensureAcademyEntitlement(user)) {
        await ensureLearnerMembership(user);
        roles = await getActiveAcademyRoles(profile.user.id);
      }
    }
  }

  const context = academyContextFromPath(pathname, roles);
  const roleList = [...roles];

  if (context === "admin" || context === "super_admin") {
    const groups = context === "super_admin" ? SUPER_ADMIN_NAV_GROUPS : ADMIN_NAV_GROUPS;
    return {
      items: flattenGroups(groups),
      groups,
      context,
      roles: roleList,
    };
  }

  if (context === "instructor") {
    return {
      items: flattenGroups(INSTRUCTOR_NAV_GROUPS),
      groups: INSTRUCTOR_NAV_GROUPS,
      context: "instructor",
      roles: roleList,
    };
  }

  return {
    items: flattenGroups(LEARNER_NAV_GROUPS),
    groups: LEARNER_NAV_GROUPS,
    context: "learner",
    roles: roleList,
  };
}

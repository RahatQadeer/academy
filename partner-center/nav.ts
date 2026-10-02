import type { NavItem } from "@/base/components/Sidebar";

const TEAM_HREF = "/partner-center/team";

export const NAV: NavItem[] = [
  { href: "/partner-center", label: "Home" },

  { href: "/partner-center/referrals", label: "Referrals", group: "Grow" },
  {
    href: "/partner-center/opportunities",
    label: "Opportunities",
    group: "Grow",
  },
  { href: "/partner-center/earnings", label: "Earnings", group: "Grow" },
  { href: "/partner-center/links", label: "Referral Link", group: "Grow" },

  { href: TEAM_HREF, label: "Company & Team", group: "Workspace" },
  { href: "/partner-center/documents", label: "Documents", group: "Workspace" },

  {
    href: "/partner-center/messages",
    label: "Messages",
    group: "Communication",
  },
];

/** Company partners see Company & Team; individuals see Partner details (same route). */
export function partnerNavFor(individual: boolean): NavItem[] {
  if (!individual) return NAV;
  return NAV.map((item) =>
    item.href === TEAM_HREF
      ? { ...item, label: "Partner details" }
      : item,
  );
}

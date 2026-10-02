import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

export type PartnerCenterAdminNavItem = {
  href: string;
  label: string;
  /** Section heading — consecutive items with the same group share one label. */
  group?: string;
};

/**
 * Staff rail, grouped like the partner-facing product: lone top/bottom items,
 * then Partners → Grow → Finance → Communication.
 */
export const PARTNER_CENTER_ADMIN_NAV: PartnerCenterAdminNavItem[] = [
  { href: PC_ADMIN.root, label: "Dashboard" },

  { href: PC_ADMIN.applications, label: "Applications", group: "Partners" },
  { href: PC_ADMIN.partners, label: "Partners", group: "Partners" },

  { href: PC_ADMIN.referrals, label: "Referrals", group: "Grow" },
  { href: PC_ADMIN.opportunities, label: "Opportunities", group: "Grow" },

  { href: PC_ADMIN.payouts, label: "Payouts", group: "Finance" },
  { href: PC_ADMIN.tax1099, label: "1099", group: "Finance" },

  { href: PC_ADMIN.messages, label: "Messages", group: "Communication" },

  { href: "/super-admin/users", label: "Partner Admins" },

  { href: PC_ADMIN.programConfig, label: "Program config" },
];

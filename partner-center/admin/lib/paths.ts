export const PA_ADMIN = {
  root: "/partner-center/admin",
  signin: "/partner-center/admin/signin",
  signup: "/partner-center/admin/signup",
  forgotPassword: "/partner-center/admin/forgot-password",
  resetPassword: "/partner-center/admin/reset-password",
  applications: "/partner-center/admin/applications",
  application: (id: string) => `/partner-center/admin/applications/${id}`,
  partners: "/partner-center/admin/partners",
  partner: (id: string) => `/partner-center/admin/partners/${id}`,
  referrals: "/partner-center/admin/referrals",
  referral: (id: string) => `/partner-center/admin/referrals/${id}`,
  opportunities: "/partner-center/admin/opportunities",
  opportunity: (id: string) => `/partner-center/admin/opportunities/${id}`,
  payouts: "/partner-center/admin/payouts",
  commission: "/partner-center/admin/commission",
  messages: "/partner-center/admin/messages",
  message: (profileId: string, channel = "partner_manager") =>
    `/partner-center/admin/messages/${profileId}?channel=${channel}`,
} as const;

export type PartnerAdminNavItem = {
  href: string;
  label: string;
  group?: string;
};

export const PARTNER_ADMIN_NAV: PartnerAdminNavItem[] = [
  { href: PA_ADMIN.root, label: "Dashboard" },
  { href: PA_ADMIN.applications, label: "Applications", group: "Partners" },
  { href: PA_ADMIN.partners, label: "Partners", group: "Partners" },
  { href: PA_ADMIN.referrals, label: "Referrals", group: "Grow" },
  { href: PA_ADMIN.opportunities, label: "Opportunities", group: "Grow" },
  { href: PA_ADMIN.commission, label: "Commission rules", group: "Finance" },
  { href: PA_ADMIN.payouts, label: "Payouts", group: "Finance" },
  { href: PA_ADMIN.messages, label: "Messages", group: "Communication" },
];

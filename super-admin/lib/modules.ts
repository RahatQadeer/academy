import { PRODUCTS } from "@/base/switcher/products";

export type SuperAdminModule = {
  key: string;
  name: string;
  description: string;
  href: string;
  iconBg: string;
  iconFg: string;
  glyph: string;
  available: boolean;
  actionLabel: string;
};

/**
 * What each product's admin covers, where staff have one.
 *
 * Keyed by the product rather than listed separately, so a tool lands inside
 * the product it administers. Portal seat limits are set per workspace, but
 * they are a Client Portal rule — what a client account may hold — so they
 * belong here and not in a platform section of their own.
 */
const ADMIN_MODULES: Record<string, { href: string; description: string }> = {
  partner_center: {
    href: "/super-admin/partner-center",
    description:
      "Applications, partners, opportunities, earnings, and program configuration.",
  },
  client_portal: {
    href: "/super-admin/client-portal",
    description:
      "Portal seats: how many people each client account may hold, per workspace.",
  },
};

/** Four product modules; the ones with an entry above have somewhere to go. */
export const SUPER_ADMIN_MODULES: SuperAdminModule[] = PRODUCTS.map((product) => {
  const admin = ADMIN_MODULES[product.key];
  return {
    key: product.key,
    name: product.name,
    description: admin ? admin.description : product.description,
    href: admin ? admin.href : "#",
    iconBg: product.iconBg,
    iconFg: product.iconFg,
    glyph: product.glyph,
    available: Boolean(admin),
    actionLabel: admin ? "Open admin" : "Coming soon",
  };
});

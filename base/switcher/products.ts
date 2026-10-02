import type { ProductKey } from "@/base/types";

/** Whitby's product entry — Figma 0.9 Workspace Overview, before Home. */
export const WHITBY_ENTRY = "/whitbyos/workspaces";

/**
 * Home stays `/whitbyos`. Entering the product (switcher, sole entitlement,
 * `next=/whitbyos`) lands on Workspace Overview instead.
 */
export function whitbyEntryPath(path: string) {
  const pathname = path.split("?")[0];
  if (pathname === "/whitbyos" || pathname === "/whitbyos/") return WHITBY_ENTRY;
  return path;
}

export type ProductMeta = {
  key: ProductKey;
  slug: "whitbyos" | "client-portal" | "academy" | "partner-center";
  name: string;
  href: string;
  tagline: string;
  description: string;
  comingSoon: string;
  glyph: string;
  iconBg: string;
  iconFg: string;
  applyHref?: string;
  exploreLabel: string;
};

export const PRODUCTS: ProductMeta[] = [
  {
    key: "whitbyos",
    slug: "whitbyos",
    name: "Whitby",
    href: WHITBY_ENTRY,
    tagline: "Professional platform",
    description: "Coordinate complex client work from request to follow-through.",
    comingSoon: "Whitby, coming soon",
    glyph: "W",
    iconBg: "var(--module-whitby-bg)",
    iconFg: "var(--module-whitby-fg)",
    exploreLabel: "Explore Whitby",
  },
  {
    key: "client_portal",
    slug: "client-portal",
    name: "Client Portal",
    href: "/client-portal",
    tagline: "Preview as client",
    description: "Give clients one place to respond, approve, and stay informed.",
    comingSoon: "Client Portal, coming soon",
    glyph: "CP",
    iconBg: "var(--module-portal-bg)",
    iconFg: "var(--module-portal-fg)",
    exploreLabel: "Explore portal",
  },
  {
    key: "academy",
    slug: "academy",
    name: "Academy",
    href: "/academy",
    tagline: "Learning & certification",
    description: "Professional education for intelligent coordination.",
    comingSoon: "Academy, coming soon",
    glyph: "A",
    iconBg: "var(--module-academy-bg)",
    iconFg: "var(--module-academy-fg)",
    exploreLabel: "Explore Academy",
  },
  {
    key: "partner_center",
    slug: "partner-center",
    name: "Partner Center",
    href: "/partner-center",
    tagline: "Refer & earn",
    description: "Referrals, introductions, and partnership administration.",
    comingSoon: "Partner Center, coming soon",
    glyph: "PC",
    iconBg: "var(--module-partner-bg)",
    iconFg: "var(--module-partner-fg)",
    applyHref: "/partner-center/apply",
    exploreLabel: "Apply",
  },
];

export function getProduct(key: ProductKey) {
  const product = PRODUCTS.find((item) => item.key === key);
  if (!product) {
    throw new Error(`Unknown product: ${key}`);
  }
  return product;
}

export function getProductBySlug(slug: string) {
  return PRODUCTS.find((item) => item.slug === slug) ?? null;
}

export const SWITCHER_UNENTITLED =
  process.env.NEXT_PUBLIC_SWITCHER_UNENTITLED === "hide" ? "hide" : "grey";

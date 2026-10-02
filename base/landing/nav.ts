import type { ModuleKey } from "@/base/landing/content";
import { moduleHref } from "@/base/landing/modules";
import { PLATFORM_OVERVIEW, platformCapabilityHref } from "@/base/landing/platform";

export type PrimaryNavItem =
  | { id: "platform" | "solutions" | "resources"; label: string; hasMenu: true }
  | { id: string; label: string; hasMenu?: false; href: string };

export const PRIMARY_NAV: PrimaryNavItem[] = [
  { id: "platform", label: "Platform", hasMenu: true },
  { id: "academy", label: "Academy", href: moduleHref("academy") },
  { id: "solutions", label: "Solutions", hasMenu: true },
  { id: "pricing", label: "Pricing", href: "/#pricing" },
  { id: "resources", label: "Resources", hasMenu: true },
];

export const PLATFORM_OVERVIEW_LINK = {
  title: "Platform overview",
  description: "All capabilities on one page — Whitby, Portal, Academy, Partner.",
  href: PLATFORM_OVERVIEW.href,
} as const;

/** Platform — what PA can do (modules / capabilities). */
export const PLATFORM_MODULES: Array<{
  key: ModuleKey;
  title: string;
  description: string;
  href: string;
}> = [
  {
    key: "whitby",
    title: "Whitby",
    description: "Draft and run the work plan for any request.",
    href: platformCapabilityHref("whitby"),
  },
  {
    key: "portal",
    title: "Client Portal",
    description: "What the principal sees — without the noise.",
    href: platformCapabilityHref("portal"),
  },
  {
    key: "academy",
    title: "Academy",
    description: "The CPA credential and specialty endorsements.",
    href: platformCapabilityHref("academy"),
  },
  {
    key: "partner",
    title: "Partner Center",
    description: "Referrals, protection windows, and commissions.",
    href: platformCapabilityHref("partner"),
  },
];

/** Solutions — who uses PA and what they use it to accomplish. */
export type SolutionsNavLink = { title: string; href: string };

export const SOLUTIONS_COLUMNS: ReadonlyArray<{
  items: ReadonlyArray<SolutionsNavLink>;
}> = [
  {
    items: [
      { title: "Executive Support", href: moduleHref("whitby") },
      { title: "Family Offices", href: moduleHref("whitby") },
      { title: "Residence Operations", href: moduleHref("whitby") },
      { title: "Real Estate", href: moduleHref("whitby") },
    ],
  },
  {
    items: [
      { title: "Private Client Services", href: moduleHref("portal") },
      { title: "Independent Professionals", href: moduleHref("academy") },
      { title: "Organizations & Teams", href: moduleHref("partner") },
      { title: "Travel & Hospitality", href: moduleHref("whitby") },
    ],
  },
  {
    items: [
      { title: "Personal & Family", href: moduleHref("portal") },
      { title: "International Living", href: moduleHref("whitby") },
      { title: "Healthcare Navigation", href: moduleHref("whitby") },
      { title: "Private Education", href: moduleHref("academy") },
    ],
  },
  {
    items: [
      { title: "Events & Experiences", href: moduleHref("whitby") },
      { title: "Private Aviation", href: moduleHref("whitby") },
      { title: "Art & Assets", href: moduleHref("whitby") },
      { title: "Yacht & Marine", href: moduleHref("whitby") },
    ],
  },
];

export const RESOURCES_LINKS = [
  {
    title: "Help Center",
    description: "Guides for specialists and partners.",
    href: moduleHref("whitby"),
  },
  {
    title: "Security",
    description: "Data handling, access controls, and incident response.",
    href: "/#security",
  },
  {
    title: "Program Terms",
    description: "How referral and credential terms work.",
    href: moduleHref("partner"),
  },
  {
    title: "Book a walkthrough",
    description: "See Whitby on a live engagement.",
    href: "/#pricing",
  },
] as const;

/** Kept for footer product column */
export const NAV_LINKS = [
  { id: "whitby", label: "Whitby", href: moduleHref("whitby") },
  { id: "portal", label: "Client Portal", href: moduleHref("portal") },
  { id: "academy", label: "Academy", href: moduleHref("academy") },
  { id: "partner", label: "Partner Center", href: moduleHref("partner") },
] as const;

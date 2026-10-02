import type { ModuleSlug } from "@/base/landing/modules";

/** Platform overview page (/platform). */
export const PLATFORM_OVERVIEW = {
  href: "/platform",
  eyebrow: "Platform",
  title: "One coordination layer. Four surfaces.",
  lede:
    "Four capabilities on one coordination layer — each scoped for a different role on the same engagement.",
} as const;

export function platformCapabilityHref(slug: ModuleSlug): string {
  return `${PLATFORM_OVERVIEW.href}#capability-${slug}`;
}

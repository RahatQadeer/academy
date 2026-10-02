"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CircleDollarSign,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings2,
  Share2,
  Users,
} from "lucide-react";
import { Logo, Wordmark } from "@/base/components/Logo";
import { cn } from "@/base/lib/cn";
import { SuperAdminSignOutButton } from "@/super-admin/auth/components/SuperAdminSignOutButton";
import {
  PARTNER_CENTER_ADMIN_NAV,
  type PartnerCenterAdminNavItem,
} from "@/super-admin/partner-center/nav";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";
import { pcType } from "@/super-admin/partner-center/lib/typography";

const NAV_ICONS: Record<string, LucideIcon> = {
  [PC_ADMIN.root]: LayoutDashboard,
  [PC_ADMIN.applications]: ClipboardList,
  [PC_ADMIN.partners]: Users,
  [PC_ADMIN.referrals]: Share2,
  [PC_ADMIN.opportunities]: Building2,
  [PC_ADMIN.payouts]: CircleDollarSign,
  [PC_ADMIN.tax1099]: FileText,
  [PC_ADMIN.messages]: MessageSquare,
  [PC_ADMIN.programConfig]: Settings2,
};

function isActive(pathname: string, href: string) {
  if (href === PC_ADMIN.root) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupNav(
  items: PartnerCenterAdminNavItem[],
): { group?: string; items: PartnerCenterAdminNavItem[] }[] {
  const sections: { group?: string; items: PartnerCenterAdminNavItem[] }[] = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else sections.push({ group: item.group, items: [item] });
  }
  return sections;
}

export function AdminSidebar({
  messagesUnread = 0,
}: {
  messagesUnread?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const sections = groupNav(PARTNER_CENTER_ADMIN_NAV);

  return (
    <aside
      className="relative z-30 flex h-full w-[220px] shrink-0 flex-col overflow-visible border-r lg:w-[232px]"
      style={{
        background: "var(--chrome)",
        borderColor: "var(--chrome-line, var(--border))",
      }}
    >
      <div
        className="shrink-0 border-b px-3.5 py-3.5"
        style={{ borderColor: "var(--chrome-line, var(--border))" }}
      >
        <Link
          href="/super-admin"
          className="flex items-center gap-2.5 no-underline"
        >
          <Logo size={22} />
          <span className="min-w-0">
            <Wordmark size={13} trademark />
            <span
              className={cn("mt-0.5 block truncate", pcType.metaMedium)}
              style={{ color: "var(--text-tertiary)" }}
            >
              Partner Center — Admin
            </span>
          </span>
        </Link>
      </div>

      <nav className="mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 pb-2 pt-1">
        {sections.map((section, sectionIndex) => (
          <div
            key={section.group ?? section.items[0]?.href ?? sectionIndex}
            className={cn(sectionIndex > 0 && "mt-3 pt-2.5")}
            style={
              sectionIndex > 0
                ? { borderTop: "1px solid rgba(55,53,47,0.08)" }
                : undefined
            }
          >
            {section.group ? (
              <div
                className="mb-1 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: "rgba(55,53,47,.4)" }}
              >
                {section.group}
              </div>
            ) : null}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const showBadge =
                  item.href === PC_ADMIN.messages && messagesUnread > 0;
                const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className={cn(
                      "pa-side-nav-link mb-0.5 flex items-center gap-2.5 px-2.5 py-[8px]",
                      pcType.control,
                      active && "font-semibold",
                    )}
                    style={{ textDecoration: "none" }}
                    aria-current={active ? "page" : undefined}
                    onMouseEnter={() => router.prefetch(item.href)}
                  >
                    <NavGlyph Icon={Icon} />
                    <NavLinkLabel>
                      <span className="flex w-full min-w-0 items-center justify-between gap-2">
                        <span className="truncate">{item.label}</span>
                        {showBadge ? (
                          <span
                            className={cn(
                              "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5 leading-none",
                              pcType.micro,
                              "font-semibold",
                            )}
                            style={{
                              background: "var(--accent)",
                              color: "#fff",
                            }}
                            aria-label={`${messagesUnread} unread messages`}
                          >
                            {messagesUnread > 9 ? "9+" : messagesUnread}
                          </span>
                        ) : null}
                      </span>
                    </NavLinkLabel>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "mt-auto border-t px-3.5 py-3.5",
          pcType.label,
        )}
        style={{
          borderColor: "var(--chrome-line, var(--border))",
          color: "var(--text-tertiary)",
        }}
      >
        <div className="mb-2">Staff access only</div>
        <SuperAdminSignOutButton
          className={cn(
            pcType.label,
            "font-medium transition-colors hover:text-[var(--accent)]",
          )}
        />
      </div>
    </aside>
  );
}

function NavGlyph({ Icon }: { Icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center"
      style={{
        color: "var(--nav-glyph, rgba(55, 53, 47, 0.55))",
      }}
      aria-hidden={!pending}
    >
      {pending ? (
        <span
          className="inline-block h-[11px] w-[11px] animate-spin rounded-full border-[1.5px] border-solid"
          style={{
            borderColor: "var(--border-strong)",
            borderTopColor: "var(--ink)",
          }}
        />
      ) : (
        <Icon size={16} strokeWidth={1.9} />
      )}
    </span>
  );
}

/** Must live under Link — useLinkStatus reads the parent Link’s pending state. */
function NavLinkLabel({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={cn(
        "pa-side-nav-label min-w-0 flex-1",
        pending && "pa-side-nav-pending",
      )}
    >
      {children}
    </span>
  );
}

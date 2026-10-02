"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  Percent,
  Share2,
  Users,
} from "lucide-react";
import { Logo, Wordmark } from "@/base/components/Logo";
import { cn } from "@/base/lib/cn";
import { PARTNER_HEADER_GUTTER } from "@/partner-center/lib/layout";
import { pcType } from "@/partner-center/lib/typography";
import {
  PA_ADMIN,
  PARTNER_ADMIN_NAV,
  type PartnerAdminNavItem,
} from "@/partner-center/admin/lib/paths";
import { partnerAdminSignOutAction } from "@/partner-center/admin/lib/auth-actions";
import {
  AdminHeaderProvider,
  useAdminHeader,
} from "@/super-admin/partner-center/components/AdminHeaderContext";
import { AdminUiProvider } from "@/super-admin/partner-center/lib/admin-ui-paths";

const NAV_ICONS: Record<string, LucideIcon> = {
  [PA_ADMIN.root]: LayoutDashboard,
  [PA_ADMIN.applications]: ClipboardList,
  [PA_ADMIN.partners]: Users,
  [PA_ADMIN.referrals]: Share2,
  [PA_ADMIN.opportunities]: Building2,
  [PA_ADMIN.commission]: Percent,
  [PA_ADMIN.payouts]: CircleDollarSign,
  [PA_ADMIN.messages]: MessageSquare,
};

function isActive(pathname: string, href: string) {
  if (href === PA_ADMIN.root) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupNav(
  items: PartnerAdminNavItem[],
): { group?: string; items: PartnerAdminNavItem[] }[] {
  const sections: { group?: string; items: PartnerAdminNavItem[] }[] = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else sections.push({ group: item.group, items: [item] });
  }
  return sections;
}

function titleFromPath(pathname: string): string | undefined {
  const matches = PARTNER_ADMIN_NAV.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (matches.length === 0) {
    if (pathname === PA_ADMIN.root || pathname.startsWith(`${PA_ADMIN.root}/`)) {
      return "Dashboard";
    }
    return undefined;
  }
  const best = [...matches].sort((a, b) => b.href.length - a.href.length)[0];
  return best.label;
}

export function PartnerAdminShellClient({
  children,
  email,
  messagesUnread = 0,
}: {
  children: React.ReactNode;
  email: string;
  messagesUnread?: number;
}) {
  const pathname = usePathname() || "";
  const isMessages = pathname.startsWith(PA_ADMIN.messages);

  return (
    <div className="pa-app-shell pa-partner-theme flex overflow-hidden bg-canvas">
      <PartnerAdminSidebar email={email} messagesUnread={messagesUnread} />
      <main className="pa-app-shell-main flex h-full min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-surface">
        <AdminUiProvider root={PA_ADMIN.root} mode="partner_admin">
          <AdminHeaderProvider>
            <PartnerAdminShellBar pathname={pathname} />
            <div
              className={cn(
                "relative flex min-h-0 min-w-0 flex-1 flex-col",
                isMessages ? "overflow-hidden" : "overflow-y-auto",
              )}
              style={isMessages ? undefined : { scrollbarGutter: "stable" }}
            >
              {children}
            </div>
          </AdminHeaderProvider>
        </AdminUiProvider>
      </main>
    </div>
  );
}

function PartnerAdminShellBar({ pathname }: { pathname: string }) {
  const { header, actionSlotRef } = useAdminHeader();
  const title = header?.title ?? titleFromPath(pathname);
  const subtitle = header?.subtitle;

  return (
    <header
      className={cn(
        "z-40 flex shrink-0 flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b bg-surface",
        PARTNER_HEADER_GUTTER,
      )}
      style={{ borderColor: "var(--chrome-line, var(--border))" }}
    >
      <div className="min-w-0 flex-1 pt-0.5">
        {title ? (
          <>
            <h1
              className={cn("m-0 text-pretty", pcType.page)}
              style={{ color: "var(--ink)" }}
            >
              {title}
            </h1>
            {subtitle ? (
              <p
                className={cn(
                  "m-0 mt-1.5 max-w-[42rem] text-pretty",
                  pcType.subtitle,
                )}
                style={{ color: "var(--text-soft, var(--text-secondary))" }}
              >
                {subtitle}
              </p>
            ) : null}
          </>
        ) : (
          <span className="block h-7" aria-hidden />
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2.5 self-center">
        <div
          ref={actionSlotRef}
          className="flex items-center gap-2 empty:hidden"
        />
      </div>
    </header>
  );
}

function PartnerAdminSidebar({
  email,
  messagesUnread = 0,
}: {
  email: string;
  messagesUnread?: number;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const sections = groupNav(PARTNER_ADMIN_NAV);

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
          href={PA_ADMIN.root}
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
                  item.href === PA_ADMIN.messages && messagesUnread > 0;
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
        className={cn("mt-auto border-t px-3.5 py-3.5", pcType.label)}
        style={{
          borderColor: "var(--chrome-line, var(--border))",
          color: "var(--text-tertiary)",
        }}
      >
        <div className="mb-1 truncate" title={email}>
          {email}
        </div>
        <div className="mb-2">Partner Admin</div>
        <form action={partnerAdminSignOutAction}>
          <button
            type="submit"
            className={cn(
              pcType.label,
              "bg-transparent p-0 font-medium transition-colors hover:text-[var(--accent)]",
            )}
            style={{ color: "inherit", border: "none", cursor: "pointer" }}
          >
            Sign out
          </button>
        </form>
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

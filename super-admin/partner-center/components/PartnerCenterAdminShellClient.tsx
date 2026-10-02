"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/base/lib/cn";
import { PARTNER_HEADER_GUTTER } from "@/partner-center/lib/layout";
import { AdminSidebar } from "@/super-admin/partner-center/components/AdminSidebar";
import {
  AdminHeaderProvider,
  useAdminHeader,
} from "@/super-admin/partner-center/components/AdminHeaderContext";
import { AdminUiProvider } from "@/super-admin/partner-center/lib/admin-ui-paths";
import { PARTNER_CENTER_ADMIN_NAV } from "@/super-admin/partner-center/nav";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";
import { pcType } from "@/super-admin/partner-center/lib/typography";

/** Fallback title from the URL while page chrome mounts. */
export function adminTitleFromPath(pathname: string): string | undefined {
  if (pathname.startsWith(PC_ADMIN.programConfig)) return "Program config";
  if (/\/opportunities\/[^/]+\/attachment$/.test(pathname)) {
    return "Opportunity attachment";
  }
  if (/\/partners\/[^/]+\/terms$/.test(pathname)) return "Partner terms";
  if (pathname === `${PC_ADMIN.referrals}/new`) return "Create referral";
  if (/\/messages\/[^/]+$/.test(pathname)) return "Message thread";

  const matches = PARTNER_CENTER_ADMIN_NAV.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (matches.length === 0) {
    if (pathname === PC_ADMIN.root || pathname.startsWith(`${PC_ADMIN.root}/`)) {
      return "Dashboard";
    }
    return undefined;
  }
  const best = [...matches].sort((a, b) => b.href.length - a.href.length)[0];
  // Detail routes keep the list label until AdminPageHeader sets the record title.
  if (pathname !== best.href && pathname.startsWith(`${best.href}/`)) {
    return best.label;
  }
  return best.label;
}

export function PartnerCenterAdminShellClient({
  children,
  notifications,
  messagesUnread = 0,
}: {
  children: React.ReactNode;
  notifications?: React.ReactNode;
  messagesUnread?: number;
}) {
  const pathname = usePathname();
  const isMessages = pathname.startsWith(PC_ADMIN.messages);

  return (
    <div className="pa-app-shell pa-partner-theme flex overflow-hidden bg-canvas">
      <AdminSidebar messagesUnread={messagesUnread} />
      <main className="pa-app-shell-main flex h-full min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-surface">
        <AdminUiProvider root={PC_ADMIN.root} mode="super_admin">
          <AdminHeaderProvider>
            <AdminShellBar pathname={pathname} notifications={notifications} />
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

function AdminShellBar({
  pathname,
  notifications,
}: {
  pathname: string;
  notifications?: React.ReactNode;
}) {
  const { header, actionSlotRef } = useAdminHeader();
  const title = header?.title ?? adminTitleFromPath(pathname);
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
        {notifications}
      </div>
    </header>
  );
}

"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/base/lib/cn";
import { PartnerSessionExpired } from "@/partner-center/components/states/PartnerSessionExpired";
import { PartnerUiProvider } from "@/partner-center/components/PartnerUiProvider";
import {
  PartnerHeaderProvider,
  usePartnerHeader,
} from "@/partner-center/components/PartnerHeaderContext";
import type { NavItem } from "@/base/components/Sidebar";
import { NAV } from "@/partner-center/nav";
import { PARTNER_HEADER_GUTTER } from "@/partner-center/lib/layout";
import { pcType } from "@/partner-center/lib/typography";

/** Immediate title from the URL so the bar is never empty while chrome mounts. */
export function partnerTitleFromPath(
  pathname: string,
  items: NavItem[] = NAV,
): string | undefined {
  if (pathname.startsWith("/partner-center/settings")) return "Settings";
  if (pathname === "/partner-center/tax") return "Tax profile";
  if (pathname.startsWith("/partner-center/opportunities/new")) {
    return "Submit an Opportunity";
  }
  if (/\/opportunities\/[^/]+\/edit$/.test(pathname)) {
    return "Edit opportunity";
  }
  if (pathname.startsWith("/partner-center/documents/terms")) {
    return "Program terms";
  }

  const matches = items.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (matches.length === 0) return undefined;
  const best = [...matches].sort((a, b) => b.href.length - a.href.length)[0];
  return best?.label;
}

export function PartnerAppShellClient({
  children,
  notifications,
  navItems = NAV,
}: {
  children: React.ReactNode;
  notifications?: React.ReactNode;
  navItems?: NavItem[];
}) {
  const pathname = usePathname();
  const isMessages = pathname === "/partner-center/messages";

  return (
    <PartnerUiProvider>
      <PartnerHeaderProvider>
        <PartnerShellBar
          pathname={pathname}
          navItems={navItems}
          notifications={notifications}
        />
        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col",
            isMessages ? "overflow-hidden" : "min-h-0 overflow-y-auto",
          )}
          style={isMessages ? undefined : { scrollbarGutter: "stable" }}
        >
          {children}
        </div>
        <Suspense fallback={null}>
          <PartnerExpiredGate />
        </Suspense>
      </PartnerHeaderProvider>
    </PartnerUiProvider>
  );
}

/** Isolated so useSearchParams does not suspend the whole shell + header. */
function PartnerExpiredGate() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "1";
  const next =
    expired && pathname.startsWith("/partner-center") ? pathname : undefined;
  if (!expired) return null;
  return <PartnerSessionExpired next={next} />;
}

function PartnerShellBar({
  pathname,
  navItems,
  notifications,
}: {
  pathname: string;
  navItems: NavItem[];
  notifications?: React.ReactNode;
}) {
  const { header, actionSlotRef } = usePartnerHeader();
  const title = header?.title ?? partnerTitleFromPath(pathname, navItems);
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
                className={cn("m-0 mt-1.5 max-w-[42rem] text-pretty", pcType.subtitle)}
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

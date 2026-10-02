"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CircleDollarSign,
  FileText,
  Home,
  Link2,
  MessageSquare,
  Settings,
  Share2,
  Users,
} from "lucide-react";
import { Avatar } from "@/base/components/Avatar";
import type { NavItem } from "@/base/components/Sidebar";
import { ProductSwitcher } from "@/base/switcher/ProductSwitcher";
import { cn } from "@/base/lib/cn";
import type { Entitlement, ProductKey } from "@/base/types";
import type { PartnerNavBadges } from "@/partner-center/messages/lib/load-nav-badges";
import { pcType } from "@/partner-center/lib/typography";

const MESSAGES_HREF = "/partner-center/messages";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/partner-center": Home,
  "/partner-center/referrals": Share2,
  "/partner-center/opportunities": Building2,
  "/partner-center/earnings": CircleDollarSign,
  "/partner-center/links": Link2,
  "/partner-center/team": Users,
  "/partner-center/documents": FileText,
  "/partner-center/messages": MessageSquare,
};

export function PartnerSidebar({
  productKey,
  workspaceName,
  items,
  userName,
  entitlements = [],
  previewAll = false,
  badges = null,
}: {
  productKey: ProductKey;
  workspaceName?: string;
  items: NavItem[];
  userName: string;
  entitlements?: Entitlement[];
  previewAll?: boolean;
  badges?: PartnerNavBadges | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const messageCount = badges?.messages ?? 0;
  const settingsActive = pathname.startsWith("/partner-center/settings");
  const sections = toSections(items);

  return (
    <aside
      className="relative z-30 flex h-full w-[220px] shrink-0 flex-col overflow-visible border-r lg:w-[232px]"
      style={{
        background: "var(--chrome)",
        borderColor: "var(--chrome-line, var(--border))",
      }}
    >
      <div className="shrink-0 px-2.5 pt-2.5">
        <ProductSwitcher
          currentProduct={productKey}
          workspaceName={workspaceName}
          entitlements={entitlements}
          previewAll={previewAll}
          portalAccess="hidden"
          bare
        />
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-2 pt-1">
        {sections.map((section) => (
          <div
            key={section.group ?? section.items[0]?.href ?? "section"}
            className={cn(section.group ? "mt-3 first:mt-0" : undefined)}
          >
            {section.group ? (
              <div
                className={cn(
                  "px-2.5 pb-1.5 pt-1 uppercase tracking-[0.07em]",
                  pcType.micro,
                  "font-semibold",
                )}
                style={{ color: "var(--text-quiet, var(--text-tertiary))" }}
              >
                {section.group}
              </div>
            ) : null}
            {section.items.map((item) => {
              const active = isNavActive(pathname, item.href, items);
              const showBadge =
                item.href === MESSAGES_HREF && messageCount > 0;
              const Icon = NAV_ICONS[item.href] ?? Home;
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    "pa-side-nav-link mb-0.5 flex items-center gap-2.5 px-2.5 py-[8px]",
                    pcType.control,
                    active && "font-semibold",
                  )}
                  aria-current={active ? "page" : undefined}
                  style={{ textDecoration: "none" }}
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
                          aria-label={`${messageCount} unread messages`}
                        >
                          {messageCount > 9 ? "9+" : messageCount}
                        </span>
                      ) : null}
                    </span>
                  </NavLinkLabel>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <Link
        href="/partner-center/settings/profile"
        aria-label="Open profile settings"
        aria-current={settingsActive ? "page" : undefined}
        onMouseEnter={() => router.prefetch("/partner-center/settings/profile")}
        className={cn(
          "mt-auto flex items-center gap-2.5 border-t px-3.5 py-3.5 no-underline transition-colors",
          "hover:bg-[var(--chrome-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]",
        )}
        style={{
          borderColor: "var(--chrome-line, var(--border))",
          background: settingsActive ? "var(--chrome-hover)" : "transparent",
        }}
      >
        <Avatar name={userName} size={30} tone="tan" />
        <div className="min-w-0 flex-1">
          <div
            className={cn("truncate", pcType.bodyMedium)}
            style={{ color: "var(--accent)" }}
          >
            {userName}
          </div>
          <div
            className={cn("truncate", pcType.meta)}
            style={{ color: "var(--text-tertiary)" }}
          >
            Partner
          </div>
        </div>
        <Settings
          size={15}
          strokeWidth={2}
          className="shrink-0"
          style={{ color: "var(--accent)" }}
          aria-hidden
        />
      </Link>
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

function toSections(items: NavItem[]) {
  const sections: { group?: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else sections.push({ group: item.group, items: [item] });
  }
  return sections;
}

function isNavActive(pathname: string, href: string, items: NavItem[]) {
  const matches = items.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (matches.length === 0) return false;
  const best = [...matches].sort((a, b) => b.href.length - a.href.length)[0];
  return best?.href === href;
}

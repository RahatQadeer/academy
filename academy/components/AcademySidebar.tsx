"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Avatar } from "@/base/components/Avatar";
import { NavIcon } from "@/base/components/NavIcons";
import { cn } from "@/base/lib/cn";
import type { Entitlement } from "@/base/types";
import { AcademySidebarBrand } from "@/academy/components/AcademySidebarBrand";
import { isAdminEnrollmentsPath } from "@/academy/lib/adminNavSeen";
import { markAdminNavSeenAction } from "@/academy/lib/markAdminNavSeen";
import { loadAcademyNavBadgesAction } from "@/academy/lib/navBadgeAction";
import type { AcademyNavBadges, AcademyNavBadgeKey, AcademyNavGroup } from "@/academy/lib/navTypes";
import {
  ACADEMY_SIDEBAR_COLLAPSED_STORAGE,
  persistAcademySidebarCollapsed,
} from "@/academy/lib/sidebarPreference";
import { ACADEMY_SHELL, academyRoleTag, academyRoleTagStyle } from "@/academy/lib/surfacePath";
import type { AcademyRole } from "@/academy/lib/types";
import type { NavItem } from "@/base/components/Sidebar";

function isNavActive(pathname: string, href: string, items: { href: string }[]) {
  const pathOnly = (value: string) => value.split("?")[0] ?? value;
  const current = pathOnly(pathname);
  const matches = items.filter((item) => {
    const itemPath = pathOnly(item.href);
    return current === itemPath || current.startsWith(`${itemPath}/`);
  });
  if (matches.length === 0) return false;
  const best = [...matches].sort((a, b) => pathOnly(b.href).length - pathOnly(a.href).length)[0];
  return pathOnly(best?.href ?? "") === pathOnly(href);
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 999 ? "999+" : count.toLocaleString();
  return (
    <span
      className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold leading-none tabular-nums text-white"
      style={{ background: ACADEMY_SHELL.badgeBg }}
    >
      {label}
    </span>
  );
}

function NavLinkLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className={cn("min-w-0 truncate", pending && "pa-side-nav-pending")}>{label}</span>
  );
}

function NavLink({
  item,
  active,
  badge,
  collapsed,
}: {
  item: { href: string; label: string };
  active: boolean;
  badge?: number;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      prefetch
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative mb-0.5 flex items-center overflow-hidden rounded-[10px] text-[13.5px] no-underline",
        "transition-[background,color,transform,box-shadow] duration-200 ease-out",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
        collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
        active ? "font-semibold" : "font-medium hover:translate-x-px hover:bg-[rgba(55,53,47,0.045)]",
      )}
      style={{
        background: active ? ACADEMY_SHELL.activeBg : "transparent",
        color: active ? ACADEMY_SHELL.activeFg : "rgba(55,53,47,.72)",
      }}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute top-[8px] bottom-[8px] left-0 w-[3px] rounded-r-full transition-opacity duration-200"
          style={{ background: ACADEMY_SHELL.activeBorder }}
        />
      ) : null}
      <span
        className={cn(
          "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center transition-colors duration-200",
          !active && "group-hover:text-[rgba(55,53,47,.78)]",
        )}
        style={{ color: active ? ACADEMY_SHELL.activeFg : "rgba(55,53,47,.5)" }}
      >
        <NavIcon href={item.href} label={item.label} />
      </span>
      {!collapsed ? (
        <>
          <NavLinkLabel label={item.label} />
          {badge !== undefined ? <NavBadge count={badge} /> : null}
        </>
      ) : null}
    </Link>
  );
}

function EdgeCollapseButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="absolute -right-3.5 top-[4.5rem] z-40 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface transition-colors duration-200 hover:bg-[var(--surface-soft)]"
      style={{ boxShadow: "0 1px 4px rgba(15, 15, 15, 0.08)" }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden
        style={{ color: "var(--text-tertiary)" }}
      >
        {collapsed ? (
          <path
            d="M5 3.5L8.5 7L5 10.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M9 3.5L5.5 7L9 10.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  );
}

export function AcademySidebar({
  context,
  items,
  groups,
  badges,
  userName,
  userEmail,
  entitlements,
  previewAll,
  initialCollapsed = false,
}: {
  context: AcademyRole;
  items: (NavItem & { badgeKey?: AcademyNavBadgeKey })[];
  groups: AcademyNavGroup[] | null;
  badges: AcademyNavBadges | null;
  roles: AcademyRole[];
  userName: string;
  userEmail?: string;
  entitlements?: Entitlement[];
  previewAll?: boolean;
  initialCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const flatItems = groups?.flatMap((group) => group.items) ?? items;
  const roleTag = academyRoleTag(context);
  const tagStyle = academyRoleTagStyle(context);
  const showGroupLabels = Boolean(groups && groups.length > 0);

  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [animateWidth, setAnimateWidth] = useState(false);
  const [enrollmentsSeen, setEnrollmentsSeen] = useState(false);
  const [liveBadges, setLiveBadges] = useState(badges);

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 1023px)");
    function apply() {
      if (narrow.matches) {
        setCollapsed(true);
        return;
      }
      try {
        const stored = window.localStorage.getItem(ACADEMY_SIDEBAR_COLLAPSED_STORAGE) === "1";
        persistAcademySidebarCollapsed(stored);
        setCollapsed(stored);
      } catch {
        /* ignore */
      }
    }
    apply();
    narrow.addEventListener("change", apply);
    return () => narrow.removeEventListener("change", apply);
  }, [initialCollapsed]);

  useEffect(() => {
    if (context !== "admin" && context !== "instructor") {
      setLiveBadges(null);
      return;
    }
    let cancelled = false;
    void loadAcademyNavBadgesAction(context).then((next) => {
      if (!cancelled) setLiveBadges(next);
    });
    return () => {
      cancelled = true;
    };
  }, [context]);

  useEffect(() => {
    if (!isAdminEnrollmentsPath(pathname)) return;
    setEnrollmentsSeen(true);
    void markAdminNavSeenAction("enrollments");
  }, [pathname]);

  function toggleCollapsed() {
    setAnimateWidth(true);
    setCollapsed((current) => {
      const next = !current;
      persistAcademySidebarCollapsed(next);
      return next;
    });
  }

  function badgeFor(key?: AcademyNavBadgeKey) {
    if (!key || !liveBadges) return undefined;
    if (key === "enrollments" && (enrollmentsSeen || isAdminEnrollmentsPath(pathname))) {
      return undefined;
    }
    return liveBadges?.[key];
  }

  return (
    <aside
      className={cn(
        "relative z-30 flex h-full shrink-0 flex-col border-r border-line print:hidden",
        animateWidth && "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed ? "w-[76px]" : "w-[252px]",
      )}
      style={{ background: "var(--surface-soft)" }}
    >
      <EdgeCollapseButton collapsed={collapsed} onToggle={toggleCollapsed} />

      <div className={cn("shrink-0 pb-2", collapsed ? "px-2.5 pt-5" : "px-5 pt-6")}>
        <AcademySidebarBrand
          roleTag={collapsed ? undefined : roleTag}
          roleTagStyle={tagStyle}
          entitlements={entitlements}
          previewAll={previewAll}
          collapsed={collapsed}
        />
      </div>

      {!collapsed ? (
        <div className="mx-4 mb-3 h-px" style={{ background: "rgba(55,53,47,0.08)" }} />
      ) : (
        <div className="mb-2" />
      )}

      <nav className={cn("flex-1 overflow-y-auto pb-4", collapsed ? "px-2.5" : "px-3.5")}>
        {groups ? (
          groups.map((group, groupIndex) => (
            <div
              key={group.label}
              className={cn(groupIndex > 0 && !collapsed && "mt-4 pt-3", groupIndex > 0 && collapsed && "mt-2")}
              style={
                groupIndex > 0 && !collapsed
                  ? { borderTop: "1px solid rgba(55,53,47,0.08)" }
                  : undefined
              }
            >
              {showGroupLabels && !collapsed ? (
                <div
                  className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "rgba(55,53,47,.4)" }}
                >
                  {group.label}
                </div>
              ) : null}
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isNavActive(pathname, item.href, flatItems)}
                  badge={badgeFor(item.badgeKey)}
                  collapsed={collapsed}
                />
              ))}
            </div>
          ))
        ) : (
          flatItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isNavActive(pathname, item.href, flatItems)}
              badge={badgeFor((item as { badgeKey?: AcademyNavBadgeKey }).badgeKey)}
              collapsed={collapsed}
            />
          ))
        )}
      </nav>

      <div
        className={cn("py-4", collapsed ? "px-2.5" : "px-3.5")}
        style={{ borderTop: "1px solid rgba(55,53,47,0.08)" }}
      >
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2.5 px-1")}>
          <Avatar name={userName} size={32} tone="tan" />
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold leading-tight">{userName}</div>
              {userEmail ? (
                <div className="truncate text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                  {userEmail}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {!collapsed ? (
          <form action="/auth/sign-out" method="post" className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-[10px] border-none bg-transparent px-2 py-2 text-left text-[13px] font-medium transition-colors duration-200 hover:bg-[rgba(55,53,47,0.045)]"
              style={{ color: "rgba(55, 53, 47, 0.68)" }}
            >
              <span
                className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center"
                style={{ color: "rgba(55, 53, 47, 0.52)" }}
              >
                <SignOutIcon />
              </span>
              Sign out
            </button>
          </form>
        ) : (
          <form action="/auth/sign-out" method="post" className="mt-3 flex justify-center">
            <button
              type="submit"
              aria-label="Sign out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border-none bg-transparent transition-colors duration-200 hover:bg-[rgba(55,53,47,0.045)]"
              style={{ color: "rgba(55, 53, 47, 0.52)" }}
            >
              <SignOutIcon />
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 2.5H3.8A1.3 1.3 0 0 0 2.5 3.8v8.4a1.3 1.3 0 0 0 1.3 1.3H6M10.5 11.5L13 9M13 9l-2.5-2.5M13 9H6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

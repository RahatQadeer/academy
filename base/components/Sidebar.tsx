"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/base/components/Avatar";
import { NavIcon } from "@/base/components/NavIcons";
import { ProductSwitcher } from "@/base/switcher/ProductSwitcher";
import { cn } from "@/base/lib/cn";
import type { Entitlement, ProductKey } from "@/base/types";

export type NavItem = {
  href: string;
  label: string;
  icon?: React.ReactNode;
  /**
   * Optional section heading. Consecutive items sharing a group are drawn
   * under one collapsible heading; items with no group render on their own,
   * exactly as before. A product that sets no groups is unaffected.
   */
  group?: string;
  /**
   * A small mark at the end of the row, for a screen with something waiting on
   * this person. Optional and absent everywhere it is not set, so a nav that
   * knows nothing about it draws exactly what it drew before.
   *
   * A dot on its own where there is nothing to count — a queue is a standing
   * fact, and "there is something here" is enough to make somebody look. A
   * screen that can say how much says it with `count` beside the dot.
   */
  attention?: boolean;
  /**
   * How many things are waiting, where that is a number somebody would act
   * on — unread messages, and so far nothing else.
   *
   * Drawn beside the dot rather than instead of it: the dot is what catches
   * the eye from across the rail, and the number is what it is worth looking
   * closer for. Zero and undefined are the same thing and draw nothing, so a
   * nav that knows nothing about this is unchanged.
   */
  count?: number;
};

const SIDEBAR_STORAGE_KEY = "pa-sidebar-icon-rail";

type SidebarProps = {
  productKey: ProductKey;
  workspaceName?: string;
  /** The line under it — see ProductSwitcher. */
  workspaceNote?: string;
  /** A signed URL for the workspace's own mark, drawn in place of initials. */
  workspaceLogo?: string | null;
  items: NavItem[];
  userName: string;
  userEmail?: string;
  /** The signed-in person's own photo, drawn in place of their initials. */
  userPhoto?: string | null;
  /**
   * What they are here, which is what the reference puts under the name.
   * Optional so the products that have not worked theirs out keep the email.
   */
  userRole?: string;
  entitlements?: Entitlement[];
  previewAll?: boolean;
  /** SRS §2.4. Omitted by products that have not defined their entries. */
  /** A word beside the product name — Academy uses it for the role being viewed. */
  badge?: string;
  /** Whether the rail can be collapsed to icons. Off unless a product asks. */
  collapsible?: boolean;
  /** False where the product's own bar carries it instead. */
  signOut?: boolean;
  roleTag?: string;
  roleTagStyle?: { background: string; color: string };
  /**
   * What they are here, drawn under their name. Supersedes `userRole`, which
   * remains so that callers still passing it keep type-checking.
   */
  roleLabel?: string;
  /** The workspace name in the rail opens this overview, not only after login. */
  workspaceHref?: string;
  /**
   * Hide the organization mark. Whitby draws it on the top bar instead, so
   * the rail would otherwise say the same name twice.
   */
  brand?: boolean;
  /**
   * Whose client work is open — at the head of the rail, the way the
   * organization mark sits on Whitby's top bar.
   */
  clientChip?: { name: string; photo?: string | null } | null;
  /** The footer photo opens profile settings so they can view and change it. */
  accountHref?: string;
  /**
   * Whether the rail's footer carries the "who is signed in" row at all.
   *
   * False for a product whose own top bar already says it. The Client Portal
   * draws that chip on every screen, and keeps Profile & Settings in the nav
   * above — so the footer was a third face, a third copy of the name and a
   * third route to one settings screen, at the bottom of a rail that had
   * already answered the question twice.
   */
  account?: boolean;
  /**
   * Below 768px, take the rail off the page and open it as a drawer.
   *
   * A 224px rail on a 390px phone left the screen a 160px column, and every
   * table, heading and form in it wrapped a word per line. Opt-in, because
   * Academy and Partner Center draw their own chrome around this shell and a
   * menu button fixed over their top-left corner is not theirs to be given.
   */
  mobileDrawer?: boolean;
  /** See ProductSwitcher. */
  portalAccess?: "open" | "hidden" | "upgrade";
  portalUpgradeHref?: string;
  /** See ProductSwitcher. */
  noSwitch?: boolean;
  /**
   * A rail measured to its own labels rather than to the widest product's.
   *
   * 224px was set for Whitby, whose rail carries eighteen items and phrases
   * like "Public information". The Client Portal's longest is "Profile &
   * Settings", which ends 70px short of the edge — so every portal screen was
   * giving up that much of its width to a column of air between the labels and
   * the rule. Opt-in, because the number is only right for a rail whose
   * longest label is known.
   */
  narrow?: boolean;
};

export function Sidebar({
  productKey,
  workspaceName,
  workspaceNote,
  workspaceLogo,
  items,
  userName,
  userEmail,
  userPhoto,
  userRole,
  entitlements = [],
  previewAll = false,
  badge,
  collapsible = false,
  signOut = true,
  roleTag,
  roleTagStyle,
  roleLabel,
  workspaceHref,
  brand = true,
  accountHref,
  account = true,
  mobileDrawer = false,
  portalAccess,
  portalUpgradeHref,
  noSwitch,
  narrow = false,
  clientChip,
}: SidebarProps) {
  const usingRoleLabel = Boolean(roleLabel);
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A drawer that stays open over the screen it just navigated to is covering
  // the thing somebody asked for.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const wasOnAsk = useRef(false);

  useEffect(() => {
    if (!collapsible) return;

    const onAsk =
      pathname === "/whitbyos/ask" || pathname.startsWith("/whitbyos/ask/");

    // Entering Ask (from Home or elsewhere): collapse once so Ask's rail has room.
    // Staying on Ask (thread → thread) leaves the user's expand/collapse alone.
    if (onAsk) {
      if (!wasOnAsk.current) {
        setCollapsed(true);
        try {
          window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1");
        } catch {
          /* ignore */
        }
      }
      wasOnAsk.current = true;
      return;
    }

    wasOnAsk.current = false;
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      setCollapsed(stored !== "0");
    } catch {
      /* ignore */
    }
  }, [collapsible, pathname]);

  // Home's Ask box collapses before navigation so the rail does not flash open.
  useEffect(() => {
    if (!collapsible) return;
    function onCollapse() {
      setCollapsed(true);
    }
    window.addEventListener("pa-sidebar-collapse", onCollapse);
    return () => window.removeEventListener("pa-sidebar-collapse", onCollapse);
  }, [collapsible]);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // An open drawer is always the full rail: icons alone are a desktop
  // economy, and on a phone the drawer is already out of the way when shut.
  const compact = collapsible && collapsed && !drawerOpen;
  const navParts = splitNav(items);
  const holdingGroup =
    navParts.groups.find((section) =>
      section.items.some((item) => isNavActive(pathname, item.href, items)),
    )?.group ?? null;
  /*
   * Always start closed.
   *
   * Starting on the group that holds the current page meant the icon-rail
   * flyout was "expanded" on the first paint (collapsed defaults to true),
   * and RailGroup then branched on `typeof document` — null on the server,
   * a portal on the client — which is exactly a hydration mismatch.
   * The effect below opens the accordion once the full list is showing.
   */
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    if (compact) {
      setOpenGroup(null);
      return;
    }
    if (holdingGroup) setOpenGroup(holdingGroup);
  }, [holdingGroup, compact]);

  function toggleGroup(group: string) {
    setOpenGroup((current) => (current === group ? null : group));
  }

  return (
    <>
    {mobileDrawer ? (
      <>
        {/* Sits in the empty left end of the product's sticky top bar, which
            is the same 58px on Whitby and the portal. */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          className="pa-print-hide fixed left-4 top-3 z-[25] flex h-[34px] w-[34px] items-center justify-center rounded-control border border-line bg-surface md:hidden"
          style={{ color: "var(--text-secondary)" }}
        >
          <MenuMark />
        </button>
        <button
          type="button"
          aria-label="Close navigation"
          tabIndex={drawerOpen ? 0 : -1}
          onClick={() => setDrawerOpen(false)}
          className={cn(
            "fixed inset-0 z-40 transition-opacity duration-200 md:hidden",
            drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          style={{ background: "rgba(55,53,47,.45)" }}
        />
      </>
    ) : null}
    <aside
      className={cn(
        // base moved the shell to a scrolling main pane, so the rail is h-full
        // rather than a sticky h-screen; pa-print-hide keeps it off the paper
        // when a client timeline is printed. Both, not one.
        "pa-side pa-print-hide relative z-30 h-full shrink-0",
        compact
          ? "w-[84px]"
          : collapsible
            ? "w-[248px]"
            : roleTag && !usingRoleLabel
              ? "w-[228px]"
              : narrow
                ? "w-[196px]"
                : "w-[224px]",
        mobileDrawer &&
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[248px]",
        mobileDrawer &&
          (drawerOpen
            ? "max-md:translate-x-0 max-md:shadow-[0_12px_40px_rgba(15,15,15,.18)]"
            : "max-md:-translate-x-full"),
      )}
      style={{
        // The frame's own colour — see `--chrome` in globals. No border: the
        // handle on the edge is the rail's only line, and two an inch apart
        // read as a seam rather than as an edge.
        background: "var(--chrome)",
        // Width for the rail closing, transform for the drawer sliding in from
        // the edge on a narrow window.
        transition:
          "width 360ms cubic-bezier(0.22, 1, 0.36, 1), transform 360ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div className="flex h-full flex-col overflow-hidden">
        {brand ? (
        <div
          className={cn(
            "pa-side-brand flex shrink-0 items-center",
            /*
             * The right padding lines this row's chevron up with the collapse
             * arrow in the Menu row beneath it.
             *
             * Equal padding would not do it: the two buttons are different
             * sizes, 28px here and 32px there, so their icons sit at
             * different distances from the edge. 16 plus half of 28 is 30,
             * and so is 14 plus half of 32.
             */
            compact ? "justify-center px-1.5 pb-1 pt-3" : "pb-3 pl-3.5 pr-4 pt-3.5",
          )}
        >
          <ProductSwitcher
            currentProduct={productKey}
            workspaceName={usingRoleLabel || roleTag ? undefined : workspaceName}
            workspaceNote={usingRoleLabel || roleTag ? undefined : workspaceNote}
            workspaceLogo={workspaceLogo}
            roleTag={usingRoleLabel ? undefined : roleTag}
            roleTagStyle={roleTagStyle}
            roleLabel={roleLabel}
            entitlements={entitlements}
            previewAll={previewAll}
            compact={compact}
            bare
            masthead={collapsible}
            workspaceHref={workspaceHref}
            portalAccess={portalAccess}
            portalUpgradeHref={portalUpgradeHref}
            noSwitch={noSwitch}
          />
        </div>
        ) : null}

        {clientChip ? (
          <div
            className={cn(
              "pa-side-client shrink-0",
              compact ? "flex justify-center px-1.5 pb-2 pt-2" : "px-3.5 pb-3 pt-5",
            )}
          >
            {compact ? (
              <span title={clientChip.name} className="flex justify-center">
                <Avatar name={clientChip.name} size={28} src={clientChip.photo} />
              </span>
            ) : (
              <div className="flex items-start gap-2.5">
                <Avatar name={clientChip.name} size={34} src={clientChip.photo} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <div
                    className="truncate text-[15px] font-bold leading-tight tracking-[-0.02em]"
                    style={{ color: "var(--ink)" }}
                    title={clientChip.name}
                  >
                    {clientChip.name}
                  </div>
                  <div
                    className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: "var(--accent)" }}
                  >
                    Client
                  </div>
                </div>
                {collapsible ? (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar"
                    className="pa-side-rail-toggle mt-0.5 shrink-0"
                  >
                    <DoubleChevron collapsed={false} />
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {collapsible && !(clientChip && !compact) ? (
          compact ? (
            <div className="flex shrink-0 flex-col items-center px-1.5 pt-1.5">
              <button
                type="button"
                onClick={toggle}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="pa-side-rail-toggle"
              >
                <DoubleChevron collapsed />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-2.5">
              <h2
                className="min-w-0 flex-1 truncate text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Menu
              </h2>
              <button
                type="button"
                onClick={toggle}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="pa-side-rail-toggle"
              >
                <DoubleChevron collapsed={false} />
              </button>
            </div>
          )
        ) : null}

        {clientChip && !compact ? (
          <div
            className="mx-3.5 mb-2 shrink-0"
            style={{ height: 1, background: "color-mix(in srgb, var(--chrome-line) 80%, transparent)" }}
            aria-hidden
          />
        ) : null}

      {badge && !roleTag && !usingRoleLabel && !compact ? (
        <div className="px-3 pb-1">
          <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            Academy
          </span>{" "}
          <span
            className="inline-block rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-semibold"
            style={
              productKey === "academy"
                ? { background: "var(--module-academy-bg)", color: "var(--module-academy-fg)" }
                : { background: "var(--accent-tint-soft, #e7f1fb)", color: "var(--accent, #2383e2)" }
            }
          >
            {badge}
          </span>
        </div>
      ) : null}

      {/*
       * Quick Add is on the bar, and only there.
       *
       * It sat here as well, so the same menu had two buttons on one screen —
       * and closed, the rail's was a bare "+" above seventeen icons with
       * nothing to say what it added.
       */}

      <nav
        data-tour="nav"
        key={compact ? "rail" : "list"}
        className={cn(
          "pa-side-nav-scroll min-h-0 flex-1 overflow-y-auto",
          compact ? "flex flex-col px-1 py-1 pa-side-nav-swap" : "px-2.5 py-1 pa-side-nav-swap",
        )}
      >
        {compact ? (
          <>
            <div className="flex flex-col items-stretch gap-0.5">
              {navParts.top.flatMap((section) =>
                section.items.map((item) => (
                  <RailTile
                    key={`${item.href}-${item.label}`}
                    item={item}
                    active={isNavActive(pathname, item.href, items)}
                  />
                )),
              )}
              {navParts.groups.map((section) => (
                <RailGroup
                  key={section.group}
                  group={section.group!}
                  items={section.items}
                  pathname={pathname}
                  allItems={items}
                  expanded={openGroup === section.group}
                  onToggle={() => toggleGroup(section.group!)}
                  onClose={() => setOpenGroup(null)}
                />
              ))}
            </div>
            {navParts.tail.length > 0 ? (
              <div className="mt-auto flex flex-col items-stretch gap-0.5 pt-1">
                <span className="pa-side-rail-rule mx-2 mb-1" aria-hidden />
                {navParts.tail.flatMap((section) =>
                  section.items.map((item) => (
                    <RailTile
                      key={`${item.href}-${item.label}`}
                      item={item}
                      active={isNavActive(pathname, item.href, items)}
                    />
                  )),
                )}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {navParts.top.map((section, index) => (
              <div key={`top-${index}`}>
                {section.items.map((item) => (
                  <NavLink
                    key={`${item.href}-${item.label}`}
                    item={item}
                    active={isNavActive(pathname, item.href, items)}
                  />
                ))}
              </div>
            ))}
            {navParts.groups.map((section) => (
              <NavGroup
                key={section.group}
                group={section.group!}
                items={section.items}
                pathname={pathname}
                allItems={items}
                expanded={openGroup === section.group}
                onToggle={() => toggleGroup(section.group!)}
              />
            ))}
          </>
        )}
      </nav>

      {!compact && navParts.tail.length > 0 ? (
        <div className={cn("shrink-0 border-t py-2", compact ? "px-1.5" : "px-2.5")} style={{ borderColor: "var(--chrome-line)" }}>
          {navParts.tail.map((section, index) => (
            <div key={`tail-${index}`}>
              {section.items.map((item) => (
                <NavLink
                  key={`${item.href}-${item.label}`}
                  item={item}
                  active={isNavActive(pathname, item.href, items)}
                  compact={compact}
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {/* Profile and Sign out at the foot of the rail. */}
      {signOut || account ? (
      <div className={cn("border-t", compact ? "px-1.5 py-2" : "px-2.5 py-2.5")} style={{ borderColor: "var(--chrome-line)" }}>
        {/*
         * Sign out above the account row: that row is what you press to change
         * a photograph — occasional and deliberate — and it sits at the very
         * bottom of the window where a mis-aimed click lands.
         */}
        {signOut ? (
          <form action="/auth/sign-out" method="post" className={compact ? "mb-2" : "mb-2.5"}>
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className={cn(
                "flex items-center rounded-control text-[12.5px] font-medium transition-colors",
                "text-[var(--text-secondary)] hover:bg-[var(--chrome-hover)] hover:text-[var(--ink)]",
                compact ? "h-8 w-full justify-center" : "w-full gap-2 px-2 py-[7px]",
              )}
            >
              <SignOutMark />
              {!compact ? "Sign out" : null}
            </button>
          </form>
        ) : null}

        {!account ? null : accountHref ? (
          <Link
            href={accountHref}
            title={userEmail ? `${userName} · ${userEmail}` : "Profile settings"}
            aria-label="Open profile settings"
            className={cn(
              "flex items-center no-underline transition-colors",
              compact
                ? "justify-center rounded-control p-1 hover:bg-[var(--chrome-hover)]"
                : "pa-side-account gap-2.5 px-2 py-2",
            )}
            style={{ color: "var(--ink)" }}
          >
            <Avatar name={userName} size={compact ? 26 : 28} src={userPhoto} />
            {!compact ? (
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{userName}</div>
                {userRole || userEmail ? (
                  <div className="truncate text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                    {userRole || userEmail}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Link>
        ) : (
          <div
            className={cn(
              "flex items-center",
              compact ? "justify-center" : "pa-side-account gap-2.5 px-2 py-2",
            )}
          >
            <Avatar name={userName} size={compact ? 26 : 28} src={userPhoto} />
            {!compact ? (
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{userName}</div>
                {userRole || userEmail ? (
                  <div className="truncate text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                    {userRole || userEmail}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
      ) : null}
      </div>
    </aside>
    </>
  );
}

function DoubleChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d={collapsed ? "M3.2 4.2 6.8 8 3.2 11.8M8.4 4.2 12 8l-3.6 3.8" : "M12.8 4.2 9.2 8l3.6 3.8M7.6 4.2 4 8l3.6 3.8"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuMark() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
    </svg>
  );
}

/**
 * A door with an arrow leaving it, drawn rather than set as a character.
 *
 * Sign out used to be a line of grey text with nothing around it, which read
 * as a caption rather than as something you could press.
 */
function SignOutMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6" />
      <path d="M10.5 11 14 8l-3.5-3" />
      <path d="M14 8H6" />
    </svg>
  );
}

function splitNav(items: NavItem[]) {
  const sections = toSections(items);
  const top: { group?: string; items: NavItem[] }[] = [];
  const groups: { group?: string; items: NavItem[] }[] = [];
  const tail: { group?: string; items: NavItem[] }[] = [];
  let seenGroup = false;
  for (const section of sections) {
    if (section.group) {
      seenGroup = true;
      groups.push(section);
    } else if (!seenGroup) {
      top.push(section);
    } else {
      tail.push(section);
    }
  }
  return { top, groups, tail };
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

function groupIconOf(group: string) {
  switch (group) {
    case "Relationships":
      return <NavIcon href="/whitbyos/clients" label="Clients" />;
    case "Work":
      return <NavIcon href="/whitbyos/requests" label="Requests" />;
    case "Collaboration":
      return <NavIcon href="/whitbyos/messages" label="Messages" />;
    case "Information":
      return <NavIcon href="/whitbyos/documents" label="Documents" />;
    /* The client portal still groups its own rail as Communication and
       Content. This function is shared, so renaming Whitby's groups must not
       take the portal's icons with them. */
    case "Communication":
      return <NavIcon href="/whitbyos/messages" label="Messages" />;
    case "Content":
      return <NavIcon href="/whitbyos/documents" label="Documents" />;
    case "Reporting":
      return <NavIcon href="/whitbyos/insights" label="Insights" />;
    default:
      return <NavIcon href="" label={group} />;
  }
}

function railCaption(label: string) {
  switch (label) {
    case "Relationships":
      return "People";
    case "Collaboration":
      return "Chat";
    /* Documents, Knowledge, Insights and Reports. "Files" was the old
       Content group and is wrong for a group that holds two of them. */
    case "Information":
      return "Info";
    /* The client portal's own group names, kept because this is shared. */
    case "Communication":
      return "Chat";
    case "Content":
      return "Files";
    case "Reporting":
      return "Reports";
    default:
      return label;
  }
}

function RailTile({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      title={item.label}
      prefetch={false}
      className="pa-side-rail-item"
      aria-current={active ? "page" : undefined}
    >
      <span className="pa-side-rail-icon">
        <NavIcon href={item.href} label={item.label} />
        {item.attention ? (
          <span className="pa-side-rail-dot" style={{ background: "var(--danger-solid)" }} />
        ) : null}
      </span>
      <span className="pa-side-rail-label">{railCaption(item.label)}</span>
    </Link>
  );
}

function RailGroup({
  group,
  items,
  pathname,
  allItems,
  expanded,
  onToggle,
  onClose,
}: {
  group: string;
  items: NavItem[];
  pathname: string;
  allItems: NavItem[];
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const holdsCurrent = items.some((item) => isNavActive(pathname, item.href, allItems));
  const waiting = items.some((item) => item.attention);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const row = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function place() {
    const box = row.current?.getBoundingClientRect();
    if (box) {
      setPos({
        top: Math.min(Math.max(8, box.top - 8), window.innerHeight - 300),
        left: box.right + 8,
      });
    }
  }

  function show() {
    place();
    onToggle();
  }

  useEffect(() => {
    if (expanded) place();
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    function away(event: MouseEvent) {
      if (row.current?.contains(event.target as Node)) return;
      const fly = document.getElementById(`pa-rail-flyout-${group}`);
      if (fly?.contains(event.target as Node)) return;
      onClose();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [expanded, group, onClose]);

  return (
    <>
      <button
        ref={row}
        type="button"
        onClick={show}
        title={group}
        aria-expanded={expanded}
        aria-current={holdsCurrent ? "true" : undefined}
        className="pa-side-rail-item pa-side-rail-parent"
      >
        <span className="pa-side-rail-icon">
          {groupIconOf(group)}
          {waiting ? (
            <span className="pa-side-rail-dot" style={{ background: "var(--danger-solid)" }} />
          ) : null}
        </span>
        <span className="pa-side-rail-label">
          {railCaption(group)}
          <span className="pa-side-rail-parent-mark" aria-hidden>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M2.2 1.4 5.4 4 2.2 6.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
      </button>
      {/*
       * Portal only after mount.
       *
       * `typeof document !== "undefined"` is true on the client during
       * hydration and false on the server, so the same `expanded` flag drew
       * a flyout on one side and nothing on the other. Wait for mount so
       * both passes agree on null first.
       */}
      {expanded && mounted
        ? createPortal(
            <div
              id={`pa-rail-flyout-${group}`}
              className="pa-side-flyout fixed z-[70]"
              style={{ top: pos.top, left: pos.left }}
            >
              <div className="pa-side-flyout-head">
                <span className="pa-side-flyout-mark">
                  {groupIconOf(group)}
                  {waiting ? (
                    <span className="pa-side-rail-dot" style={{ background: "var(--danger-solid)" }} />
                  ) : null}
                </span>
                <p>{group}</p>
              </div>
              {items.map((item) => (
                <NavLink
                  key={`${item.href}-${item.label}`}
                  item={item}
                  active={isNavActive(pathname, item.href, allItems)}
                />
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function NavLink({
  item,
  active,
  compact,
  nested,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
  nested?: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={compact ? item.label : undefined}
      prefetch={false}
      className={cn(
        "pa-side-nav-link mb-[3px] flex items-center py-[8px] text-[13.5px]",
        compact ? "pa-side-nav-compact relative justify-center px-0" : nested ? "px-2.5 pl-2" : "px-2.5",
        active && "font-semibold",
      )}
      aria-current={active ? "page" : undefined}
      style={{ color: "var(--ink)" }}
    >
      <NavGlyph href={item.href} label={item.label} compact={compact} />
      {compact ? null : item.label}
      {item.attention ? (
        <span
          aria-label={
            item.count ? `${item.count} waiting for you` : "Something is waiting for you"
          }
          // At the end of the row, not against the word: a mark that sits
          // where the label happens to stop moves from row to row. Closed,
          // there is no row to sit at the end of, so it goes on the glyph.
          className={cn(
            "flex shrink-0 items-center gap-1.5",
            compact ? "absolute right-[9px] top-[5px]" : "ml-auto",
          )}
        >
          <span
            className="h-[6px] w-[6px] shrink-0 rounded-full"
            style={{ background: "var(--danger-solid)" }}
          />
          {/* Closed, the rail is 56px and there is no room for a number
              beside the dot — the dot alone still says to open it. */}
          {item.count && !compact ? (
            <span
              className="shrink-0 text-[11.5px] font-bold tabular-nums"
              style={{ color: "var(--danger-solid)" }}
            >
              {item.count > 99 ? "99+" : item.count}
            </span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The item's own icon, and a spinner in its place while that page is being
 * fetched.
 *
 * `loading.tsx` is the usual answer, and it never appears here: these links
 * prefetch, so a sidebar navigation finishes in 35–80ms and the route is
 * already in hand — nothing suspends, so nothing renders a skeleton. Pressing
 * a nav item therefore looked like it had done nothing at all until the new
 * page arrived.
 *
 * `useLinkStatus` reports the pending state of the Link it sits inside, so
 * this says so from the moment of the press, however long the wait turns out
 * to be. It takes the icon's own place rather than adding anything beside it,
 * so no row moves.
 */
function NavGlyph({
  href,
  label,
  compact,
}: {
  href: string;
  label: string;
  compact?: boolean;
}) {
  const { pending } = useLinkStatus();

  return (
    <span
      // 15px wide and no size of its own: the export lets the glyph take the
      // item's 14px, and pinning it to 11 was quietly shrinking every icon in
      // the rail. The spinner inside keeps its own 11px.
      className={cn(
        "inline-flex items-center justify-center",
        // Bigger and darker with no label beside it. A 15px outline at 65%
        // grey is legible next to a word and is a smudge on its own.
        compact ? "h-[20px] w-[20px]" : "mr-2 h-[18px] w-[18px]",
      )}
      // The row sets `--nav-glyph` when it is the page being read, so the icon
      // goes with the label rather than staying grey beside a blue word.
      style={{ color: `var(--nav-glyph, ${compact ? "rgba(55,53,47,.78)" : "rgba(55,53,47,.62)"})` }}
      aria-hidden={!pending}
    >
      {pending ? (
        <span
          className="inline-block h-[11px] w-[11px] animate-spin rounded-full border-[1.5px] border-solid"
          style={{ borderColor: "var(--border-strong)", borderTopColor: "var(--ink)" }}
        />
      ) : (
        /*
         * A drawn icon, not the character in `NavItem.icon`.
         *
         * The rail carried unicode geometry — ◔ ⚇ ◫ ☰ ❖ ▤ ☑ ▦ — which is
         * faint at any size, differs by font, and closed to 56px is seventeen
         * smudges in a column. `NavIcons` has had real ones the whole time and
         * nothing was reading them.
         */
        <NavIcon href={href} label={label} />
      )}
    </span>
  );
}

/**
 * A collapsible section. Opening one closes the others.
 */
function NavGroup({
  group,
  items,
  pathname,
  allItems,
  expanded,
  onToggle,
}: {
  group: string;
  items: NavItem[];
  pathname: string;
  allItems: NavItem[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const waiting = items.some((item) => item.attention);

  return (
    <div className="pa-side-nav-section">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="pa-side-nav-group flex w-full items-center gap-2 rounded-[10px] px-2 py-[7px]"
      >
        <span className="pa-side-group-icon" aria-hidden>
          {groupIconOf(group)}
          {waiting ? (
            <span className="pa-side-rail-dot" style={{ background: "var(--danger-solid)" }} />
          ) : null}
        </span>
        <span className="pa-side-group-name min-w-0 flex-1 text-left">
          {group}
        </span>
        <span className={cn("pa-side-nav-caret flex h-4 w-4 shrink-0 items-center justify-center", expanded && "is-open")} aria-hidden>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M4.5 3 7.5 6 4.5 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      <div className={cn("pa-side-nav-fold", expanded && "is-open")}>
        <div className="pa-side-nav-fold-inner">
          {items.map((item) => (
            <NavLink
              key={`${item.href}-${item.label}`}
              item={item}
              active={isNavActive(pathname, item.href, allItems)}
              nested
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function isNavActive(pathname: string, href: string, items: NavItem[]) {
  const matches = items.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (matches.length === 0) return false;
  const best = [...matches].sort((a, b) => b.href.length - a.href.length)[0];
  return best?.href === href;
}


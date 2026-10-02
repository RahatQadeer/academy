import Link from "next/link";
import { cn } from "@/base/lib/cn";

export type SubNavItem = {
  key: string;
  label: string;
  href: string;
  count?: number;
  /** Count badge tone. Defaults to the tan "warning" style used everywhere else. */
  countTone?: "warning" | "danger";
};

/**
 * Sub-navigation for a portal section (Home: Overview / Action Needed / Recent
 * Activity, and so on). Rendered as links rather than client-side state so every
 * tab is a real, shareable URL and the pages stay server components.
 *
 * The active tab is underlined in ink, not accent. Whitby draws it in ink on
 * six screens — Forms, Documents, Contacts, Updates, Playbooks and the Client
 * tabs — and reserves accent for the one place a tab row sits inside a Request.
 * Accent here put the loudest colour on the page on a control saying where you
 * already are, which is the one thing on a screen nobody needs telling.
 *
 * The resting colour moves with it: --text-tertiary rather than
 * --text-secondary, so the gap between the tab you are on and the tabs you are
 * not is carried by weight and colour together, as it is on the other side.
 */
export function SubNav({
  items,
  active,
  tour,
}: {
  items: SubNavItem[];
  active: string;
  /**
   * A name for the welcome tour to point at, for the one screen whose tabs the
   * tour explains. Absent everywhere else, so a row of tabs with nothing to
   * say about itself is drawn exactly as it was.
   */
  tour?: string;
}) {
  return (
    <nav
      data-tour={tour}
      // One line that scrolls, never a wrap. A Request's nine tabs on a phone
      // wrapped to three rows, and the underline of the one you were on sat
      // in the middle of the stack rather than on the rule beneath it.
      // The rule is an inset shadow rather than a border: a scrolling box
      // clips at its padding edge, so a tab's underline pulled over a real
      // border by -1px would be cut off and leave a pixel of vertical scroll.
      className="pa-no-scrollbar mb-6 flex items-center gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--border)]"
      style={{ borderColor: "var(--border)" }}
    >
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13.5px] no-underline",
              isActive ? "font-semibold" : "font-normal",
            )}
            style={{
              borderColor: isActive ? "var(--ink)" : "transparent",
              color: isActive ? "var(--ink)" : "var(--text-tertiary)",
            }}
          >
            {item.label}
            {item.count ? (
              <span
                className={cn(
                  "inline-flex min-w-[18px] items-center justify-center px-1.5 py-px text-[11px] font-medium",
                  item.countTone === "danger" ? "rounded-full" : "rounded",
                )}
                style={
                  item.countTone === "danger"
                    ? { background: "var(--danger-bg)", color: "var(--danger-fg)" }
                    : { background: "var(--warning-bg)", color: "var(--warning-fg)" }
                }
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Builds `?tab=` hrefs for a base path, omitting the param for the default tab. */
export function tabHref(basePath: string, key: string, defaultKey: string) {
  return key === defaultKey ? basePath : `${basePath}?tab=${key}`;
}

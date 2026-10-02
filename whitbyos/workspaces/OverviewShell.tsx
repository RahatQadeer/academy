"use client";

import { useEffect, useState } from "react";
import { cn } from "@/base/lib/cn";

const STORAGE = "pa-workspace-rail-collapsed";

/**
 * Workspace Overview chrome: a full-height client rail with the firm at the
 * top, and a header that only spans the overview.
 *
 * Collapse is remembered. On a laptop the rail narrows to avatars; on a phone
 * it becomes a drawer.
 */
export function OverviewShell({
  showRail,
  brand,
  org,
  headerLeft,
  headerRight,
  rail,
  railFooter,
  railEyebrow = "Workspaces",
  railNote,
  banner,
  children,
}: {
  showRail: boolean;
  brand: React.ReactNode;
  /** The firm, at the foot of the rail beside what it makes. */
  org?: React.ReactNode;
  headerLeft: React.ReactNode;
  headerRight: React.ReactNode;
  rail?: React.ReactNode;
  railFooter?: React.ReactNode;
  railEyebrow?: string;
  railNote?: string;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!drawer) return;
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawer(false);
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [drawer]);

  function toggle() {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setDrawer((open) => !open);
      return;
    }
    setCollapsed((was) => {
      const next = !was;
      try {
        window.localStorage.setItem(STORAGE, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const railEl = showRail ? (
    <>
      {drawer ? (
        <button
          type="button"
          aria-label="Close workspaces"
          className="fixed inset-0 z-[15] bg-[rgba(55,53,47,.28)] lg:hidden"
          onClick={() => setDrawer(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Open workspaces"
          className="fixed bottom-5 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-[8px] lg:hidden"
          style={{
            color: "var(--accent)",
            background: "var(--surface)",
            boxShadow: "0 0 0 1px var(--chrome-line), 0 4px 12px -6px rgba(15,32,56,.28)",
          }}
        >
          <RailGlyph collapsed />
        </button>
      )}
      <aside
        className={cn(
          "ws-overview-rail ws-rail relative z-20 flex w-full shrink-0 flex-col transition-[width] duration-200 ease-out lg:h-full lg:min-h-0",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-20 max-lg:w-[280px]",
          drawer ? "max-lg:flex" : "max-lg:hidden",
          collapsed ? "lg:w-[64px]" : "lg:w-[260px]",
        )}
        data-collapsed={collapsed ? "true" : "false"}
      >
        <div className="ws-rail-brand shrink-0 px-3 pb-3 pt-3.5">{brand}</div>

        {/* Room above the heading. It sat tight under the rule below the
            product's corner, so the two read as one crowded block. */}
        <div className="ws-rail-toolbar flex items-center justify-between gap-2 px-3 pb-2 pt-6">
          <div className="ws-rail-copy min-w-0 flex-1">
            <h2
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--text-quiet)" }}
            >
              {railEyebrow}
            </h2>
            {railNote ? (
              <p className="mt-[1px] text-[11px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                {railNote}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand workspaces" : "Collapse workspaces"}
            title={collapsed ? "Expand workspaces" : "Collapse workspaces"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] transition-colors hover:bg-[var(--surface-soft)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <RailGlyph collapsed={collapsed} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5">{rail}</div>

        <div className="ws-rail-foot mt-auto shrink-0">
          {railFooter ? <div className="px-2.5 py-2.5">{railFooter}</div> : null}
          {org ? <div className="ws-rail-org px-3 py-2.5">{org}</div> : null}
        </div>
      </aside>
    </>
  ) : null;

  const header = (
    <header className="ws-overview-header relative z-10 shrink-0">
      <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="hidden h-[22px] w-[3px] shrink-0 rounded-full sm:block"
            style={{
              background:
                "linear-gradient(180deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 35%, transparent) 100%)",
            }}
          />
          <div className="min-w-0">{headerLeft}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">{headerRight}</div>
      </div>
    </header>
  );

  return (
    <div
      className="ws-overview fixed inset-0 z-50 flex flex-col lg:flex-row"
      data-collapsed={collapsed ? "true" : "false"}
    >
      {railEl}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {header}
        {banner}
        <main className="ws-overview-main min-h-0 min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function RailGlyph({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1.5"
        y="2"
        width="13"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M6 2.5v11" stroke="currentColor" strokeWidth="1.4" />
      <path
        d={collapsed ? "M9.2 8h3.2M11.2 6.2v3.6" : "M9.5 8h3"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

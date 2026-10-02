"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { switchWorkspace } from "@/whitbyos/actions";

export type WorkspaceOption = {
  id: string;
  name: string;
  /** Signed, because the bucket it lives in is private. */
  logo: string | null;
  activeRequests: number;
};

/**
 * Quick Add, Switch workspace, and Add Widget, in the shell's own top bar.
 *
 * The first two open a panel over the page, so they are one component rather
 * than two: they share the outside-click and Escape handling, and both open at
 * once would be a bug.
 *
 * No avatar here any more. The sidebar's footer already carries the name, the
 * address and Sign out, and a second circle of initials that does nothing was
 * the same person said twice.
 */
export function HeaderControls({
  workspaces,
  currentWorkspaceId,
  quickAdd,
  onHome,
}: {
  workspaces: WorkspaceOption[];
  currentWorkspaceId: string | null;
  quickAdd: { href: string; label: string; description: string }[];
  /** Add Widget belongs to Home; the rest belong to every screen. */
  onHome: boolean;
}) {
  const [open, setOpen] = useState<"add" | "workspace" | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function away(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }

    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={box} className="relative flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setOpen(open === "add" ? null : "add")}
          aria-label="Quick Add"
          aria-expanded={open === "add"}
          title="Quick Add"
          className="pa-bar-btn pa-bar-accent text-[18px] font-semibold leading-none"
        >
          +
        </button>

        <button
          type="button"
          onClick={() => setOpen(open === "workspace" ? null : "workspace")}
          data-tour="workspace"
          aria-label="Switch workspace"
          aria-expanded={open === "workspace"}
          title="Switch workspace"
          className="pa-bar-btn"
        >
          {/* Two arrows passing, drawn — the glyph ⇄ arrives at whatever
              weight the font feels like and sat off-centre in a 36px box. */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M2.6 5.6h9.2L9.4 3.2M13.4 10.4H4.2l2.4 2.4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {onHome ? (
          <Link
            href="/whitbyos?widgets=1"
            className="whitespace-nowrap rounded-control border px-3 py-2 text-[13px] font-medium no-underline"
            style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
          >
            Add Widget
          </Link>
        ) : null}

      {open === "add" ? (
        <Panel>
          <PanelTitle>Quick Add</PanelTitle>
          {quickAdd.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-control px-2.5 py-2 no-underline hover:bg-[var(--surface-soft)]"
              style={{ color: "var(--ink)" }}
            >
              <span className="block text-[13.5px] font-medium">{item.label}</span>
              <span className="block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {item.description}
              </span>
            </Link>
          ))}
        </Panel>
      ) : null}

      {open === "workspace" ? (
        <Panel>
          {/*
           * "Switch workspace" over a list of one organisation was the word
           * doing two jobs. A *client* workspace is Rohail Khan; this lists
           * the firms you belong to, of which RightTail is one. The panel says
           * which it is, and the link under it says where the other kind is.
           */}
          <PanelTitle>Your organization</PanelTitle>

          {workspaces.map((workspace) => (
            <form key={workspace.id} action={switchWorkspace}>
              <input type="hidden" name="workspace_id" value={workspace.id} />
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-soft)]"
                style={
                  workspace.id === currentWorkspaceId
                    ? { background: "var(--accent-tint)" }
                    : undefined
                }
              >
                <span
                  className="flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold"
                  style={{ background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" }}
                >
                  {workspace.logo ? (
                    // Signed URL on a private bucket, which the optimiser
                    // cannot fetch.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={workspace.logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    workspace.name.slice(0, 2).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[13.5px] font-medium"
                    style={
                      workspace.id === currentWorkspaceId
                        ? { color: "var(--accent)" }
                        : undefined
                    }
                  >
                    {workspace.name}
                  </span>
                  <span className="block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {workspace.activeRequests} active request
                    {workspace.activeRequests === 1 ? "" : "s"}
                  </span>
                </span>
                {workspace.id === currentWorkspaceId ? (
                  <span className="shrink-0 text-[12px]" style={{ color: "var(--accent)" }}>
                    ✓
                  </span>
                ) : null}
              </button>
            </form>
          ))}

          {/*
           * The two ways out, under a rule rather than one above the list and
           * one below it. A panel whose first line is a link somewhere else is
           * a panel arguing with its own heading.
           *
           * "Create workspace" goes to onboarding, which names it, picks a
           * time zone and sets its work types — a menu item that skipped all
           * three would leave a workspace nobody had set up.
           */}
          <div className="mt-1.5 border-t border-line pt-1.5">
            {/*
             * A full load, not a client navigation.
             *
             * Workspace Overview is drawn as a cover over the shell, because a
             * layout cannot be told to go away for one route without staying
             * away for the next. Reached by a soft navigation, the shell is
             * still mounted and still painted while the new route is fetched,
             * so the old screen sits there for a moment and the cover snaps
             * over it — which is the flicker you saw.
             *
             * `<a>` loads the page as itself. It is the screen Whitby opens
             * on and the one that changes what every other screen is scoped
             * to; a fresh document is the honest thing to give it.
             *
             * The lint rule that wants a `<Link>` here assumes a client
             * navigation is always the better one. For a route that replaces
             * the shell rather than filling it, it is the worse one.
             */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/whitbyos/workspaces"
              onClick={() => setOpen(null)}
              className="flex items-center justify-between gap-2 rounded-control px-2.5 py-2 text-[13px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
              style={{ color: "var(--accent)" }}
            >
              All workspaces
              <span aria-hidden style={{ color: "var(--text-quiet)" }}>
                →
              </span>
            </a>
            <Link
              href="/onboarding/workspace?new=1"
              className="block rounded-control px-2.5 py-2 text-[13px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
              style={{ color: "var(--accent)" }}
            >
              + Create workspace
            </Link>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute right-0 top-[46px] z-30 flex w-[300px] flex-col gap-1 rounded-[10px] border border-line bg-surface p-3"
      style={{ boxShadow: "0 12px 40px rgba(15,15,15,.14)" }}
    >
      {children}
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[.05em]"
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </div>
  );
}

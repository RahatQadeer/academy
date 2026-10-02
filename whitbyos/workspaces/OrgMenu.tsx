"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * The organization, and everything that belongs to it rather than to a client.
 *
 * Workspace Overview has no rail and no bar — that is the point of it — so
 * until now it was the one screen in the product with no way into settings at
 * all. Pressing the firm's name is the way in, which is also where somebody
 * looks for it: account things live under the account.
 *
 * Organization-level only. What a client's workspace holds — their contacts,
 * their documents, their invoices — is reached inside that workspace, and
 * keeping the two apart is the whole reason this menu is here rather than a
 * longer rail somewhere.
 */
const LINKS: { href: string; label: string; mark: Mark; group: "firm" | "you" }[] = [
  { href: "/whitbyos/settings", label: "Organization settings", mark: "building", group: "firm" },
  {
    href: "/whitbyos/settings/organization",
    label: "Professional information",
    mark: "card",
    group: "firm",
  },
  {
    href: "/whitbyos/settings/public-information",
    label: "Public and contract",
    mark: "globe",
    group: "firm",
  },
  {
    href: "/whitbyos/settings/organization#internal-rate",
    label: "Internal billing rate",
    mark: "clock",
    group: "firm",
  },
  { href: "/whitbyos/settings/team", label: "Team and access", mark: "people", group: "firm" },
  { href: "/whitbyos/settings/billing", label: "Billing and plans", mark: "receipt", group: "firm" },
  {
    href: "/whitbyos/settings/security",
    label: "Sign-in",
    mark: "lock",
    group: "you",
  },
  { href: "/whitbyos/settings/profile", label: "Profile", mark: "person", group: "you" },
];

export function OrgMenu({
  userName,
  userPhoto,
  userInitials,
  userRole,
}: {
  userName: string;
  userPhoto: string | null;
  userInitials: string;
  userRole: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  /*
   * Closed by anything that means "not this": a press elsewhere, Escape, or
   * following one of the links. Bound only while it is open, so a screen that
   * spends most of its life with this shut is not listening to every click on
   * the page.
   */
  useEffect(() => {
    if (!open) return;

    function away(event: MouseEvent) {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      {/*
       * Your own face, with a cog on it.
       *
       * A bare cog said "settings" and nothing about whose. This is the one
       * place in the product that shows the organization and not a client, so
       * the person signed in belongs on it — and an avatar is also what
       * somebody reaches for when they want their own account. The cog stays,
       * as a small mark on the corner, so it still reads as the way into
       * settings rather than as decoration.
       */}
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${userName}: organization and account settings`}
        title={`${userName} · ${userRole}`}
        className="relative flex h-[36px] w-[36px] items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-soft)]"
        style={{
          boxShadow: open
            ? "0 0 0 2px var(--surface), 0 0 0 4px var(--accent)"
            : "0 0 0 1px var(--chrome-line)",
        }}
      >
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center overflow-hidden rounded-full text-[12px] font-bold"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        >
          {userPhoto ? (
            // A signed URL on a private bucket, which the optimiser cannot
            // fetch; a Google photo is refused when a referrer is sent.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userPhoto}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            userInitials
          )}
        </span>

        <span
          aria-hidden
          className="absolute -bottom-[3px] -right-[3px] flex h-[17px] w-[17px] items-center justify-center rounded-full transition-transform duration-300"
          style={{
            background: "var(--accent)",
            color: "#ffffff",
            boxShadow: "0 0 0 2px var(--surface)",
            transform: open ? "rotate(45deg)" : undefined,
          }}
        >
          <CogIcon size={11} />
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[258px] overflow-hidden rounded-[14px] border p-1.5"
          style={{
            background: "var(--surface)",
            borderColor: "var(--chrome-line)",
            boxShadow: "0 1px 2px rgba(15,32,56,.08), 0 24px 48px -20px rgba(15,32,56,.45)",
          }}
        >
          {/* Whose account this is, above what can be done with it. */}
          <div className="flex items-center gap-2.5 rounded-[10px] px-2 py-2">
            <span
              aria-hidden
              className="flex h-[32px] w-[32px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold"
              style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
            >
              {userPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userPhoto}
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                userInitials
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold leading-tight">
                {userName}
              </span>
              <span
                className="mt-[3px] block truncate text-[11px] font-medium uppercase tracking-[0.06em]"
                style={{ color: "var(--accent)" }}
              >
                {userRole}
              </span>
            </span>
          </div>

          {/*
           * Labels, not paragraphs.
           *
           * Every row carried a sentence explaining itself, which made seven
           * choices into a wall of small grey text taller than the screen it
           * opened over. "Internal billing rate" says what it is; the mark
           * beside it is what the eye actually uses to find the row again.
           */}
          <Group label="Organization">
            {LINKS.filter((link) => link.group === "firm").map((link) => (
              <Row key={link.href} link={link} onGo={() => setOpen(false)} />
            ))}
          </Group>

          <Group label="Account">
            {LINKS.filter((link) => link.group === "you").map((link) => (
              <Row key={link.href} link={link} onGo={() => setOpen(false)} />
            ))}

            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-[9px] px-2 py-[7px] text-left text-[13px] transition-colors hover:bg-[var(--danger-bg,#ffe2dd)]"
                style={{ color: "var(--danger-text)" }}
              >
                <span aria-hidden className="shrink-0">
                  <MenuIcon mark="out" />
                </span>
                Sign out
              </button>
            </form>
          </Group>
        </div>
      ) : null}
    </div>
  );
}

/** A named handful of rows, with a rule above all but the first. */
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-1.5 border-t border-line pt-1.5">
      <div
        className="px-2 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--text-quiet)" }}
      >
        {label}
      </div>
      <div className="flex flex-col gap-px">{children}</div>
    </div>
  );
}

function Row({
  link,
  onGo,
}: {
  link: { href: string; label: string; mark: Mark };
  onGo: () => void;
}) {
  return (
    <Link
      href={link.href}
      role="menuitem"
      onClick={onGo}
      /* Fetched before it is pressed: these screens are the slowest in the
         product to reach and this menu is where somebody reaches them. */
      prefetch
      className="pa-org-row flex items-center gap-2.5 rounded-[9px] px-2 py-[7px] text-[13px] no-underline transition-colors hover:bg-[var(--surface-soft)]"
      style={{ color: "var(--ink)" }}
    >
      <span aria-hidden className="shrink-0" style={{ color: "var(--text-tertiary)" }}>
        <MenuIcon mark={link.mark} />
      </span>
      <span className="truncate">{link.label}</span>
    </Link>
  );
}

type Mark =
  | "building"
  | "card"
  | "globe"
  | "clock"
  | "people"
  | "receipt"
  | "person"
  | "lock"
  | "out";

/**
 * One 15px mark per row, drawn on the same grid and in one weight — a menu
 * where every icon comes from a different hand is worse than no icons at all.
 */
function MenuIcon({ mark }: { mark: Mark }) {
  const paths: Record<Mark, React.ReactNode> = {
    building: (
      <>
        <path d="M3.2 13.4V4.2a1 1 0 0 1 1-1h4.3a1 1 0 0 1 1 1v9.2" />
        <path d="M9.5 6.6h2.3a1 1 0 0 1 1 1v5.8" />
        <path d="M2.2 13.4h11.6M5.4 5.8h1.9M5.4 8.1h1.9M5.4 10.4h1.9" />
      </>
    ),
    card: (
      <>
        <rect x="2.4" y="3.8" width="11.2" height="8.4" rx="1.4" />
        <path d="M2.4 6.6h11.2M5 9.4h3" />
      </>
    ),
    globe: (
      <>
        <circle cx="8" cy="8" r="5.3" />
        <path d="M2.7 8h10.6M8 2.7c1.5 1.6 2.2 3.4 2.2 5.3S9.5 11.7 8 13.3c-1.5-1.6-2.2-3.4-2.2-5.3S6.5 4.3 8 2.7Z" />
      </>
    ),
    clock: (
      <>
        <circle cx="8" cy="8" r="5.3" />
        <path d="M8 5.1V8l2 1.3" />
      </>
    ),
    people: (
      <>
        <circle cx="6.4" cy="6.2" r="2.1" />
        <path d="M2.6 13c0-2 1.7-3.3 3.8-3.3S10.2 11 10.2 13" />
        <path d="M10.8 5.2a2 2 0 0 1 0 3.9M11.6 13c0-1.3-.4-2.3-1.2-3" />
      </>
    ),
    receipt: (
      <>
        <path d="M4 2.6h8v11l-1.6-1-1.6 1-1.6-1-1.6 1L4 13.6v-11Z" />
        <path d="M6.2 6h3.6M6.2 8.6h3.6" />
      </>
    ),
    person: (
      <>
        <circle cx="8" cy="5.7" r="2.4" />
        <path d="M3.4 13.2c0-2.3 2-3.7 4.6-3.7s4.6 1.4 4.6 3.7" />
      </>
    ),
    lock: (
      <>
        <rect x="3.6" y="7.2" width="8.8" height="6.4" rx="1.3" />
        <path d="M5.6 7.2V5.6a2.4 2.4 0 0 1 4.8 0v1.6" />
      </>
    ),
    out: (
      <>
        <path d="M6.2 13.4H3.6a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1h2.6" />
        <path d="M9.6 10.8 12.4 8 9.6 5.2M12.4 8H6.2" />
      </>
    ),
  };

  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[mark]}
    </svg>
  );
}

/** Eight teeth and a hole, drawn rather than set as a character — a glyph cog
    renders at whatever weight the font feels like and never matches the
    outlined button beside it. */
function CogIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 12.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M16.2 12.1a1.4 1.4 0 0 0 .28 1.54l.05.05a1.7 1.7 0 1 1-2.4 2.4l-.05-.05a1.4 1.4 0 0 0-1.54-.28 1.4 1.4 0 0 0-.85 1.29v.14a1.7 1.7 0 1 1-3.4 0v-.07a1.4 1.4 0 0 0-.92-1.29 1.4 1.4 0 0 0-1.54.28l-.05.05a1.7 1.7 0 1 1-2.4-2.4l.05-.05a1.4 1.4 0 0 0 .28-1.54 1.4 1.4 0 0 0-1.29-.85h-.14a1.7 1.7 0 1 1 0-3.4h.07a1.4 1.4 0 0 0 1.29-.92 1.4 1.4 0 0 0-.28-1.54l-.05-.05a1.7 1.7 0 1 1 2.4-2.4l.05.05a1.4 1.4 0 0 0 1.54.28h.07a1.4 1.4 0 0 0 .85-1.29v-.14a1.7 1.7 0 1 1 3.4 0v.07a1.4 1.4 0 0 0 .85 1.29 1.4 1.4 0 0 0 1.54-.28l.05-.05a1.7 1.7 0 1 1 2.4 2.4l-.05.05a1.4 1.4 0 0 0-.28 1.54v.07a1.4 1.4 0 0 0 1.29.85h.14a1.7 1.7 0 1 1 0 3.4h-.07a1.4 1.4 0 0 0-1.29.85Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

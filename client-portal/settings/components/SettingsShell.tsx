import Link from "next/link";

/** Every pane that exists, which is what a `SettingsKey` may be. */
const ALL_SETTINGS_PAGES = [
  { key: "profile", label: "Profile & Contact" },
  { key: "preferences", label: "Preferences" },
  { key: "notifications", label: "Notifications" },
  { key: "people", label: "People & Access" },
  { key: "security", label: "Security" },
  { key: "privacy", label: "Privacy" },
] as const;

export type SettingsKey = (typeof ALL_SETTINGS_PAGES)[number]["key"];

/**
 * Panes kept off the nav for now.
 *
 * Preferences, Notifications and Privacy are unfinished and are being left
 * until later, so they are taken off the rail rather than out of the product:
 * the screens, their actions and their routes are all untouched and still
 * typecheck, and each is still reachable by its own URL for whoever is working
 * on it. Empty this list to put all three back — that is the whole of the
 * change, in one line.
 *
 * Hidden rather than deleted because the code behind them is wanted: notify
 * preferences already read and write `client_portal_notification_prefs`, and
 * Privacy carries the deletion round trip.
 */
const HIDDEN_FOR_NOW: SettingsKey[] = ["preferences", "notifications", "privacy"];

export const SETTINGS_PAGES = ALL_SETTINGS_PAGES.filter(
  (page) => !HIDDEN_FOR_NOW.includes(page.key),
);

/** The panel's padding, which `width` is quoted inside of. */
const PANEL_PADDING = 64;
/** The frame's, which `maxWidth` is quoted inside of — Tailwind's border-box. */
const FRAME_PADDING = 48;

/**
 * Profile & Settings sits under the avatar menu rather than in the main nav
 * (SRS 13.2.4). Base's Sidebar has no avatar menu slot yet, so these pages are
 * reachable at /client-portal/settings/* and linked from here until it does.
 *
 * THE PANES ARE TABS, NOT A RAIL
 *
 * They were a 208px card of three links with a 36px gap beside it, and then
 * the panel — so a pane of six fields was drawn in the right two-thirds of the
 * screen with a quarter of it spent on three words and the gap between them
 * and the panel. Three items do not need a column; they need a row. The tabs
 * sit directly under the bar on one track, the panel takes the width they used
 * to share, and the number of tabs is the only thing that would ever argue for
 * changing it back.
 *
 * The track is the same segmented switch the Calendar picks its view with and
 * Tasks picks its half with — one object for "which of these am I looking at",
 * wherever the portal asks it.
 *
 * `width` is the panel's content, padding excluded, and the frame is sized from
 * it so the tabs and the panel stay centred together under any pane. A pane of
 * fields wants the default; People & Access carries a roster and is given more.
 *
 * The panel is keyed on the pane, so it is a new node on every switch and
 * arrives with `.cp-pane-in` rather than being swapped underneath the reader.
 */
export function SettingsShell({
  active,
  title,
  description,
  width = 680,
  children,
}: {
  active: SettingsKey;
  title: string;
  description?: string;
  width?: number;
  children: React.ReactNode;
}) {
  const panelWidth = width + PANEL_PADDING;

  return (
    <div
      className="mx-auto flex flex-col gap-3.5 px-4 pb-10 pt-4 sm:px-5 lg:px-6"
      style={{ maxWidth: panelWidth + FRAME_PADDING }}
    >
      <nav
        aria-label="Settings"
        // Scrolls rather than wraps on a narrow window: a track that breaks
        // onto two lines stops reading as one switch. The centring is on the
        // track itself rather than here — see `.cp-seg-even`.
        className="pa-no-scrollbar -mx-1 overflow-x-auto px-1 py-1"
      >
        <span className="cp-seg cp-seg-even">
          {SETTINGS_PAGES.map((page) => (
            <Link
              key={page.key}
              href={`/client-portal/settings/${page.key}`}
              /*
               * Fetched before it is pressed. The skeleton is not what
               * somebody sees first: the pane they are leaving stays up until
               * the router has the next one's payload, and a handful of panes
               * is a small enough list to have all of them ready.
               */
              prefetch
              aria-current={page.key === active ? "page" : undefined}
              className="cp-seg-item"
            >
              {page.label}
            </Link>
          ))}
        </span>
      </nav>

      <div
        key={active}
        className="cp-pane-in min-w-0 rounded-[14px] border px-5 py-5 sm:px-7 sm:py-6"
        style={{
          background: "var(--surface)",
          borderColor: "var(--chrome-line)",
          boxShadow: "0 1px 2px rgb(var(--shade-rgb) / .05), 0 12px 32px -22px rgb(var(--shade-rgb) / .4)",
        }}
      >
        {/*
         * The pane's own heading, at a pane's size.
         *
         * It was the page header — 22px bold with 26px of air under it — which
         * is what it was when the portal titled its screens at the top of the
         * page. The bar above says "Profile & Settings" now, so this is a
         * heading inside a card under a row of tabs, and it is drawn as one.
         */}
        <div className="mb-[18px]">
          <h2 className="text-[16px] font-semibold tracking-[-0.2px]">{title}</h2>
          {description ? (
            <p
              className="mt-1 max-w-[62ch] text-[12.5px] leading-[1.55]"
              style={{ color: "var(--text-soft)" }}
            >
              {description}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

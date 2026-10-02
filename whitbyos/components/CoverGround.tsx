"use client";

import { usePathname } from "next/navigation";

/**
 * The ground under the screens that cover the window.
 *
 * Workspace Overview and the settings screens are drawn as a cover laid over
 * the shell by the page itself. That works, with one seam: for the frame
 * between the old page's cover leaving and the next one's skeleton arriving,
 * the segment holds nothing and the rail and bar behind it are what you see —
 * a flash of the client workspace on the way from one settings tab to another.
 *
 * This is the same ground those screens use, painted from the layout instead
 * of from the page. A layout does not remount between two pages, and a client
 * component in it re-reads the pathname on every navigation, so it is already
 * there before the first frame and stays until the last — the covers sit on
 * top of it at z-50 and the seam has nothing to show through.
 *
 * It is only a colour. Nothing is drawn on it, so it cannot be mistaken for a
 * screen that has loaded.
 */
const COVERED = ["/whitbyos/settings", "/whitbyos/workspaces"];

/** The settings that belong to the workspace open inside the shell, with the
    rail still there, so they are not covered. */
const NOT_COVERED = [
  "/whitbyos/settings/workspace",
  "/whitbyos/settings/notifications",
  "/whitbyos/settings/invoices",
  "/whitbyos/settings/archive",
];

export function CoverGround() {
  const here = usePathname();
  if (!here) return null;
  if (NOT_COVERED.some((path) => here === path || here.startsWith(`${path}/`))) return null;
  if (!COVERED.some((path) => here === path || here.startsWith(`${path}/`))) return null;

  const overview = here === "/whitbyos/workspaces" || here.startsWith("/whitbyos/workspaces/");

  return (
    <div
      aria-hidden
      className={overview ? "ws-overview pointer-events-none fixed inset-0 z-40" : "pointer-events-none fixed inset-0 z-40"}
      style={overview ? undefined : { background: "var(--canvas)" }}
    />
  );
}

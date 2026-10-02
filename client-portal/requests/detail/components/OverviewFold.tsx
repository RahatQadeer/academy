"use client";

import { useEffect, useState } from "react";

/**
 * Whether each Request's fold was open on the tab the client just left.
 *
 * Module state, not React state, because React state does not survive the
 * move: every tab is its own URL, and the catch-all route's `loading.tsx`
 * remounts the page between them. The module lives as long as the tab does, so
 * the fold arriving on "Tasks" knows it was open on "Overview" a moment ago and
 * can close from there rather than simply being closed.
 */
const lastOpen = new Map<string, boolean>();

/**
 * The part of a Request that belongs to its Overview — the facts strip and the
 * description — folding away when another tab is chosen and back when
 * Overview is.
 *
 * The strip is the Overview's summary: status, progress, target date and what
 * is waiting on the client. On Tasks or Notes it is 200px of the same four
 * facts standing between the tabs and what was asked for. So it folds, and the
 * tabs and the panel under them rise into its place.
 *
 * Height is animated as a grid row going from `1fr` to `0fr`, the one way CSS
 * animates to and from a height it does not know. The content lifts and fades
 * as it goes, so it reads as moving up out of the way rather than being cut
 * off at the bottom.
 *
 * On a first load there is nothing remembered and the fold is drawn as it
 * should be, so server and client render the same thing.
 */
export function OverviewFold({
  id,
  open,
  children,
}: {
  /** The Request, so one Request's state is not read as another's. */
  id: string;
  open: boolean;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(() => lastOpen.get(id) ?? open);

  useEffect(() => {
    lastOpen.set(id, open);
    if (shown === open) return;
    // One frame in the old state first, so there is something to move from.
    const frame = requestAnimationFrame(() => setShown(open));
    return () => cancelAnimationFrame(frame);
    // `shown` is deliberately left out: it is what this effect changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, open]);

  return (
    <div className="pa-fold" data-open={shown} aria-hidden={!shown} inert={!shown}>
      <div className="pa-fold-inner">{children}</div>
    </div>
  );
}

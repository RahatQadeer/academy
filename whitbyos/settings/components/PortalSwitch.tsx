"use client";

import { useState } from "react";

/**
 * The Client Portal's own switch.
 *
 * A checkbox, so it posts with the form's Save rather than acting the moment
 * it is touched — closing a portal signs people out of it, and that is not
 * something to do on a stray click. The label beside it is rendered by the
 * page from the saved state, so what it says is what is stored, not what is
 * showing.
 */
export function PortalSwitch({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);

  return (
    <span className="relative inline-flex shrink-0">
      <input
        type="checkbox"
        name="portal_enabled"
        checked={on}
        onChange={(event) => setOn(event.target.checked)}
        aria-label="Client Portal open"
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden
        className="h-5 w-9 rounded-full transition-colors"
        style={{ background: on ? "var(--accent)" : "var(--border-strong)" }}
      />
      <span
        aria-hidden
        className="absolute top-[2px] h-4 w-4 rounded-full bg-white transition-all"
        style={{ left: on ? "18px" : "2px", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }}
      />
    </span>
  );
}

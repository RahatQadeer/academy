/**
 * The bin, for taking a row off a list.
 *
 * Three screens draw the client's requirements — the plan's own needs
 * panel, the task page inside a plan, and the task page outside one — and
 * each had its own copy of this path. Three copies is the same icon drawn
 * three times and redrawn twice whenever it changes, which is how one of
 * them ends up a pixel off or a stroke heavier than the others.
 *
 * Deliberately not a button. What pressing it does differs by screen, and
 * an icon that knows what it deletes is an icon that cannot be used for
 * anything else.
 */
export function Bin() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 4.5h10M6.5 4.5V3.2c0-.4.3-.7.7-.7h1.6c.4 0 .7.3.7.7v1.3M4.4 4.5l.5 8c0 .5.5.9 1 .9h4.2c.5 0 1-.4 1-.9l.5-8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.8 7v4M9.2 7v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

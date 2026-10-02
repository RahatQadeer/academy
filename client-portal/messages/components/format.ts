/**
 * Times inside a conversation.
 *
 * Every one is drawn in the professional's zone (`PortalContext.timezone`), the
 * zone the rest of the portal draws dates in, and in `en-US` explicitly: these
 * run once on the server and again in the browser, and two locales spelling
 * one time differently is a hydration mismatch.
 */

const DAY = 24 * 60 * 60 * 1000;

/** The calendar day a moment falls on, in the zone — for comparing, not showing. */
export function dayKey(iso: string, timeZone: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone });
}

/** "2:14 PM". */
export function clockTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

/**
 * The line between two moments of a conversation: "Today 2:14 PM",
 * "Yesterday 9:02 AM", "Monday 4:30 PM" within the week, and the date beyond it.
 *
 * Day and time together, the way a chat marks a pause, because a separator only
 * appears where time has passed — and "Today" alone above a message sent six
 * hours after the one before it says less than it could.
 */
export function separatorLabel(iso: string, timeZone: string, now = Date.now()) {
  const date = new Date(iso);
  const time = clockTime(iso, timeZone);
  const today = dayKey(new Date(now).toISOString(), timeZone);
  const yesterday = dayKey(new Date(now - DAY).toISOString(), timeZone);
  const day = dayKey(iso, timeZone);

  if (day === today) return { day: "Today", time };
  if (day === yesterday) return { day: "Yesterday", time };

  if (now - date.getTime() < 6 * DAY) {
    return { day: date.toLocaleDateString("en-US", { weekday: "long", timeZone }), time };
  }

  const sameYear =
    date.toLocaleDateString("en-US", { year: "numeric", timeZone }) ===
    new Date(now).toLocaleDateString("en-US", { year: "numeric", timeZone });

  return {
    day: date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
      timeZone,
    }),
    time,
  };
}

/** The full moment, for a tooltip and for a screen reader. */
export function fullTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

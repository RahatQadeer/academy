import { getPortalContext } from "@/client-portal/lib/portal-context";
import { getRequest } from "@/client-portal/lib/data/requests";
import { getRequestPlan } from "@/client-portal/lib/data/plans";
import { getForm } from "@/client-portal/lib/data/forms";

/**
 * What the top bar says, for the address it is drawn over.
 *
 * WHY THE BAR AND NOT THE PAGE
 *
 * Every portal screen used to open with a title block: 36px of padding, a 26px
 * heading, 20px of air under it — and above all of that, a bar whose whole left
 * half was empty, because the portal's controls are a chip, a search, a bell and
 * a way out, and all four belong at the right end. So the first inch and a half
 * of every screen said one word, twice over in the case of a detail screen that
 * also carried "← Back to Requests" above its heading.
 *
 * The heading moves into that empty half. It costs nothing there — the bar is
 * drawn on every screen whether or not it has anything to say — and what it
 * gives back is the fold: a client opening Requests now sees rows of requests
 * where they used to see the word "Requests".
 *
 * WHY IT IS RESOLVED FROM THE ADDRESS
 *
 * The bar is chrome. It is rendered above the screen rather than by it, so the
 * screen cannot hand it a title without a round trip through the client, and a
 * title that arrives a frame after the page is a title that visibly lands.
 * Resolving it from the address instead keeps it server-rendered and correct in
 * the first byte.
 *
 * The reads that names a detail screen cost nothing: `getRequest`, `getForm`
 * and `getRequestPlan` all go through the `cache()`d list loader the screen
 * underneath is about to ask for anyway, so the row is fetched once per request
 * and read twice.
 *
 * Nothing here may throw. A title is decoration over a screen that has its own
 * error handling, and a bar that 500s because a lookup failed would take the
 * screen with it — so every dynamic branch falls back to the section's own
 * name, which is never wrong, only less specific.
 */
export type PortalPageTitle = {
  title: string;
  /** The quiet line beside it — a date, a count, a word of context. */
  note?: string;
  /** Where "‹" goes, and what it is called for a reader who cannot see it. */
  back?: { href: string; label: string };
};

const BASE = "/client-portal";

/** Every top-level section, by its first path segment. */
const SECTIONS: Record<string, string> = {
  requests: "Requests",
  tasks: "Tasks",
  calendar: "Calendar",
  messages: "Messages",
  updates: "Updates",
  forms: "Forms",
  documents: "Documents",
  billing: "Billing",
  integrations: "Integrations",
  settings: "Profile & Settings",
};

export async function portalPageTitle(slug: string[]): Promise<PortalPageTitle> {
  const [section, second, sub, planId, streams, streamId] = slug;

  // Home. The greeting and the day were the page's own header; they are the
  // only title in the portal that is about the reader rather than the screen,
  // and the bar is where a reader's own name belongs.
  if (!section) {
    const context = await getPortalContext();
    return {
      title: `Welcome back, ${context.displayName.split(/\s+/)[0]}`,
      note: new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: context.timezone,
      }),
    };
  }

  // Onboarding covers the shell with its own overlay, so the bar behind it is
  // never read. Named anyway, for the frame between one step and the next.
  if (section === "onboarding") return { title: "Set up your account" };

  const fallback = SECTIONS[section] ?? "Client Portal";

  try {
    if (section === "requests" && second) {
      const request = await getRequest(second);
      const requestPath = `${BASE}/requests/${second}`;

      if (sub === "plans" && planId) {
        const plan = await getRequestPlan(second, planId);
        const planPath = `${requestPath}/plans/${planId}`;

        // One stream of a plan — the deepest screen the portal has.
        if (streams === "streams" && streamId) {
          const stream = plan?.streams.find((row) => row.id === streamId);
          return {
            title: stream?.name ?? "Work Stream",
            note: plan?.name,
            back: { href: planPath, label: plan?.name ?? "Work Plan" },
          };
        }

        return {
          title: plan?.name ?? "Work Plan",
          note: request?.title,
          back: { href: `${requestPath}?tab=plans`, label: "Work Plans" },
        };
      }

      return {
        title: request?.title ?? "Request",
        back: { href: `${BASE}/requests`, label: "Requests" },
      };
    }

    if (section === "forms" && second) {
      const form = await getForm(second);
      return {
        title: form?.title ?? "Form",
        back: { href: `${BASE}/forms`, label: "Forms" },
      };
    }
  } catch {
    // Said above: the section's own name, rather than no screen at all.
    return { title: fallback };
  }

  // A connected mailbox, read under Integrations. "Email" rather than the
  // provider, which is what the screen itself has always called it.
  if (section === "integrations" && second) {
    return {
      title: "Email",
      back: { href: `${BASE}/integrations`, label: "Integrations" },
    };
  }

  // Settings is the one section the bar does not name the pane of. The pane is
  // a card with its own heading, beside a rail naming the other five — the bar
  // repeating whichever is open would be the same words twice within an inch.
  // It names the nav item that got the client here instead.

  return { title: fallback };
}

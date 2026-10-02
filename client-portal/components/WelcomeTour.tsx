import { WelcomeTour as Tour, type TourStep } from "@/base/components/WelcomeTour";

/**
 * The client's first visit, in five steps and a card.
 *
 * Whitby has run one of these since 056 and the portal ran nothing: a client
 * accepted an invitation, landed on a dashboard of counts and widgets they had
 * never been shown, and was left to find the rail, the bell and the tabs on
 * their own. This is the same spotlight — `base/components/WelcomeTour.tsx` —
 * saying the five things that are true on this side of the wall.
 *
 * It is deliberately not Whitby's six. A client has no workspace to switch, no
 * Quick Add and no widget picker; what they have is a rail whose items depend
 * on what they were granted, a bar that holds search, the bell and the way out,
 * and a Home split into three tabs where the one thing they usually came for —
 * something waiting on them — is behind the middle one.
 *
 * Every step but the last names a `data-tour` target that exists on Home. A
 * step whose target is missing keeps its card and loses its ring, which is what
 * happens to the counts row on an account granted neither Requests nor Updates.
 */

const STEPS: TourStep[] = [
  {
    target: '[data-tour="nav"]',
    title: "Everything shared with you is in here",
    body: "Your requests, calendar, messages, forms and documents, grouped by what they're for. You'll only ever see the areas your attaché has given you access to. Drag the rail's edge — or use the arrow on it — to collapse it to icons.",
  },
  {
    target: '[data-tour="header-actions"]',
    title: "Search, notifications and sign out",
    body: "The magnifier searches everything shared with you. The bell collects what your attaché has sent — a form to complete, an answer to a question, a new invoice — and the last button signs you out.",
  },
  {
    target: '[data-tour="portal-tabs"]',
    title: "Home is three views, not one",
    body: "Overview is where things stand. Action Needed is everything waiting on you, with a count on the tab so you can see it without opening it. Recent Activity is what has happened lately.",
  },
  {
    target: '[data-tour="portal-counts"]',
    title: "Your two questions, answered up top",
    body: "Is anything waiting on me, and is my work moving. These counts answer both before you scroll, and each one opens the screen behind it.",
  },
  {
    target: '[data-tour="portal-widgets"]',
    title: "Your work, and what needs you",
    body: "Active requests and recent progress updates on the left, anything waiting on you on the right. Open any row to see the whole thing.",
  },
  {
    target: null,
    title: "That's the whole portal",
    body: "You can run this tour again whenever you like — Profile & Settings, at the foot of Profile & Contact. Anything you can't find here, your attaché can send through Messages.",
  },
];

export function PortalWelcomeTour({ finish }: { finish: () => Promise<void> }) {
  return <Tour steps={STEPS} finish={finish} doneLabel="Go to my portal" />;
}

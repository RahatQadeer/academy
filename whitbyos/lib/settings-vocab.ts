/**
 * Shared by the Settings screens and their server actions.
 *
 * No server imports here: the notification form is a client component, and a
 * client component that reaches a module touching `next/headers` pulls it into
 * the browser bundle and fails the build.
 */

export type Role = "owner" | "admin" | "team_lead" | "coordinator" | "billing" | "marketing" | "viewer";

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  team_lead: "Team Lead",
  coordinator: "Coordinator",
  billing: "Billing",
  marketing: "Marketing",
  viewer: "Viewer",
};

/**
 * What 17.2a offers. Owner is not among them — a workspace has one, it passes
 * on rather than being handed out, and there is nowhere in the design that
 * invites a second.
 */
export const INVITABLE_ROLES: Role[] = ["admin", "team_lead", "coordinator", "viewer"];

/** Only Owners and Admins may change roles or invite — 17.2's own note. */
export function mayAdminister(role: string | null) {
  return role === "owner" || role === "admin";
}

export type NotificationEvent = {
  key: string;
  label: string;
  channel: "email" | "in_app";
};

/** 17.3, in the order and the grouping the export draws. */
export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  { key: "request_message", label: "New message on a Request I follow", channel: "email" },
  { key: "task_assigned", label: "Task assigned to me", channel: "email" },
  { key: "workplan_approval", label: "Workplan needs my approval", channel: "email" },
  { key: "client_access_request", label: "Client requests new access", channel: "email" },
  { key: "weekly_digest", label: "Weekly digest", channel: "email" },
  { key: "document_review", label: "Document needs review", channel: "in_app" },
  { key: "form_submission", label: "Form submission received", channel: "in_app" },
  // Raised by the mailbox rather than by a person, which is exactly why it
  // needs a switch of its own.
  { key: "gmail_context", label: "Email brought in from Gmail", channel: "in_app" },
  // Raised from the Client Portal. Not in the 17.3 export, which predates a
  // client being able to raise one; without a switch it would be a notice
  // nobody could refuse.
  { key: "client_request", label: "Request submitted by a client", channel: "in_app" },
  // The email switch above it cannot fire while nothing sends email; this is
  // the one that reaches anybody.
  { key: "access_request", label: "Client asks to add someone", channel: "in_app" },
];

export const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "AED", "CAD", "AUD", "SGD"];

/** The time zones the onboarding step offers, kept in step with it. */
export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Zurich",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Singapore",
  "Australia/Sydney",
];

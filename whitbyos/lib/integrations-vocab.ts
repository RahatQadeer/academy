/**
 * What Manage asks about, per kind of integration.
 *
 * No server imports: the modal is a client component.
 *
 * The export draws this modal once, for Google Calendar, with three switches.
 * Those three are here verbatim and apply to a calendar. A mailbox and a
 * billing account are asked different things, because asking a mailbox whether
 * to show declined events would be nonsense — that extension is ours, and it is
 * the smallest one that lets every connected integration be managed.
 */
export type SyncSetting = { key: string; label: string; defaultOn: boolean };

const CALENDAR: SyncSetting[] = [
  { key: "events_into_requests", label: "Sync Calendar events into Requests", defaultOn: true },
  { key: "propose_times", label: "Let Whitby propose meeting times", defaultOn: true },
  { key: "show_declined", label: "Show declined events", defaultOn: false },
];

const MAIL: SyncSetting[] = [
  { key: "file_against_requests", label: "File matching email against Requests", defaultOn: true },
  { key: "send_as", label: "Send Whitby messages from this address", defaultOn: true },
  { key: "include_spam", label: "Include junk and spam folders", defaultOn: false },
];

const BILLING: SyncSetting[] = [
  { key: "show_on_client", label: "Show billing status on a Client", defaultOn: true },
  { key: "flag_failed", label: "Flag failed payments as needing attention", defaultOn: true },
];

const SIGNING: SyncSetting[] = [
  { key: "file_signed_copy", label: "File the signed copy back into Documents", defaultOn: true },
  { key: "chase_unsigned", label: "Remind me about envelopes nobody has signed", defaultOn: true },
];

const FILES: SyncSetting[] = [
  { key: "copy_documents", label: "Copy Whitby documents to a shared folder", defaultOn: true },
  { key: "link_only", label: "Link to the file rather than storing a copy", defaultOn: false },
];

const CHAT: SyncSetting[] = [
  { key: "post_request_updates", label: "Post Request updates to a channel", defaultOn: true },
  { key: "post_plan_changes", label: "Post Work Plan changes too", defaultOn: false },
  { key: "mention_owner", label: "Mention the owner when something needs them", defaultOn: true },
];

export function settingsFor(provider: string): SyncSetting[] {
  if (provider.endsWith("_calendar")) return CALENDAR;
  if (provider === "gmail" || provider === "outlook_mail") return MAIL;
  if (provider === "google_drive") return FILES;
  if (provider === "slack") return CHAT;
  return BILLING;
}

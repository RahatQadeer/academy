import type { IntegrationKey } from "@/client-portal/types";

/**
 * What the portal's Integrations screen offers, and what Manage asks about.
 *
 * No server imports: the Manage dialog's switches are read on the client.
 *
 * THE FOUR, AND WHAT EACH ONE DOES
 *
 * Whitby's Calendar & Email group, in Whitby's order and with Whitby's
 * behaviour, connected to the person instead of the workspace:
 *
 *   Google Calendar   connect, sync events into Calendar, disconnect
 *   Outlook Calendar  the same, through Microsoft Graph
 *   Gmail             connect, choose whose mail may be read, read and
 *                     summarise it, disconnect
 *   Outlook Mail      the same, through Microsoft Graph
 *
 * OUTLOOK USED TO CONNECT AND STOP THERE
 *
 * It did, on the grounds that Whitby's Outlook does the same — a consent round
 * trip in `whitbyos/lib/oauth-providers.ts` and nothing reading the grant — and
 * that a portal doing more than Whitby would be inventing behaviour the
 * professional side knew nothing about.
 *
 * That was the wrong way round for this side. A client keeping their life in
 * Outlook is not a client asking for less; they were being offered a switch
 * that turned nothing on. The two syncs are `outlook-mail.ts` and
 * `outlook-calendar.ts`, and client-portal/021 is the schema half. Nothing on
 * the Whitby side changed: these read a person's own mailbox into tables only
 * that person's portal can see.
 */
export type ProviderMeta = {
  key: IntegrationKey;
  name: string;
  group: "Email" | "Calendar";
  purpose: string;
  /** Whether a connection here is read, not only held. */
  syncs: boolean;
};

export const PROVIDERS: ProviderMeta[] = [
  {
    key: "google_calendar",
    name: "Google Calendar",
    group: "Calendar",
    purpose: "Show your own events beside the ones your team schedules with you",
    syncs: true,
  },
  {
    key: "outlook_calendar",
    name: "Outlook Calendar",
    group: "Calendar",
    purpose: "Show your own events beside the ones your team schedules with you",
    syncs: true,
  },
  {
    key: "gmail",
    name: "Gmail",
    group: "Email",
    purpose: "Keep a summary of the email you exchange with the people you choose",
    syncs: true,
  },
  {
    key: "outlook_mail",
    name: "Outlook Mail",
    group: "Email",
    purpose: "Keep a summary of the email you exchange with the people you choose",
    syncs: true,
  },
];

export const GROUPS = ["Calendar", "Email"] as const;

export function providerMeta(key: string): ProviderMeta | null {
  return PROVIDERS.find((provider) => provider.key === key) ?? null;
}

export function isIntegrationKey(value: string): value is IntegrationKey {
  return PROVIDERS.some((provider) => provider.key === value);
}

/**
 * A switch on Manage.
 *
 * Only switches the sync actually reads. Whitby's Manage draws three per
 * integration and, today, nothing on that side reads any of them — they are
 * saved and never consulted. Copying them would put twelve controls in front
 * of a client that change nothing. These four are the ones that mean something
 * for a person's own mailbox and calendar, and every one is honoured by a sync
 * in this module.
 */
export type SyncSetting = {
  key: string;
  label: string;
  hint: string;
  defaultOn: boolean;
};

const SETTINGS: Partial<Record<IntegrationKey, SyncSetting[]>> = {
  google_calendar: [
    {
      key: "show_declined",
      label: "Show declined events",
      hint: "Invitations you said no to stay on your Calendar, marked as declined.",
      defaultOn: false,
    },
  ],
  outlook_calendar: [
    {
      key: "show_declined",
      label: "Show declined events",
      hint: "Invitations you said no to stay on your Calendar, marked as declined.",
      defaultOn: false,
    },
  ],
  gmail: [
    {
      key: "include_spam",
      label: "Include junk and spam folders",
      hint: "Also read mail from your chosen people that Gmail filed as spam.",
      defaultOn: false,
    },
  ],
  /**
   * Outlook's switch is not Gmail's, because the two mailboxes are not asked
   * the same question. Gmail's one search returns both directions at once, so
   * there is nothing to opt into; Graph needs a second read of Sent Items
   * (`outlook-mail.ts` says why), which is a folder some people would rather
   * nothing opened. On by default, so the two mailboxes behave alike unless
   * the client says otherwise.
   */
  outlook_mail: [
    {
      key: "include_sent",
      label: "Include mail you sent",
      hint: "Also summarise what you wrote to your chosen people, not only what they wrote to you.",
      defaultOn: true,
    },
  ],
};

export function settingsFor(key: string): SyncSetting[] {
  return isIntegrationKey(key) ? (SETTINGS[key] ?? []) : [];
}

/** A setting's stored value, or its default where it has never been saved. */
export function settingOn(stored: Record<string, boolean>, key: string, provider: string) {
  const setting = settingsFor(provider).find((one) => one.key === key);
  return stored[key] ?? setting?.defaultOn ?? false;
}

/** Whose mail may be read, as the Manage dialog offers and saves it. */
export type SourceKind = "team" | "person" | "external";

export type SourceOption = {
  kind: Exclude<SourceKind, "external">;
  id: string;
  name: string;
  /**
   * Shown for someone on the client's own account. Never sent for a
   * professional: the portal does not hand `users.email` to a browser, so a
   * teammate is chosen by name and their address is resolved on the server.
   */
  email: string | null;
};

export type ChosenSource = {
  kind: SourceKind;
  sourceId: string | null;
  label: string;
  /** Present for `person` and `external`; resolved server-side for `team`. */
  email: string | null;
};

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  team: "Your team",
  person: "On your account",
  external: "Other",
};

import Link from "next/link";
import { relativeTime } from "@/client-portal/lib/format";
import { Modal } from "@/client-portal/components/Modal";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import {
  BUTTON_SIZE,
  DANGER_OUTLINE,
  DANGER_OUTLINE_STYLE,
} from "@/client-portal/components/buttons";
import {
  disconnectIntegration,
  saveIntegrationSettings,
} from "@/client-portal/lib/actions/integrations";
import { providerMeta, settingOn, settingsFor } from "@/client-portal/lib/integrations/catalog";
import type { ChosenSource } from "@/client-portal/lib/integrations/catalog";
import type { SourcePicker as Picker } from "@/client-portal/lib/integrations/mail";
import type { PortalIntegration } from "@/client-portal/types";
import { DangerSubmit } from "./DangerSubmit";
import { ProviderMark } from "./ProviderMark";
import { SourcePicker } from "./SourcePicker";

const LIST = "/client-portal/integrations";

/** Cancel, as every other dialog in the portal draws it — see `CancelLink`. */
const SECONDARY = `inline-flex items-center justify-center rounded-control border border-line-strong font-medium text-ink no-underline transition-colors hover:bg-surface-soft hover:text-ink ${BUTTON_SIZE.form}`;

/** The connection this dialog is about, in one line: whose account, and how fresh. */
function AccountLine({ integration }: { integration: PortalIntegration }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[8px] border px-3.5 py-3"
      style={{ borderColor: "var(--border)", background: "var(--surface-subtle)" }}
    >
      <ProviderMark provider={integration.key} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium">
          {integration.connectedAccount ?? "Connected"}
        </div>
        <div className="truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {providerMeta(integration.key)?.syncs
            ? integration.lastSyncAt
              ? `Last synced ${relativeTime(integration.lastSyncAt)}`
              : "Waiting for its first sync"
            : "Connected and kept ready"}
        </div>
      </div>
    </div>
  );
}

/**
 * Manage — Whitby's 16.2 for a client: what is done with the connection, and
 * the way to end it.
 *
 * Switches are drawn only where the sync reads them (see `settingsFor`), and
 * the people picker only for a mailbox. A provider that is connected and read
 * by nothing says so plainly rather than offering controls that change
 * nothing — which is nothing today, and was both Outlooks until
 * client-portal/021.
 */
export function ManageDialog({
  integration,
  mail,
}: {
  integration: PortalIntegration;
  /** Present for a mailbox: whose mail may be read, and who has been chosen. */
  mail?: { picker: Picker; chosen: ChosenSource[] };
}) {
  const settings = settingsFor(integration.key);
  const meta = providerMeta(integration.key);

  return (
    <Modal title={`Manage ${integration.name}`} closeHref={LIST} width={560}>
      <form action={saveIntegrationSettings}>
        <input type="hidden" name="provider" value={integration.key} />

        <AccountLine integration={integration} />

        {settings.length > 0 ? (
          <div className="mt-5 flex flex-col gap-1">
            {settings.map((setting) => (
              <label
                key={setting.key}
                className="flex cursor-pointer items-center justify-between gap-4 rounded-[10px] px-1 py-2"
              >
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium">{setting.label}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-[1.5]" style={{ color: "var(--text-tertiary)" }}>
                    {setting.hint}
                  </span>
                </span>
                <Switch
                  name={setting.key}
                  defaultChecked={settingOn(integration.syncSettings, setting.key, integration.key)}
                />
              </label>
            ))}
          </div>
        ) : null}

        {mail ? (
          <SourcePicker team={mail.picker.team} people={mail.picker.people} initial={mail.chosen} />
        ) : null}

        {!meta?.syncs ? (
          <p className="mt-5 text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
            {integration.name} is connected to your account. Nothing is read from it yet — when
            your portal starts using it, it will appear here with its settings.
          </p>
        ) : null}

        <div
          className="mt-7 flex flex-wrap items-center gap-2.5 border-t pt-5"
          style={{ borderColor: "var(--border)" }}
        >
          <Link
            href={`${LIST}?disconnect=${integration.key}`}
            className={`${DANGER_OUTLINE} ${BUTTON_SIZE.form}`}
            style={DANGER_OUTLINE_STYLE}
          >
            Disconnect
          </Link>
          <span className="flex-1" />
          <Link href={LIST} className={SECONDARY}>
            Cancel
          </Link>
          {settings.length > 0 || mail ? (
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}

/** A real checkbox, drawn as a switch. It submits as `on` like any checkbox. */
function Switch({ name, defaultChecked }: { name: string; defaultChecked: boolean }) {
  return (
    <span className="relative inline-flex shrink-0">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
      />
      <span
        aria-hidden
        className="h-[22px] w-[38px] rounded-full bg-[var(--border-strong)] transition-colors duration-200 peer-checked:bg-[var(--accent)] peer-focus-visible:shadow-[0_0_0_3px_var(--accent-tint)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgb(var(--shade-rgb) / .25)] transition-transform duration-200 peer-checked:translate-x-4"
      />
    </span>
  );
}

/** What Disconnect takes away, said for the service it is about. */
const WHAT_STAYS: Record<PortalIntegration["key"], string> = {
  google_calendar:
    "Your Google Calendar events are removed from your portal Calendar. Nothing in Google Calendar itself changes.",
  outlook_calendar:
    "Your Outlook Calendar events are removed from your portal Calendar. Nothing in Outlook Calendar itself changes.",
  gmail:
    "Nothing more is read. The summaries already made stay on your Email page, and nothing in Gmail itself changes.",
  outlook_mail:
    "Nothing more is read. The summaries already made stay on your Outlook Mail page, and nothing in your Outlook mailbox changes.",
};

export function DisconnectDialog({ integration }: { integration: PortalIntegration }) {
  return (
    <Modal title={`Disconnect ${integration.name}?`} closeHref={LIST} width={460} dense>
      <p className="-mt-1 text-[13.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
        {integration.name} will stop syncing with your account and its access is handed back.{" "}
        {WHAT_STAYS[integration.key]} You can connect it again whenever you like.
      </p>

      <form action={disconnectIntegration} className="mt-6 flex justify-end gap-2.5">
        <input type="hidden" name="provider" value={integration.key} />
        <Link
          href={`${LIST}?manage=${integration.key}`}
          className={SECONDARY}
          style={{ color: "var(--text-secondary)" }}
        >
          Keep connected
        </Link>
        <DangerSubmit pendingLabel="Disconnecting…">Disconnect</DangerSubmit>
      </form>
    </Modal>
  );
}

/**
 * What Connect opens where this site cannot connect a service yet — Whitby's
 * `ConnectDialog`, saying why in terms a client can do something with.
 */
export function UnavailableDialog({ integration }: { integration: PortalIntegration }) {
  return (
    <Modal title={`${integration.name} isn't available yet`} closeHref={LIST} width={460} dense>
      <p className="-mt-1 text-[13.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
        Connecting {integration.name} hasn&apos;t been switched on for this portal yet. Nothing on
        this screen will change when it is — the same Connect button will take you to{" "}
        {integration.key.startsWith("outlook") ? "Microsoft" : "Google"} to sign in.
      </p>
      <div className="mt-6 flex justify-end">
        <Link
          href={LIST}
          className="rounded-control px-[18px] py-[9px] text-[14px] font-medium text-white no-underline hover:text-white"
          style={{ background: "var(--accent)" }}
        >
          Got it
        </Link>
      </div>
    </Modal>
  );
}

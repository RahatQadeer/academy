import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Modal } from "@/whitbyos/components/Modal";
import { DialogForm } from "@/whitbyos/components/DialogForm";
import { disconnectIntegration, saveSyncSettings } from "@/whitbyos/integrations/actions";
import { settingsFor } from "@/whitbyos/lib/integrations-vocab";
import type { IntegrationRow } from "@/whitbyos/lib/integrations";
import { GmailSourcePicker } from "@/whitbyos/integrations/components/GmailSourcePicker";
import type { GmailPicker, GmailSelectedSource } from "@/whitbyos/lib/gmail-context";

/**
 * Screen 16.2 — Manage Integration.
 *
 * In-app sync settings, not the provider's own screen: what Whitby does with
 * the connection, which is why Disconnect belongs here rather than at Google.
 */
export function ManageDialog({
  row,
  closeHref,
  gmail,
}: {
  row: IntegrationRow;
  closeHref: string;
  /** Gmail alone carries a second permission — who may be read. Absent for
   *  every other provider, which has only the switches. */
  gmail?: { picker: GmailPicker; selected: GmailSelectedSource[] };
}) {
  const settings = settingsFor(row.key);
  const join = closeHref.includes("?") ? "&" : "?";

  return (
    <Modal title={`Manage ${row.name}`} closeHref={closeHref} width={480} dense>
      <p className="-mt-3 mb-5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {row.connectedAccount ? `Connected as ${row.connectedAccount}` : "Connected"}
      </p>

      <DialogForm
        action={saveSyncSettings}
        closeHref={closeHref}
        submitLabel="Save"
        cancel={false}
        ruled
        footerStart={
          /* A link rather than a second submit: two submits in one form would
             make Disconnect a variant of Save, which it is the opposite of. */
          <Link
            href={`${closeHref}${join}disconnect=${row.key}`}
            className="rounded-control border px-4 py-[9px] text-[13.5px] font-medium no-underline"
            style={{
              borderColor: "var(--danger-border)",
              color: "var(--danger-outline-fg)",
              background: "var(--surface)",
            }}
          >
            Disconnect
          </Link>
        }
        className="flex flex-col"
      >
        <input type="hidden" name="provider" value={row.key} />

        <div className="mb-5 flex flex-col gap-3.5">
          {settings.map((setting) => (
            <label
              key={setting.key}
              className="flex items-center justify-between gap-4 text-[13.5px]"
            >
              <span>{setting.label}</span>
              <input
                type="checkbox"
                name={setting.key}
                defaultChecked={row.syncSettings[setting.key] ?? setting.defaultOn}
                className="h-4 w-4 shrink-0"
                style={{ accentColor: "var(--accent)" }}
              />
            </label>
          ))}
        </div>

        {gmail ? (
          <GmailSourcePicker picker={gmail.picker} initial={gmail.selected} />
        ) : null}

      </DialogForm>
    </Modal>
  );
}

/** The confirmation Disconnect opens, because it takes a connection away. */
export function DisconnectDialog({
  row,
  closeHref,
}: {
  row: IntegrationRow;
  closeHref: string;
}) {
  return (
    <Modal title={`Disconnect ${row.name}?`} closeHref={closeHref} width={440} dense>
      <p className="-mt-2 mb-5 text-[13.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
        Whitby stops syncing with {row.name}. Nothing already in Whitby is
        removed, what came across stays where it is. You can connect it again
        whenever you like.
      </p>

      <DialogForm
        action={disconnectIntegration}
        closeHref={closeHref}
        submitLabel="Disconnect"
        pendingLabel="Disconnecting…"
        className="flex flex-col"
      >
        <input type="hidden" name="provider" value={row.key} />
      </DialogForm>
    </Modal>
  );
}

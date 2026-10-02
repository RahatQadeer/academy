import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Toast } from "@/whitbyos/components/Toast";
import { ConnectDialog } from "@/whitbyos/integrations/components/ConnectDialog";
import {
  DisconnectDialog,
  ManageDialog,
} from "@/whitbyos/integrations/components/ManageDialog";
import { ProviderMark } from "@/whitbyos/integrations/components/ProviderMark";
import { relativeTime } from "@/whitbyos/lib/format";
import {
  GROUPS,
  listIntegrations,
  type IntegrationRow,
} from "@/whitbyos/lib/integrations";
import { GOOGLE_PROVIDER, googleConfigured } from "@/whitbyos/lib/google-calendar";
import { connectableProviders } from "@/whitbyos/lib/oauth-providers";
import { GMAIL_PROVIDER } from "@/whitbyos/lib/gmail";
import {
  loadGmailPicker,
  loadSelectedGmailSources,
} from "@/whitbyos/lib/gmail-context";

const LIST = "/whitbyos/integrations";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Screen 16, with 16.1 and 16.2 over it. */
export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const result = await listIntegrations();

  const error = one(searchParams?.error);
  const managing = one(searchParams?.manage);
  const disconnecting = one(searchParams?.disconnect);
  const saved = one(searchParams?.saved);
  const wasDisconnected = one(searchParams?.disconnected);
  const connected = one(searchParams?.connected);
  const connecting = one(searchParams?.connect);

  if (!result.ok) {
    return (
      <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We couldn't load your Integrations. Check your connection and try again, if this keeps happening, contact support."
          action={
            <>
              <Button unsized
                href="mailto:support@privateattache.com?subject=Integrations%20failed%20to%20load"
                variant="secondary"
                className="px-4 py-[9px]"
              >
                Contact support
              </Button>
              <Button unsized href={LIST} variant="primary" className="px-[18px] py-[9px]">
                Try again
              </Button>
            </>
          }
        />
      </div>
    );
  }

  // Which of the nine this deployment has actually been given credentials
  // for. The button looks the same either way; what it does does not.
  const connectable = connectableProviders();
  if (googleConfigured()) connectable.add(GOOGLE_PROVIDER);

  const integrations = result.rows;
  const named = (key: string | undefined) =>
    integrations.find((row) => row.key === key) ?? null;

  const manageRow = named(managing);
  const disconnectRow = named(disconnecting);
  const connectRow = named(connecting);

  // Only when the Gmail dialog is actually open. Two queries for a control
  // nobody has asked for would be paid on every visit to this screen.
  const gmail =
    manageRow?.key === GMAIL_PROVIDER && manageRow.status === "connected"
      ? await Promise.all([loadGmailPicker(), loadSelectedGmailSources()]).then(
          ([picker, selected]) => ({ picker, selected }),
        )
      : undefined;

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <PageHeader
        title="Integrations"
        size={22}
        subtitle="Connect the tools your workflows and Whitby draw on."
      />

      {error ? (
        <div className="mb-5">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      {GROUPS.map((group) => {
        const rows = integrations.filter((item) => item.group === group);
        if (rows.length === 0) return null;

        return (
          <section key={group} className="mb-7">
            <h2
              className="mb-3 text-[12.5px] font-semibold uppercase tracking-[0.04em]"
              style={{ color: "var(--text-faint)" }}
            >
              {group}
            </h2>
            <div className="overflow-hidden rounded-[8px] border border-line">
              {rows.map((row) => (
                <IntegrationLine key={row.key} row={row} ready={connectable.has(row.key)} />
              ))}
            </div>
          </section>
        );
      })}

      {manageRow && manageRow.status === "connected" ? (
        <ManageDialog row={manageRow} closeHref={LIST} gmail={gmail} />
      ) : null}

      {disconnectRow ? <DisconnectDialog row={disconnectRow} closeHref={LIST} /> : null}

      {/* Only for an app that genuinely cannot connect. Once its credentials
          arrive the Connect button starts the real round trip, and this
          dialog would be explaining a problem that no longer exists. */}
      {connectRow && connectRow.status !== "connected" && !connectable.has(connectRow.key) ? (
        <ConnectDialog row={connectRow} closeHref={LIST} />
      ) : null}

      {/* 16.1 — after connecting. Nothing can reach this yet: connecting needs
          credentials no environment holds. It is wired so that the day one is
          added, the confirmation is already there. */}
      {connected ? (
        <Toast
          title="Integration connected"
          detail={`${named(connected)?.name ?? "It"} is now syncing with your workspace.`}
          closeHref={LIST}
        />
      ) : null}

      {saved ? (
        <Toast
          title="Settings saved"
          detail={`What Whitby syncs with ${named(saved)?.name ?? "it"} has been updated.`}
          closeHref={LIST}
        />
      ) : null}

      {wasDisconnected ? (
        <Toast
          title="Disconnected"
          detail={`${named(wasDisconnected)?.name ?? "It"} is no longer syncing. Nothing already in Whitby was removed.`}
          closeHref={LIST}
        />
      ) : null}
    </div>
  );
}

function IntegrationLine({ row, ready }: { row: IntegrationRow; ready: boolean }) {
  const connected = row.status === "connected";

  const detail = connected
    ? [
        row.connectedAccount ? `Connected as ${row.connectedAccount}` : "Connected",
        row.lastSyncAt ? `synced ${relativeTime(row.lastSyncAt)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : (row.errorState ?? `Not connected. ${row.purpose}.`);

  return (
    <div className="flex items-center gap-3.5 border-b border-line px-4 py-3.5 last:border-b-0">
      <ProviderMark provider={row.key} />

      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">{row.name}</div>
        <div
          className="truncate text-[12.5px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {detail}
        </div>
      </div>

      {connected ? <Pill tone="success">Connected</Pill> : null}
      {row.status === "needs_attention" ? <Pill tone="warning">Needs attention</Pill> : null}

      {/* Gmail is the one integration that leaves something behind to read.
          Manage chooses who may be read; this is what they have written. */}
      {row.key === GMAIL_PROVIDER && connected ? (
        <Link
          href={`${LIST}/gmail`}
          className={MANAGE}
          style={{ background: "var(--surface)", color: "var(--ink)" }}
        >
          Messages
        </Link>
      ) : null}

      <ConnectButton row={row} ready={ready} />
    </div>
  );
}

/** The export's Manage: white, a grey outline, 6px by 12px. */
const MANAGE =
  "shrink-0 whitespace-nowrap rounded-control border border-line-strong px-3 py-1.5 text-[12.5px] font-medium no-underline";

/** The export's Connect: filled accent, 6px by 14px. */
const CONNECT =
  "shrink-0 whitespace-nowrap rounded-control px-3.5 py-1.5 text-[12.5px] font-medium text-white no-underline hover:text-white";

/**
 * Every app here connects the same way, through the consent round trip in
 * `/api/whitbyos/integrations/<provider>`, the moment this deployment has been
 * given that provider's client id and secret. Google Calendar keeps its own
 * route because it does far more than connect.
 *
 * `ready` is whether those credentials exist. Where they do not, the button is
 * still the export's Connect rather than a greyed placeholder, and pressing it
 * says what is missing for that particular app instead of starting a round
 * trip that would fail at the provider.
 */
function ConnectButton({ row, ready }: { row: IntegrationRow; ready: boolean }) {
  if (row.status === "connected") {
    return (
      <Link
        href={`${LIST}?manage=${row.key}`}
        className={MANAGE}
        style={{ background: "var(--surface)", color: "var(--ink)" }}
      >
        Manage
      </Link>
    );
  }

  const label = row.status === "needs_attention" ? "Reconnect" : "Connect";

  if (ready) {
    // Plain anchors: these routes redirect off-origin, which the client
    // router cannot follow.
    const start =
      row.key === GOOGLE_PROVIDER
        ? `/api/whitbyos/integrations/google/start?next=${encodeURIComponent(LIST)}`
        : `/api/whitbyos/integrations/${row.key}/start`;

    return (
      <a href={start} className={CONNECT} style={{ background: "var(--accent)" }}>
        {label}
      </a>
    );
  }

  return (
    <Link
      href={`${LIST}?connect=${row.key}`}
      className={CONNECT}
      style={{ background: "var(--accent)" }}
    >
      {label}
    </Link>
  );
}

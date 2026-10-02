import Link from "next/link";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { listIntegrations, loadMailManage } from "@/client-portal/lib/data/integrations";
import { relativeTime } from "@/client-portal/lib/format";
import { param, type ScreenProps } from "@/client-portal/lib/routing";
import { GROUPS, providerMeta } from "@/client-portal/lib/integrations/catalog";
import { PageBody, PageIntro } from "@/client-portal/components/PageHeader";
import { DataNotice } from "@/client-portal/components/DataNotice";
import { BUTTON_SIZE } from "@/client-portal/components/buttons";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { DisconnectDialog, ManageDialog, UnavailableDialog } from "./components/Dialogs";
import { ProviderMark } from "./components/ProviderMark";
import { SyncNow } from "./components/SyncNow";
import type { PortalIntegration } from "@/client-portal/types";

const LIST = "/client-portal/integrations";

/** Sync now reads a mailbox inline — the same allowance the cron route takes. */
export const maxDuration = 300;

const GROUP_NOTE: Record<(typeof GROUPS)[number], string> = {
  Calendar: "Your own events, beside everything your team schedules with you.",
  Email: "A short summary of the email you exchange with people you choose.",
};

/**
 * Integrations — Whitby's Screen 16, with 16.1 and 16.2 over it, for the
 * client's own calendar and mailbox.
 *
 * Every row is the person's, not the practice's (client-portal/018). This
 * screen used to read the workspace's connections and offer buttons that could
 * only redirect with an apology; each one is now the real round trip, or — for
 * a service this site has no app credentials for — a dialog saying so.
 *
 * Drawn as Whitby draws it: a group label, then one ruled list per group, a
 * line per service. It was two columns of cards in a 920px frame for a while,
 * because a 760px row truncated the account and its freshness. The frame was
 * the problem rather than the row — at the page's full width the line holds
 * the name, the account, when it last synced, a status and two actions, and on
 * a phone the actions drop under the name instead of cutting it short.
 */
export default async function IntegrationsScreen({ searchParams }: ScreenProps) {
  const [context, integrations] = await Promise.all([getPortalContext(), listIntegrations()]);

  const named = (key: string | undefined) =>
    key ? (integrations.find((row) => row.key === key) ?? null) : null;

  const managing = named(param(searchParams, "manage"));
  const disconnecting = named(param(searchParams, "disconnect"));
  const connecting = named(param(searchParams, "connect"));

  const manageOpen = managing && managing.status !== "disconnected" ? managing : null;
  // Both mailboxes keep their own list of people, so Manage loads the one it
  // is open on rather than a single shared list (client-portal/021).
  const mailbox =
    manageOpen?.key === "gmail" || manageOpen?.key === "outlook_mail"
      ? await loadMailManage(manageOpen.key)
      : undefined;

  return (
    <PageBody>
      <PageIntro note="Connect your own calendar and email, so what matters to you is in one place." />

      <DataNotice context={context} />

      <Callout tone="info" title="Private to you" className="mb-7">
        Your team can&apos;t see your calendar, your mailbox, or anything read from them. Access
        is read-only, and you can disconnect at any time.
      </Callout>

      {GROUPS.map((group) => (
        <section key={group} className="mb-7">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h2
              className="text-[12.5px] font-semibold uppercase tracking-[0.04em]"
              style={{ color: "var(--text-faint)" }}
            >
              {group}
            </h2>
            <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {GROUP_NOTE[group]}
            </p>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-line">
            {integrations
              .filter((row) => row.group === group)
              .map((row) => (
                <IntegrationLine key={row.key} integration={row} />
              ))}
          </div>
        </section>
      ))}

      {manageOpen ? <ManageDialog integration={manageOpen} mail={mailbox} /> : null}
      {disconnecting && disconnecting.status !== "disconnected" ? (
        <DisconnectDialog integration={disconnecting} />
      ) : null}
      {connecting && connecting.status !== "connected" && !connecting.connectable ? (
        <UnavailableDialog integration={connecting} />
      ) : null}
    </PageBody>
  );
}

/**
 * Where a mailbox's summaries are read. Both calendars land on one Calendar,
 * because the client has one; a mailbox keeps its own page, so a client with
 * both can tell which summary came from where.
 */
const MAILBOX_HREF: Partial<Record<PortalIntegration["key"], string>> = {
  gmail: `${LIST}/gmail`,
  outlook_mail: `${LIST}/outlook-mail`,
};

/** The export's Connect: filled accent. */
const PRIMARY = `inline-flex items-center justify-center rounded-control font-medium text-white no-underline transition-colors bg-accent hover:bg-accent-hover hover:text-white ${BUTTON_SIZE.row}`;
/** The export's Manage: white, a grey outline. */
const SECONDARY = `inline-flex items-center justify-center rounded-control border border-line-strong bg-surface font-medium no-underline transition-colors hover:bg-surface-soft ${BUTTON_SIZE.row}`;
/** A way on to what the connection has brought in. */
const QUIET = `inline-flex items-center gap-1 rounded-control font-medium no-underline transition-colors hover:bg-[var(--accent-tint-mid)] ${BUTTON_SIZE.row}`;

function IntegrationLine({ integration }: { integration: PortalIntegration }) {
  const meta = providerMeta(integration.key);
  const attention = integration.status === "needs_attention";
  const connected = integration.status === "connected";

  const detail =
    integration.status === "disconnected"
      ? `Not connected. ${integration.purpose}.`
      : attention
        ? (integration.errorState ?? "It has stopped syncing. Reconnect to pick up where it left off.")
        : [
            integration.connectedAccount
              ? `Connected as ${integration.connectedAccount}`
              : "Connected",
            meta?.syncs
              ? integration.lastSyncAt
                ? `synced ${relativeTime(integration.lastSyncAt)}`
                : "first sync on its way"
              : null,
          ]
            .filter(Boolean)
            .join(" · ");

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 border-b border-line px-4 py-3.5 last:border-b-0 sm:flex-nowrap">
      <ProviderMark provider={integration.key} />

      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">{integration.name}</div>
        <div
          className="truncate text-[12.5px]"
          style={{ color: attention ? "var(--warning-fg)" : "var(--text-tertiary)" }}
          title={detail}
        >
          {detail}
        </div>
      </div>

      {connected ? <Pill tone="success">Connected</Pill> : null}
      {attention ? <Pill tone="warning">Needs attention</Pill> : null}

      {/* Under the name on a phone, lined up with it rather than the mark. */}
      <div className="flex w-full shrink-0 flex-wrap items-center gap-2 pl-[48px] sm:w-auto sm:pl-0">
        {connected && MAILBOX_HREF[integration.key] ? (
          <Link
            href={MAILBOX_HREF[integration.key] as string}
            className={QUIET}
            style={{ color: "var(--accent)" }}
          >
            View email <span aria-hidden>→</span>
          </Link>
        ) : null}
        {connected && integration.group === "Calendar" ? (
          <Link href="/client-portal/calendar" className={QUIET} style={{ color: "var(--accent)" }}>
            Open Calendar <span aria-hidden>→</span>
          </Link>
        ) : null}
        {/*
         * Only where something actually reads the connection. Outlook is
         * `syncs: false` in the catalog — connected, and read by nothing yet.
         */}
        {connected && meta?.syncs ? <SyncNow provider={integration.key} back={LIST} /> : null}
        <PrimaryAction integration={integration} />
      </div>
    </div>
  );
}

/**
 * Connect starts the provider's sign-in where this site can, and explains
 * where it cannot — Whitby's `ConnectButton`. A plain anchor for the real one:
 * the route redirects off-origin, which the client router cannot follow.
 */
function PrimaryAction({ integration }: { integration: PortalIntegration }) {
  const start = `/api/client-portal/integrations/${integration.key}/start`;

  if (integration.status === "connected") {
    return (
      <Link href={`${LIST}?manage=${integration.key}`} className={SECONDARY} style={{ color: "var(--ink)" }}>
        Manage
      </Link>
    );
  }

  if (integration.status === "needs_attention") {
    return (
      <>
        {integration.connectable ? (
          <a href={start} className={PRIMARY}>
            Reconnect
          </a>
        ) : null}
        <Link href={`${LIST}?manage=${integration.key}`} className={SECONDARY} style={{ color: "var(--ink)" }}>
          Manage
        </Link>
      </>
    );
  }

  return integration.connectable ? (
    <a href={start} className={PRIMARY}>
      Connect
    </a>
  ) : (
    <Link href={`${LIST}?connect=${integration.key}`} className={PRIMARY}>
      Connect
    </Link>
  );
}

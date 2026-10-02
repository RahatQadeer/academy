import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";

/** SRS §11.1.7 — the four connection states. */
export type IntegrationStatus =
  | "connected"
  | "needs_attention"
  | "disconnected"
  | "available";

export type ProviderKey =
  | "google_calendar"
  | "outlook_calendar"
  | "gmail"
  | "outlook_mail"
  | "google_drive"
  | "slack"
  | "quickbooks"
  | "stripe";

export type ProviderMeta = {
  key: ProviderKey;
  name: string;
  group: string;
  /** What it is for, shown when nothing is connected. */
  purpose: string;
};

/**
 * The eight apps screen 16 can show, in the order the export draws them.
 *
 * Seven are on the export. Two are not: Outlook Mail and Stripe, which SRS
 * §11.1 lists and which other screens already lean on, Stripe being what
 * Settings > Billing reads. Dropping them to make this screen match a frame
 * would take away support the product claims to have, so they sit at the end
 * of the group they belong to.
 *
 * Google Drive and Slack came in with migration 054, along with DocuSign —
 * which is not here any more. Signing happens in Whitby: a document is sent to
 * the other side, they sign it or decline it, and the answer comes back. An
 * integration that hands that round trip to somebody else's product was
 * offering to replace a thing this one does.
 *
 * The enum value stays in the database. Dropping one is destructive, and a row
 * somewhere may still name it.
 */
export const PROVIDERS: ProviderMeta[] = [
  {
    key: "google_calendar",
    name: "Google Calendar",
    group: "Calendar & Email",
    purpose: "Show your schedule alongside coordination work",
  },
  {
    key: "outlook_calendar",
    name: "Outlook Calendar",
    group: "Calendar & Email",
    purpose: "Show your schedule alongside coordination work",
  },
  {
    key: "gmail",
    name: "Gmail",
    group: "Calendar & Email",
    purpose: "Optional, can be skipped during onboarding",
  },
  {
    key: "outlook_mail",
    name: "Outlook Mail",
    group: "Calendar & Email",
    purpose: "Read and link client email for context",
  },
  {
    key: "google_drive",
    name: "Google Drive",
    group: "Documents & Signing",
    purpose: "File documents to a shared Drive folder",
  },
  {
    key: "slack",
    name: "Slack",
    group: "Communication",
    purpose: "Get request updates in a channel",
  },
  {
    key: "quickbooks",
    name: "QuickBooks Online",
    group: "Billing & Accounting",
    purpose: "Sync invoices and payments",
  },
  {
    key: "stripe",
    name: "Stripe",
    group: "Billing & Accounting",
    purpose: "Subscription and payment status",
  },
];

export const GROUPS = [
  "Calendar & Email",
  "Documents & Signing",
  "Communication",
  "Billing & Accounting",
];

export type IntegrationRow = ProviderMeta & {
  status: IntegrationStatus;
  connectedAccount: string | null;
  lastSyncAt: string | null;
  errorState: string | null;
  syncSettings: Record<string, boolean>;
};

export type IntegrationsResult =
  | { ok: true; rows: IntegrationRow[] }
  | { ok: false; error: string };

function unconfigured(): IntegrationRow[] {
  return PROVIDERS.map((provider) => ({
    ...provider,
    status: "available" as const,
    connectedAccount: null,
    lastSyncAt: null,
    errorState: null,
    syncSettings: {},
  }));
}

/**
 * Every provider with its stored state. Anything with no row yet is
 * "available" — supported but not configured (§11.1.7).
 *
 * Failure comes back rather than being swallowed. This used to fall through to
 * an empty list, which on this screen is indistinguishable from "nothing is
 * connected" — so 16.2's error state could never appear no matter what broke.
 */
export async function listIntegrations(): Promise<IntegrationsResult> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: true, rows: unconfigured() };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whitbyos_integrations")
    .select("provider, status, connected_account, last_sync_at, error_state, sync_settings")
    .eq("workspace_id", workspaceId);

  if (error) return { ok: false, error: error.message };

  const byProvider = new Map(
    (data ?? []).map((row) => [row.provider as ProviderKey, row]),
  );

  return {
    ok: true,
    rows: PROVIDERS.map((provider) => {
      const row = byProvider.get(provider.key);
      return {
        ...provider,
        status: (row?.status as IntegrationStatus) ?? "available",
        connectedAccount: (row?.connected_account as string | null) ?? null,
        lastSyncAt: (row?.last_sync_at as string | null) ?? null,
        errorState: (row?.error_state as string | null) ?? null,
        syncSettings: (row?.sync_settings as Record<string, boolean>) ?? {},
      };
    }),
  };
}

import { createServiceClient } from "@/base/lib/supabase/service";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import * as fixtures from "@/client-portal/lib/fixtures";
import { PROVIDERS, type ChosenSource } from "@/client-portal/lib/integrations/catalog";
import { connectableKeys } from "@/client-portal/lib/integrations/providers";
import {
  listEmailByPerson,
  loadChosenSources,
  loadSourcePicker,
  type MailListing,
  type MailProvider,
  type SourcePicker,
} from "@/client-portal/lib/integrations/mail";
import type { IntegrationKey, PortalIntegration } from "@/client-portal/types";

type Row = {
  provider: IntegrationKey;
  status: PortalIntegration["status"];
  connected_account: string | null;
  last_sync_at: string | null;
  error_state: string | null;
  sync_settings: Record<string, boolean> | null;
};

/**
 * The four, with this person's own state on each.
 *
 * Read from `client_portal_integrations` (client-portal/018), keyed on the
 * contact. This used to read `whitbyos_integrations` for the workspace — the
 * professional's own connections — so a client was shown their adviser's
 * Gmail as though it were theirs.
 *
 * The service role, filtered on the contact the session resolves to: the table
 * has no policy a browser session could use (see 018 for why).
 */
export async function listIntegrations(): Promise<PortalIntegration[]> {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.INTEGRATIONS;

  const connectable = connectableKeys();
  const supabase = createServiceClient();

  const rows = new Map<IntegrationKey, Row>();
  if (supabase && ctx.contactId) {
    const { data } = await supabase
      .from("client_portal_integrations")
      .select("provider, status, connected_account, last_sync_at, error_state, sync_settings")
      .eq("contact_id", ctx.contactId);
    for (const row of (data ?? []) as Row[]) rows.set(row.provider, row);
  }

  return PROVIDERS.map((provider) => {
    const row = rows.get(provider.key);
    return {
      key: provider.key,
      name: provider.name,
      group: provider.group,
      purpose: provider.purpose,
      status: row?.status ?? "disconnected",
      connectedAccount: row?.connected_account ?? null,
      lastSyncAt: row?.last_sync_at ?? null,
      errorState: row?.error_state ?? null,
      syncSettings: row?.sync_settings ?? {},
      connectable: connectable.has(provider.key),
    };
  });
}

/**
 * Manage's mailbox half: who could be chosen, and who has been.
 *
 * The picker is the same for both mailboxes — it is the people this client
 * corresponds with, which does not depend on where their mail lives. What is
 * chosen is per mailbox (client-portal/021), so a client can summarise their
 * adviser on Outlook and nobody at all on Gmail.
 */
export async function loadMailManage(
  provider: MailProvider,
): Promise<{ picker: SourcePicker; chosen: ChosenSource[] }> {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.GMAIL_MANAGE;
  if (!ctx.contactId) return { picker: { team: [], people: [] }, chosen: [] };

  const [picker, chosen] = await Promise.all([
    loadSourcePicker(ctx),
    loadChosenSources(ctx.contactId, provider),
  ]);
  return { picker, chosen };
}

/** A mailbox screen: the people chosen, and what has been read with each. */
export async function loadEmail(
  provider: MailProvider,
  person?: string | null,
  search?: string | null,
): Promise<MailListing> {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") {
    const term = (search ?? "").trim().toLowerCase();
    return {
      people: fixtures.EMAIL.people,
      routine: 0,
      sections: fixtures.EMAIL.sections
        .filter((section) => !person || section.sourceId === person)
        .map((section) => ({
          ...section,
          rows: section.rows.filter(
            (row) =>
              !term || `${row.subject ?? ""} ${row.summary ?? ""}`.toLowerCase().includes(term),
          ),
        }))
        .filter((section) => section.rows.length > 0),
    };
  }
  if (!ctx.contactId) return { people: [], sections: [], routine: 0 };
  return listEmailByPerson(ctx.contactId, provider, person, search);
}

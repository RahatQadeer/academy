import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";

/**
 * Screen 2.2b — what the Configure Client Workspace page needs, and no more.
 *
 * A reader of its own rather than another field on `getClient`: this screen is
 * reached once, straight after a client is created, and everything it asks
 * for already exists on `whitbyos_client_members` — `portal_access` for the
 * switch, and `role` for the two lists. Nothing new is stored.
 *
 * The contact's own email is the portal contact email. The reference draws it
 * as an empty field with a placeholder, which is right for a client created
 * without one and wrong for one created with one, so it is prefilled where
 * there is something to prefill.
 */
export type SetupPerson = { id: string; name: string; email: string | null };

export type ClientWorkspaceSetup = {
  clientId: string;
  clientName: string;
  portalEnabled: boolean;
  portalEmail: string;
  authorizedUsers: SetupPerson[];
  additionalMembers: SetupPerson[];
};

type ContactRow = { id: string; first_name: string | null; last_name: string | null; email: string | null };

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function nameOf(contact: ContactRow | null): string {
  if (!contact) return "Unnamed";
  const full = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return full || contact.email || "Unnamed";
}

export async function getClientWorkspaceSetup(
  clientId: string,
): Promise<ClientWorkspaceSetup | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();

  // Scoped to the workspace as well as the id, so a client id from somewhere
  // else cannot be set up through this page.
  const { data: client } = await supabase
    .from("whitbyos_clients")
    .select(
      "id, name, workspace_id, primary_contact:contacts!primary_contact_id (id, first_name, last_name, email)",
    )
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!client) return null;

  const { data: members } = await supabase
    .from("whitbyos_client_members")
    .select(
      "id, role, portal_access, contact:contacts!contact_id (id, first_name, last_name, email)",
    )
    .eq("client_id", clientId);

  const rows = members ?? [];
  const primary = firstOf(client.primary_contact as ContactRow | ContactRow[] | null);

  const people = (role: string): SetupPerson[] =>
    rows
      .filter((row) => row.role === role)
      .map((row) => {
        const contact = firstOf(row.contact as ContactRow | ContactRow[] | null);
        return { id: row.id as string, name: nameOf(contact), email: contact?.email ?? null };
      });

  return {
    clientId: client.id as string,
    clientName: (client.name as string) ?? "this client",
    // The switch is on when anybody already has portal access; creating a
    // client with an email grants it to the primary contact, so arriving here
    // straight from that path finds it already on.
    portalEnabled: rows.some((row) => row.portal_access === true),
    portalEmail: primary?.email ?? "",
    authorizedUsers: people("authorized_user"),
    additionalMembers: people("additional_member"),
  };
}

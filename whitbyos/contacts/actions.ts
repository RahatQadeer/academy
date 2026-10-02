"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getContact } from "@/whitbyos/lib/contacts";
import { firstAndLast, RELATIONSHIP_OPTIONS } from "@/whitbyos/lib/contact-vocab";
import { purgeClient } from "@/whitbyos/lib/client-purge";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";

const LIST = "/whitbyos/contacts";
const ROUTE = "/[product]/[[...slug]]";

const ROLES = new Set(RELATIONSHIP_OPTIONS.map((option) => option.value as string));

function backWithError(message: string): never {
  redirect(`${LIST}?new=1&error=${encodeURIComponent(message)}`);
}

/**
 * Screen 4.5 — Add Contact or Company.
 *
 * One action for both halves of the dialog, because the dialog is one dialog
 * with a toggle. A person becomes a row in base's shared `contacts`; a company
 * a row in `companies`. Neither is a Whitby-local copy — §5.4 makes these the
 * canonical records the Portal and Partner Center read too, which is why the
 * relationship label lives on the link to a client rather than on the person.
 */
export async function createContact(formData: FormData) {
  await stopIfReadOnly();

  const kind = String(formData.get("kind") ?? "person");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const companyRole = String(formData.get("title_role") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();

  if (!name) {
    backWithError(kind === "company" ? "Company name is required." : "Full name is required.");
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) backWithError("Create your workspace first.");

  const supabase = await createClient();

  if (kind === "company") {
    const { error } = await supabase.from("companies").insert({
      name,
      industry_type: companyRole || null,
      created_by_workspace_id: workspaceId,
    });
    if (error) backWithError(error.message);

    revalidatePath(ROUTE, "page");
    redirect(`${LIST}?tab=companies&created=${encodeURIComponent(name)}`);
  }

  const parts = firstAndLast(name);
  if (!parts) backWithError("Full name is required.");

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      first_name: parts.first,
      last_name: parts.last,
      email: email || null,
      title_role: companyRole || null,
      source: "whitbyos",
      created_by_workspace_id: workspaceId,
    })
    .select("id")
    .single();

  if (error || !contact) backWithError(error?.message ?? "Could not add the contact.");

  // The relationship label is a fact about a link, not about a person, so it is
  // only recorded when there is a client to link them to.
  if (clientId && ROLES.has(role)) {
    const { data: client } = await supabase
      .from("whitbyos_clients")
      .select("id")
      .eq("id", clientId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (client) {
      await supabase.from("whitbyos_client_members").insert({
        client_id: clientId,
        contact_id: contact.id,
        role,
      });
    }
  }

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?created=${encodeURIComponent(name)}`);
}

/** 4.0a's first answer — the person stays, and so does everything linked. */
/**
 * 4.4's Edit.
 *
 * Reachable by anyone who can already see the person: a contact is a shared
 * record (§5.4), so a workspace that works with them can correct their number
 * whether or not it is the one that first wrote them down. `created_by_
 * workspace_id` says who typed it first, not who owns it, and scoping the
 * write by it would have left a wrong email uneditable by everyone but one
 * team.
 */
export async function updateContact(formData: FormData) {
  await stopIfReadOnly();

  const contactId = String(formData.get("contact_id") ?? "").trim();
  if (!contactId) redirect(LIST);

  const here = `${LIST}/${contactId}`;
  const back = (message: string): never =>
    redirect(`${here}?edit=1&error=${encodeURIComponent(message)}`);

  const first = String(formData.get("first_name") ?? "").trim();
  if (!first) back("A contact needs a first name.");

  // getContact is the same reachability rule the screen itself uses, so a
  // person this workspace cannot see cannot be edited through a guessed id.
  const existing = await getContact(contactId);
  if (!existing) redirect(LIST);

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      first_name: first,
      last_name: String(formData.get("last_name") ?? "").trim() || null,
      title_role: String(formData.get("title_role") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      timezone: String(formData.get("timezone") ?? "").trim() || null,
      communication_preferences:
        String(formData.get("communication_preferences") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId);

  if (error) back(error.message);

  revalidatePath(ROUTE, "page");
  redirect(`${here}?saved=1`);
}

export async function archiveContact(formData: FormData) {
  await stopIfReadOnly();

  const contactId = String(formData.get("contact_id") ?? "").trim();
  if (!contactId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("created_by_workspace_id", workspaceId);

  if (error) redirect(`${LIST}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?archived=1`);
}

/**
 * 4.0a's second, which is the widest of the three: "Also removes <the client>
 * and its Requests, Work Plans and Documents".
 *
 * That is what the reference says, and it is only true of a Primary Contact —
 * a client whose primary contact is gone has nobody to coordinate with, which
 * is the reasoning the dialog states. So the sweep runs only where this person
 * is the primary contact on a client; a decision-maker or a family member is
 * removed from the client and the client goes on.
 *
 * The client half is `deleteClient`'s work, called rather than copied: two
 * cascades over the same tables would disagree the first time either changed.
 */
export async function deleteContact(formData: FormData) {
  await stopIfReadOnly();

  const contactId = String(formData.get("contact_id") ?? "").trim();
  if (!contactId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();

  const { data: primaryFor } = await supabase
    .from("whitbyos_clients")
    .select("id")
    .eq("primary_contact_id", contactId)
    .eq("workspace_id", workspaceId);

  for (const client of primaryFor ?? []) {
    await purgeClient(supabase, client.id as string, workspaceId);
  }

  await supabase.from("client_portal_identities").delete().eq("contact_id", contactId);
  await supabase.from("whitbyos_client_members").delete().eq("contact_id", contactId);
  await supabase.from("whitbyos_providers").delete().eq("contact_id", contactId);

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", contactId)
    .eq("created_by_workspace_id", workspaceId);

  if (error) redirect(`${LIST}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?removed=1`);
}

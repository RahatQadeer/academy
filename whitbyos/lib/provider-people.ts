import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";

/**
 * The people at a provider company.
 *
 * A provider row holds one `contact_id`, which is the person you ring. A firm
 * of any size has more than one — the partner, the account manager, the person
 * who sends the invoices — and a directory that can only hold the first of
 * them sends somebody back to their own inbox to find the other two.
 *
 * `company_contacts` has been in base since the schema was written and nothing
 * in Whitby had ever touched it: company to contact, with a title and a flag
 * for who is primary. Contacts themselves stay canonical (§5.4), shared with
 * the Portal and the Partner Center, so adding a person here writes a real
 * contact rather than a copy that lives only on a provider.
 */
export type ProviderPerson = {
  id: string;
  contactId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  /**
   * Their own provider record, when they have one.
   *
   * Everybody added at a firm from now on does: the dialog files them as an
   * individual provider and links them here in the same breath. The ones who
   * do not are the contacts entered before that, and they have only a name, a
   * role and two ways to be reached to edit.
   */
  providerId: string | null;
};

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
};

function nameOf(row: ContactRow | null) {
  if (!row) return "Contact";
  return (
    row.preferred_name ||
    [row.first_name, row.last_name].filter(Boolean).join(" ") ||
    "Contact"
  );
}

/**
 * A person's name arrives as one string and `contacts` keeps two.
 *
 * The last word is the surname and everything before it is the rest, which is
 * the only split that survives "Dr. Renata Silva" without inventing a title
 * field to put "Dr." in. One word is a first name, not a surname.
 */
export function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return {
    firstName: parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0]!,
    lastName: parts.length > 1 ? parts[parts.length - 1]! : "",
  };
}

export async function listCompanyPeople(
  companyId: string,
  /**
   * The firm's own provider row, which has to be left out of this.
   *
   * It carries `company_id` and, once somebody is the point of contact, their
   * `contact_id` as well — so matching "a provider at this company with this
   * contact" finds the firm itself and calls it that person's own record.
   * Filtering on `kind` hid it, and hid every individual filed before `kind`
   * existed along with it.
   */
  firmProviderId?: string,
): Promise<ProviderPerson[]> {
  const supabase = await createClient();

  const { data: theirOwn } = await supabase
    .from("whitbyos_providers")
    .select("id, contact_id")
    .eq("company_id", companyId)
    .not("contact_id", "is", null)
    .is("archived_at", null);

  const providerFor = new Map(
    (theirOwn ?? [])
      .filter((row) => row.id !== firmProviderId)
      .map((row) => [row.contact_id as string, row.id as string]),
  );

  const { data } = await supabase
    .from("company_contacts")
    .select(
      "id, contact_id, title_function, is_primary, contact:contacts!contact_id (id, first_name, last_name, preferred_name, email, phone)",
    )
    .eq("company_id", companyId);

  const rows = (data ?? []).map((row) => {
    const contact = (
      Array.isArray(row.contact) ? row.contact[0] : row.contact
    ) as ContactRow | null;

    return {
      id: row.id as string,
      contactId: row.contact_id as string,
      name: nameOf(contact),
      role: (row.title_function as string | null) ?? null,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      isPrimary: Boolean(row.is_primary),
      providerId: providerFor.get(row.contact_id as string) ?? null,
    };
  });

  // The primary first, then by name — the order somebody reads a firm's people.
  return rows.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Files a person at a company, creating the contact if they are new.
 *
 * Returns the contact's id, so the caller can make them the provider's point
 * of contact when they are the primary one.
 */
export async function addCompanyPerson(input: {
  companyId: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  primary?: boolean;
}) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false as const, error: "No workspace is open." };

  const split = splitName(input.name);
  if (!split) return { ok: false as const, error: "A person needs a name." };

  const supabase = await createClient();

  const { data: person, error: contactError } = await supabase
    .from("contacts")
    .insert({
      first_name: split.firstName,
      last_name: split.lastName,
      title_role: input.role || null,
      email: input.email || null,
      phone: input.phone || null,
      created_by_workspace_id: workspaceId,
    })
    .select("id")
    .single();

  if (contactError || !person) {
    return { ok: false as const, error: contactError?.message ?? "Could not add that person." };
  }

  const contactId = person.id as string;

  // One primary per company: the new one takes it and the old one gives it up.
  if (input.primary) {
    await supabase
      .from("company_contacts")
      .update({ is_primary: false })
      .eq("company_id", input.companyId);
  }

  const { error: linkError } = await supabase.from("company_contacts").insert({
    company_id: input.companyId,
    contact_id: contactId,
    title_function: input.role || null,
    is_primary: Boolean(input.primary),
  });

  if (linkError) return { ok: false as const, error: linkError.message };
  return { ok: true as const, contactId };
}

/**
 * Correcting somebody already on file.
 *
 * A typo in an email had no remedy but removing the person and adding them
 * again, which takes the record with them: the link to the firm, the fact that
 * they were the one to ring, and any history of either.
 *
 * The contact is canonical, so editing here edits the contact everywhere; the
 * role is the firm's own word for them and lives on the link.
 */
export async function editCompanyPerson(input: {
  linkId: string;
  contactId: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const split = splitName(input.name);
  if (!split) return { ok: false as const, error: "A person needs a name." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts")
    .update({
      first_name: split.firstName,
      last_name: split.lastName,
      email: input.email || null,
      phone: input.phone || null,
    })
    .eq("id", input.contactId);

  if (error) return { ok: false as const, error: error.message };

  await supabase
    .from("company_contacts")
    .update({ title_function: input.role || null })
    .eq("id", input.linkId);

  return { ok: true as const };
}

export async function makePersonPrimary(companyId: string, contactId: string) {
  const supabase = await createClient();
  await supabase
    .from("company_contacts")
    .update({ is_primary: false })
    .eq("company_id", companyId);
  await supabase
    .from("company_contacts")
    .update({ is_primary: true })
    .eq("company_id", companyId)
    .eq("contact_id", contactId);
}

/**
 * Takes a person off the company, and leaves the person alone.
 *
 * The contact is canonical and may be on a request, a message or a client's
 * file. Unlinking says they are not at this firm; deleting them would say they
 * do not exist.
 */
export async function removeCompanyPerson(linkId: string) {
  const supabase = await createClient();
  await supabase.from("company_contacts").delete().eq("id", linkId);
}

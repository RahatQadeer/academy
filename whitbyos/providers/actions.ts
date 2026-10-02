"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { categoryName, listCategories } from "@/whitbyos/lib/taxonomy";
import {
  addProviderNoteRow,
  deleteProviderNoteRow,
} from "@/whitbyos/lib/provider-notes";
import {
  addCompanyPerson,
  editCompanyPerson,
  makePersonPrimary,
  removeCompanyPerson,
} from "@/whitbyos/lib/provider-people";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { OUTREACH, READINESS, RESPONSES, SOURCES } from "@/whitbyos/lib/provider-vocab";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";
import { contactProblem } from "@/whitbyos/lib/contact-format";
import { recordTimelineEvent, TIMELINE_EVENT } from "@/whitbyos/lib/timeline-events";

const LIST = "/whitbyos/providers";
const ROUTE = "/[product]/[[...slug]]";

const READINESS_VALUES = new Set(READINESS.map((r) => r.value as string));
const OUTREACH_VALUES = new Set(OUTREACH.map((o) => o.value as string));
const SOURCE_VALUES = new Set(SOURCES.map((s) => s.value as string));
const RESPONSE_VALUES = new Set(RESPONSES.map((r) => r.value as string));

/**
 * Back to the form that was being filled in, not to a different one.
 *
 * This always sent people to the directory's own Add dialog, so a bad website
 * typed while editing somebody at a firm threw the reader onto another screen,
 * into an empty form, with the thing they had been doing gone. `error_to` is
 * the address of the dialog they were actually in.
 */
function backWithError(message: string, errorTo?: string): never {
  const where =
    errorTo && errorTo.startsWith("/whitbyos/providers")
      ? errorTo
      : `${LIST}?new=1`;
  redirect(`${where}${where.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

/** What both dialogs collect, read the same way from either form. */
function readFields(formData: FormData) {
  const source = String(formData.get("source") ?? "").trim();
  const readiness = String(formData.get("readiness") ?? "prospect").trim();
  const outreach = String(formData.get("outreach") ?? "").trim();

  const response = String(formData.get("response_state") ?? "").trim();
  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;

  return {
    /* A `taxonomy_categories.id` — "CAT-0130" — not a word any more. */
    category: String(formData.get("category") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    owner: String(formData.get("owner") ?? "").trim(),
    readiness: READINESS_VALUES.has(readiness) ? readiness : "prospect",
    outreach: OUTREACH_VALUES.has(outreach) ? outreach : null,
    source: SOURCE_VALUES.has(source) ? source : null,
    // 5.1's own. Free text but for the response, which is a fixed list like
    // the outreach state it sits beside, and the three dates.
    nextAction: text("next_action"),
    qualifications: text("qualifications"),
    restrictions: text("restrictions"),
    missingInformation: text("missing_information"),
    lastContactDate: text("last_contact_date"),
    responseState: RESPONSE_VALUES.has(response) ? response : null,
    // Columns since the schema was written, drawn on 5.1 since it was built,
    // and until now writable from nowhere at all.
    specialty: text("specialty"),
    lastVerifiedAt: text("last_verified_at"),
    nextFollowUp: text("next_follow_up_date"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    address: text("address"),
  };
}

/** The columns 5.1's fields write, shared by Add and Edit. */
function detailColumns(fields: ReturnType<typeof readFields>) {
  return {
    next_action: fields.nextAction,
    qualifications: fields.qualifications,
    restrictions: fields.restrictions,
    missing_information: fields.missingInformation,
    last_contact_date: fields.lastContactDate,
    response_state: fields.responseState,
    category_id: fields.category || null,
    specialty_capability: fields.specialty,
    email: fields.email,
    phone: fields.phone,
    website: fields.website,
    address: fields.address,
    last_verified_at: fields.lastVerifiedAt,
    next_follow_up_date: fields.nextFollowUp,
  };
}

/**
 * Screen 14's Add Provider.
 *
 * A provider is a relationship with a company, so it hangs off a `companies`
 * row rather than storing a name of its own — §5.4's canonical record again.
 * Naming a company that is not on file yet creates it, because being asked to
 * go and add the company first is the sort of detour that gets a provider
 * written on paper instead.
 */
export async function createProvider(formData: FormData) {
  await stopIfReadOnly();

  const companyId = String(formData.get("company_id") ?? "").trim();
  // Both dialogs share their fields, and those emit `name`.
  const newCompany = String(formData.get("name") ?? "").trim();
  // 5.0a asks this first, and it decides which table the provider is: a
  // company, or a person. The row points at one or the other, never both.
  const individual = String(formData.get("type") ?? "company").trim() === "individual";
  const clientId = String(formData.get("client_id") ?? "").trim();
  // The first note, written while the provider is being filed. There is no
  // detail page to write it on yet, and it is the moment somebody actually
  // knows why they are adding this person.
  const firstNote = String(formData.get("note") ?? "").trim();
  /*
   * The people at the firm, filled in on the same form that names it.
   *
   * Four parallel lists, which is what repeated fields of the same name give
   * you, read back by position. Rows with no name are skipped rather than
   * refused: somebody who opened a row and thought better of it has not made
   * a mistake worth stopping for.
   */
  const people = formData.getAll("person_name").map((value, index) => ({
    name: String(value ?? "").trim(),
    role: String(formData.getAll("person_role")[index] ?? "").trim(),
    email: String(formData.getAll("person_email")[index] ?? "").trim(),
    phone: String(formData.getAll("person_phone")[index] ?? "").trim(),
  }));
  const primaryAt = Number(formData.get("person_primary") ?? 0);
  const fields = readFields(formData);
  const { category } = fields;
  /*
   * Two places, on purpose.
   *
   * `category_id` is the real one: it is the taxonomy, it can be renamed
   * centrally, and it is what the directory groups and filters by. But
   * `companies.industry_type` and `contacts.title_role` are base's columns and
   * three other products read them, so the category's *name* keeps going there
   * too. Dropping that would blank the classification everywhere else in the
   * ecosystem to tidy up one dropdown.
   */
  const categoryLabel = categoryName(await listCategories(), category) ?? category;

  if (!companyId && !newCompany) backWithError("Choose a company, or name a new one.");

  /*
   * Checked here as well as in the browser.
   *
   * The input types catch a typed mistake, and nothing else: a pasted value, a
   * field the browser filled, an older browser, a form posted without one at
   * all. A record is worth more than the moment it was entered, so the rule
   * lives where the writing happens.
   */
  const errorTo = String(formData.get("error_to") ?? "").trim();
  const wrong = contactProblem(fields);
  if (wrong) backWithError(wrong, errorTo);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) backWithError("Create your workspace first.");

  const supabase = await createClient();

  if (individual) {
    // A person's name arrives as one string, and `contacts` keeps two. The
    // last word is the surname and the rest is everything before it, which is
    // the only split that survives "Dr. Renata Silva" — the reference's own
    // example — without inventing a title field to put "Dr." in.
    const parts = newCompany.split(/\s+/).filter(Boolean);
    const lastName = parts.length > 1 ? parts[parts.length - 1]! : "";
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : newCompany;

    /*
     * Somebody already on file becomes a provider rather than a second copy.
     *
     * The firm's People panel could enter a contact before it could enter a
     * provider, so there are people at firms with a name, a role and nothing
     * else. Editing one opens this same form, and saving it gives them the
     * record they never had — against the contact they already are, because
     * the alternative is two of them.
     */
    const existingContactId = String(formData.get("existing_contact_id") ?? "").trim();

    const { data: person, error: contactError } = existingContactId
      ? await supabase
          .from("contacts")
          .update({
            first_name: firstName,
            last_name: lastName,
            email: fields.email || null,
            phone: fields.phone || null,
          })
          .eq("id", existingContactId)
          .select("id")
          .single()
      : await supabase
      .from("contacts")
      .insert({
        first_name: firstName,
        last_name: lastName,
        title_role: categoryLabel || null,
        // The same two the provider keeps. A contact nobody can reach is half
        // a record wherever else it is read.
        email: fields.email || null,
        phone: fields.phone || null,
        created_by_workspace_id: workspaceId,
      })
      .select("id")
      .single();

    if (contactError || !person) {
      backWithError(contactError?.message ?? "Could not add the provider.");
    }

    const { data: filed, error } = await supabase.from("whitbyos_providers").insert({
      workspace_id: workspaceId,
      kind: "individual",
      // A person can be at a firm that is itself a provider. Both columns were
      // always here; only the guess about which one meant what stopped this.
      company_id: String(formData.get("firm_id") ?? "").trim() || null,
      contact_id: person.id as string,
      client_id: clientId || null,
      readiness: fields.readiness,
      outreach_status: fields.outreach,
      location: fields.location || null,
      evidence_source: fields.source,
      ...detailColumns(fields),
      relationship_owner_user_id: fields.owner || null,
    }).select("id").single();

    if (error) backWithError(error.message);
    if (filed?.id) {
      await recordTimelineEvent({
        providerId: filed.id as string,
        eventType: TIMELINE_EVENT.providerAdded,
        description: `${newCompany} was added to the directory`,
      });
      if (firstNote) await addProviderNoteRow(filed.id as string, firstNote);
    }

    /*
     * A person at a firm, filed once.
     *
     * Somebody who is a provider and works somewhere is not two records. The
     * provider row says what they do; `company_contacts` says where they are,
     * and it is that second one the firm's People panel reads. Writing only
     * the first left them nested in the list and missing from the firm's own
     * page, which is the same person in two places disagreeing.
     */
    const firmId = String(formData.get("firm_id") ?? "").trim();
    if (firmId) {
      // The role is what the firm calls them; the specialty is what they do.
      // They were being written to the same column, so every partner read
      // "Immigration" and nobody's title survived.
      const role = String(formData.get("role") ?? "").trim();
      await supabase
        .from("company_contacts")
        .upsert(
          {
            company_id: firmId,
            contact_id: person.id as string,
            title_function: role || fields.specialty || null,
          },
          { onConflict: "company_id,contact_id" },
        );

      // Ticked while filing them, rather than found and set afterwards.
      const firmProviderId = String(formData.get("firm_provider_id") ?? "").trim();
      if (firmProviderId && String(formData.get("as_contact") ?? "") === "1") {
        await supabase
          .from("company_contacts")
          .update({ is_primary: false })
          .eq("company_id", firmId);
        await supabase
          .from("company_contacts")
          .update({ is_primary: true })
          .eq("company_id", firmId)
          .eq("contact_id", person.id as string);
        await supabase
          .from("whitbyos_providers")
          .update({ contact_id: person.id as string })
          .eq("id", firmProviderId);
      }
    }

    revalidatePath(ROUTE, "page");

    // Added from inside a firm, so that is where it goes back to.
    const back = String(formData.get("return_to") ?? "").trim();
    if (back.startsWith("/whitbyos/providers/")) {
      redirect(`${back}?saved=1`);
    }
    redirect(`${LIST}?created=${encodeURIComponent(newCompany || "Provider")}`);
  }

  let resolvedCompanyId = companyId;

  /*
   * The same firm, twice, is the thing this has to refuse.
   *
   * The name field says so while somebody types, but a message on a screen is
   * not a rule: two people filing at once, a stale dialog, a name that matched
   * nothing until a second ago. So it is checked here as well, where it is
   * actually decided — against the company the name names, and against a
   * provider already hanging off it.
   */
  if (!resolvedCompanyId && newCompany) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("created_by_workspace_id", workspaceId)
      .ilike("name", newCompany)
      .maybeSingle();

    if (existing?.id) {
      const { data: alreadyFiled } = await supabase
        .from("whitbyos_providers")
        .select("id")
        .eq("company_id", existing.id as string)
        .is("archived_at", null)
        .maybeSingle();

      if (alreadyFiled?.id) {
        backWithError(`${newCompany} is already a provider. Open them from the directory instead.`);
      }
      // On file but not a provider: this is added to that company rather than
      // making a second one under the same name.
      resolvedCompanyId = existing.id as string;
    }
  }

  if (!resolvedCompanyId) {
    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: newCompany,
        industry_type: categoryLabel || null,
        created_by_workspace_id: workspaceId,
      })
      .select("id")
      .single();

    if (error || !data) backWithError(error?.message ?? "Could not add the company.");
    resolvedCompanyId = data.id as string;
  } else if (category) {
    await supabase
      .from("companies")
      .update({ industry_type: categoryLabel })
      .eq("id", resolvedCompanyId)
      .eq("created_by_workspace_id", workspaceId);
  }

  const { data: filed, error } = await supabase.from("whitbyos_providers").insert({
    // Without this the row is invisible and, worse, unwritable: the staff
    // policy is is_workspace_member(workspace_id) on both sides, so a null
    // workspace made every Add Provider fail — which is why the table was
    // empty. Migration 011 added the column and this never started setting it.
    workspace_id: workspaceId,
    kind: "company",
    company_id: resolvedCompanyId,
    client_id: clientId || null,
    readiness: fields.readiness,
    outreach_status: fields.outreach,
    location: fields.location || null,
    evidence_source: fields.source,
    ...detailColumns(fields),
    relationship_owner_user_id: fields.owner || null,
  }).select("id").single();

  if (error) backWithError(error.message);
  if (filed?.id) {
    await recordTimelineEvent({
      providerId: filed.id as string,
      eventType: TIMELINE_EVENT.providerAdded,
      description: `${newCompany || "This provider"} was added to the directory`,
    });
    if (firstNote) await addProviderNoteRow(filed.id as string, firstNote);
  }

  // The people, and then whichever of them is the one to ring.
  for (const [index, person] of people.entries()) {
    if (!person.name) continue;
    const added = await addCompanyPerson({
      companyId: resolvedCompanyId,
      name: person.name,
      role: person.role,
      email: person.email,
      phone: person.phone,
      primary: index === primaryAt,
    });
    if (added.ok && index === primaryAt && filed?.id) {
      await supabase
        .from("whitbyos_providers")
        .update({ contact_id: added.contactId })
        .eq("id", filed.id as string);
    }
  }

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?created=${encodeURIComponent(newCompany || "Provider")}`);
}


/**
 * Screen 5.1a — Edit Provider.
 *
 * The company's name and category belong to `companies`, which every product
 * shares; everything else is this workspace's own view of them and lives on the
 * Whitby record. Both are written, which is why this touches two tables.
 */
export async function updateProvider(formData: FormData) {
  await stopIfReadOnly();

  const providerId = String(formData.get("provider_id") ?? "").trim();
  const companyId = String(formData.get("company_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const contactId = String(formData.get("contact_id") ?? "").trim();
  const fields = readFields(formData);

  const back = `/whitbyos/providers/${providerId}`;
  if (!providerId) redirect(LIST);
  if (!name) redirect(`${back}?edit=1&error=${encodeURIComponent("A provider needs a name.")}`);

  const wrong = contactProblem(fields);
  if (wrong) redirect(`${back}?edit=1&error=${encodeURIComponent(wrong)}`);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();

  // The name of the category, for base's own column — see `createProvider`.
  const categoryLabel =
    categoryName(await listCategories(), fields.category) ?? fields.category;

  /*
   * Whose name this is, and it is not always the company's.
   *
   * This renamed `companies` whenever the row had a `company_id`, which was
   * safe while that column could only mean "the company this provider is".
   * It cannot any more: an individual's `company_id` is where they *work*, so
   * editing a partner rewrote their firm's name to the partner's, and wiped
   * its category on the way past.
   *
   * `kind` is the stored answer, but older rows do not have one, and the
   * People dialog already knows it is a person (`type` / `firm_id`). Either
   * is enough to keep the firm's record out of this save.
   */
  const type = String(formData.get("type") ?? "").trim();
  const atFirm = Boolean(String(formData.get("firm_id") ?? "").trim());

  const { data: existing } = await supabase
    .from("whitbyos_providers")
    .select("kind, contact_id")
    .eq("id", providerId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const individual =
    existing?.kind === "company"
      ? false
      : existing?.kind === "individual" || type === "individual" || atFirm;
  const storedContactId = (existing?.contact_id as string | null) || null;
  const theirContactId = storedContactId || contactId || null;

  if (individual) {
    // The person's own record carries their name and their two ways in.
    if (theirContactId) {
      const parts = name.split(/\s+/).filter(Boolean);
      await supabase
        .from("contacts")
        .update({
          first_name: parts.length > 1 ? parts.slice(0, -1).join(" ") : name,
          last_name: parts.length > 1 ? parts[parts.length - 1]! : "",
          email: fields.email || null,
          phone: fields.phone || null,
        })
        .eq("id", theirContactId);
    }

    // What the firm calls them, where the firm keeps it.
    const role = String(formData.get("role") ?? "").trim();
    if (role && companyId && theirContactId) {
      await supabase
        .from("company_contacts")
        .update({ title_function: role })
        .eq("company_id", companyId)
        .eq("contact_id", theirContactId);
    }
  } else if (companyId) {
    await supabase
      .from("companies")
      .update({ name, industry_type: categoryLabel || null })
      .eq("id", companyId);
  }

  /*
   * A person edited from inside the firm is asked only what is theirs.
   *
   * The slim form does not carry the firm's website, address, category or
   * readiness. Writing the missing keys as null — or as the firm's hidden
   * defaults — blanked the person's record, and on the way through the old
   * company write, the firm's too. Only the fields on that form move here.
   */
  const personPatch = atFirm && individual
    ? {
        specialty_capability: fields.specialty,
        email: fields.email,
        phone: fields.phone,
        next_action: fields.nextAction,
        updated_at: new Date().toISOString(),
      }
    : {
        readiness: fields.readiness,
        outreach_status: fields.outreach,
        location: fields.location || null,
        evidence_source: fields.source,
        ...detailColumns(fields),
        relationship_owner_user_id: fields.owner || null,
        // A person's own row points at themselves; only a company's row is told
        // who to ring, and only by the dialog that asks.
        ...(individual ? {} : { contact_id: contactId || null }),
        updated_at: new Date().toISOString(),
      };

  const { error } = await supabase
    .from("whitbyos_providers")
    .update(personPatch)
    .eq("id", providerId)
    .eq("workspace_id", workspaceId);

  if (error) redirect(`${back}?edit=1&error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");

  // Edited from inside a firm's People panel, so that is where it returns.
  const from = String(formData.get("return_to") ?? "").trim();
  if (from.startsWith("/whitbyos/providers/")) redirect(`${from}?saved=1`);

  redirect(`${back}?saved=1`);
}

/**
 * 5.1a's Remove Provider.
 *
 * Only the Whitby record goes. The company and any contacts on it are base
 * records shared with the Portal and the Partner Center (§5.4) — removing a
 * provider from this directory is not a reason to erase the company from
 * everywhere else.
 */
/** 5.0d's first answer — hides it from the directory, keeps everything. */
export async function archiveProvider(formData: FormData) {
  await stopIfReadOnly();

  const providerId = String(formData.get("provider_id") ?? "").trim();
  if (!providerId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { error } = await supabase
    .from("whitbyos_providers")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", providerId)
    .eq("workspace_id", workspaceId);

  if (error) redirect(`${LIST}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?archived=1`);
}

/**
 * 5.0d's second — "Also removes its outreach history and linked Documents".
 *
 * The company or contact behind the provider is left alone. Those are base
 * records shared with the Portal and the Partner Center (§5.4): the firm is
 * deleting a relationship it holds with them, not the fact that they exist.
 */
export async function deleteProvider(formData: FormData) {
  await stopIfReadOnly();

  const providerId = String(formData.get("provider_id") ?? "").trim();
  if (!providerId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();

  await supabase
    .from("documents")
    .delete()
    .eq("context_type", "provider")
    .eq("context_id", providerId);

  const { error } = await supabase
    .from("whitbyos_providers")
    .delete()
    .eq("id", providerId)
    .eq("workspace_id", workspaceId);

  if (error) redirect(`${LIST}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?removed=1`);
}

export async function removeProvider(formData: FormData) {
  await stopIfReadOnly();

  const providerId = String(formData.get("provider_id") ?? "").trim();
  if (!providerId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { error } = await supabase
    .from("whitbyos_providers")
    .delete()
    .eq("id", providerId)
    .eq("workspace_id", workspaceId);

  if (error) {
    redirect(`/whitbyos/providers/${providerId}?edit=1&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?removed=1`);
}

/**
 * The person to speak to at a provider — set from the provider's own screen.
 *
 * This was only reachable from inside Edit, where nobody looking at an empty
 * "Point of Contact" panel would think to go: the panel said no contact was
 * recorded and offered nothing, and the control sat behind a button labelled
 * for something else. It is a link in that panel now, and this is what it
 * posts to.
 *
 * Only for a company provider. Where the provider is a person,
 * `whitbyos_providers.contact_id` is that person — their identity, not their
 * point of contact — and changing it would quietly turn the provider into
 * somebody else. The panel offers nothing there for the same reason.
 */
export async function setProviderContact(formData: FormData) {
  await stopIfReadOnly();

  const providerId = String(formData.get("provider_id") ?? "").trim();
  const contactId = String(formData.get("contact_id") ?? "").trim();
  const back = `/whitbyos/providers/${providerId}`;
  if (!providerId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();

  // The provider has to be this workspace's, and a company one.
  const { data: provider } = await supabase
    .from("whitbyos_providers")
    .select("id, company_id")
    .eq("id", providerId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!provider) redirect(LIST);
  if (!provider.company_id) {
    redirect(`${back}?error=${encodeURIComponent("This provider is a person, so they are their own contact.")}`);
  }

  // An empty choice clears it, which is the way back from picking the wrong
  // person. Anything else has to be a contact this workspace can read — RLS
  // decides that, and a miss comes back as not found rather than as a write.
  if (contactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .maybeSingle();

    if (!contact) {
      redirect(`${back}?contact=1&error=${encodeURIComponent("That contact is not one this workspace can see.")}`);
    }
  }

  const { error } = await supabase
    .from("whitbyos_providers")
    .update({ contact_id: contactId || null, updated_at: new Date().toISOString() })
    .eq("id", providerId);

  if (error) redirect(`${back}?contact=1&error=${encodeURIComponent(error.message)}`);

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(`${back}?saved=1`);
}

/**
 * A note on a provider.
 *
 * `revalidatePath` rather than a redirect: the form sits on the page it writes
 * to, so there is nowhere to go — the page just has to come back with one more
 * note on it. A same-route redirect would not move anything.
 */
export async function addProviderNote(formData: FormData) {
  await stopIfReadOnly();

  const providerId = String(formData.get("provider_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!providerId || !body) return;

  const result = await addProviderNoteRow(providerId, body);
  if (result.ok) {
    await recordTimelineEvent({
      providerId,
      eventType: TIMELINE_EVENT.noteAdded,
      description: "A note was added",
    });
  }
  if (!result.ok) {
    redirect(
      `/whitbyos/providers/${providerId}?error=${encodeURIComponent(result.error)}`,
    );
  }

  revalidatePath(ROUTE, "page");
}

export async function deleteProviderNote(formData: FormData) {
  await stopIfReadOnly();

  const noteId = String(formData.get("note_id") ?? "").trim();
  if (!noteId) return;

  await deleteProviderNoteRow(noteId);
  revalidatePath(ROUTE, "page");
}


/**
 * A person at a provider company, added from the provider's own screen.
 *
 * The alternative was the sentence the Point of Contact dialog used to end on:
 * add them under Contacts first. Nobody does that in the middle of filing a
 * provider; they write the name on something else and the directory keeps a
 * firm with nobody at it.
 */
export async function addProviderPerson(formData: FormData) {
  await stopIfReadOnly();

  const providerId = String(formData.get("provider_id") ?? "").trim();
  const companyId = String(formData.get("company_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const back = `/whitbyos/providers/${providerId}`;
  if (!providerId || !companyId || !name) return;

  const wrong = contactProblem({
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
  });
  if (wrong) redirect(`${back}?error=${encodeURIComponent(wrong)}`);

  const result = await addCompanyPerson({
    companyId,
    name,
    role: String(formData.get("role") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    primary: String(formData.get("primary") ?? "") === "1",
  });

  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  await recordTimelineEvent({
    providerId,
    eventType: TIMELINE_EVENT.personAdded,
    description: `${name} was added at this provider`,
  });

  // Made the point of contact here as well, so the two never disagree.
  if (String(formData.get("primary") ?? "") === "1") {
    const supabase = await createClient();
    await supabase
      .from("whitbyos_providers")
      .update({ contact_id: result.contactId })
      .eq("id", providerId);
  }

  revalidatePath(ROUTE, "page");
}

export async function setProviderPersonPrimary(formData: FormData) {
  await stopIfReadOnly();

  const providerId = String(formData.get("provider_id") ?? "").trim();
  const companyId = String(formData.get("company_id") ?? "").trim();
  const contactId = String(formData.get("contact_id") ?? "").trim();
  if (!providerId || !companyId || !contactId) return;

  await makePersonPrimary(companyId, contactId);
  await recordTimelineEvent({
    providerId,
    eventType: TIMELINE_EVENT.contactSet,
    description: "The point of contact was changed",
  });

  const supabase = await createClient();
  await supabase
    .from("whitbyos_providers")
    .update({ contact_id: contactId })
    .eq("id", providerId);

  revalidatePath(ROUTE, "page");
}

export async function removeProviderPerson(formData: FormData) {
  await stopIfReadOnly();

  const providerId = String(formData.get("provider_id") ?? "").trim();
  const linkId = String(formData.get("link_id") ?? "").trim();
  const contactId = String(formData.get("contact_id") ?? "").trim();
  if (!linkId) return;

  await removeCompanyPerson(linkId);

  // If they were the one to ring, the provider is left with nobody rather
  // than with somebody who is no longer there.
  if (providerId && contactId) {
    const supabase = await createClient();
    await supabase
      .from("whitbyos_providers")
      .update({ contact_id: null })
      .eq("id", providerId)
      .eq("contact_id", contactId);
  }

  revalidatePath(ROUTE, "page");
}


/** Correcting somebody already at the firm, rather than removing them. */
export async function updateProviderPerson(formData: FormData) {
  await stopIfReadOnly();

  const providerId = String(formData.get("provider_id") ?? "").trim();
  const linkId = String(formData.get("link_id") ?? "").trim();
  const contactId = String(formData.get("contact_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!providerId || !linkId || !contactId || !name) return;

  const wrong = contactProblem({
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
  });
  if (wrong) {
    redirect(`/whitbyos/providers/${providerId}?error=${encodeURIComponent(wrong)}`);
  }

  const result = await editCompanyPerson({
    linkId,
    contactId,
    name,
    role: String(formData.get("role") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
  });

  if (!result.ok) {
    redirect(
      `/whitbyos/providers/${providerId}?error=${encodeURIComponent(result.error)}`,
    );
  }

  revalidatePath(ROUTE, "page");
}

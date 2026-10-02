"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DialogResult } from "@/whitbyos/components/DialogForm";
import { randomUUID } from "crypto";
import { createClient } from "@/base/lib/supabase/server";
import { checkEmail } from "@/base/auth/email";
import { inviteOrigin } from "@/base/auth/site";
import { getCurrentWorkspaceId, getCurrentWorkspacePlan } from "@/whitbyos/lib/workspace";
import { getWorkspaceSeatLimits } from "@/whitbyos/lib/client-sections";
import { ACCESS_AREAS, grantHasLogin, roleFor } from "@/whitbyos/lib/access-requests-vocab";
import { createAdminClient } from "@/whitbyos/lib/supabase-admin";
import { sendSignInLink } from "@/whitbyos/lib/invite-mail";
import type { ClientType } from "@/whitbyos/types";
import { purgeClient } from "@/whitbyos/lib/client-purge";
import { readOnlyDialogResult, stopIfReadOnly } from "@/whitbyos/lib/read-only";
import { planIncludesClientPortal } from "@/whitbyos/lib/billing-vocab";

/** §9.4.3 — an invitation expires rather than standing open indefinitely. */
const INVITE_DAYS = 14;

const CLIENT_TYPES: ClientType[] = [
  "individual",
  "family",
  "company",
  "organization",
];

const LIST = "/whitbyos/clients";
const WORKSPACES = "/whitbyos/workspaces";
const ARCHIVED = "/whitbyos/workspaces/archived";

function backWithError(message: string, returnTo?: string): never {
  const back = returnTo?.startsWith("/whitbyos/") ? returnTo : LIST;
  redirect(`${back}?new=1&error=${encodeURIComponent(message)}`);
}

/**
 * Screen 2.2a — where a newly created client goes before its toast.
 *
 * `then` is the query the flow would have ended on, carried through so that
 * Skip for now lands exactly where creating a client used to: the Client Added
 * toast on the plain path, and the invitation's own toast — including the one
 * that says the email did not leave — on the invited path. That warning must
 * not be lost behind a dialog, which is why it travels rather than being
 * replaced.
 */
function createdHref(clientId: string, name: string, then: string) {
  const query = new URLSearchParams({ created: clientId, name });
  if (then) query.set("then", then);
  return `${LIST}?${query.toString()}`;
}


/** "Jordan Hartwell" → ["Jordan", "Hartwell"]. `contacts` requires both parts. */
function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0]!, ""];
  return [parts.slice(0, -1).join(" "), parts.at(-1)!];
}

export async function createClientRecord(formData: FormData) {
  await stopIfReadOnly();

  /* Which screen the dialog was opened on, so a refusal goes back there. */
  const returnTo = String(formData.get("return_to") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const classification = String(formData.get("classification") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();

  if (!name) backWithError("Workspace is required.", returnTo);
  if (!classification) backWithError("Classification is required.", returnTo);
  if (!contactName) backWithError("Contact person is required.", returnTo);
  if (!contactEmail) backWithError("Contact Email is required.", returnTo);

  // Checked before anything is built around it: an invitation to an address
  // that was never real sits pending forever while somebody waits on a reply.
  const checked = checkEmail(contactEmail);
  if (!checked.ok) backWithError(checked.reason, returnTo);

  /*
   * The firm's word is what is stored and shown. `client_type` is the
   * structural kind underneath it and is still written, because the enum is
   * what four screens and one filter were built on — derived from the
   * classification where the two mean the same thing, and left at "family"
   * where the firm has invented a word of its own ("Estate", "Household"),
   * which is the closest the enum can honestly get.
   */
  const guessed = classification.toLowerCase();
  const clientType: ClientType = CLIENT_TYPES.includes(guessed as ClientType)
    ? (guessed as ClientType)
    : guessed.includes("compan") || guessed.includes("business")
      ? "company"
      : guessed.includes("individual") || guessed.includes("person")
        ? "individual"
        : "family";

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    backWithError("No workspace found. Finish onboarding before adding clients.", returnTo);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`${LIST}?expired=1`);

  // The primary contact is a canonical base `contacts` row, never a local copy.
  let primaryContactId: string | null = null;
  if (contactName) {
    const [firstName, lastName] = splitName(contactName);
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: contactEmail || null,
        phone: contactPhone || null,
        // Where this person sits, which is the client they came in with. The
        // export fills the Contacts list's Company / Role column this way for
        // a primary contact and leaves it empty for everyone else.
        title_role: name,
        source: "whitby_add_client",
        created_by_workspace_id: workspaceId,
      })
      .select("id")
      .single();

    if (contactError) backWithError(contactError.message, returnTo);
    primaryContactId = contact.id;
  }

  const { data: client, error } = await supabase
    .from("whitbyos_clients")
    .insert({
      workspace_id: workspaceId,
      name,
      client_type: clientType,
      classification: classification || null,
      status: "active",
      owner_user_id: user.id,
      primary_contact_id: primaryContactId,
    })
    .select("id")
    .single();

  if (error || !client) backWithError(error?.message ?? "Could not add the client.", returnTo);

  // Relationship is the membership row, not the contact pointer.
  // Portal access is a plan capability, offered from the client setup
  // screen, not from creating the workspace.
  if (primaryContactId) {
    await supabase.from("whitbyos_client_members").insert({
      client_id: client.id,
      contact_id: primaryContactId,
      role: "primary_contact",
      portal_access: false,
    });
  }

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(createdHref(client.id, name, `added=${encodeURIComponent(name)}`));
}

/**
 * Screen 2.1 Profile — relationship health, Active / At risk / Inactive.
 *
 * The list now shows this column, so it has to be writable from the Overview
 * rather than remaining a default of "active" that nobody can change.
 */
export async function updateClientStatus(formData: FormData) {
  await stopIfReadOnly();

  const clientId = String(formData.get("client_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const back = `/whitbyos/clients/${clientId}`;

  if (!clientId) redirect(LIST);
  if (!["active", "at_risk", "inactive"].includes(status)) redirect(back);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  await supabase
    .from("whitbyos_clients")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", clientId)
    .eq("workspace_id", workspaceId);

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(back);
}

/**
 * SRS §4.9.2 — Whitby sends the invitation.
 *
 * The row is what matters and the email is a convenience: the link works from
 * the moment the row exists. So the two are reported separately — an invitation
 * that exists but could not be emailed is still usable, and saying "sent" over
 * it would be a lie the professional acts on.
 *
 * The common reason is dull and worth naming rather than dressing up: Supabase
 * refuses to invite an address that already has an account, which is most
 * addresses during testing.
 *
 * `context_id` is the client, not the contact — the accept page reads it to
 * name the household doing the inviting.
 */
type InviteOutcome = { emailed: boolean; reason: string | null; clientId: string | null };

/**
 * The invitation kind that matches a role.
 *
 * `client_authorized_user` has been in `InvitationContextType` and in the
 * accept-invite route's `CLIENT_KINDS` since both were written, and nothing has
 * ever written it — it was declared for exactly this case. Both kinds lead into
 * the Client Portal by the identical path, so this changes what the row says
 * about the person, not where the link takes them.
 */
function invitationKindFor(role: string) {
  return role === "authorized_user" ? "client_authorized_user" : "client_member";
}

export async function inviteToPortal({
  email,
  name,
  clientId,
  inviterId,
  role = "primary_contact",
}: {
  email: string;
  name: string;
  clientId: string;
  inviterId: string;
  /**
   * What this person was actually granted. Defaults to the primary contact,
   * which is the only role the create-a-client path can produce.
   */
  role?: string;
}): Promise<InviteOutcome> {
  if (!planIncludesClientPortal(await getCurrentWorkspacePlan())) {
    return {
      emailed: false,
      reason: "Upgrade your plan to enable Client Portal.",
      clientId,
    };
  }

  const supabase = await createClient();
  const token = randomUUID();

  const { error } = await supabase.from("invitations").insert({
    // null until the send is attempted, so a row can never claim delivery it
    // has not had.
    email_delivered: null,
    token,
    inviter_user_id: inviterId,
    invitee_email: email,
    invitee_name: name || null,
    // Both were constants, on every invitation this writes, including one for
    // somebody approved as an Authorized User. The membership row carried the
    // right role and the invitation contradicted it; nothing displayed the
    // difference, so the row has simply been wrong in private.
    context_type: invitationKindFor(role),
    context_id: clientId,
    role_or_relationship: role,
    status: "pending",
    sent_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    // RLS on `invitations` requires created_by to be the acting user.
    created_by: inviterId,
  });

  if (error) {
    return {
      emailed: false,
      reason: `The invitation could not be created: ${error.message}`,
      clientId: null,
    };
  }

  /** Records what actually happened, so the list stops having to guess. */
  const record = async (delivered: boolean) => {
    await supabase.from("invitations").update({ email_delivered: delivered }).eq("token", token);
  };

  const admin = createAdminClient();
  if (!admin) {
    await record(false);
    return {
      emailed: false,
      reason: "No email was sent, SUPABASE_SERVICE_ROLE_KEY is not set on this environment.",
      clientId,
    };
  }

  const link = `${inviteOrigin()}/invite/${token}`;

  try {
    const { error: mailError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: link,
    });
    if (mailError) throw mailError;
    await record(true);
    return { emailed: true, reason: null, clientId };
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : String(thrown);

    // Everyone signs in through one account across all four products, so an
    // address can already have a login before it is ever a client — a
    // professional who is also somebody's client, or the same person invited
    // twice. Supabase will not "invite" such an address, and it is right not
    // to: there is no account to create. What they need is a way in, not a way
    // to sign up, so they get a sign-in link to the same invitation page.
    if (/already been registered|already exists|email_exists/i.test(message)) {
      const sent = await sendSignInLink(email, link);
      await record(sent);
      return sent
        ? { emailed: true, reason: null, clientId }
        : {
            emailed: false,
            reason: `${email} already has an account, and the sign-in link to it could not be sent either. Copy the invitation link from the client's Contacts tab and send it yourself, it works the same way.`,
            clientId,
          };
    }

    if (/rate limit|too many|over_email_send_rate/i.test(message)) {
      await record(false);
      return {
        emailed: false,
        reason:
          "Supabase's hourly email limit was reached. Copy the link from the client's Contacts tab, or try again in an hour.",
        clientId,
      };
    }

    await record(false);
    return { emailed: false, reason: `The email could not be sent: ${message}`, clientId };
  }
}

/**
 * Send the invitation again — SRS §9.4.3, which tracks resend alongside
 * suspend and revoke.
 *
 * The old invitation is revoked rather than left standing. Two live links to
 * the same portal is one more than anyone needs, and a link that was mailed to
 * an address the professional has since corrected should stop working.
 */
export type ResendResult = { ok: boolean; message: string } | null;

export async function resendPortalInvitation(
  _previous: ResendResult,
  formData: FormData,
): Promise<ResendResult> {
  await stopIfReadOnly();

  const clientId = String(formData.get("client_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const contactId = String(formData.get("contact_id") ?? "").trim();

  // It reports back rather than redirecting. Both places this is pressed sit on
  // the page the redirect targeted, and a server action redirecting to the path
  // it is already on does not move the router — so the toast it was supposed to
  // raise has never once appeared, while the email went every time. Saying it
  // where the button is needs no navigation at all.
  const fail = (message: string): ResendResult => ({ ok: false, message });

  if (!clientId) return fail("That client is no longer here.");

  const checked = checkEmail(email);
  if (!checked.ok) return fail(checked.reason);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return fail("Create your workspace first.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in again to send this.");

  // Only for a client in this workspace — the id arrives from a form.
  const { data: client } = await supabase
    .from("whitbyos_clients")
    .select("id")
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!client) return fail("That client is not in this workspace.");

  await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("context_id", clientId)
    .eq("invitee_email", email)
    .eq("status", "pending");

  // Re-granting is the point of resending: an invitation that lapsed while
  // access was switched off should not land them somewhere they cannot enter.
  if (contactId) {
    await supabase
      .from("whitbyos_client_members")
      .update({ portal_access: true })
      .eq("client_id", clientId)
      .eq("contact_id", contactId);
  }

  // The membership is the record of what this person is, so a resend reads it
  // rather than assuming. Without this, resending an Authorized User's
  // invitation would quietly rewrite the row as a primary contact.
  const { data: membership } = contactId
    ? await supabase
        .from("whitbyos_client_members")
        .select("role")
        .eq("client_id", clientId)
        .eq("contact_id", contactId)
        .maybeSingle()
    : { data: null };

  const outcome = await inviteToPortal({
    email,
    name,
    clientId,
    inviterId: user.id,
    ...(membership?.role ? { role: membership.role as string } : {}),
  });

  revalidatePath("/[product]/[[...slug]]", "page");

  // Two different facts, and the second is the one that matters to somebody
  // waiting for a reply: the invitation exists, and the email left.
  return outcome.emailed
    ? { ok: true, message: `Sent to ${email}` }
    : {
        ok: false,
        message: outcome.reason ?? `No email reached ${email}. Copy the link instead.`,
      };
}


/**
 * Screen 2.1.2.1 — approving what a client asked for (SRS §4.9).
 *
 * §4.9.2 is the whole reason this is a review and not a notification: Whitby
 * sends the invitation only after the professional has approved. So this makes
 * the person a member of the client, records what they may reach, and then
 * invites them — through the same machinery a primary contact goes through.
 *
 * The status distinguishes approved as requested from approved with changes,
 * which the enum has carried since it was written (§4.9.1). A professional
 * quietly narrowing what was asked for is a different act from agreeing to it,
 * and the client's side should be able to tell.
 */
/**
 * Whether adding one more person in this role would go past the ceiling.
 *
 * The portal checks this too, but that check decides whether to draw a button.
 * This one decides whether the row is created, which is the part that has to
 * hold: approval is a different door into the same account.
 *
 * The limit is the workspace's (supabase/00056), so it is the same number the
 * client is shown on their own People & Access screen. It used to be read off
 * the membership rows of this one client, which is why approving somebody had
 * to copy the numbers onto the new row — there is nothing to copy now.
 *
 * Returns the sentence to show, or null when there is room.
 */
async function overCeiling(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  role: string,
): Promise<string | null> {
  const { maxAdditionalMembers, maxAuthorizedUsers } = await getWorkspaceSeatLimits();

  // Null is no ceiling — still not the same as zero.
  const limit =
    role === "authorized_user" ? maxAuthorizedUsers : maxAdditionalMembers;
  if (limit == null) return null;

  const { data } = await supabase
    .from("whitbyos_client_members")
    .select("role")
    .eq("client_id", clientId);

  const held = (data ?? []).filter((row) => row.role === role).length;
  if (held < limit) return null;

  const what = role === "authorized_user" ? "authorized users" : "additional members";
  return `This account is set to a maximum of ${limit} ${what} and already has ${held}. Private Attaché sets this limit — contact them to raise it, or approve this person in the other role.`;
}

export async function approveAccessRequest(
  _previous: DialogResult,
  formData: FormData,
): Promise<DialogResult> {
  const stop = await readOnlyDialogResult();
  if (stop) return stop;

  const requestId = String(formData.get("request_id") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const grant = String(formData.get("grant_role") ?? "").trim();

  const back = `/whitbyos/clients/${clientId}/contacts`;
  if (!requestId || !clientId) return { ok: false, error: "Nothing to approve." };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: true, to: "/login" };

  const { data: client } = await supabase
    .from("whitbyos_clients")
    .select("id, name")
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!client) return { ok: false, error: "That client is not in this workspace." };

  const { data: request } = await supabase
    .from("client_portal_access_requests")
    .select("id, person_name, person_email, requested_role, status")
    .eq("id", requestId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!request || request.status !== "pending") {
    return { ok: false, error: "This request has already been answered." };
  }

  // Checked before anything is written: a contact created for someone who is
  // then refused a membership leaves a person on file nobody asked for.
  const full = await overCeiling(supabase, clientId, roleFor(grant));
  if (full) return { ok: false, error: full };

  const permissions: Record<string, boolean> = { view_only: grant === "view_only" };
  for (const area of ACCESS_AREAS) {
    permissions[area.key] = formData.get(area.key) === "on";
  }

  const email = String(request.person_email ?? "").trim();
  const name = String(request.person_name ?? "").trim();

  // They have no contact record yet — the client named someone who is not on
  // file. §5.4 keeps people canonical, so one is created rather than the
  // membership pointing at nothing.
  const [firstName, lastName] = splitName(name || email);
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      title_role: client.name,
      source: "portal_access_request",
      created_by_workspace_id: workspaceId,
    })
    .select("id")
    .single();

  if (contactError || !contact) {
    return { ok: false, error: contactError?.message ?? "Could not add them." };
  }

  /*
   * A Dependent is on the account and cannot sign in.
   *
   * The portal offers the role with those words; granting one must match them
   * or the two screens describe different things. No portal access on the
   * membership, and no invitation sent further down.
   */
  const withLogin = grantHasLogin(grant);

  const { error: memberError } = await supabase.from("whitbyos_client_members").insert({
    client_id: clientId,
    contact_id: contact.id,
    role: roleFor(grant),
    portal_access: withLogin && Boolean(email),
    permissions,
  });

  if (memberError) return { ok: false, error: memberError.message };

  const edited = grant !== (request.requested_role ?? grant);

  await supabase
    .from("client_portal_access_requests")
    .update({
      status: edited ? "approved_edited" : "approved_as_requested",
      reviewed_by_user_id: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (!withLogin) {
    return {
      ok: true,
      to: `${back}?approved=${encodeURIComponent(name)}&sent=0&reason=${encodeURIComponent("A Dependent is recorded on the account and has no portal login, so no invitation was sent.")}`,
    };
  }

  if (!email) {
    return {
      ok: true,
      to: `${back}?approved=${encodeURIComponent(name)}&sent=0&reason=${encodeURIComponent("No email address was given, so nothing could be sent. Add one on their contact and invite them from there.")}`,
    };
  }

  const outcome = await inviteToPortal({
    email,
    name,
    clientId,
    inviterId: user.id,
    // The same value written to the membership a few lines above, so the two
    // rows cannot disagree about who this person is.
    role: roleFor(grant),
  });

  const query = new URLSearchParams({
    approved: name || email,
    sent: outcome.emailed ? "1" : "0",
  });
  if (!outcome.emailed) {
    query.set("reason", outcome.reason ?? `No email reached ${email}. The invitation link still works.`);
  }

  return { ok: true, to: `${back}?${query.toString()}` };
}

/** §4.9.1's third option. The account is left exactly as it was. */
export async function declineAccessRequest(
  _previous: DialogResult,
  formData: FormData,
): Promise<DialogResult> {
  const stop = await readOnlyDialogResult();
  if (stop) return stop;

  const requestId = String(formData.get("request_id") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();

  const back = `/whitbyos/clients/${clientId}/contacts`;
  if (!requestId || !clientId) return { ok: false, error: "Nothing to decline." };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: client } = await supabase
    .from("whitbyos_clients")
    .select("id")
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!client) return { ok: false, error: "That client is not in this workspace." };

  await supabase
    .from("client_portal_access_requests")
    .update({
      status: "declined",
      reviewed_by_user_id: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("client_id", clientId);

  return { ok: true, to: `${back}?declined=1` };
}

/** 2.0a's first answer — off the active list, everything kept. */
export async function archiveClient(formData: FormData) {
  await stopIfReadOnly();

  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { error } = await supabase
    .from("whitbyos_clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", clientId)
    .eq("workspace_id", workspaceId);

  if (error) redirect(`${LIST}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(`${LIST}?archived=1`);
}

/**
 * 2.0a's second — "Removes all Requests, Work Plans, Documents and the
 * Contact", and it means it.
 *
 * Order matters and runs deepest-first, so nothing is ever left pointing at a
 * row that has gone: a Work Plan's tasks before the plan, the plans before
 * their Requests, and the Requests before the client they hang off. Documents
 * are filed against either the client or one of its Requests, so both are
 * swept.
 *
 * The contacts themselves are base records shared with the Portal (§5.4). The
 * link is deleted and the portal identity with it, which is the "Client Portal
 * access" the dialog names; the person survives as a contact, because deleting
 * a client is not a claim that the people in it never existed.
 */
export async function deleteClient(formData: FormData) {
  await stopIfReadOnly();

  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const failed = await purgeClient(supabase, clientId, workspaceId);

  if (failed) redirect(`${LIST}?error=${encodeURIComponent(failed)}`);

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(`${LIST}?removed=1`);
}


/**
 * 0.9c — Unarchive, which counts against the plan's active limit again.
 *
 * "Unarchiving one counts it again — you'll need to be under your limit first."
 * So the limit is checked here rather than only drawn on the button: a button
 * that can be reached by a stale page, a second tab, or a back press is not a
 * check.
 */
export async function unarchiveClient(formData: FormData) {
  await stopIfReadOnly();

  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) redirect(ARCHIVED);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(ARCHIVED);

  const { getCurrentWorkspacePlan } = await import("@/whitbyos/lib/workspace");
  const { planFor } = await import("@/whitbyos/lib/billing-vocab");
  const plan = planFor(await getCurrentWorkspacePlan());

  const supabase = await createClient();

  // `!= null` rather than truthiness: null is Enterprise's "no limit", and 0
  // is Inactive's "none at all". Truthiness read both as unlimited.
  if (plan?.activeWorkspaces != null) {
    const { count } = await supabase
      .from("whitbyos_clients")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .is("archived_at", null);

    if ((count ?? 0) >= plan.activeWorkspaces) {
      redirect(
        `${ARCHIVED}?error=${encodeURIComponent(
          plan.value === "inactive"
            ? "This workspace is inactive because its subscription ended. Choose a plan under Settings, Billing & Plan to create workspaces again."
            : `You're at your ${plan.label} limit of ${plan.activeWorkspaces} active workspaces. Archive one first, or upgrade.`,
        )}`,
      );
    }
  }

  const { error } = await supabase
    .from("whitbyos_clients")
    .update({ archived_at: null })
    .eq("id", clientId)
    .eq("workspace_id", workspaceId);

  if (error) redirect(`${ARCHIVED}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(WORKSPACES);
}

/**
 * Screen 2.2b — Save & finish on Configure Client Workspace.
 *
 * Nothing new is stored. The switch is `portal_access` on the client's own
 * members, which is the column the portal already reads, and the portal
 * contact email is the primary contact's own address on `contacts`.
 *
 * Turning the switch off leaves the membership rows alone and only withdraws
 * access, because a person is tied to the client by being a member, not by
 * being able to sign in.
 *
 * Both this and Skip the rest land on the Client Added toast, as the reference
 * draws them — the client exists either way, and that is what the toast says.
 */
export async function saveClientWorkspaceSetup(formData: FormData) {
  await stopIfReadOnly();

  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) redirect(LIST);

  const enabled =
    formData.get("portal_enabled") === "on" &&
    planIncludesClientPortal(await getCurrentWorkspacePlan());
  const portalEmail = String(formData.get("portal_email") ?? "").trim();

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();

  const { data: client } = await supabase
    .from("whitbyos_clients")
    .select("id, name, primary_contact_id")
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!client) redirect(LIST);

  const done = `${LIST}?added=${encodeURIComponent((client.name as string) ?? "")}`;
  const back = `${LIST}/${clientId}/setup`;

  // An address that is not one is worth saying so about rather than writing a
  // portal invitation nobody will ever receive.
  if (portalEmail && !checkEmail(portalEmail).ok) {
    redirect(`${back}?error=${encodeURIComponent("Enter a valid portal contact email.")}`);
  }

  const primaryContactId = client.primary_contact_id as string | null;

  if (portalEmail && primaryContactId) {
    const { error } = await supabase
      .from("contacts")
      .update({ email: portalEmail })
      .eq("id", primaryContactId);
    if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  }

  const { error: access } = await supabase
    .from("whitbyos_client_members")
    .update({ portal_access: enabled })
    .eq("client_id", clientId)
    .eq("role", "primary_contact");
  if (access) redirect(`${back}?error=${encodeURIComponent(access.message)}`);

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(done);
}

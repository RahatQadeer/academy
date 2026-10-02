"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { IN_APP, notifyWorkspaceMembers } from "@/whitbyos/lib/notify";
import { areasFromForm } from "@/client-portal/lib/access";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { NOT_SAVED, noAccessMessage, requireLiveContext, text, toastUrl } from "./guard";

/**
 * A client asks for someone to be added; the professional approves, edits, or
 * declines; only then does an invitation go out (SRS 4.9). This writes a request
 * row and nothing else — the portal never touches `invitations` or grants access.
 */
export async function requestAccess(formData: FormData) {
  const returnTo = text(formData, "returnTo") ?? "/client-portal/settings/people";
  const personName = text(formData, "personName");
  const personEmail = text(formData, "personEmail");
  const relationship = text(formData, "relationship");
  const requestedRole = text(formData, "requestedRole");
  const reason = text(formData, "reason");

  // Filtered through the module's own area list rather than stored as posted,
  // so a hand-edited form cannot write a key the professional's approval screen
  // will never render — an area nobody can see is an area nobody can revoke.
  const requestedAreas = areasFromForm(
    formData.getAll("areas").filter((value): value is string => typeof value === "string"),
  );

  if (!personName || !personEmail) {
    redirect(toastUrl(`${returnTo}?add=1`, "A name and email are required."));
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(personEmail)) {
    redirect(toastUrl(`${returnTo}?add=1`, "Enter a valid email address."));
  }

  // The account ceiling is set by the professional; a client can never request
  // past it (SRS 13.14.7).
  const context = await getPortalContext();

  // Asking for somebody to be put on the account is the write half of People &
  // Access, so it needs the area. Someone who is not permitted to see who is on
  // the account is not permitted to add to it — and the modal is opened by a
  // query param, so the screen hiding the button is not what stops them.
  if (!context.areas.people) {
    redirect(toastUrl(returnTo, noAccessMessage("people")));
  }

  if (!context.capabilities.mayRequestAccess) {
    redirect(
      toastUrl(returnTo, "Your account is not set up to request access for others."),
    );
  }
  // Asking for someone to be added changes the account, and view only is the
  // one grant that permits no change to it. Checked here and not only on the
  // screen: the modal is opened by a query param anyone can type.
  if (context.viewOnly) {
    redirect(
      toastUrl(returnTo, "Your access to this account is view only, so this was not sent."),
    );
  }

  const ctx = await requireLiveContext();
  if (!ctx) redirect(toastUrl(returnTo, NOT_SAVED));

  const supabase = await createClient();

  // The id is chosen here rather than read back from the insert, so the
  // professional's notice can open this exact request. Reading it back would
  // need `returning`, and a failed read after a successful insert would send
  // the fallback below to write the same request twice.
  const requestId = crypto.randomUUID();
  const row = {
    id: requestId,
    client_id: ctx.clientId,
    requested_by_contact_id: ctx.contactId,
    person_name: personName,
    person_email: personEmail,
    relationship,
    requested_role: requestedRole,
    reason,
    status: "pending",
  };

  let { error } = await supabase
    .from("client_portal_access_requests")
    .insert({ ...row, requested_areas: requestedAreas });

  // `requested_areas` arrives with client-portal/009, which is a proposal until
  // its owner applies it. An environment without the column rejects the insert,
  // and losing the whole request over the areas on it would be the wrong trade:
  // the person, the role and the reason are what the professional acts on, and
  // the areas are a suggestion they can set themselves on 2.1.2.1.
  if (error) {
    ({ error } = await supabase.from("client_portal_access_requests").insert(row));
  }

  if (error) {
    redirect(toastUrl(returnTo, "Could not send the request. Please try again."));
  }

  /*
   * Tell the professionals, because nothing did.
   *
   * The screen that answers this request is a panel on one client's Contacts
   * tab, and until now the only way to know it was there was to open that
   * tab. Their own notification switch can refuse it, like every other.
   *
   * Addressed to the request rather than to the client: an unread notice is
   * what a duplicate is judged on, so keying it to the client would swallow
   * the second ask while the first was still unread. `?review=` opens it.
   */
  if (ctx.workspaceId && ctx.clientId) {
    await notifyWorkspaceMembers({
      workspaceId: ctx.workspaceId,
      event: IN_APP.accessRequest,
      title: `${ctx.accountName}: access asked for ${personName}`,
      body: `${ctx.displayName} asked for ${personName}${
        relationship ? ` (${relationship})` : ""
      } to be given access. Review the level before approving.`,
      href: `/whitbyos/clients/${ctx.clientId}/contacts?review=${requestId}`,
      entityType: "client_portal_access_request",
      entityId: requestId,
    });
  }

  revalidatePath(returnTo);
  redirect(
    toastUrl(returnTo, `Access request for ${personName} submitted for review.`),
  );
}

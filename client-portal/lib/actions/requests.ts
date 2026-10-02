"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { TOASTS } from "@/client-portal/lib/toasts";
import { IN_APP, notifyWorkspaceMembers } from "@/whitbyos/lib/notify";
import { requireWrite, text, toastUrl } from "./guard";

const REQUESTS_PATH = "/client-portal/requests";

/**
 * Client-submitted request. It lands in the professional's own Requests list as
 * a `whitbyos_requests` row — the portal never keeps a parallel copy.
 *
 * Two things are still open with Sabahat and are marked below rather than
 * guessed at: the status a client-originated request should start in, and
 * whether the submitting contact is recorded as a participant or through a
 * dedicated requestor field.
 */
export async function submitRequest(formData: FormData) {
  const title = text(formData, "title");
  const description = text(formData, "description");

  if (!title) {
    redirect(toastUrl(`${REQUESTS_PATH}?new=1`, "A title is required."));
  }

  const guard = await requireWrite("requests");
  if ("reason" in guard) redirect(toastUrl(REQUESTS_PATH, guard.reason));

  // Nothing off the guard is passed to the RPC: it resolves the contact, client
  // and workspace itself from `portal_contact_id()`. The guard is here to refuse
  // the write, not to supply it.
  const supabase = await createClient();

  // Goes through the RPC rather than two inserts. A client-originated request is
  // private_to_requestor, so between the request insert and the participant
  // insert the client cannot SELECT the row they just created — which makes
  // `insert ... returning` fail against their own row. The function does both in
  // one transaction. See client-portal/migrations/001.
  const { data: requestId, error } = await supabase.rpc("portal_submit_request", {
    p_title: title,
    p_description: description,
  });

  if (error) {
    redirect(
      toastUrl(REQUESTS_PATH, "Could not submit the request. Please try again."),
    );
  }

  // It arrives `private_to_requestor` and `open`, and nothing else on the
  // professional's side says it came in.
  if (typeof requestId === "string") {
    await notifyWorkspaceMembers({
      workspaceId: guard.ctx.workspaceId,
      event: IN_APP.clientRequest,
      title: "New request from a client",
      body: `${guard.ctx.accountName}: ${title}`,
      href: `/whitbyos/requests/${requestId}`,
      entityType: "request",
      entityId: requestId,
    });
  }

  revalidatePath(REQUESTS_PATH);
  redirect(toastUrl(REQUESTS_PATH, TOASTS.requestSubmitted));
}

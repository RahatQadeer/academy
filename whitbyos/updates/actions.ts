"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";
import { notifyRequestAudience } from "@/whitbyos/lib/notify";

const LIST = "/whitbyos/updates";
const ROUTE = "/[product]/[[...slug]]";

function backWithError(message: string, updateId?: string): never {
  const where = updateId ? `edit=${updateId}` : "new=1";
  redirect(`${LIST}?${where}&error=${encodeURIComponent(message)}`);
}

/**
 * Screen 10.1 — Draft Progress Update, and the three ways out of it.
 *
 * Save as Draft, Send for Review and Publish to Client are three acts, not a
 * status field the professional has to remember to set: §7.3 has an update
 * reviewed before it reaches a client, and 10.1.1 and 10.1.2 are the export
 * saying the same thing.
 *
 * The same form writes a new update and edits one that exists, because 10 has
 * no separate edit screen — a card opens the draft it came from.
 *
 * Nothing is delivered either way. Publishing makes it visible in the client's
 * portal, which is a real place they can read it — but no email leaves Whitby,
 * because no mailbox is connected.
 */
export async function draftUpdate(formData: FormData) {
  await stopIfReadOnly();

  const requestId = String(formData.get("request_id") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  const category = String(formData.get("category") ?? "General").trim();
  const body = String(formData.get("body") ?? "").trim();
  const urgent = formData.get("urgent") === "on";
  const updateId = String(formData.get("update_id") ?? "").trim();

  const asked = String(formData.get("then") ?? "draft");
  const status = asked === "publish" ? "published" : asked === "review" ? "review" : "draft";
  const publish = status === "published";

  if (!headline) backWithError("Give the update a headline.", updateId);
  if (!requestId) backWithError("Choose the Request this is about.", updateId);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) backWithError("Create your workspace first.", updateId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: request } = await supabase
    .from("whitbyos_requests")
    .select("id, client_id")
    .eq("id", requestId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!request) backWithError("That request is not in this workspace.", updateId);

  const fields = {
    request_id: requestId,
    client_id: request.client_id,
    type: "progress_update",
    headline,
    category: category || null,
    body,
    urgent,
    status,
    // Published once, and the date it happened stays that date. Editing a
    // published update must not quietly re-date it.
    ...(publish ? { published_at: new Date().toISOString() } : {}),
  };

  // `whitbyos_updates` carries no workspace of its own — the Request it hangs
  // off is what places it. So an edit has to check the update's *current*
  // request, not just the one being submitted: without it an id from another
  // workspace could be re-pointed at a request in this one and taken over.
  /*
   * Whether this one has already reached the client, read before the write
   * rather than after it.
   *
   * Publishing is what rings the portal's bell, and "publish" is also the
   * button on an edit of something already published — a typo fixed on
   * Tuesday must not tell the client a second time that the update exists.
   */
  let alreadyPublished = false;

  if (updateId) {
    const { data: existing } = await supabase
      .from("whitbyos_updates")
      .select("id, status, request:whitbyos_requests!request_id (workspace_id)")
      .eq("id", updateId)
      .maybeSingle();

    const owner = existing?.request as unknown as { workspace_id: string } | null;
    if (!existing || owner?.workspace_id !== workspaceId) redirect(LIST);
    alreadyPublished = existing.status === "published";
  }

  // The row's own id comes back from an insert, because the notice below is
  // keyed on it: `deliverToContacts` treats an unread notice with the same
  // kind and entity as this same notice, so two updates on one Request that
  // both identified themselves by the Request would silence the second.
  const { data: saved, error } = updateId
    ? await supabase
        .from("whitbyos_updates")
        .update(fields)
        .eq("id", updateId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("whitbyos_updates")
        .insert({ ...fields, created_by_user_id: user.id })
        .select("id")
        .maybeSingle();

  if (error) backWithError(error.message, updateId);

  /*
   * The portal's bell, on the one act that puts something in front of a
   * client.
   *
   * Publishing was the only client-facing event in 17.3 that raised nothing:
   * the update appeared on the portal's Updates screen and on its dashboard
   * count, and the client learned about it by going and looking. The
   * "Progress update" switch on their Notifications screen had nothing behind
   * it to switch off.
   *
   * `notifyRequestAudience` rather than `notifyClientContacts` because an
   * update hangs off a Request, and a Request the portal will not show this
   * person is one they must not be told the headline of — that function
   * narrows to the same participant list `listRequests` renders by.
   */
  const savedId = (saved?.id as string | undefined) ?? updateId;

  if (publish && !alreadyPublished && savedId) {
    await notifyRequestAudience({
      workspaceId,
      requestId,
      event: "progress_update",
      area: "updates",
      kind: "progress_update",
      title: "New progress update",
      body: headline,
      href: "/client-portal/updates",
      entityType: "update",
      entityId: savedId,
    });
  }

  revalidatePath(ROUTE, "page");
  redirect(
    `${LIST}?${
      status === "published" ? "published" : status === "review" ? "review" : "saved"
    }=${encodeURIComponent(headline)}`,
  );
}

/** 10.2 — something the client told you that changes how the work runs. */
export async function recordPlansUpdate(formData: FormData) {
  await stopIfReadOnly();

  const clientId = String(formData.get("client_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  const back = `${LIST}?tab=plans`;
  if (!body) redirect(`${back}&plan=1&error=${encodeURIComponent("Write down what they told you.")}`);
  if (!clientId) redirect(`${back}&plan=1&error=${encodeURIComponent("Choose the client.")}`);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("whitbyos_clients")
    .select("id")
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!client) redirect(`${back}&plan=1&error=${encodeURIComponent("That client is not in this workspace.")}`);

  const { error } = await supabase.from("whitbyos_updates").insert({
    client_id: clientId,
    type: "plans_update",
    headline: body.split("\n")[0]?.slice(0, 120) ?? body,
    body,
    // These are notes on the account rather than something a client reads back,
    // so there is no draft or review step for them.
    status: "published",
    published_at: new Date().toISOString(),
    created_by_user_id: user.id,
  });

  if (error) redirect(`${back}&plan=1&error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");
  redirect(`${back}&recorded=1`);
}

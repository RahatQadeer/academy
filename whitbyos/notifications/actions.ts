"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { createServiceClient } from "@/base/lib/supabase/service";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { tellRequester } from "@/whitbyos/lib/deletion";
import { destroy } from "@/whitbyos/settings/archive/actions";
import type { ArchiveType } from "@/whitbyos/lib/archive";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";

const ROUTE = "/[product]/[[...slug]]";

function safeBack(value: unknown) {
  const back = String(value ?? "").trim();
  return back.startsWith("/") && !back.startsWith("//") ? back : "/whitbyos";
}

/**
 * Accept or decline somebody's request to delete something.
 *
 * Accepting is what performs the deletion, not the asking. Until this runs the
 * record is untouched, which is the whole point of asking.
 *
 * One action serves both sides. A professional answers a client's request; a
 * client answers a professional's. Both are held to the row's own policy, so
 * neither can answer a request that was never addressed to them.
 */
export type DecisionResult = { ok: boolean; message: string } | null;

export async function decideDeletion(
  _previous: DecisionResult,
  formData: FormData,
): Promise<DecisionResult> {
  await stopIfReadOnly();

  const requestId = String(formData.get("request_id") ?? "").trim();
  const accept = String(formData.get("decision") ?? "") === "accept";

  // Reports rather than redirects: both places this is answered are the page
  // the redirect targeted, and a server action redirecting to its own path
  // does not move the router. revalidatePath repaints the list either way.
  if (!requestId) return { ok: false, message: "That request is gone." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again." };

  const { data: request } = await supabase
    .from("whitbyos_deletion_requests")
    .select(
      "id, workspace_id, client_id, entity_type, entity_id, entity_label, status, requested_by_user_id, requested_by_contact_id",
    )
    .eq("id", requestId)
    .maybeSingle();

  // Gone, or answered already by somebody else at the same client.
  if (!request || request.status !== "pending") {
    return { ok: false, message: "Somebody has already answered this one." };
  }

  // Deleting and telling both act on rows the answerer cannot reach themselves,
  // so they run with the service role. Without it there is no deletion to do.
  const service = createServiceClient();
  if (!service) {
    return { ok: false, message: "This environment cannot complete deletions." };
  }

  // A teammate signs as a user; somebody in the portal signs as their contact.
  const { data: identity } = await supabase
    .from("client_portal_identities")
    .select("contact_id")
    .eq("user_id", user.id)
    .maybeSingle();

  await supabase
    .from("whitbyos_deletion_requests")
    .update({
      status: accept ? "approved" : "declined",
      decided_at: new Date().toISOString(),
      decided_by_user_id: identity ? null : user.id,
      decided_by_contact_id: identity ? (identity.contact_id as string) : null,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (accept) {
    // The authority to delete comes from the approved request, not from the
    // approver's own reach: a client can allow their work plan to go, but the
    // portal's own permissions cannot touch a whitbyos_workplans row, so the
    // delete silently did nothing and the record survived an approved request.
    // The check that this is allowed has already happened — the row could only
    // be read, and could only be moved out of `pending`, by someone entitled
    // to answer it.
    const gone = await destroy(
      service,
      request.entity_type as ArchiveType,
      request.entity_id as string,
      request.workspace_id as string,
    );

    // The approval stands either way — the client did say yes — but nobody is
    // told it is gone when it is not.
    if (!gone.ok) {
      return { ok: false, message: `Could not delete it: ${gone.error}` };
    }
  }

  await tellRequester(
    service,
    {
      id: request.id as string,
      workspace_id: request.workspace_id as string,
      entity_label: request.entity_label as string,
      entity_type: request.entity_type as string,
      entity_id: request.entity_id as string,
      requested_by_user_id: (request.requested_by_user_id as string | null) ?? null,
      requested_by_contact_id: (request.requested_by_contact_id as string | null) ?? null,
    },
    accept,
  );

  revalidatePath(ROUTE, "page");
  return {
    ok: true,
    message: accept
      ? `"${request.entity_label}" has been deleted.`
      : `"${request.entity_label}" was kept.`,
  };
}

/** Mark everything in the bell as seen. */
export async function readAllNotices(formData: FormData) {
  const here = safeBack(formData.get("back"));

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(here);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("whitbyos_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", user.id)
    .is("read_at", null);

  revalidatePath(ROUTE, "page");
  redirect(here);
}

/**
 * Mark the one that was opened.
 *
 * The bell only had "Mark all read", so reading a single notice left the red
 * count exactly where it was and there was no way to clear one without
 * clearing every other unread notice with it. Opening a notice is somebody
 * saying they have seen it, which is the whole of what read means.
 *
 * Scoped to the signed-in member: a notice addressed to somebody else is not
 * one this can touch, and RLS would refuse it anyway.
 */
export async function readNotice(noticeId: string) {
  const id = noticeId.trim();
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("whitbyos_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_user_id", user.id)
    .is("read_at", null);

  revalidatePath(ROUTE, "page");
}

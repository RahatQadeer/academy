"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import type { ArchiveType } from "@/whitbyos/lib/archive";
import { needsApproval, requestDeletion, withinGrace } from "@/whitbyos/lib/deletion";
import { purgeClient } from "@/whitbyos/lib/client-purge";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";

const ARCHIVE = "/whitbyos/settings/archive";
const ROUTE = "/[product]/[[...slug]]";

/**
 * 17.7's Restore — put an archived record back where it came from.
 *
 * Each kind is restored in its own vocabulary: a Work Plan and a Playbook each
 * clear the date they were filed away, a document goes back to `current`. None
 * invents a state it did not have — a plan's own status was never touched by
 * archiving, so there is nothing to put back but the date.
 */
export async function restoreArchived(formData: FormData) {
  await stopIfReadOnly();

  const id = String(formData.get("id") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  if (!id || !type) redirect(ARCHIVE);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(ARCHIVE);

  const supabase = await createClient();

  if (type === "workplan") {
    // Reachable from this workspace, through the Request the plan hangs off.
    const { data: plan } = await supabase
      .from("whitbyos_workplans")
      .select("id, whitbyos_requests!request_id (workspace_id)")
      .eq("id", id)
      .maybeSingle();

    const owner = plan?.whitbyos_requests as unknown as
      | { workspace_id: string }
      | { workspace_id: string }[]
      | null;
    const ownerId = Array.isArray(owner) ? owner[0]?.workspace_id : owner?.workspace_id;
    if (!plan || ownerId !== workspaceId) redirect(ARCHIVE);

    await supabase
      .from("whitbyos_workplans")
      .update({
        archived_at: null,
        archived_by_user_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  } else if (type === "playbook") {
    const { data: playbook } = await supabase
      .from("whitbyos_playbooks")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!playbook) redirect(ARCHIVE);

    await supabase
      .from("whitbyos_playbooks")
      .update({
        archived_at: null,
        archived_by_user_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  } else if (type === "document") {
    const { data: document } = await supabase
      .from("documents")
      .select("id, context_type, context_id")
      .eq("id", id)
      .maybeSingle();

    if (!document) redirect(ARCHIVE);

    if (document.context_type === "client") {
      if (document.context_id !== workspaceId) {
        const { data: client } = await supabase
          .from("whitbyos_clients")
          .select("id")
          .eq("id", document.context_id as string)
          .eq("workspace_id", workspaceId)
          .maybeSingle();
        if (!client) redirect(ARCHIVE);
      }
    } else if (document.context_type === "request") {
      const { data: request } = await supabase
        .from("whitbyos_requests")
        .select("id")
        .eq("id", document.context_id as string)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!request) redirect(ARCHIVE);
    } else {
      redirect(ARCHIVE);
    }

    await supabase
      .from("documents")
      .update({ status: "current", updated_at: new Date().toISOString() })
      .eq("id", id);
  } else if (
    type === "client" ||
    type === "contact" ||
    type === "provider" ||
    type === "article"
  ) {
    // The three 2.0a, 4.0a and 5.0d file away. Each carries `archived_at` and
    // nothing else, so restoring is clearing it — and each is scoped by the
    // column that makes it this workspace's, which for a base contact is who
    // created it rather than a workspace of its own.
    const table =
      type === "client"
        ? "whitbyos_clients"
        : type === "contact"
          ? "contacts"
          : type === "article"
            ? "whitbyos_knowledge"
            : "whitbyos_providers";
    const scope = type === "contact" ? "created_by_workspace_id" : "workspace_id";

    const { data: row } = await supabase
      .from(table)
      .select("id")
      .eq("id", id)
      .eq(scope, workspaceId)
      .maybeSingle();

    if (!row) redirect(ARCHIVE);

    await supabase.from(table).update({ archived_at: null }).eq("id", id);
  }

  revalidatePath(ROUTE, "page");
  redirect(`${ARCHIVE}?restored=1`);
}

/**
 * 17.7's Delete — the only place in Whitby anything is destroyed.
 *
 * Two roads, decided by the record's own age. Something made in the last
 * fifteen minutes goes now: that is the window for undoing a mistake you have
 * just made, and nobody else has seen it yet. Anything older, and belonging to
 * a client, becomes a request the client accepts or declines — their work is
 * theirs as much as the firm's, and it should not vanish on one person's press.
 *
 * The firm's own working material — providers, playbooks, contacts, knowledge —
 * is deleted outright whatever its age. There is no client to ask about a
 * provider used by five of them.
 */
export type DeleteResult = { ok: boolean; message: string } | null;

export async function deleteArchived(
  _previous: DeleteResult,
  formData: FormData,
): Promise<DeleteResult> {
  await stopIfReadOnly();

  const id = String(formData.get("id") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim() as ArchiveType;
  const reason = String(formData.get("reason") ?? "").trim();
  const fail = (message: string): DeleteResult => ({ ok: false, message });

  // It reports rather than redirecting. This screen is the screen the redirect
  // would have gone to, and a server action redirecting to its own path does
  // not move the router — so the confirmation never arrived and the row never
  // repainted. revalidatePath refreshes the list on its own.
  if (!id || !type) return fail("Nothing to delete.");

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return fail("Create your workspace first.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in again.");

  const target = await findArchived(supabase, workspaceId, type, id);
  if (!target) return fail("That record is not here.");

  if (!withinGrace(target.createdAt) && needsApproval(type)) {
    const asked = await requestDeletion(supabase, {
      workspaceId,
      clientId: target.clientId,
      type,
      entityId: id,
      label: target.label,
      reason,
      byUserId: user.id,
    });

    revalidatePath(ROUTE, "page");
    return asked.ok
      ? { ok: true, message: `Asked the client about "${target.label}". Nothing is deleted yet.` }
      : fail(asked.error);
  }

  const gone = await destroy(supabase, type, id, workspaceId);
  if (!gone.ok) return fail(gone.error);

  revalidatePath(ROUTE, "page");
  return { ok: true, message: `"${target.label}" is gone.` };
}

/**
 * The archived record itself, with the two things deleting needs to know: how
 * old it is, and whose it is. Each kind is found the way `restoreArchived`
 * finds it, and scoped the same way, so nothing can be deleted from outside
 * the workspace by handing this an id.
 */
async function findArchived(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  type: ArchiveType,
  id: string,
): Promise<{ label: string; createdAt: string | null; clientId: string | null } | null> {
  if (type === "workplan") {
    const { data } = await supabase
      .from("whitbyos_workplans")
      .select(
        "id, name, created_at, request:whitbyos_requests!request_id (workspace_id, client_id)",
      )
      .eq("id", id)
      .maybeSingle();

    const request = firstOf(data?.request) as { workspace_id: string; client_id: string } | null;
    if (!data || request?.workspace_id !== workspaceId) return null;
    return {
      label: (data.name as string) || "Work Plan",
      createdAt: (data.created_at as string) ?? null,
      clientId: request?.client_id ?? null,
    };
  }

  if (type === "document") {
    const { data } = await supabase
      .from("documents")
      .select("id, title, created_at, context_type, context_id")
      .eq("id", id)
      .maybeSingle();

    if (!data) return null;

    // A document is placed by what it hangs off, the way restoring places it.
    let clientId: string | null = null;
    if (data.context_type === "client") {
      if (data.context_id === workspaceId) {
        clientId = null;
      } else {
        const { data: client } = await supabase
          .from("whitbyos_clients")
          .select("id")
          .eq("id", data.context_id as string)
          .eq("workspace_id", workspaceId)
          .maybeSingle();
        if (!client) return null;
        clientId = client.id as string;
      }
    } else if (data.context_type === "request") {
      const { data: request } = await supabase
        .from("whitbyos_requests")
        .select("id, client_id")
        .eq("id", data.context_id as string)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!request) return null;
      clientId = (request.client_id as string) ?? null;
    }

    return {
      label: (data.title as string) || "Document",
      createdAt: (data.created_at as string) ?? null,
      clientId,
    };
  }

  const table =
    type === "client"
      ? "whitbyos_clients"
      : type === "contact"
        ? "contacts"
        : type === "article"
          ? "whitbyos_knowledge"
          : type === "playbook"
            ? "whitbyos_playbooks"
            : "whitbyos_providers";
  const scope = type === "contact" ? "created_by_workspace_id" : "workspace_id";
  // A contact's name is two columns; everything else has one. Selected as a
  // string built here, so the row comes back untyped and is read by hand.
  const columns =
    type === "contact" ? "id, created_at, first_name, last_name" : "id, created_at, name";

  const { data } = await supabase
    .from(table)
    .select(columns)
    .eq("id", id)
    .eq(scope, workspaceId)
    .maybeSingle();

  const row = data as unknown as Record<string, string | null> | null;
  if (!row) return null;

  const label =
    type === "contact"
      ? [row.first_name, row.last_name].filter(Boolean).join(" ") || "Contact"
      : row.name || "Record";

  return {
    label,
    createdAt: row.created_at ?? null,
    clientId: type === "client" ? id : null,
  };
}

/**
 * Destroy it, each kind by the sweep that kind needs, and say whether it went.
 *
 * It used to ignore the error and every caller reported success. A Work Plan
 * that a Playbook had been made from could not be deleted at all — the
 * reference is ON DELETE NO ACTION and Postgres refused — so an approved
 * request said "deleted" over a record that was still sitting there. Nothing
 * here claims a deletion it did not perform.
 */
export async function destroy(
  supabase: SupabaseClient,
  type: ArchiveType,
  id: string,
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (type === "client") {
    // A client takes its Requests, Work Plans, Documents and Tasks with it, and
    // `purgeClient` is the one place that knows the order.
    await purgeClient(supabase, id, workspaceId);
    return { ok: true };
  }

  if (type === "workplan") {
    // A Playbook made from this plan outlives it. It is its own template by
    // now, and where it came from is a note about its history rather than a
    // dependency — the same reasoning migration 049 applied to a duplicated
    // Form. Cleared rather than cascaded, so the Playbook survives.
    await supabase
      .from("whitbyos_playbooks")
      .update({ created_from_workplan_id: null })
      .eq("created_from_workplan_id", id);
  }

  const table =
    type === "workplan"
      ? "whitbyos_workplans"
      : type === "playbook"
        ? "whitbyos_playbooks"
        : type === "document"
          ? "documents"
          : type === "contact"
            ? "contacts"
            : type === "article"
              ? "whitbyos_knowledge"
              : "whitbyos_providers";

  const { error } = await supabase.from(table).delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

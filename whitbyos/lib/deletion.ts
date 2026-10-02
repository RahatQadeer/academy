import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArchiveType } from "@/whitbyos/lib/archive";

/**
 * How long after something is made it can still be destroyed on your own say-so.
 *
 * Fifteen minutes is the window for undoing a mistake you have just made — the
 * client added twice, the plan started against the wrong request. After that
 * the record has been seen by the other side and belongs to the relationship as
 * much as to whoever is holding the mouse, so destroying it becomes a request
 * rather than an act.
 */
export const GRACE_MINUTES = 15;

export function withinGrace(createdAt: string | null | undefined) {
  if (!createdAt) return false;
  const made = new Date(createdAt).getTime();
  if (Number.isNaN(made)) return false;
  return Date.now() - made < GRACE_MINUTES * 60_000;
}

export function graceLeft(createdAt: string | null | undefined) {
  if (!createdAt) return 0;
  const left = GRACE_MINUTES * 60_000 - (Date.now() - new Date(createdAt).getTime());
  return Math.max(0, Math.ceil(left / 60_000));
}

/**
 * Which kinds a client is asked about.
 *
 * A client's own record and the work carried out for them are theirs as much as
 * the firm's, so they are asked. A provider, a playbook, a knowledge article
 * and a contact are the firm's own working material — no client owns them, and
 * asking one client to approve the removal of a provider used by five would be
 * asking the wrong person.
 */
const CLIENT_OWNED: ArchiveType[] = ["client", "workplan", "document"];

export function needsApproval(type: ArchiveType) {
  return CLIENT_OWNED.includes(type);
}

export const DELETION_KIND = {
  requested: "deletion_requested",
  approved: "deletion_approved",
  declined: "deletion_declined",
} as const;

/**
 * Ask the other side to allow a deletion, and tell them.
 *
 * The label is stored on the request because the whole point is that the row it
 * names will be gone if this is accepted: "Deleted: Hartwell Family" has to
 * still read after Hartwell Family does not exist.
 *
 * Who is told depends on who asked. A professional asks the people at that
 * client who can actually open the portal — anyone else would never see it. A
 * client asks the workspace's members.
 */
export async function requestDeletion(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    clientId: string | null;
    type: ArchiveType;
    entityId: string;
    label: string;
    reason?: string | null;
    byUserId?: string | null;
    byContactId?: string | null;
    href?: string | null;
  },
): Promise<{ ok: true; asked: number } | { ok: false; error: string }> {
  const { data: existing } = await supabase
    .from("whitbyos_deletion_requests")
    .select("id")
    .eq("entity_type", input.type)
    .eq("entity_id", input.entityId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) return { ok: false, error: "Somebody has already asked about this one." };

  const { data: created, error } = await supabase
    .from("whitbyos_deletion_requests")
    .insert({
      workspace_id: input.workspaceId,
      client_id: input.clientId,
      entity_type: input.type,
      entity_id: input.entityId,
      entity_label: input.label,
      reason: input.reason || null,
      requested_by_user_id: input.byUserId ?? null,
      requested_by_contact_id: input.byContactId ?? null,
    })
    .select("id")
    .single();

  if (error || !created) return { ok: false, error: error?.message ?? "Could not ask." };

  const recipients = input.byUserId
    ? await portalPeople(supabase, input.clientId)
    : await workspacePeople(supabase, input.workspaceId);

  if (recipients.length === 0) {
    // Nobody to ask. Said plainly rather than leaving a request nobody will
    // ever answer sitting in the way of the record.
    await supabase.from("whitbyos_deletion_requests").delete().eq("id", created.id);
    return {
      ok: false,
      error: input.byUserId
        ? "Nobody at this client is in the portal, so there is nobody to ask."
        : "Nobody is in this workspace to ask.",
    };
  }

  await supabase.from("whitbyos_notifications").insert(
    recipients.map((who) => ({
      workspace_id: input.workspaceId,
      recipient_user_id: input.byUserId ? null : who,
      recipient_contact_id: input.byUserId ? who : null,
      kind: DELETION_KIND.requested,
      title: `Permission to delete ${input.label}`,
      body: input.reason || null,
      href: input.href ?? null,
      entity_type: input.type,
      entity_id: input.entityId,
      deletion_request_id: created.id,
    })),
  );

  return { ok: true, asked: recipients.length };
}

/** The people at this client who can actually open the portal and answer. */
async function portalPeople(supabase: SupabaseClient, clientId: string | null) {
  if (!clientId) return [];

  const { data: members } = await supabase
    .from("whitbyos_client_members")
    .select("contact_id")
    .eq("client_id", clientId);

  const ids = (members ?? []).map((row) => row.contact_id as string).filter(Boolean);
  if (ids.length === 0) return [];

  const { data: identities } = await supabase
    .from("client_portal_identities")
    .select("contact_id")
    .in("contact_id", ids);

  return [...new Set((identities ?? []).map((row) => row.contact_id as string))];
}

async function workspacePeople(supabase: SupabaseClient, workspaceId: string) {
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);

  return [...new Set((data ?? []).map((row) => row.user_id as string))];
}

/** Tell whoever asked what was decided. */
export async function tellRequester(
  supabase: SupabaseClient,
  request: {
    id: string;
    workspace_id: string;
    entity_label: string;
    entity_type: string;
    entity_id: string;
    requested_by_user_id: string | null;
    requested_by_contact_id: string | null;
  },
  approved: boolean,
) {
  await supabase.from("whitbyos_notifications").insert({
    workspace_id: request.workspace_id,
    recipient_user_id: request.requested_by_user_id,
    recipient_contact_id: request.requested_by_contact_id,
    kind: approved ? DELETION_KIND.approved : DELETION_KIND.declined,
    title: approved
      ? `${request.entity_label} was deleted`
      : `${request.entity_label} was kept`,
    body: approved
      ? "The other side agreed, and it is gone."
      : "The other side declined, so nothing was deleted.",
    entity_type: request.entity_type,
    entity_id: request.entity_id,
    deletion_request_id: request.id,
  });
}

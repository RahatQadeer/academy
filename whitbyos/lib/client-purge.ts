import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Everything 2.0a's "Delete permanently" removes, in the order that leaves
 * nothing pointing at a row that has gone: a plan's tasks and streams before
 * the plan, the plans before their Requests, the Requests before the client.
 * Documents are filed against either the client or one of its Requests, so
 * both are swept.
 *
 * The contacts themselves are base records shared with the Portal (§5.4). The
 * link goes and the portal identity with it — the "Client Portal access" the
 * dialog names — but the person survives, because deleting a client is not a
 * claim that the people in it never existed.
 *
 * A function rather than an action, because 4.0a deletes a client too: a
 * Primary Contact who goes takes the client with them, and two cascades over
 * the same tables would disagree the first time either was changed.
 */
export async function purgeClient(
  supabase: SupabaseClient,
  clientId: string,
  workspaceId: string,
): Promise<string | null> {
  const { data: owned } = await supabase
    .from("whitbyos_clients")
    .select("id")
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!owned) return null;

  const { data: requests } = await supabase
    .from("whitbyos_requests")
    .select("id")
    .eq("client_id", clientId);

  const requestIds = (requests ?? []).map((row) => row.id as string);

  if (requestIds.length > 0) {
    const { data: plans } = await supabase
      .from("whitbyos_workplans")
      .select("id")
      .in("request_id", requestIds);

    const planIds = (plans ?? []).map((row) => row.id as string);

    if (planIds.length > 0) {
      // Tasks hang off a workstream, not a plan — `workplan_id` is not a
      // column on them, so this deleted nothing and left every task behind.
      const { data: streams } = await supabase
        .from("whitbyos_workstreams")
        .select("id")
        .in("workplan_id", planIds);

      const streamIds = (streams ?? []).map((row) => row.id as string);
      if (streamIds.length > 0) {
        await supabase.from("whitbyos_tasks").delete().in("workstream_id", streamIds);
      }

      // And the ones filed against the client's Requests directly, which have
      // no workstream at all.
      await supabase.from("whitbyos_tasks").delete().in("request_id", requestIds);
      await supabase.from("whitbyos_workstreams").delete().in("workplan_id", planIds);
      await supabase.from("whitbyos_workplans").delete().in("id", planIds);
    }

    await supabase
      .from("documents")
      .delete()
      .eq("context_type", "request")
      .in("context_id", requestIds);

    await supabase.from("whitbyos_requests").delete().in("id", requestIds);
  }

  await supabase
    .from("documents")
    .delete()
    .eq("context_type", "client")
    .eq("context_id", clientId);

  const { data: members } = await supabase
    .from("whitbyos_client_members")
    .select("contact_id")
    .eq("client_id", clientId);

  const contactIds = (members ?? [])
    .map((row) => row.contact_id as string | null)
    .filter(Boolean) as string[];

  if (contactIds.length > 0) {
    await supabase.from("client_portal_identities").delete().in("contact_id", contactIds);
  }

  await supabase.from("whitbyos_client_members").delete().eq("client_id", clientId);

  const { error } = await supabase
    .from("whitbyos_clients")
    .delete()
    .eq("id", clientId)
    .eq("workspace_id", workspaceId);

  return error?.message ?? null;
}

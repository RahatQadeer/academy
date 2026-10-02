"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";

const ROUTE = "/[product]/[[...slug]]";

/**
 * Bring a provider in on a Work Stream, or take them off it.
 *
 * A provider option belongs to the Request; migration 039 records which stream
 * it was brought in for. So attaching one here writes a row against both, and
 * detaching deletes only the row — never the provider, who exists in the
 * directory whatever happens on this plan.
 */
export async function attachProvider(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  const streamId = String(formData.get("workstream_id") ?? "").trim();
  const providerId = String(formData.get("provider_id") ?? "").trim();
  const back = `/whitbyos/work-plans/${planId}/streams/${streamId}`;

  if (!planId || !streamId || !providerId) redirect(back);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(back);

  const supabase = await createClient();

  // The stream has to belong to a plan in this workspace, through its Request.
  const { data: stream } = await supabase
    .from("whitbyos_workstreams")
    .select("id, workplan:whitbyos_workplans!workplan_id (request_id, request:whitbyos_requests!request_id (id, workspace_id))")
    .eq("id", streamId)
    .maybeSingle();

  const plan = firstOf(stream?.workplan) as { request_id?: string; request?: unknown } | null;
  const request = firstOf(plan?.request) as { id?: string; workspace_id?: string } | null;
  if (!stream || request?.workspace_id !== workspaceId || !request.id) redirect(back);

  await supabase.from("whitbyos_provider_options").insert({
    request_id: request.id,
    provider_id: providerId,
    workstream_id: streamId,
  });

  revalidatePath(ROUTE, "page");
  redirect(back);
}

export async function detachProvider(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  const streamId = String(formData.get("workstream_id") ?? "").trim();
  const optionId = String(formData.get("option_id") ?? "").trim();
  const back = `/whitbyos/work-plans/${planId}/streams/${streamId}`;

  if (!optionId || !streamId) redirect(back);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(back);

  const supabase = await createClient();

  // Only a row that really is against this stream, and this workspace's plan.
  const { data: option } = await supabase
    .from("whitbyos_provider_options")
    .select("id, workstream_id, request:whitbyos_requests!request_id (workspace_id)")
    .eq("id", optionId)
    .maybeSingle();

  const owner = firstOf(option?.request) as { workspace_id?: string } | null;
  if (!option || option.workstream_id !== streamId || owner?.workspace_id !== workspaceId) {
    redirect(back);
  }

  await supabase.from("whitbyos_provider_options").delete().eq("id", optionId);

  revalidatePath(ROUTE, "page");
  redirect(back);
}

function firstOf(value: unknown) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

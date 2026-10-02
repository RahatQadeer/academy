"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";

const LIST = "/whitbyos/insights";
const ROUTE = "/[product]/[[...slug]]";

/**
 * Checks a consideration belongs to this workspace before anything is done to
 * it. The row itself has no workspace — it hangs off a Work Plan, which hangs
 * off a Request, which has one.
 */
async function reachable(considerationId: string, workspaceId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("whitbyos_considerations")
    .select(
      "id, body, workstream_id, plan:whitbyos_workplans!workplan_id (id, request_id, request:whitbyos_requests!request_id (workspace_id, client_id))",
    )
    .eq("id", considerationId)
    .maybeSingle();

  const plan = data?.plan as unknown as
    | { id: string; request_id: string; request: { workspace_id: string } | null }
    | null;

  const owner = Array.isArray(plan?.request) ? plan?.request[0] : plan?.request;
  if (!data || owner?.workspace_id !== workspaceId) return null;

  return {
    body: data.body as string,
    requestId: plan?.request_id ?? null,
    /* Already read above and, until now, thrown away — which is why the
       task this becomes was invisible on the plan it came from. */
    workstreamId: (data.workstream_id as string | null) ?? null,
    clientId: (owner as { client_id?: string | null } | null)?.client_id ?? null,
  };
}

/** 14 and 14.1's Dismiss — this one is not worth acting on. */
export async function dismissConsideration(formData: FormData) {
  await stopIfReadOnly();

  const id = String(formData.get("consideration_id") ?? "").trim();
  if (!id) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);
  if (!(await reachable(id, workspaceId))) redirect(LIST);

  const supabase = await createClient();
  await supabase
    .from("whitbyos_considerations")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?dismissed=1`);
}

/** 14.1's Resolve — it has been dealt with. */
export async function resolveConsideration(formData: FormData) {
  await stopIfReadOnly();

  const id = String(formData.get("consideration_id") ?? "").trim();
  if (!id) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);
  if (!(await reachable(id, workspaceId))) redirect(LIST);

  const supabase = await createClient();
  await supabase
    .from("whitbyos_considerations")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?resolved=1`);
}

/**
 * 14.1's Add Task — turning a consideration into work.
 *
 * The consideration is not dismissed by this. It stays open until the task it
 * became is done, because the thing it noticed is still true until then; the
 * link is what stops it being raised twice.
 */
export async function considerationToTask(formData: FormData) {
  await stopIfReadOnly();

  const id = String(formData.get("consideration_id") ?? "").trim();
  if (!id) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const found = await reachable(id, workspaceId);
  if (!found) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * A title is a line, and a consideration is a paragraph.
   *
   * This put 160 characters of prose in the title — "Send the child profile
   * questionnaire and document request to the family today. Everything
   * downstream depends on the children's year groups, needs and the…" — so
   * every list it appeared in was one unreadable row. The first sentence is
   * the instruction; the rest is why, and that is what a description is for.
   */
  const first = found.body.split(/(?<=[.!?])\s/)[0]?.trim() ?? found.body;
  const title = (first.length > 90 ? `${first.slice(0, 88).trimEnd()}…` : first) || "Consideration";

  /* A week, the same default the create agent uses. A task with no date is
     one the calendar and the overdue count cannot see. */
  const due = new Date();
  due.setDate(due.getDate() + 7);

  const { data: task, error } = await supabase
    .from("whitbyos_tasks")
    .insert({
      workspace_id: workspaceId,
      request_id: found.requestId,
      /* Without this the task exists but appears on no plan: a plan draws
         its tasks through its Work Streams, so one with no stream is filed
         under nothing and visible only in My Tasks. */
      workstream_id: found.workstreamId,
      client_id: found.clientId,
      title,
      description: found.body.length > title.length ? found.body : null,
      status: "not_started",
      priority: "medium",
      due_date: due.toISOString().slice(0, 10),
      owner_user_id: user?.id ?? null,
      visibility: "internal",
    })
    .select("id")
    .single();

  if (error || !task) redirect(`${LIST}?error=${encodeURIComponent(error?.message ?? "Could not add the task.")}`);

  await supabase
    .from("whitbyos_considerations")
    .update({ converted_to_task_id: task.id })
    .eq("id", id);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?tasked=1`);
}

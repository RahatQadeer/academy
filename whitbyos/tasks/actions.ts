"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { completionStamp } from "@/whitbyos/lib/tasks";
import { isDone } from "@/whitbyos/lib/task-vocab";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";
import { draftTask } from "@/whitbyos/lib/ai/draft-task";
import { listDraftableProviders } from "@/whitbyos/lib/providers";
import { workspaceKnowledgeContext } from "@/whitbyos/lib/knowledge";
import { resolveClientId } from "@/whitbyos/lib/client-workspace";

const LIST = "/whitbyos/tasks";

/** Every Whitby screen is served by one catch-all route, so that is what is revalidated. */
const ROUTE = "/[product]/[[...slug]]";

const STATUSES = new Set(["not_started", "in_progress", "waiting", "complete"]);
const PRIORITIES = new Set(["low", "medium", "high"]);

function backWithError(query: string, message: string): never {
  redirect(`${LIST}?${query}&error=${encodeURIComponent(message)}`);
}

/** A Task is only ours if it sits in the workspace this session is scoped to. */
async function requireTask(taskId: string) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_tasks")
    .select("id, status, workspace_id, due_date, start_date")
    .eq("id", taskId)
    .maybeSingle();

  if (!data || data.workspace_id !== workspaceId) redirect(LIST);
  return { supabase, task: data };
}

/**
 * Who a task is assigned to, written in one place.
 *
 * Migration 044 made whitbyos_task_assignees the record and left
 * owner_user_id as the first of them, so that every screen already reading
 * the column keeps working. Two columns holding one fact is how a count and a
 * list start disagreeing — so this is the only code that writes either, and
 * it always writes both.
 */
async function setTaskAssignees(taskId: string, userIds: string[]) {
  const supabase = await createClient();
  const wanted = [...new Set(userIds.filter(Boolean))];

  await supabase.from("whitbyos_task_assignees").delete().eq("task_id", taskId);

  if (wanted.length > 0) {
    await supabase.from("whitbyos_task_assignees").insert(
      wanted.map((userId, index) => ({ task_id: taskId, user_id: userId, sort_order: index })),
    );
  }

  await supabase
    .from("whitbyos_tasks")
    .update({ owner_user_id: wanted[0] ?? null, updated_at: new Date().toISOString() })
    .eq("id", taskId);
}

/**
 * Screen 7.0 — New Task.
 *
 * The reference asks for a title, the client or workspace it belongs to, an
 * optional Request to hang it on, its assignees, a priority and a due date,
 * plus an optional next action. §6.7.1's other fields — waiting state,
 * dependency, completion evidence — belong to a task already underway, so they
 * are set later rather than guessed at creation.
 */
export async function createTask(formData: FormData) {
  await stopIfReadOnly();

  const title = String(formData.get("title") ?? "").trim();
  const requestId = String(formData.get("request_id") ?? "").trim();
  const clientId =
    (await resolveClientId(String(formData.get("client_id") ?? ""))) ?? "";
  const assignees = formData.getAll("assignees").map((value) => String(value).trim());
  const priority = String(formData.get("priority") ?? "medium").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const nextAction = String(formData.get("next_action") ?? "").trim();
  const workstreamId = String(formData.get("workstream_id") ?? "").trim();

  /*
   * Everything the dialog asks for, asked again here.
   *
   * The browser enforces `required` and a form posted any other way does not,
   * and half a task is what fills My Tasks with rows nobody can act on: no
   * client, no plan, nobody on it, no date. Next Action is the one field
   * marked optional, and stays that way.
   */
  if (!title) backWithError("new=1", "Title is required.");
  if (!clientId) backWithError("new=1", "Choose the workspace this task is for.");
  if (!workstreamId) {
    backWithError("new=1", "Choose the Work Plan and Work Stream this belongs to.");
  }
  if (assignees.length === 0) backWithError("new=1", "Put at least one person on it.");
  if (!dueDate) backWithError("new=1", "Give it a due date.");
  if (!PRIORITIES.has(priority)) backWithError("new=1", "Choose a priority.");

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) backWithError("new=1", "Create your workspace first.");

  const supabase = await createClient();

  /*
   * The Work Stream has to be one of this workspace's, and on a plan being
   * worked on. The select only offers those, and a select is a list the
   * browser sends back whatever it was given.
   */
  /*
   * A task belongs to a Request.
   *
   * With a client named and no Request chosen, the task used to be filed
   * under nothing: invisible to every plan and to the client's own file, and
   * listed only in My Tasks. The one honest case is a client with no Requests
   * at all, which is a gap in their Requests rather than a choice, so that is
   * the only one still allowed through.
   */
  if (clientId && !requestId) {
    const { count } = await supabase
      .from("whitbyos_requests")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId);

    if ((count ?? 0) > 0) {
      backWithError("new=1", "Choose the Request this task belongs to.");
    }
  }

  const { data: stream } = await supabase
    .from("whitbyos_workstreams")
    .select(
      "id, name, workplan_id, plan:whitbyos_workplans!workplan_id (id, name, deleted_at, archived_at, request:whitbyos_requests!request_id (id, title, workspace_id))",
    )
    .eq("id", workstreamId)
    .maybeSingle();

  const plan = stream
    ? ((Array.isArray(stream.plan) ? stream.plan[0] : stream.plan) as
        | {
            id: string;
            name: string;
            deleted_at: string | null;
            archived_at: string | null;
            request: unknown;
          }
        | null)
    : null;

  const planRequest = plan
    ? ((Array.isArray(plan.request) ? plan.request[0] : plan.request) as
        | { id: string; title: string; workspace_id: string }
        | null)
    : null;

  if (
    !stream ||
    !plan ||
    plan.deleted_at ||
    plan.archived_at ||
    planRequest?.workspace_id !== workspaceId
  ) {
    backWithError("new=1", "That Work Stream is not on a plan you are working on.");
  }
  const { data: created, error } = await supabase
    .from("whitbyos_tasks")
    .insert({
      workspace_id: workspaceId,
      // The Request somebody named. Left empty with a client named, the task
      // is that client's general work and has no Request — the dialog says
      // so. Falling back to the plan's Request here is what filed every
      // "unlinked" task under one and hid it from the portal's Tasks screen.
      // With no client either, the plan's Request is still the only thing
      // tying the task to anybody.
      request_id: requestId || (clientId ? null : planRequest?.id) || null,
      client_id: clientId || null,
      workstream_id: workstreamId,
      title,
      owner_user_id: assignees[0] || null,
      priority: PRIORITIES.has(priority) ? priority : "medium",
      status: "not_started",
      due_date: dueDate || null,
      next_action: nextAction || null,
      // Internal unless the dialog asked for otherwise. This was the literal
      // "internal" with nothing able to change it — see the note on the
      // checkbox in NewTaskDialog.
      visibility: formData.get("client_visible") === "1" ? "client_visible" : "internal",
    })
    .select("id")
    .single();

  if (error || !created) backWithError("new=1", error?.message ?? "Could not add the task.");

  if (assignees.length > 0) await setTaskAssignees(created.id as string, assignees);

  /*
   * Whitby works the task out, the same as it does for every task it drafts.
   *
   * A task added by hand used to arrive with a title and a date, which on a
   * screen showing the work somebody can work through is not work. It gets
   * what a drafted one gets: what it is, what it produces, how long it takes,
   * its steps, what has to be in hand first, where to go and whether it needs
   * an outside firm.
   *
   * Written onto the task rather than kept anywhere of its own, so everything
   * downstream reads one thing — the plan's "What we need from the client"
   * panel gathers `required_inputs` from every task on it and cannot tell
   * which of them a person typed.
   *
   * Never fatal: a task that reaches the screen with nothing on it can still
   * be opened and worked through, and one that failed to be created because a
   * model was busy is a task that does not exist.
   */
  const directory = await listDraftableProviders();
  const about = [title, stream.name as string | null, plan.name, planRequest?.title]
    .filter(Boolean)
    .join("\n");

  const drafted = await draftTask({
    title,
    stream: (stream.name as string) ?? null,
    plan: plan.name ?? null,
    request: planRequest?.title ?? null,
    providers: directory,
    knowledgeContext: await workspaceKnowledgeContext(about, clientId || null),
    workspaceId,
  });

  if (drafted) {
    /*
     * A provider the firm already has beats one it has to go and find.
     *
     * The model is shown the directory and names its pick; this is where that
     * name becomes a row. Matched on a folded name, the same as the plan's
     * drafter: a model given a list answers with one of its entries, and the
     * only thing that can go wrong is spacing or case.
     *
     * Where it matched, the task carries the provider and their number instead
     * of "Add a provider" — which is a gap in the directory, not a step.
     */
    const fold = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
    const chosen = drafted.useProvider
      ? (directory.find((provider) => fold(provider.name) === fold(drafted.useProvider!)) ?? null)
      : null;

    const reachable = chosen && (chosen.phone || chosen.email)
      ? [
          {
            kind: "provider" as const,
            label: chosen.specialty ? `${chosen.name}, ${chosen.specialty}` : chosen.name,
            phone: chosen.phone,
            email: chosen.email,
            address: chosen.location,
            // The firm wrote it down, which is what the mark means.
            verified: true,
          },
        ]
      : [];

    const { error: detailError } = await supabase
      .from("whitbyos_tasks")
      .update({
        description: drafted.description || null,
        expected_output: drafted.expectedOutput || null,
        estimated_days: drafted.estimatedDays,
        required_inputs: drafted.requiredInputs,
        external_links: [...reachable, ...drafted.resources],
        provider_id: chosen?.id ?? null,
        // Only where the directory has nobody. A matched provider is not a gap.
        provider_need: chosen ? null : drafted.providerNeed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.id as string);

    if (detailError) {
      console.error("Could not save the drafted task detail", detailError.message);
    }
  }

  const steps = drafted?.steps ?? [];

  if (steps.length > 0) {
    // `workstream_id` and `title` are both NOT NULL on this table, and an
    // insert without them fails — silently, the first time this was written,
    // so the model answered perfectly and the task arrived with no steps.
    // The same three columns drafting writes, in `saveDraftedSteps`.
    const { error: stepsError } = await supabase.from("whitbyos_checklists").insert({
      task_id: created.id as string,
      workstream_id: workstreamId,
      title: "Steps",
      items: steps.map((step) => ({
        text: step.text,
        done: false,
        // Whoever the task is on leads every step of it until somebody splits
        // it; a null here would read as "the task's owner" anyway, and saying
        // it plainly is what makes "two people on this" answerable later.
        ownerUserId: assignees[0] || null,
      })),
    });

    if (stepsError) {
      // Not fatal, and no longer silent: the task exists and can be worked
      // through, and the one place this matters is the page about to open.
      console.error("Could not save the drafted steps", stepsError.message);
    }
  }

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}/${created.id as string}`);
}

/**
 * Screen 7.1 — Mark Complete, and the same button undoing it.
 *
 * §12.1.4 treats this kind of record as reversible internal work, so a task
 * marked done by mistake is put back with one more click rather than recreated.
 * Completing redirects with the task's id so 7.1.1's toast has something to
 * name; reopening does not, since there is nothing to celebrate.
 */
export async function completeTask(formData: FormData) {
  await stopIfReadOnly();

  const taskId = String(formData.get("task_id") ?? "").trim();
  if (!taskId) redirect(LIST);

  const { supabase, task } = await requireTask(taskId);
  const done = isDone(String(task.status));

  const { error } = await supabase
    .from("whitbyos_tasks")
    .update({
      status: done ? "in_progress" : "complete",
      completed_at: completionStamp(
        done ? "in_progress" : "complete",
        (task as { completed_at?: string | null }).completed_at ?? null,
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) backWithError(`task=${taskId}`, error.message);

  revalidatePath(ROUTE, "page");
  redirect(done ? LIST : `${LIST}?done=${taskId}`);
}

/**
 * Screen 7's checkbox — the same change as Mark Complete, without opening the
 * task first. No redirect: the list is already on screen, and sending it back
 * to its own URL hands the render to the client router cache, which can answer
 * with the version from before the click.
 */
export async function toggleTaskDone(formData: FormData) {
  await stopIfReadOnly();

  const taskId = String(formData.get("task_id") ?? "").trim();
  if (!taskId) redirect(LIST);

  const { supabase, task } = await requireTask(taskId);

  await supabase
    .from("whitbyos_tasks")
    .update({
      status: isDone(String(task.status)) ? "in_progress" : "complete",
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  revalidatePath(ROUTE, "page");
}

/**
 * 7.1's Reassign — §6.7.1 allows a Task to be handed to a teammate.
 *
 * Through the same one writer as creation, so the join table and the column
 * can never come apart. Handing a task over replaces who is on it rather than
 * adding to them: that is what "reassign" means, and the modal that opens this
 * says Reassign, not Add.
 */
export async function reassignTask(formData: FormData) {
  await stopIfReadOnly();

  const taskId = String(formData.get("task_id") ?? "").trim();
  const assignees = formData.getAll("assignees").map((value) => String(value).trim());
  const single = String(formData.get("owner_user_id") ?? "").trim();
  if (!taskId) redirect(LIST);

  await requireTask(taskId);
  await setTaskAssignees(taskId, assignees.length > 0 ? assignees : single ? [single] : []);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?task=${taskId}`);
}

/** 7.1's Status field, changed without leaving the task. */
export async function setTaskStatus(formData: FormData) {
  await stopIfReadOnly();

  const taskId = String(formData.get("task_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!taskId || !STATUSES.has(status)) redirect(LIST);

  const { supabase } = await requireTask(taskId);

  await supabase
    .from("whitbyos_tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId);

  revalidatePath(ROUTE, "page");
  redirect(status === "complete" ? `${LIST}?done=${taskId}` : `${LIST}?task=${taskId}`);
}

/**
 * Tick a step off, from the task's own page.
 *
 * `toggleChecklistItem` in work-plans/actions does the same thing and insists
 * on a `plan_id`: it checks the task is inside that plan, which is right for
 * the plan's screen and impossible for a task that belongs to no plan, or to
 * one since deleted. This checks the same thing the rest of this file checks —
 * that the task is in the workspace you are signed into — and nothing else.
 *
 * No redirect. The page is already on screen and sending it back to its own
 * URL hands the render to the client router cache, which can answer with the
 * version from before the press.
 */
export async function toggleTaskStep(formData: FormData) {
  await stopIfReadOnly();

  const taskId = String(formData.get("task_id") ?? "").trim();
  const index = Number(formData.get("index"));
  if (!taskId || !Number.isInteger(index) || index < 0) redirect(LIST);

  const { supabase } = await requireTask(taskId);

  const { data: row } = await supabase
    .from("whitbyos_checklists")
    .select("id, items")
    .eq("task_id", taskId)
    .maybeSingle();

  if (!row || !Array.isArray(row.items) || index >= row.items.length) {
    revalidatePath(ROUTE, "page");
    return;
  }

  const items = (row.items as { text: string; done?: boolean }[]).map((item, i) =>
    i === index ? { ...item, done: !item.done } : item,
  );

  await supabase.from("whitbyos_checklists").update({ items }).eq("id", row.id);

  revalidatePath(ROUTE, "page");
}

/**
 * A task dropped on a different day.
 *
 * The Calendar is the one view where a date is a place, so moving a task
 * across it is how a date is changed there: no dialog, no form, the gesture is
 * the edit.
 *
 * A task that had a start date keeps the run-up it was given — three days
 * between starting and being due stays three days — because a task pushed a
 * week out was not shortened by a week, it was moved.
 *
 * An empty date takes it off the calendar and back to the undated rail, which
 * is what dragging it there means.
 */
export async function rescheduleTask(
  taskId: string,
  /** ISO date, or null to clear it. */
  date: string | null,
): Promise<{ ok: boolean; error?: string }> {
  await stopIfReadOnly();

  if (!taskId) return { ok: false, error: "No task." };
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "That is not a date." };

  const { supabase, task } = await requireTask(taskId);

  const patch: Record<string, unknown> = { due_date: date };

  const was = (task.due_date as string | null) ?? null;
  const start = (task.start_date as string | null) ?? null;

  if (date && was && start) {
    const moved = Date.parse(date) - Date.parse(was);
    if (Number.isFinite(moved) && moved !== 0) {
      patch.start_date = new Date(Date.parse(start) + moved).toISOString().slice(0, 10);
    }
  }

  const { error } = await supabase.from("whitbyos_tasks").update(patch).eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(ROUTE, "page");
  return { ok: true };
}

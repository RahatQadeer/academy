"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { readUpload } from "@/whitbyos/lib/import-file";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { completionStamp } from "@/whitbyos/lib/tasks";
import { draftQuestions } from "@/whitbyos/lib/ai/draft-questions";
import { draftWorkplan } from "@/whitbyos/lib/ai/draft-workplan";
import { researchGroundedWithState } from "@/whitbyos/lib/ai/provider";
import { attachResources } from "@/whitbyos/lib/ai/attach-resources";
import { listDraftableProviders } from "@/whitbyos/lib/providers";
import { resolveClientId } from "@/whitbyos/lib/client-workspace";
import { assignRole, listAssignable } from "@/whitbyos/lib/assign";
import { saveDraftedPlan } from "@/whitbyos/lib/workplan";
import { schedulePlan } from "@/whitbyos/lib/schedule";
import { getWorkTypes } from "@/whitbyos/lib/onboarding";
import { clientEmailContext } from "@/whitbyos/lib/gmail-context";
import { workspaceKnowledgeContext } from "@/whitbyos/lib/knowledge";
import { readStreams } from "@/whitbyos/lib/playbook-vocab";
import { unbranded } from "@/whitbyos/lib/unbranded";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";
import { notifyClientContacts, notifyPeople } from "@/whitbyos/lib/notify";
import { clientAskHref, getClientAsk, readProposals } from "@/whitbyos/lib/client-ask";
import { draftProposals } from "@/whitbyos/lib/ai/draft-proposal";
import {
  clientNeeds,
  needFieldId,
  needFieldType,
  needSections,
  needSlug,
  needWhen,
  readNeedEdits,
  type NeedSource,
} from "@/whitbyos/lib/plan-requirements";
import { getWorkPlan } from "@/whitbyos/lib/work-plans";
import { runWhitbyFirstDrafts } from "@/whitbyos/lib/whitby-drafts";
import { shortDate } from "@/whitbyos/lib/format";

const LIST = "/whitbyos/work-plans";

/**
 * What the picker sends when somebody chooses None.
 *
 * An empty select is "unanswered" and also what a firm running without Client
 * Workspaces submits, so "none" is said in a word rather than inferred from a
 * blank that already means two other things.
 */
const NO_CLIENT = "none";

/** What a hand-added client need may be, matching `TaskRequirement["kind"]`. */
const NEED_KINDS = new Set(["document", "information", "approval", "account", "contact"]);
const ROUTE = "/[product]/[[...slug]]";

/** The statuses that count as finished, as lib/work-plans.ts counts them. */
const DONE = new Set(["complete", "completed", "done"]);

/** WP.18's Status and Priority selects, as the (5) export lists them. */
const TASK_STATUSES = new Set(["not_started", "in_progress", "waiting", "complete"]);
const TASK_PRIORITIES = new Set(["high", "medium", "low"]);

function planPath(planId: string): PlanPath {
  return `${LIST}/${planId}` as PlanPath;
}

/**
 * Fail in place: `where` is a path, not a plan id.
 *
 * A branded type because the two are both strings and this used to take the
 * id — so a caller handing one over would have redirected to "/<uuid>?edit=1"
 * and nothing in the compiler would have said a word.
 */
type PlanPath = string & { readonly __planPath: unique symbol };

function backWithError(where: PlanPath, query: string, message: string): never {
  redirect(`${where}?${query}&error=${encodeURIComponent(message)}`);
}

/**
 * Where a dialog opened from says to go back to.
 *
 * The Edit Task dialog is opened over the plan, over a Work Stream and over
 * the task's own page, and saving used to land on the plan wherever it came
 * from — so editing a task you were reading took you away from it.
 *
 * Only paths inside this plan are honoured. The value arrives in a form field,
 * which means it arrives from whoever is sending the form, and a redirect that
 * takes any string is a redirect to anywhere.
 */
function returnTo(formData: FormData, planId: string): PlanPath {
  const raw = String(formData.get("return_to") ?? "").trim();
  const home = planPath(planId);

  // No scheme, no host, no protocol-relative "//host" — a path on this site.
  if (raw.includes("://") || raw.startsWith("//")) return home;

  // Inside this plan, or anywhere else in Whitby.
  //
  // It used to be the plan only, which was right while every one of these was
  // pressed on the plan. A need can be asked for from the task that needs it
  // now, and landing back on the plan after pressing a button on a task is
  // losing somebody's place to save a check that "/whitbyos/" already makes.
  if (raw === home || raw.startsWith(`${home}/`)) return raw as PlanPath;
  if (raw.startsWith("/whitbyos/")) return raw as PlanPath;

  return home;
}

/**
 * A plan reaches its workspace through its Request, so every write starts by
 * proving the plan is one this user may touch.
 *
 * RLS would refuse the write anyway, but it refuses silently — this turns a
 * row that quietly fails to update into a message the professional can read.
 */
async function requirePlan(planId: string) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("id, request_id, request:whitbyos_requests!request_id (id, workspace_id)")
    .eq("id", planId)
    .maybeSingle();

  const request = Array.isArray(plan?.request) ? plan?.request[0] : plan?.request;
  if (!plan || !request || request.workspace_id !== workspaceId) redirect(LIST);

  return {
    supabase,
    workspaceId,
    requestId: plan.request_id as string,
  };
}

/** Work Streams on this plan, used to check a task is being filed inside it. */
async function planStreamIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
) {
  const { data } = await supabase
    .from("whitbyos_workstreams")
    .select("id")
    .eq("workplan_id", planId);
  return new Set((data ?? []).map((row) => row.id as string));
}

// ---------------------------------------------------------------------------
// WP.18 — Edit Task
// ---------------------------------------------------------------------------

/**
 * Reads the checklist rows back off the form.
 *
 * The dialog posts one `checklist_text` and one `checklist_done` per row, in
 * order, so the two arrays line up. Blank rows are dropped rather than saved —
 * an empty tick box is not a step.
 */
function readChecklistFields(formData: FormData) {
  const texts = formData.getAll("checklist_text").map((value) => String(value));
  const done = formData.getAll("checklist_done").map((value) => String(value));
  const owners = formData.getAll("checklist_owner").map((value) => String(value));

  return texts
    .map((text, index) => ({
      text: text.trim(),
      done: done[index] === "1",
      // Whose step it is. Blank means the task's own owner, which is what a
      // row somebody just added means too.
      ownerUserId: owners[index]?.trim() ? owners[index]!.trim() : null,
    }))
    .filter((item) => item.text.length > 0);
}

/**
 * WP.18 — save the Task, creating it when there is no id yet.
 *
 * One action for both because the dialog is one dialog: the reference draws the
 * same fields whether the Task exists or not, and splitting them would mean two
 * copies of the same validation.
 *
 * SRS §6.7.1 gives a Task an owner, status, due date and next action; this
 * screen edits the four WP.18 shows and leaves the rest as they were.
 */
export async function saveTask(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  const taskId = String(formData.get("task_id") ?? "").trim();
  if (!planId) redirect(LIST);

  const back = taskId ? `task=${taskId}` : "task=new";

  const title = String(formData.get("title") ?? "").trim();
  const streamId = String(formData.get("workstream_id") ?? "").trim();
  const assignee = String(formData.get("owner_user_id") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const priority = String(formData.get("priority") ?? "").trim();
  const nextAction = String(formData.get("next_action") ?? "").trim();
  const dependency = String(formData.get("dependency") ?? "").trim();

  if (!title) backWithError(returnTo(formData, planId), back, "Task Name is required.");
  if (!streamId) backWithError(returnTo(formData, planId), back, "Choose the Work Stream this task belongs to.");

  const { supabase, workspaceId, requestId } = await requirePlan(planId);

  const streams = await planStreamIds(supabase, planId);
  if (!streams.has(streamId)) {
    backWithError(returnTo(formData, planId), back, "That Work Stream is not part of this plan.");
  }

  // "ws:<id>" and "task:<id>" land in different columns; one blocker either way.
  const blockedByStream = dependency.startsWith("ws:") ? dependency.slice(3) : null;
  const blockedByTask = dependency.startsWith("task:") ? dependency.slice(5) : null;

  const fields = {
    title,
    workstream_id: streamId,
    owner_user_id: assignee || null,
    due_date: dueDate || null,
    status: TASK_STATUSES.has(status) ? status : "not_started",
    completed_at: completionStamp(TASK_STATUSES.has(status) ? status : "not_started"),
    priority: TASK_PRIORITIES.has(priority) ? priority : null,
    next_action: nextAction || null,
    dependency_task_id: blockedByTask,
    dependency_workstream_id: blockedByStream,
    updated_at: new Date().toISOString(),
  };

  // WP.18's "Visible to the client". An unticked box posts nothing, so only a
  // task that *was* client-visible is taken back to internal — a restricted
  // one stays restricted rather than being widened by a save that never
  // mentioned it.
  const clientVisible = formData.get("client_visible") === "1";
  const visibilityWas = String(formData.get("visibility_was") ?? "").trim();
  const visibility = clientVisible
    ? "client_visible"
    : visibilityWas === "client_visible"
      ? "internal"
      : null;

  let savedId = taskId;

  if (taskId) {
    // Scoped to this plan's streams so an id from elsewhere cannot be steered
    // into it by editing the URL.
    const { error } = await supabase
      .from("whitbyos_tasks")
      .update(visibility ? { ...fields, visibility } : fields)
      .eq("id", taskId)
      .in("workstream_id", [...streams]);
    if (error) backWithError(returnTo(formData, planId), back, error.message);
  } else {
    const { data, error } = await supabase
      .from("whitbyos_tasks")
      .insert({
        ...fields,
        workspace_id: workspaceId,
        request_id: requestId,
        visibility: visibility ?? "internal",
      })
      .select("id")
      .single();
    if (error || !data) backWithError(returnTo(formData, planId), back, error?.message ?? "Could not create the task.");
    savedId = data.id as string;
  }

  await saveChecklist(supabase, savedId, streamId, readChecklistFields(formData));
  // The modal sets a task's status directly, so the stream it sits in has to
  // hear about that the same way ticking one off makes it hear.
  await syncStreamStatus(supabase, streamId);

  revalidatePath(planPath(planId));
  // Back where the dialog was opened from, which is not always the plan.
  redirect(returnTo(formData, planId));
}

/**
 * The Task's checklist, kept as one row in `whitbyos_checklists` (migration
 * 008). Written by hand rather than upserted because the uniqueness of
 * `task_id` is a partial index, which PostgREST's on-conflict cannot name.
 */
async function saveChecklist(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  streamId: string,
  items: { text: string; done: boolean }[],
) {
  const { data: existing } = await supabase
    .from("whitbyos_checklists")
    .select("id")
    .eq("task_id", taskId)
    .maybeSingle();

  if (items.length === 0) {
    // No steps left means no checklist, not an empty one.
    if (existing) await supabase.from("whitbyos_checklists").delete().eq("id", existing.id);
    return;
  }

  if (existing) {
    await supabase
      .from("whitbyos_checklists")
      .update({ items, workstream_id: streamId })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("whitbyos_checklists").insert({
    task_id: taskId,
    workstream_id: streamId,
    title: "Checklist",
    items,
  });
}

/**
 * WP.18 — Remove Task.
 *
 * A real delete, unlike closing a Request. §1.16 keeps the record of what was
 * promised and delivered at Request level; a Task added to a plan by mistake
 * carries none of that, and WP.18 offers removal rather than an archive.
 * Its checklist goes with it through the cascade in migration 008.
 */
export async function removeTask(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  const taskId = String(formData.get("task_id") ?? "").trim();
  if (!planId || !taskId) redirect(LIST);

  const { supabase } = await requirePlan(planId);
  const streams = await planStreamIds(supabase, planId);

  // Read before the delete: afterwards there is no row to say which stream it
  // belonged to, and removing the last unfinished task finishes that stream.
  const { data: removed } = await supabase
    .from("whitbyos_tasks")
    .select("workstream_id")
    .eq("id", taskId)
    .maybeSingle();

  const { error } = await supabase
    .from("whitbyos_tasks")
    .delete()
    .eq("id", taskId)
    .in("workstream_id", [...streams]);

  if (error) backWithError(planPath(planId), `task=${taskId}`, error.message);

  if (removed?.workstream_id) {
    await syncStreamStatus(supabase, removed.workstream_id as string);
  }

  revalidatePath(planPath(planId));
  redirect(planPath(planId));
}

/**
 * Tick a Task off, or put it back.
 *
 * WP.18 has no Status field — the reference's Edit Task modal edits a name, a
 * stream, an assignee, a due date and a checklist, and nothing else. Without
 * somewhere to mark work finished, a plan's progress could only ever count up
 * its denominator and report 0%, which is worse than not reporting at all.
 *
 * So the circle beside a task on WP.17 does it, which is where the eye already
 * is. Reversible on purpose: §12.1.4 treats this kind of record as reversible
 * internal work, and a mis-click should cost one more click.
 */
export async function toggleTask(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  const taskId = String(formData.get("task_id") ?? "").trim();
  if (!planId || !taskId) redirect(LIST);

  const { supabase } = await requirePlan(planId);
  const streams = await planStreamIds(supabase, planId);

  const { data: task } = await supabase
    .from("whitbyos_tasks")
    .select("id, status, workstream_id, completed_at")
    .eq("id", taskId)
    .maybeSingle();

  if (!task || !streams.has(task.workstream_id as string)) redirect(planPath(planId));

  const done = DONE.has(String(task.status).toLowerCase());

  await supabase
    .from("whitbyos_tasks")
    .update({
      // Untick lands on "not_started", one of WP.18's own four words, rather
      // than on the column default "open" — the modal and the tick were
      // writing two different names for the same state.
      status: done ? "not_started" : "complete",
      // Ticking it records the day; putting it back clears the record, since
      // a completion that was undone did not happen.
      completed_at: completionStamp(
        done ? "open" : "complete",
        task.completed_at as string | null,
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  await syncStreamStatus(supabase, task.workstream_id as string);

  // No redirect: this screen is already the one being looked at, and bouncing
  // it to its own URL hands the render back to the client router cache, which
  // can answer with the version from before the click. Revalidating and
  // returning re-renders in place.
  revalidatePath("/[product]/[[...slug]]", "page");
}

/**
 * A Work Stream's state, from the state of the work inside it.
 *
 * Ticking every task in a stream and leaving it reading "Not Started" is not a
 * position anyone holds — it is the stream having no way to hear about it. So
 * finishing the last task finishes the stream, and starting the first one
 * starts it.
 *
 * `paused` is left alone. Nothing about the work derives it — it is somebody
 * deciding to stop, and no count of tasks can know that. It stays until the
 * same person changes it in WP.19.
 *
 * Everything else follows the work, including waiting: a stream whose only
 * movement is a task sitting with somebody else is waiting, not running.
 */
async function syncStreamStatus(
  supabase: Awaited<ReturnType<typeof requirePlan>>["supabase"],
  streamId: string,
) {
  if (!streamId) return;

  const { data: stream } = await supabase
    .from("whitbyos_workstreams")
    .select("status")
    .eq("id", streamId)
    .maybeSingle();

  const held = String(stream?.status ?? "").toLowerCase();
  if (held === "paused") return;

  const { data: tasks } = await supabase
    .from("whitbyos_tasks")
    .select("status")
    .eq("workstream_id", streamId);

  const rows = tasks ?? [];
  if (rows.length === 0) return;

  const state = (row: { status: string | null }) => String(row.status ?? "").toLowerCase();

  const complete = rows.filter((row) => DONE.has(state(row)));
  // "open" is base's column default and predates the four words the screens
  // use; unticking a task lands there too. It means nobody has started, so a
  // stream reading it as "started" would say Running over a stream of blanks.
  const untouched = rows.filter((row) => ["not_started", "open", ""].includes(state(row)));
  const waiting = rows.filter((row) => ["waiting", "blocked"].includes(state(row)));

  const next =
    complete.length === rows.length
      ? "complete"
      : untouched.length === rows.length
        ? "not_started"
        : // Nothing finished and nothing actually being worked on, but something
          // sitting with somebody else — that is a stream waiting, not running.
          complete.length === 0 && waiting.length > 0 &&
            untouched.length + waiting.length === rows.length
          ? "waiting"
          : "active";

  if (next === held) return;

  await supabase
    .from("whitbyos_workstreams")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", streamId);
}

/**
 * WP.3's "Start from Scratch" — Step 1 into Step 2.
 *
 * A Work Plan cannot float free: SRS §6.6.1 hangs it off a Request, and the
 * Request is what carries the workspace and the client. So choosing this path
 * opens both at once, as a Draft, and drops the professional into WP.15 with an
 * empty plan to fill — rather than asking them to create a Request first and
 * find their way back.
 *
 * Both stay Draft until Save Work Plan, which is what §6.4.13 means by the
 * professional adopting a plan rather than it becoming live on its own.
 */
export async function startFromScratch(formData: FormData) {
  await stopIfReadOnly();

  /* "None" is an answer here — see `toStepTwo`. */
  const submitted = String(formData.get("client_id") ?? "").trim();
  const clientId = submitted === NO_CLIENT ? "" : (await resolveClientId(submitted)) ?? "";
  const name = String(formData.get("name") ?? "").trim() || "Untitled Work Plan";

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: request, error: requestError } = await supabase
    .from("whitbyos_requests")
    .insert({
      workspace_id: workspaceId,
      client_id: clientId || null,
      title: name,
      status: "open",
      priority: "standard",
      owner_user_id: user?.id ?? null,
      /* Nobody's work is nobody's to see: the portal reads a client's work by
         that client's id, and a Request with none matches nobody. */
      visibility: clientId ? "client_account" : "private_to_requestor",
    })
    .select("id, target_date")
    .single();

  if (requestError || !request) {
    redirect(
      `${LIST}/new?error=${encodeURIComponent(requestError?.message ?? "Could not start the plan.")}`,
    );
  }

  const { data: plan, error: planError } = await supabase
    .from("whitbyos_workplans")
    .insert({
      request_id: request.id,
      name,
      status: "draft",
      // The Request was created a moment ago with the column defaults, so the
      // plan starts from the same place rather than a second set of literals.
      urgency: "medium",
      health: "on_track",
      owner_user_id: user?.id ?? null,
    })
    .select("id")
    .single();

  if (planError || !plan) {
    redirect(
      `${LIST}/new?error=${encodeURIComponent(planError?.message ?? "Could not start the plan.")}`,
    );
  }

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(`${planPath(plan.id)}?wizard=scratch`);
}

/**
 * WP.15's "Save Work Plan" — Step 2 into Step 3.
 *
 * §6.4.13: a plan becomes live because the professional adopts it, never on its
 * own. Its Request starts running at the same moment, since a plan being worked
 * and a Request sitting open would disagree about the same work.
 */
export async function saveScratchPlan(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) redirect(LIST);

  const { supabase, requestId } = await requirePlan(planId);

  await supabase
    .from("whitbyos_workplans")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", planId);

  await supabase
    .from("whitbyos_requests")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(`${planPath(planId)}?saved=1&whitby=1`);
}

const URGENCY = new Set(["critical", "high", "medium", "low"]);
const HEALTH = new Set(["on_track", "needs_attention", "at_risk"]);

/**
 * WP.17's Edit button, and the ✎ beside the title — both open the same dialog,
 * because they do the same thing.
 *
 * The reference draws the two controls but no screen behind them, so the fields
 * are the plan's own editable state as migration 007 defines it: what it is
 * called, what it is for, how urgent it is, how it is going, when it is due and
 * where. Status is deliberately absent — a plan becomes active by being adopted
 * (§6.4.13) and complete by its Request closing, never by being typed here.
 */
export async function saveWorkPlan(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) redirect(LIST);

  const name = String(formData.get("name") ?? "").trim();
  const outcome = String(formData.get("desired_outcome") ?? "").trim();
  const urgency = String(formData.get("urgency") ?? "").trim();
  const health = String(formData.get("health") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const targetDate = String(formData.get("target_date") ?? "").trim();

  if (!name) backWithError(planPath(planId), "edit=1", "Name is required.");

  if (startDate && targetDate && targetDate < startDate) {
    backWithError(planPath(planId), "edit=1", "The target date is before the start date.");
  }

  const { supabase } = await requirePlan(planId);

  /* What it was, so a new deadline can be told from the same one saved
     again — only a move is worth redating the work for. */
  const { data: before } = await supabase
    .from("whitbyos_workplans")
    .select("target_date")
    .eq("id", planId)
    .maybeSingle();

  const { error } = await supabase
    .from("whitbyos_workplans")
    .update({
      name,
      desired_outcome: outcome || null,
      urgency: URGENCY.has(urgency) ? urgency : "medium",
      health: HEALTH.has(health) ? health : "on_track",
      start_date: startDate || null,
      target_date: targetDate || null,
      // `location` is deliberately not written here. The dialog no longer asks
      // for it, and a form that does not show a field must not empty it.
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);

  if (error) backWithError(planPath(planId), "edit=1", error.message);

  /*
   * Moving the deadline moves the work.
   *
   * Every task was dated backwards from the old one when the plan was drafted
   * — that is what the dates on them mean. Changing the date and leaving them
   * where they were produced a plan due in December whose last task was due in
   * October, and nothing said which of the two to believe.
   *
   * The same scheduler the draft used, over the tasks as they stand now, so a
   * task somebody has moved by hand is re-dated by its place in the plan
   * rather than by what the model once guessed.
   */
  const moved = targetDate && (before?.target_date as string | null)?.slice(0, 10) !== targetDate;
  if (moved) await redateTasks(supabase, planId, targetDate);

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(planPath(planId));
}

/**
 * Every task in a plan, dated backwards from a deadline.
 *
 * Best effort. A plan whose dates could not be worked out is still a plan
 * with a new deadline on it, and refusing the save over the dates would lose
 * the edit as well.
 */
async function redateTasks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
  targetDate: string,
) {
  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .select("id, sort_order")
    .eq("workplan_id", planId)
    .order("sort_order");

  const phases = new Map((streams ?? []).map((row, index) => [row.id as string, index]));
  if (phases.size === 0) return;

  const { data: tasks } = await supabase
    .from("whitbyos_tasks")
    .select("id, workstream_id, estimated_days, dependency_task_id, sort_order, created_at")
    .in("workstream_id", [...phases.keys()])
    .order("sort_order")
    .order("created_at");

  if (!tasks || tasks.length === 0) return;

  const here = new Set(tasks.map((task) => task.id as string));

  const { tasks: dated } = schedulePlan({
    targetDate,
    tasks: tasks.map((task, index) => ({
      key: task.id as string,
      estimatedDays: (task.estimated_days as number | null) ?? null,
      /* A dependency on a task that has since been deleted is no dependency;
         the scheduler would otherwise wait on something that never finishes. */
      dependsOn: here.has((task.dependency_task_id as string) ?? "")
        ? (task.dependency_task_id as string)
        : null,
      phase: phases.get(task.workstream_id as string) ?? 0,
      order: (task.sort_order as number) ?? index,
    })),
  });

  for (const task of dated) {
    await supabase
      .from("whitbyos_tasks")
      .update({
        start_date: task.startDate,
        due_date: task.dueDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.key);
  }

  /* The plan starts when its earliest task does, the way the draft sets it. */
  const earliest = dated.reduce<string | null>(
    (soonest, task) => (!soonest || task.startDate < soonest ? task.startDate : soonest),
    null,
  );

  if (earliest) {
    await supabase
      .from("whitbyos_workplans")
      .update({ start_date: earliest })
      .eq("id", planId);
  }
}

/**
 * WP.6's checklist — ticked from the plan itself, not only inside WP.18.
 *
 * The reference draws each item as a real checkbox on the task row and puts a
 * "Checklist 2/4" count in its header, so the tick has to mean something the
 * moment it happens. Position rather than an id because the items live as a
 * jsonb array on the checklist row, which is the shape base's schema gave them.
 */
/**
 * WP.17 — run the web lookup again on a plan that already exists.
 *
 * The lookup before drafting is deliberately never fatal, which means it fails
 * quietly: a plan with no phone numbers on it looks exactly like work that
 * needed none. Migration 076 records which it was, and this is the remedy —
 * because "the model was busy for nine seconds" should not cost somebody a
 * plan they have already edited, and rebuilding it was the only way back.
 *
 * Only the resources are touched. Not the tasks, not the dates, not the
 * owners: somebody asked for the numbers, not for a different plan.
 */
export async function researchPlanAgain(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) redirect(LIST);

  const { supabase } = await requirePlan(planId);

  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("id, name, desired_outcome, request:whitbyos_requests!request_id (title, description)")
    .eq("id", planId)
    .maybeSingle();

  const request = Array.isArray(plan?.request) ? plan?.request[0] : plan?.request;
  const title = (request?.title as string) ?? (plan?.name as string) ?? "";
  const detail =
    (plan?.desired_outcome as string | null) ?? (request?.description as string | null) ?? null;

  const lookup = await researchGroundedWithState({
    prompt: [
      `Work: ${title}`,
      detail ? `Detail: ${detail}` : null,
      "Find the practical externals somebody would need to do this: the official authority or department, the page where an application or appointment is actually made, published contact details for the offices involved, and anything with a fixed deadline or processing time.",
      "Only what you can actually find. Say plainly where you could not find something.",
    ]
      .filter(Boolean)
      .join("\n"),
    signal: AbortSignal.timeout(35_000),
  });

  await supabase
    .from("whitbyos_workplans")
    .update({ research_state: lookup.state, updated_at: new Date().toISOString() })
    .eq("id", planId);

  if (!lookup.answer) {
    revalidatePath(ROUTE, "page");
    redirect(
      `${planPath(planId)}?lookup=${lookup.state === "empty" ? "empty" : "failed"}`,
    );
  }

  const streams = [...(await planStreamIds(supabase, planId))];
  const { data: tasks } = await supabase
    .from("whitbyos_tasks")
    .select("id, title, external_links")
    .in("workstream_id", streams);

  const attached = await attachResources({
    requestTitle: title,
    description: detail,
    tasks: (tasks ?? []).map((task) => task.title as string),
    findings: lookup.answer.text,
    sources: lookup.answer.sources,
  });

  if (!attached || attached.length === 0) {
    /**
     * The search worked and nothing needed attaching, which is not the same
     * as the search finding nothing.
     *
     * Both used to redirect as "empty", so a plan already carrying four
     * government pages was told the search "turned up nothing usable for this
     * work" — a sentence that was not true about a lookup that had just
     * succeeded.
     */
    revalidatePath(ROUTE, "page");
    redirect(`${planPath(planId)}?lookup=none`);
  }

  // A provider from the firm's own directory already sits on some of these
  // rows and is the better record; the found ones go after it rather than
  // over it.
  const byTitle = new Map<string, { id: string; existing: unknown[] }>();
  for (const task of tasks ?? []) {
    const title = task.title as string;
    if (byTitle.has(title)) continue;
    byTitle.set(title, {
      id: task.id as string,
      existing: Array.isArray(task.external_links) ? (task.external_links as unknown[]) : [],
    });
  }

  let touched = 0;
  for (const row of attached) {
    const task = byTitle.get(row.task);
    if (!task) continue;

    const own = task.existing.filter(
      (link) => (link as { kind?: string })?.kind === "provider",
    );

    await supabase
      .from("whitbyos_tasks")
      .update({ external_links: [...own, ...row.resources], updated_at: new Date().toISOString() })
      .eq("id", task.id);

    touched += 1;
  }

  revalidatePath(ROUTE, "page");
  redirect(`${planPath(planId)}?lookup=${touched}`);
}

export async function toggleChecklistItem(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  const taskId = String(formData.get("task_id") ?? "").trim();
  const index = Number(formData.get("index"));

  if (!planId || !taskId || !Number.isInteger(index) || index < 0) redirect(LIST);

  const { supabase } = await requirePlan(planId);
  const streams = await planStreamIds(supabase, planId);

  const { data: task } = await supabase
    .from("whitbyos_tasks")
    .select("id, workstream_id")
    .eq("id", taskId)
    .maybeSingle();

  if (!task || !streams.has(task.workstream_id as string)) redirect(planPath(planId));

  const { data: row } = await supabase
    .from("whitbyos_checklists")
    .select("id, items")
    .eq("task_id", taskId)
    .maybeSingle();

  if (!row || !Array.isArray(row.items) || index >= row.items.length) {
    redirect(planPath(planId));
  }

  const items = (row.items as { text: string; done?: boolean }[]).map((item, i) =>
    i === index ? { ...item, done: !item.done } : item,
  );

  await supabase.from("whitbyos_checklists").update({ items }).eq("id", row.id);

  revalidatePath("/[product]/[[...slug]]", "page");
}

// ---------------------------------------------------------------------------
// WP.19 — Edit Work Stream
// ---------------------------------------------------------------------------

const STREAM_STATUS = new Set([
  "not_started",
  "active",
  "waiting",
  "paused",
  "complete",
]);

/**
 * WP.19 — save the Work Stream, creating it when there is no id yet.
 *
 * "Blocked" is the one option in the reference's Status select that is not a
 * value of `whitbyos_workstream_status`. Migration 007 added it as a boolean
 * beside the status, so choosing it raises the flag and leaves the status
 * where it was — a blocked stream is still running, waiting or not started
 * underneath, and picking any other option lowers the flag again.
 */
export async function saveWorkstream(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  const streamId = String(formData.get("workstream_id") ?? "").trim();
  if (!planId) redirect(LIST);

  const back = streamId ? `stream=${streamId}` : "stream=new";

  const name = String(formData.get("name") ?? "").trim();
  const choice = String(formData.get("status") ?? "").trim();
  // The Timeline lays a stream out against this. Nothing else on any screen
  // could set it, so it was null on every stream in the product and 15.3c had
  // nothing to draw.
  const targetDate = String(formData.get("target_date") ?? "").trim();

  if (!name) backWithError(planPath(planId), back, "Name is required.");

  const { supabase } = await requirePlan(planId);

  const blocked = choice === "blocked";
  const status = STREAM_STATUS.has(choice) ? choice : null;

  if (streamId) {
    const { error } = await supabase
      .from("whitbyos_workstreams")
      .update({
        name,
        blocked,
        target_date: targetDate || null,
        ...(status ? { status } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", streamId)
      .eq("workplan_id", planId);
    if (error) backWithError(planPath(planId), back, error.message);
  } else {
    // New streams go to the end of the plan's numbered list.
    const { data: last } = await supabase
      .from("whitbyos_workstreams")
      .select("sort_order")
      .eq("workplan_id", planId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("whitbyos_workstreams").insert({
      workplan_id: planId,
      name,
      status: status ?? "not_started",
      blocked,
      target_date: targetDate || null,
      kind: "manual",
      sort_order: ((last?.sort_order as number) ?? -1) + 1,
    });
    if (error) backWithError(planPath(planId), back, error.message);
  }

  revalidatePath(planPath(planId));
  redirect(planPath(planId));
}

/**
 * WP.19 — Remove Work Stream.
 *
 * The dialog says plainly that this takes the stream's tasks and checklists
 * with it. `whitbyos_tasks.workstream_id` is ON DELETE SET NULL in base's
 * schema, which would leave the tasks alive but attached to nothing and
 * invisible on every screen, so they are deleted first rather than orphaned.
 */
export async function removeWorkstream(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  const streamId = String(formData.get("workstream_id") ?? "").trim();
  if (!planId || !streamId) redirect(LIST);

  const { supabase } = await requirePlan(planId);

  const { data: owned } = await supabase
    .from("whitbyos_workstreams")
    .select("id")
    .eq("id", streamId)
    .eq("workplan_id", planId)
    .maybeSingle();

  if (!owned) redirect(planPath(planId));

  await supabase.from("whitbyos_tasks").delete().eq("workstream_id", streamId);

  const { error } = await supabase
    .from("whitbyos_workstreams")
    .delete()
    .eq("id", streamId)
    .eq("workplan_id", planId);

  if (error) backWithError(planPath(planId), `stream=${streamId}`, error.message);

  revalidatePath(planPath(planId));
  redirect(planPath(planId));
}


const URGENCY_VALUES = new Set(["low", "medium", "high", "critical"]);
const COMPLEXITY_VALUES = new Set(["simple", "moderate", "complex"]);
const SIZE_VALUES = new Set(["lean", "standard", "comprehensive"]);

/**
 * WP.4 → WP.6 — Build with Whitby, with the plan's shape configured first.
 *
 * The plan lands as a draft on the Review & Edit step rather than live. §6.4.13
 * has the professional adopt a plan; drafting one is Whitby proposing, and
 * Save Work Plan is the moment somebody agrees.
 *
 * The Request is created here when none was chosen, because a Work Plan hangs
 * off one (§6.6.1) and there is nothing to hang it on otherwise. Choosing an
 * existing Request instead attaches the plan to work already under way.
 */
export async function buildWithWhitby(formData: FormData) {
  await stopIfReadOnly();

  const clientId = String(formData.get("client_id") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const requestId = String(formData.get("request_id") ?? "").trim();
  // WP.3 offers a name before the route is chosen. Whitby names the plan
  // itself, so this only overrides that where somebody actually typed one.
  const name = String(formData.get("name") ?? "").trim();
  const targetDate = String(formData.get("target_date") ?? "").trim();

  const urgency = String(formData.get("urgency") ?? "medium");
  const complexity = String(formData.get("complexity") ?? "moderate");
  const planSize = String(formData.get("plan_size") ?? "standard");

  const back = `${LIST}/new/configure?client=${clientId}`;
  if (!clientId) redirect(`${LIST}/new`);
  if (!prompt) redirect(`${back}&at=${Date.now()}&error=${encodeURIComponent("Describe what this plan has to do.")}`);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = clientId
    ? await supabase
        .from("whitbyos_clients")
        .select("id, name")
        .eq("id", clientId)
        .eq("workspace_id", workspaceId)
        .maybeSingle()
    : { data: null };

  if (clientId && !client) {
    redirect(`${LIST}/new?error=${encodeURIComponent("That client is not in this workspace.")}`);
  }

  // Whatever the plan is for has to be a Request. An existing one is checked
  // against the workspace; otherwise the prompt's first line names a new one.
  let targetRequestId = requestId;

  if (targetRequestId) {
    const { data: existing } = await supabase
      .from("whitbyos_requests")
      .select("id")
      .eq("id", targetRequestId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!existing) targetRequestId = "";
  }

  // No check that the Request is free. It used to need one: request_id was
  // unique, and without it the insert failed several steps later with
  // Postgres's own sentence about a constraint nobody had heard of. Migration
  // 038 dropped that constraint, because the client asked for more than one
  // plan per Request — so pointing a second plan at one is now the feature,
  // not the error.

  if (!targetRequestId) {
    const { data: created, error } = await supabase
      .from("whitbyos_requests")
      .insert({
        workspace_id: workspaceId,
        /* None is the firm's own work — 099, and see `toStepTwo`. */
        client_id: clientId || null,
        title: prompt.split("\n")[0]!.slice(0, 120),
        desired_outcome: prompt,
        status: "open",
        priority: "standard",
        owner_user_id: user.id,
        visibility: clientId ? "client_account" : "private_to_requestor",
        urgency: URGENCY_VALUES.has(urgency) ? urgency : "medium",
        target_date: targetDate || null,
      })
      .select("id")
      .single();

    if (error || !created) {
      redirect(`${back}&at=${Date.now()}&error=${encodeURIComponent(error?.message ?? "Could not start the plan.")}`);
    }
    targetRequestId = created.id as string;
  }

  /*
   * The dials from WP.4, which travel with the plan whichever way it goes.
   *
   * Everything else the drafting needs is read by `runPlanDrafting`. It used
   * to be gathered here, before the redirect, so the background work was the
   * one slow thing — but the drafting can now start a minute later, after
   * questions are answered, and context read before the questions would be
   * a minute stale by the time it was used.
   */
  const shape = {
    urgency: URGENCY_VALUES.has(urgency) ? urgency : "medium",
    complexity: COMPLEXITY_VALUES.has(complexity) ? complexity : "moderate",
    size: SIZE_VALUES.has(planSize) ? planSize : "standard",
  };

  const { data: parent } = await supabase
    .from("whitbyos_requests")
    /* Not just the title. A plan built on an existing Request is built on
       everything that Request already records, and asking about what is
       written on it is the same fault as asking for the date the form
       above already carried. */
    .select("urgency, health, title, desired_outcome, definition_of_done")
    .eq("id", targetRequestId)
    .maybeSingle();

  /*
   * The plan exists before it is written.
   *
   * Drafting used to be done while the professional watched a wizard step,
   * on a screen that could not be left without losing the work. The client
   * asked for the other arrangement — so the row is inserted now, empty but
   * for its name, and the page it opens says to come back in a minute or two
   * while the drafting goes on behind it.
   */
  const { data: placeholder, error: placeholderError } = await supabase
    .from("whitbyos_workplans")
    .insert({
      request_id: targetRequestId,
      name: name || (parent?.title as string | null) || prompt.split("\n")[0]!.slice(0, 120),
      owner_user_id: user.id,
      urgency: (parent?.urgency as string) ?? shape.urgency,
      health: (parent?.health as string) ?? "on_track",
      status: "draft",
      version: 1,
      target_date: targetDate || null,
      /* Asking, not drafting: what happens next is decided by whether the
         description left anything worth asking about. `after` settles it a
         moment from now, and the plan's own page waits either way. */
      drafting_state: "asking",
      drafting_started_at: new Date().toISOString(),
    })
    .select("id, name")
    .single();

  if (placeholderError || !placeholder) {
    redirect(
      `${back}&at=${Date.now()}&error=${encodeURIComponent(
        placeholderError?.message ?? "Could not start the plan.",
      )}`,
    );
  }

  const planId = placeholder.id as string;
  const requestForPlan = targetRequestId;
  /** What the bell will call it when it lands. */
  const planName = (placeholder.name as string | null) || "Your Work Plan";

  /*
   * And the slow part runs after the redirect has gone out.
   *
   * `after` is the same tool the portal's calendar sync uses: the response is
   * already sent, so nothing the professional does next is waiting on the
   * model. Whatever happens, the row stops saying it is drafting — a plan
   * that fails says so on its own page rather than looking unfinished
   * forever.
   */
  /*
   * What happens next is decided behind the redirect.
   *
   * Two things can follow: a short list of questions, or the drafting
   * itself. Which one is not known until the description has been read, and
   * reading it is a model call — so the professional is sent to the plan's
   * page first and the page says which it turned out to be.
   */
  after(async () => {
    const service = await createClient();

    const asked = await draftQuestions({
      description: prompt,
      requestTitle: (parent?.title as string | null) ?? null,
      clientName: (client?.name as string | undefined) ?? null,
      targetDate: targetDate || null,
      /* What the Request it is being built on already settles. */
      requestOutcome: (parent?.desired_outcome as string | null) ?? null,
      requestDefinitionOfDone: (parent?.definition_of_done as string | null) ?? null,
      workspaceId,
    });

    const questions = asked.ok ? asked.data.questions : [];

    /*
     * Nothing worth asking, or the asking itself failed: draft.
     *
     * A failed question call must never block a plan. The professional came
     * here for a plan, the questions are an improvement on the way, and an
     * improvement that can stop the thing it improves is a fault.
     */
    if (questions.length === 0) {
      await service
        .from("whitbyos_workplans")
        .update({ drafting_state: "drafting" })
        .eq("id", planId);

      await runPlanDrafting({
        planId,
        planName,
        workspaceId,
        userId: user.id,
        requestId: requestForPlan,
        name: name || null,
        prompt,
        clientId: (client?.id as string | undefined) ?? null,
        clientName: (client?.name as string | undefined) ?? null,
        targetDate: targetDate || null,
        shape,
      });

      revalidatePath(ROUTE, "page");
      return;
    }

    /* The questions, and everything the drafting will need once they are
       answered. One column, written once: this is a scratchpad between two
       steps of a wizard, not a record anybody queries by field. */
    await service
      .from("whitbyos_workplans")
      .update({
        drafting_questions: {
          questions,
          ask: {
            prompt,
            name: name || null,
            clientId: (client?.id as string | undefined) ?? null,
            clientName: (client?.name as string | undefined) ?? null,
            targetDate: targetDate || null,
            shape,
          },
        },
      })
      .eq("id", planId);

    await notifyPeople({
      workspaceId,
      userIds: [user.id],
      kind: "workplan_ready",
      title: `${planName} needs a moment of your time`,
      body:
        questions.length === 1
          ? "Whitby has one question before it drafts."
          : `Whitby has ${questions.length} questions before it drafts.`,
      href: `${LIST}/${planId}`,
      entityType: "workplan",
      entityId: planId,
    });

    revalidatePath(ROUTE, "page");
  });

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}/${planId}?drafting=1`);
}


/**
 * WP.3's four cards.
 *
 * Each is a submit rather than a link, because the client is chosen on the same
 * screen and has to come with you. Start from Scratch is the exception and
 * creates its plan here, since there is no step 2 to configure.
 */
async function toStepTwo(formData: FormData, route: string): Promise<never> {
  /*
   * A Work Plan is not always somebody's — 099.
   *
   * The firm's own work is work: the year's hiring, an office move, the
   * insurance review. So is a plan drawn before the client it is for has
   * accepted their invitation, which is the ordinary case — work starts the
   * day it is agreed, not the day somebody gets round to their email.
   *
   * "None" is the empty value and it means none: no client on the plan, and
   * nothing about it in anybody's portal, because the portal reads a client's
   * work by that client's id and a plan with none matches nobody.
   *
   * `resolveClientId` still answers for a firm that runs without Client
   * Workspaces at all — there, everything belongs to the firm's own client.
   */
  const submitted = String(formData.get("client_id") ?? "").trim();
  const clientId = submitted === NO_CLIENT ? "" : (await resolveClientId(submitted)) ?? "";

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  if (clientId) {
    const supabase = await createClient();
    const { data: client } = await supabase
      .from("whitbyos_clients")
      .select("id")
      .eq("id", clientId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!client) {
      redirect(`${LIST}/new?error=${encodeURIComponent("That client is not in this workspace.")}`);
    }
  }

  const name = String(formData.get("name") ?? "").trim();
  const query = new URLSearchParams(clientId ? { client: clientId } : { client: "" });
  if (name) query.set("name", name);

  redirect(`${LIST}/new/${route}?${query.toString()}`);
}

export async function goToConfigure(formData: FormData) {
  await stopIfReadOnly();

  await toStepTwo(formData, "configure");
}

export async function goToPlaybook(formData: FormData) {
  await stopIfReadOnly();

  await toStepTwo(formData, "playbook");
}

export async function goToImport(formData: FormData) {
  await stopIfReadOnly();

  await toStepTwo(formData, "import");
}


/**
 * WP.8–WP.11 — Use a Playbook.
 *
 * The Playbook's structure is copied and nothing else: §6.10 keeps a Playbook a
 * record rather than a live thing, so a plan built from one never points back
 * at it for its contents. `source_playbook_id` records where it came from,
 * which is what "Times Used" counts.
 *
 * No model call. The Playbook already says how this kind of work runs — that is
 * what it is for — so paying to have it rewritten would be spending credits to
 * get something less specific than what the firm wrote itself.
 */
export async function buildFromPlaybook(formData: FormData) {
  await stopIfReadOnly();

  const clientId = String(formData.get("client_id") ?? "").trim();
  const playbookId = String(formData.get("playbook_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const requestId = String(formData.get("request_id") ?? "").trim();
  const targetDate = String(formData.get("target_date") ?? "").trim();
  const urgency = String(formData.get("urgency") ?? "medium");

  // Back to the step the error happened on: with a Playbook chosen that is
  // WP.9, not the picker it was selected from.
  const picker = `${LIST}/new/playbook?client=${clientId}`;
  const back = playbookId ? `${picker}&playbook=${playbookId}` : picker;
  /* No client is an answer — see `toStepTwo`. A Playbook is a way of working,
     and the firm's own work is work. */
  if (!playbookId) redirect(`${picker}&error=${encodeURIComponent("Choose a Playbook to start from.")}`);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: playbook } = await supabase
    .from("whitbyos_playbooks")
    .select("id, name, contents, workspace_id")
    .eq("id", playbookId)
    .maybeSingle();

  if (!playbook || playbook.workspace_id !== workspaceId) {
    redirect(`${back}&error=${encodeURIComponent("That Playbook is not in this workspace.")}`);
  }

  const streams = readStreams(playbook.contents);
  const planName = name || (playbook.name as string);

  // WP.9 offers an existing Request to hang this on. One is only usable if it
  // is in this workspace and has no plan of its own — a Work Plan and a
  // Request are one to one.
  let requestRow: { id: string } | null = null;

  if (requestId) {
    const { data: existing } = await supabase
      .from("whitbyos_requests")
      .select("id")
      .eq("id", requestId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    // A Request already carrying a plan is no longer a reason to refuse this
    // one — see the note in buildWithWhitby.
    if (existing) {
      requestRow = { id: existing.id as string };
    }
  }

  if (!requestRow) {
    const { data: created, error: requestError } = await supabase
      .from("whitbyos_requests")
      .insert({
        workspace_id: workspaceId,
        client_id: clientId || null,
        title: planName,
        status: "open",
        priority: "standard",
        owner_user_id: user.id,
        visibility: clientId ? "client_account" : "private_to_requestor",
        urgency: URGENCY_VALUES.has(urgency) ? urgency : "medium",
        target_date: targetDate || null,
      })
      .select("id")
      .single();

    if (requestError || !created) {
      redirect(`${back}&error=${encodeURIComponent(requestError?.message ?? "Could not start the plan.")}`);
    }
    requestRow = { id: created.id as string };
  }

  const request = requestRow;

  const { data: plan, error: planError } = await supabase
    .from("whitbyos_workplans")
    .insert({
      request_id: request.id,
      name: planName,
      status: "draft",
      owner_user_id: user.id,
      urgency: URGENCY_VALUES.has(urgency) ? urgency : "medium",
      target_date: targetDate || null,
      source_playbook_id: playbookId,
      version: 1,
    })
    .select("id")
    .single();

  if (planError || !plan) {
    redirect(`${back}&error=${encodeURIComponent(planError?.message ?? "Could not start the plan.")}`);
  }

  if (streams.length > 0) {
    const { data: saved } = await supabase
      .from("whitbyos_workstreams")
      .insert(
        streams.map((stream, index) => ({
          workplan_id: plan.id,
          name: stream.name,
          purpose: stream.purpose ?? null,
          status: "not_started",
          sort_order: index,
          owner_user_id: user.id,
        })),
      )
      .select("id");

    /**
     * A Playbook's own work, shared out and with its checklists kept.
     *
     * Every task used to go to whoever pressed the button, and the Playbook's
     * checklists — the steps somebody wrote down precisely so the next
     * engagement would not have to work them out again — were dropped on the
     * way in. A template that loses its steps is a list of titles.
     */
    const people = await listAssignable(workspaceId);
    const taken = new Map<string, number>();

    const rows = (saved ?? []).flatMap((row, index) =>
      (streams[index]?.tasks ?? []).map((task) => {
        // No role to go on — a Playbook records what the work is, not who does
        // it — so "any", which spreads across everybody who could.
        const owner = assignRole("any", people, taken);
        if (owner) taken.set(owner, (taken.get(owner) ?? 0) + 1);

        return {
          streamId: row.id as string,
          checklist: task.checklist ?? [],
          row: {
            workspace_id: workspaceId,
            request_id: request.id,
            workstream_id: row.id as string,
            title: task.title,
            // A Playbook records what the work is, not who may do it
            // unreviewed. Manual is the cautious reading, and the professional
            // can change it.
            kind: "manual",
            status: "not_started",
            owner_user_id: owner,
            visibility: "internal",
          },
        };
      }),
    );

    if (rows.length > 0) {
      const { data: inserted } = await supabase
        .from("whitbyos_tasks")
        .insert(rows.map((entry) => entry.row))
        .select("id, title");

      const idByTitle = new Map<string, string>();
      for (const task of inserted ?? []) {
        if (!idByTitle.has(task.title as string)) {
          idByTitle.set(task.title as string, task.id as string);
        }
      }

      const checklists = rows.flatMap((entry) => {
        const taskId = idByTitle.get(entry.row.title);
        const items = entry.checklist
          .map((text) => text.trim())
          .filter((text) => text.length > 0)
          .map((text) => ({ text, done: false, ownerUserId: entry.row.owner_user_id }));

        if (!taskId || items.length === 0) return [];
        return [{ task_id: taskId, workstream_id: entry.streamId, title: "Steps", items }];
      });

      if (checklists.length > 0) {
        await supabase.from("whitbyos_checklists").insert(checklists);
      }
    }
  }

  revalidatePath(ROUTE, "page");
  redirect(
    `${LIST}/${plan.id}?review=playbook&from=${encodeURIComponent(playbook.name as string)}&whitby=1`,
  );
}

/**
 * WP.12–WP.14 — Import a Work Plan.
 *
 * The document is read here and turned into a plan by the same drafter, told
 * to restructure rather than invent. A spreadsheet or a brief already says what
 * the work is; the model's job is to put it into Work Streams and steps, not to
 * add work nobody asked for.
 *
 * Only text is read. A PDF or a spreadsheet would need parsing this project has
 * no library for, and guessing at their bytes would produce a plan built from
 * nonsense — so those are refused with the reason rather than half-read.
 */
export async function importWorkPlan(formData: FormData) {
  await stopIfReadOnly();

  const clientId = String(formData.get("client_id") ?? "").trim();
  const pasted = String(formData.get("pasted") ?? "").trim();
  const file = formData.get("file");

  /* None is an answer, not a missing one — see `toStepTwo`. */
  const back = `${LIST}/new/import?client=${clientId}`;

  let text = pasted;
  let source = "";

  if (!text && file instanceof File && file.size > 0) {
    const read = await readUpload(file);
    if (!read.ok) redirect(`${back}&error=${encodeURIComponent(read.error)}`);
    text = read.text;
    source = file.name;
  }

  if (!text) {
    redirect(`${back}&error=${encodeURIComponent("Upload a file or paste what the plan should be built from.")}`);
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = clientId
    ? await supabase
        .from("whitbyos_clients")
        .select("id, name")
        .eq("id", clientId)
        .eq("workspace_id", workspaceId)
        .maybeSingle()
    : { data: null };

  if (clientId && !client) {
    redirect(`${LIST}/new?error=${encodeURIComponent("That client is not in this workspace.")}`);
  }

  const drafted = await draftWorkplan({
    workspaceId,
    providers: await listDraftableProviders(),
    requestTitle: String(formData.get("name") ?? "").trim() || "Imported Work Plan",
    description: text.slice(0, 12000),
    clientName: (client?.name as string | undefined) ?? "the firm itself",
    workTypes: await getWorkTypes(),
    // No `emailContext` here, and that is the point of the instruction below.
    // Import is a translation of a document somebody already wrote; handing
    // the model the client's correspondence as well would invite it to add
    // work the document does not mention, which is the one thing this call
    // asks it not to do.
    instruction:
      "This is an existing plan in someone else's format. Restructure exactly what it contains into Work Streams and steps. Do not add work it does not mention, and do not drop work it does.",
  });

  if (!drafted.ok) redirect(`${back}&error=${encodeURIComponent(drafted.error)}`);

  const { data: request, error: requestError } = await supabase
    .from("whitbyos_requests")
    .insert({
      workspace_id: workspaceId,
      client_id: clientId || null,
      title: drafted.data.planName,
      desired_outcome: drafted.data.desiredOutcome,
      status: "open",
      priority: "standard",
      owner_user_id: user.id,
      visibility: clientId ? "client_account" : "private_to_requestor",
    })
    .select("id")
    .single();

  if (requestError || !request) {
    redirect(`${back}&error=${encodeURIComponent(requestError?.message ?? "Could not import it.")}`);
  }

  const saved = await saveDraftedPlan({
    requestId: request.id as string,
    ownerUserId: user.id,
    plan: drafted.data,
    // Import creates its own Request and the upload step asks for no deadline,
    // so there is nothing to plan backwards from. The durations the drafter
    // read out of the document stand, and a date can be set on the plan
    // afterwards — which reschedules it.
    targetDate: null,
  });

  if (!saved.ok) redirect(`${back}&error=${encodeURIComponent(saved.error)}`);

  revalidatePath(ROUTE, "page");
  redirect(
    `${LIST}/${saved.workplanId}?review=import${source ? `&from=${encodeURIComponent(source)}` : ""}&whitby=1`,
  );
}


/**
 * WP.17c's Save as Playbook.
 *
 * The other direction from buildFromPlaybook: a plan that worked becomes the
 * saved shape for the next one. Structure only — the client's dates, owners and
 * documents belong to their engagement, and carrying them onto the next client
 * would be worse than useless.
 *
 * It starts private. Sharing a Playbook is a decision about that Playbook, not
 * something inherited from the plan it came out of.
 */
export async function savePlanAsPlaybook(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  const back = `${LIST}/${planId}`;
  if (!planId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select(
      "id, name, desired_outcome, request:whitbyos_requests!request_id (workspace_id)",
    )
    .eq("id", planId)
    .maybeSingle();

  const request = plan?.request as unknown as { workspace_id: string } | null;
  const owner = Array.isArray(request) ? request[0] : request;
  if (!plan || owner?.workspace_id !== workspaceId) redirect(LIST);

  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .select("id, name, purpose, sort_order")
    .eq("workplan_id", planId)
    .order("sort_order");

  const ids = (streams ?? []).map((row) => row.id as string);
  const byStream = new Map<string, string[]>();

  if (ids.length > 0) {
    const { data: tasks } = await supabase
      .from("whitbyos_tasks")
      .select("title, workstream_id")
      .in("workstream_id", ids);

    for (const task of tasks ?? []) {
      const key = task.workstream_id as string;
      byStream.set(key, [...(byStream.get(key) ?? []), task.title as string]);
    }
  }

  const contents = {
    description: unbranded((plan.desired_outcome as string | null) ?? null),
    streams: (streams ?? []).map((row) => ({
      name: unbranded(row.name as string),
      purpose: unbranded((row.purpose as string | null) ?? null) ?? undefined,
      tasks: (byStream.get(row.id as string) ?? []).map((title) => ({
        title: unbranded(title),
      })),
    })),
  };

  const createdBy = (await supabase.auth.getUser()).data.user?.id ?? null;

  const { data: playbook, error } = await supabase
    .from("whitbyos_playbooks")
    .insert({
      workspace_id: workspaceId,
      name: unbranded(plan.name as string),
      /* Without the product's name in it — see `unbranded`, and §1.4. A
         Playbook is the shape that goes on to be shown to clients. */
      contents,
      version: 1,
      shared_level: "private",
      created_from_workplan_id: planId,
      created_by_user_id: createdBy,
    })
    .select("id")
    .single();

  if (error || !playbook) {
    redirect(`${back}?error=${encodeURIComponent(error?.message ?? "Could not save it as a Playbook.")}`);
  }

  await supabase.from("whitbyos_playbook_versions").insert({
    playbook_id: playbook.id,
    version_number: 1,
    snapshot: contents,
    change_reason: "Created",
    created_by_user_id: createdBy,
  });

  revalidatePath(ROUTE, "page");
  redirect(`/whitbyos/playbooks/${playbook.id}?created=1`);
}

/**
 * WP.2c — deleting a Work Plan, with the two outcomes the dialog offers.
 *
 * The difference between them is exactly what the schema already does.
 * `whitbyos_workstreams.workplan_id` cascades and `whitbyos_checklists`
 * cascades from the stream, so Work Streams and their checklists go either
 * way. `whitbyos_tasks.workstream_id` is `on delete set null`, so Tasks
 * survive by default, detached from any stream.
 *
 *   plan        the Work Plan and its Work Streams. Tasks live on, and so do
 *               the Request and its Documents — unlinked, as the dialog says.
 *   everything  the Tasks as well, deleted before the plan so the cascade
 *               cannot orphan them first.
 *
 * Neither deletes the Request or a Document. The dialog does not offer it, and
 * a Request outlives the plan that was drawn for it.
 */
/**
 * WP.2c — archiving a Work Plan, or removing it from every screen.
 *
 * Neither one deletes anything. The client was explicit: nothing leaves the
 * database. So "Archive" files the plan away and "Delete permanently" means
 * gone from every screen and not restorable from Settings → Archive — the row
 * stays, with a date and a name against it.
 *
 * Only the plan's owner may do either. Archiving is recoverable and deleting
 * is not, and neither is a thing a colleague should be able to do to somebody
 * else's plan on their way past.
 */
export async function archiveWorkPlan(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  const scope = String(formData.get("scope") ?? "archive").trim();
  if (!planId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Reachable from this workspace, through the Request the plan hangs off.
  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("id, owner_user_id, whitbyos_requests!request_id (workspace_id)")
    .eq("id", planId)
    .maybeSingle();

  const owner = plan?.whitbyos_requests as unknown as
    | { workspace_id: string }
    | { workspace_id: string }[]
    | null;
  const ownerId = Array.isArray(owner) ? owner[0]?.workspace_id : owner?.workspace_id;
  if (!plan || ownerId !== workspaceId) redirect(LIST);

  if (plan.owner_user_id && plan.owner_user_id !== user.id) {
    redirect(
      `${LIST}?error=${encodeURIComponent("Only this Work Plan's owner can archive or delete it.")}`,
    );
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("whitbyos_workplans")
    .update(
      scope === "delete"
        ? { deleted_at: now, deleted_by_user_id: user.id, updated_at: now }
        : { archived_at: now, archived_by_user_id: user.id, updated_at: now },
    )
    .eq("id", planId);

  if (error) redirect(`${LIST}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");
  redirect(LIST);
}

/**
 * WP.2b's "Try again".
 *
 * A link back to the same URL would be answered from the router's cache, so
 * the failure would simply be redrawn and the button would look broken while
 * behaving exactly as written. This drops the cached entry first, which is the
 * difference between retrying and pretending to.
 */
export async function retryWorkPlans() {
  await stopIfReadOnly();

  revalidatePath(ROUTE, "page");
  revalidatePath(LIST, "page");
  redirect(LIST);
}

/**
 * WP.17v and WP.17u — save who can see a Work Plan, or one Work Stream.
 *
 * The two modals differ only in which table they write, so they share
 * everything below them.
 *
 * Three rules, and the first is the one worth remembering: **ticking everybody
 * stores nothing.** Migration 070 reads an empty set as "everyone", so a list
 * that happens to name every current member would otherwise go stale the
 * moment somebody new joined — they would be the one person left out of a plan
 * nobody had chosen to narrow. Clearing the rows keeps it open by meaning
 * rather than by coincidence.
 *
 * The owner is always written in, whatever the form says. Their checkbox is
 * disabled in the dialog, so a browser sends nothing for it.
 *
 * And the ticks are intersected with the roster the dialog actually drew, so a
 * hand-posted id for somebody outside the workspace never reaches the table.
 */
async function saveViewers(
  formData: FormData,
  table: "whitbyos_workplan_viewers" | "whitbyos_workstream_viewers",
  column: "workplan_id" | "workstream_id",
  targetId: string,
  ownerUserId: string | null,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const roster = new Set(formData.getAll("candidate").map((value) => String(value)));
  const ticked = formData
    .getAll("viewer")
    .map((value) => String(value))
    .filter((id) => roster.has(id));

  const chosen = new Set(ticked);
  if (ownerUserId) chosen.add(ownerUserId);

  const { error: cleared } = await supabase.from(table).delete().eq(column, targetId);
  if (cleared) return cleared.message;

  // Everyone on the roster is chosen, so there is nothing to narrow.
  const everyone = [...roster].every((id) => chosen.has(id));
  if (everyone) return null;

  const { error } = await supabase
    .from(table)
    .insert([...chosen].map((userId) => ({ [column]: targetId, user_id: userId })));

  return error ? error.message : null;
}

/**
 * WP.17v's client-portal switch (client-portal/013).
 *
 * Written only when the dialog drew the switch — `client_present` says so —
 * so a form that never carried it cannot be read as an answer to it.
 *
 * The timestamp is left alone when the answer has not changed, so "shared"
 * dates from when the plan was shared rather than from the last save of the
 * dialog.
 */
async function saveClientShare(
  formData: FormData,
  planId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  if (formData.get("client_present") !== "1") return null;
  const share = formData.get("client_share") === "1";

  const { data: current, error: readError } = await supabase
    .from("whitbyos_workplans")
    .select("client_shared_at")
    .eq("id", planId)
    .maybeSingle();
  if (readError) return readError.message;
  if (share === Boolean(current?.client_shared_at)) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("whitbyos_workplans")
    .update(
      share
        ? { client_shared_at: new Date().toISOString(), client_shared_by_user_id: user?.id ?? null }
        : { client_shared_at: null, client_shared_by_user_id: null },
    )
    .eq("id", planId);

  return error ? error.message : null;
}

/** WP.17v — Work Plan Visibility. */
export async function savePlanVisibility(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) redirect(LIST);

  const { supabase } = await requirePlan(planId);

  // `requirePlan` proves the plan is this workspace's; the owner is a separate
  // read because nothing else that calls it needs the column.
  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("owner_user_id")
    .eq("id", planId)
    .maybeSingle();

  const failed = await saveViewers(
    formData,
    "whitbyos_workplan_viewers",
    "workplan_id",
    planId,
    (plan?.owner_user_id as string | null) ?? null,
    supabase,
  );
  if (failed) backWithError(planPath(planId), "visibility=plan", failed);

  const shareFailed = await saveClientShare(formData, planId, supabase);
  if (shareFailed) backWithError(planPath(planId), "visibility=plan", shareFailed);

  revalidatePath(planPath(planId));
  redirect(planPath(planId));
}

/** WP.17u — Work Stream Visibility. */
export async function saveStreamVisibility(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  const streamId = String(formData.get("workstream_id") ?? "").trim();
  if (!planId || !streamId) redirect(LIST);

  const { supabase } = await requirePlan(planId);

  // The stream has to belong to this plan, or the id in the URL decides which
  // row is written rather than the plan the person is looking at.
  const { data: stream } = await supabase
    .from("whitbyos_workstreams")
    .select("id, owner_user_id")
    .eq("id", streamId)
    .eq("workplan_id", planId)
    .maybeSingle();
  if (!stream) redirect(planPath(planId));

  const failed = await saveViewers(
    formData,
    "whitbyos_workstream_viewers",
    "workstream_id",
    streamId,
    (stream.owner_user_id as string | null) ?? null,
    supabase,
  );
  if (failed) backWithError(planPath(planId), `visibility=stream&vstream=${streamId}`, failed);

  // The stream's client-portal switch, under the same `client_present` rule as
  // the plan's. Ticked means shown, so what is stored is the untick.
  if (formData.get("client_present") === "1") {
    const { error } = await supabase
      .from("whitbyos_workstreams")
      .update({ client_hidden: formData.get("client_share") !== "1" })
      .eq("id", streamId)
      .eq("workplan_id", planId);
    if (error) backWithError(planPath(planId), `visibility=stream&vstream=${streamId}`, error.message);
  }

  revalidatePath(planPath(planId));
  redirect(planPath(planId));
}

// ---------------------------------------------------------------------------
// Asking the client for their half of the plan
// ---------------------------------------------------------------------------

/**
 * Sends the client, in one message, everything the plan needs from them.
 *
 * Every task has carried `required_inputs` since migration 074, and the task
 * screen has printed "not held yet" beside each one ever since. That was never
 * a fact: nothing checked whether the firm held it, there was no way for the
 * client to hand it over, and the words did not change once it arrived. This
 * is the other half.
 *
 * One Form and one submission for the whole plan, not one per task. A client
 * asked sixteen times for four documents answers none of them, and the same
 * passport is wanted by three different tasks — `clientNeeds` folds those into
 * one question. Asking again reuses the same submission, so answers already
 * given stay given and nobody is asked twice for what they have already sent.
 *
 * Nothing here records what has been received. That is read back off the
 * client's own answers (see `plan-requirements.ts`), because a received flag
 * written on this side would be the firm asserting something about the client.
 *
 * Nothing reaches the client without somebody pressing something. Whitby finds
 * what the work needs and stops there; this runs from a button a professional
 * presses, and it is the only path from a drafted requirement to a client's
 * form. No draft, no schedule and no background job calls it.
 */
export async function askClientForRequirements(formData: FormData) {
  await sendClientAsk(formData, null);
}

/**
 * Approving one, on its row.
 *
 * Approve All is one press for a list somebody has read, and this is the other
 * half of that: the rows go out one at a time, in whatever order they are
 * approved, and the ones nobody has decided about yet stay where they are. The
 * client's form is added to rather than replaced, so approving a second thing
 * an hour later puts it on the form they already have.
 *
 * The slug is bound into the action rather than posted as the button's name
 * and value: React uses a submit button's `name` to say which server action to
 * run, so a name of our own would be overwritten on the server and never
 * arrive. Same reason as `dropClientNeed`.
 */
export async function approveClientNeed(slug: string, formData: FormData) {
  await sendClientAsk(formData, [slug]);
}

async function sendClientAsk(formData: FormData, only: string[] | null) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) redirect(LIST);

  const back = returnTo(formData, planId);
  const { supabase, workspaceId, requestId } = await requirePlan(planId);

  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("id, name, client_ask_submission_id, client_ask_extra, client_ask_skip, client_ask_proposals")
    .eq("id", planId)
    .maybeSingle();

  if (!plan) redirect(LIST);

  const edits = readNeedEdits(plan.client_ask_extra, plan.client_ask_skip);

  /*
   * The plan as the screen reads it, not a second reading of my own.
   *
   * This used to run its own two queries for the streams and their tasks, and
   * one of them ordered by a column that does not exist: PostgREST answered
   * with an error and no rows, an empty task list is a plan that needs nothing
   * from anybody, and the button redirected saying so while the panel above it
   * listed twenty things. Two readings of the same plan can disagree, and when
   * they do it is always the one nobody can see that is wrong.
   *
   * `getWorkPlan` is heavier than two selects. It is also exactly what drew
   * the list being submitted, which is worth more than the milliseconds.
   */
  const detail = await getWorkPlan(planId);
  if (!detail) redirect(LIST);

  const streams: NeedSource[] = detail.workstreams;

  // The panel posts one `ask` per ticked need. A browser posts nothing at all
  // for an unticked box, so the list that arrives *is* the answer — which is
  // also why `scope=all` exists: the Ask again button carries no boxes, and an
  // absent list there means "everything", not "nothing".
  const all = clientNeeds(streams, edits);
  const wanted = new Set(formData.getAll("ask").map((value) => String(value)));

  /*
   * Three shapes, one action.
   *
   *   "all"     everything, however the boxes stand. Nothing sends this today;
   *             it exists so a caller with no boxes to post cannot mean
   *             "nothing" by accident.
   *   "remind"  no new questions at all. The form already holds what is
   *             outstanding, so this bumps the date and sends the message
   *             again, which is the whole of what chasing somebody is.
   *   default   the ticked ones.
   */
  const scope = String(formData.get("scope") ?? "");
  // One approved on its own row. It is neither a chase nor a reading of the
  // ticks: the row that was pressed is the answer, whatever else is ticked.
  const remind = !only && scope === "remind";
  const needs = only
    ? all.filter((need) => only.includes(need.slug))
    : remind
      ? []
      : scope === "all"
        ? all
        : all.filter((need) => wanted.has(need.slug));

  if (all.length === 0) {
    backWithError(back, "ask=1", "This plan does not need anything from anybody else.");
  }

  if (!remind && needs.length === 0) {
    backWithError(
      back,
      "ask=1",
      only
        ? "That one is no longer on the plan, so there was nothing to send."
        : "Nothing is ticked, so there is nothing to approve.",
    );
  }

  const { data: request } = await supabase
    .from("whitbyos_requests")
    .select("id, title, client_id")
    .eq("id", requestId)
    .maybeSingle();

  const clientId = (request?.client_id as string | null) ?? null;
  if (!clientId) {
    backWithError(
      back,
      "ask=1",
      "This plan's request has no client on it, so there is nobody to send it to. Add a client to the request first.",
    );
  }

  // Nobody named means the client's primary contact, the same rule `sendForm`
  // follows. A submission addressed to no one shows a dash in 11.2's Sent To.
  const { data: client } = await supabase
    .from("whitbyos_clients")
    .select("primary_contact_id")
    .eq("id", clientId)
    .maybeSingle();

  const contactId = (client?.primary_contact_id as string | null) ?? null;

  /* First name only, because the message opens "Hello Rohail," and a greeting
     carrying somebody's full legal name reads like a letter from a bank.
     `contacts` holds it split already; there is no `full_name` column. */
  const { data: contact } = contactId
    ? await supabase.from("contacts").select("first_name").eq("id", contactId).maybeSingle()
    : { data: null };

  /* The first word of it, because the column does not always hold only a
     first name: two of this workspace's contacts have "Rohail Khan" in it,
     and "Hello Rohail Khan," is the bank letter again. */
  const contactName =
    ((contact?.first_name as string | null) ?? "").trim().split(/\s+/)[0] || null;

  /*
   * What the firm is suggesting, for the needs it can draft.
   *
   * Read here rather than passed in: this action runs from four buttons and
   * an argument threaded through all of them would be stale on one of them.
   */
  const stored = readProposals(plan.client_ask_proposals);

  /*
   * What is on the screen wins over what is in the table.
   *
   * The suggestion boxes sit in this same form, and only "Save suggestions"
   * was reading them. So somebody who corrected a menu and then pressed
   * Approve and send sent the uncorrected one: their edit was dropped in
   * silence and the client got the firm's earlier wording under the firm's
   * name. The boxes are posted either way, so they are read either way.
   *
   * Only the keys that were actually posted. A row that was not on the
   * screen must not have its suggestion deleted by a form that never
   * carried it.
   */
  const proposals = { ...stored };
  let edited = false;

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("proposal_")) continue;

    const slug = key.slice("proposal_".length);
    if (!slug) continue;

    const text = String(value ?? "").trim();
    if (text === (stored[slug] ?? "")) continue;

    if (text) proposals[slug] = text;
    else delete proposals[slug];
    edited = true;
  }

  if (edited) {
    await supabase
      .from("whitbyos_workplans")
      .update({ client_ask_proposals: proposals })
      .eq("id", planId);
  }

  /*
   * The suggestion goes into the answer box, not beside it.
   *
   * That is what makes approving it the default: the client opens the form,
   * reads what we put, and either leaves it or changes it. A suggestion shown
   * as a note above an empty box asks them to copy it out.
   *
   * `answeredNeeds` knows to discount an untouched suggestion until the form
   * is actually sent back, so the plan never counts its own words as theirs.
   */
  const seeded: Record<string, string> = {};

  const title = `What we need from you: ${plan.name}`;
  const asked = needSections(needs).flatMap((section) =>
    section.needs.map((need) => ({
      id: needFieldId(need.slug),
      label: need.label,
      /*
       * A suggestion goes out as a box with our own first version in it, so
       * it has to be the type that can hold one. `needFieldType` answers for
       * the kind of thing being asked for; this answers for how it is being
       * asked, and how wins.
       *
       * Every proposable need, not only the ones that actually carry a
       * suggestion. `needFieldType` makes an approval a Yes/No toggle, which
       * is right for "do you agree" and wrong here: sent without a
       * suggestion, "Family approval of the running order" reached the
       * client as a switch asking them to approve something they had never
       * been shown. A box they can write in is the honest worst case.
       */
      type: need.proposable ? "long" : needFieldType(need.kind),
      // Deliberately not required. A client who cannot lay hands on one of six
      // documents today must still be able to send the other five, and a form
      // that refuses to submit until everything is there comes back empty.
      required: false,
      section: section.title,
      sectionBlurb: section.blurb,
      /*
       * What it is for and what it is holding up, in the client's own words.
       *
       * This line named a step of ours — "Needed for: Submit form VAF1A" —
       * which is the firm's filing rather than a reason, and the message that
       * came back was always the same one: what do you need this for? The
       * plan records why each thing is wanted and what waits on it, so the
       * person being asked is told that.
       *
       * Where is left off deliberately. They are reading this on the form, in
       * the portal, so "upload it to the portal" is noise here; it is said on
       * our side, where somebody may be about to ask them to post it. And the
       * step is still named where nothing said why, so the line is never
       * empty.
       */
      help:
        [
          /*
           * Said first, and only where there is one.
           *
           * The client opens the form and finds words already in a box.
           * Nothing anywhere told them those words are ours, or that
           * changing them is allowed, or that leaving them alone is how you
           * agree. Without this line a suggestion reads as something they
           * typed and forgot, or as a field they must not touch.
           */
          need.proposable && proposals[need.slug]
            ? "Our suggestion. Change anything you like, or leave it as it is to agree."
            : null,
          need.why,
          needWhen(need, need.dueBy ? shortDate(need.dueBy) : null),
        ]
          .filter(Boolean)
          .join(" · ") ||
        (need.neededBy.length === 1
          ? `Needed for: ${need.neededBy[0]}`
          : need.neededBy.length > 1
            ? `Needed for ${need.neededBy.length} steps, starting with ${need.neededBy[0]}`
            : ""),
    })),
  );

  for (const need of needs) {
    const suggestion = need.proposable ? proposals[need.slug]?.trim() : "";
    if (suggestion) seeded[needFieldId(need.slug)] = suggestion;
  }

  const now = new Date().toISOString();
  let submissionId = (plan.client_ask_submission_id as string | null) ?? null;
  // What actually went out, for the line the professional comes back to.
  let added = asked.length;

  if (submissionId) {
    const { data: existing } = await supabase
      .from("whitbyos_form_submissions")
      .select("id, form_id, form:whitbyos_forms!form_id (fields)")
      .eq("id", submissionId)
      .maybeSingle();

    if (existing) {
      /*
       * Added to, never replaced.
       *
       * A question already on the form is one the client is already looking
       * at, and rewriting the list from whatever happens to be ticked today
       * would take it off them mid answer. So the existing fields are kept in
       * their own order and only genuinely new ones are appended, which is
       * also what lets the panel stop offering a box beside something it has
       * already asked for.
       */
      const form = Array.isArray(existing.form) ? existing.form[0] : existing.form;
      const kept = Array.isArray(form?.fields) ? form.fields : [];
      const held = new Set(
        kept
          .map((field) => (field as { id?: unknown })?.id)
          .filter((id): id is string => typeof id === "string"),
      );

      const fresh = asked.filter((field) => !held.has(field.id));
      added = fresh.length;

      await supabase
        .from("whitbyos_forms")
        .update({ title, fields: [...kept, ...fresh], updated_at: now })
        .eq("id", existing.form_id);

      /*
       * Seed only the questions going out for the first time.
       *
       * A field already on the form may carry an answer the client has
       * written, and writing our suggestion over it would be the firm
       * deleting their work and calling it a proposal.
       */
      const freshSeed: Record<string, string> = {};
      for (const field of fresh) {
        if (seeded[field.id]) freshSeed[field.id] = seeded[field.id];
      }

      const { data: standing } = await supabase
        .from("whitbyos_form_submissions")
        .select("responses")
        .eq("id", existing.id)
        .maybeSingle();

      const standingAnswers =
        standing?.responses &&
        typeof standing.responses === "object" &&
        !Array.isArray(standing.responses)
          ? (standing.responses as Record<string, string>)
          : {};

      await supabase
        .from("whitbyos_form_submissions")
        .update({
          status: "awaiting",
          sent_at: now,
          sent_to_contact_id: contactId,
          responses: { ...standingAnswers, ...freshSeed },
        })
        .eq("id", existing.id);
    } else {
      // The form was deleted out from under the plan. Start again rather than
      // updating nothing and telling the professional it was sent.
      submissionId = null;
    }
  }

  if (!submissionId) {
    const { data: form, error: formError } = await supabase
      .from("whitbyos_forms")
      .insert({
        workspace_id: workspaceId,
        title,
        // Not a template: this belongs to one plan and is never reused for a
        // different client, which is what keeps it off the Templates tab —
        // `listForms` reads this column. It did not always, and for a while
        // this comment was describing something nothing did.
        is_template: false,
        // The client-side RLS gates on exactly this value, so a form sent to a
        // client that is not client visible is a form they cannot open.
        visibility: "client_visible",
        category: "Onboarding",
        fields: asked,
      })
      .select("id")
      .single();

    if (formError || !form) {
      backWithError(back, "ask=1", formError?.message ?? "Could not build the form.");
    }

    const { data: submission, error: sendError } = await supabase
      .from("whitbyos_form_submissions")
      .insert({
        form_id: form.id,
        client_id: clientId,
        request_id: requestId,
        sent_to_contact_id: contactId,
        sent_at: now,
        status: "awaiting",
        responses: seeded,
      })
      .select("id")
      .single();

    if (sendError || !submission) {
      // Take the form back with it. A form standing on its own is invisible to
      // the client and clutter to everybody else.
      await supabase.from("whitbyos_forms").delete().eq("id", form.id);
      backWithError(back, "ask=1", sendError?.message ?? "Could not send it.");
    }

    submissionId = submission.id as string;

    const { error: linkError } = await supabase
      .from("whitbyos_workplans")
      .update({ client_ask_submission_id: submissionId })
      .eq("id", planId);

    if (linkError) {
      backWithError(
        back,
        "ask=1",
        "It was sent, but the plan could not record it, so this screen will not show what comes back. Tell support before asking again.",
      );
    }
  }

  const href = clientAskHref(submissionId);

  /*
   * Two deliveries, because they answer different questions.
   *
   * The bell says something arrived; the message is what they find when they
   * open the conversation and ask what it is about. `form_requested` is the
   * event a client can switch off on their Notifications screen and `forms` is
   * the area they have to be able to reach — an ask sent to somebody with no
   * access to Forms is an ask they cannot answer, and `notifyClientContacts`
   * is what refuses it.
   */
  await notifyClientContacts({
    workspaceId,
    clientId,
    event: "form_requested",
    area: "forms",
    title: remind
      ? "A reminder about what your team needs"
      : "Your team needs a few things from you",
    body: remind
      ? `Still waiting on you for ${plan.name}. Open the form to upload or answer.`
      : `${added} ${added === 1 ? "item" : "items"} for ${plan.name}. Open the form to upload or answer.`,
    href,
    entityType: "form_submission",
    entityId: submissionId,
    // The person the submission is addressed to, the same rule `sendForm`
    // follows. Null is everybody on the account, which is right when nobody
    // in particular was named.
    onlyContactIds: contactId ? [contactId] : null,
  });

  await postClientAskMessage({
    supabase,
    workspaceId,
    clientId,
    requestId,
    contactId,
    contactName,
    planName: String(plan.name ?? "your plan"),
    count: added,
    remind,
    // The plan already had an ask before this press, so the client is not
    // meeting the form for the first time.
    followUp: Boolean(plan.client_ask_submission_id),
    href,
  });

  /*
   * Revalidated, not redirected.
   *
   * This used to land on `?asked=N`, which is a navigation to the page
   * somebody is already on: the screen blanked and came back, several seconds
   * after a button that had given no sign of life in between. The button says
   * "Sending" and then "Sent" itself now, and the rows moving from For your
   * approval to Waiting is the confirmation that actually matters.
   *
   * `?asked=` and `?reminded=` still work if somebody arrives on one, which
   * is why the panel still reads them. Nothing here produces one.
   */
  revalidatePath(ROUTE, "page");
}

/**
 * The message that lands in the client's Messages, beside the notification.
 *
 * Into the conversation that person already has, when the ask goes to one
 * person. It used to open a thread of its own for each Request — kind "group",
 * named "What we need from you: <plan>" — which put a message written to one
 * contact on a tab of the inbox nobody looks at, beside the direct conversation
 * with the same person. Somebody sending an ask could not then find what they
 * had sent.
 *
 * An ask with nobody to name still gets a thread of its own: it is addressed to
 * the client account rather than to a person, and there is no conversation to
 * put it in.
 *
 * Either way the *message* carries the Request, so the Request's own Messages
 * tab lists the conversation whether or not the thread itself is filed there.
 *
 * Best effort throughout: a message that fails to write must not undo a form
 * that was sent, and the notification has already told them.
 */
/**
 * The direct conversation with one contact about one Request, if there is one.
 *
 * The same question `startDirect` answers in `messages/actions.ts`: a direct
 * thread in this workspace whose live participants, other than the firm's own
 * people, are that one person — and which is about the same work, because a
 * conversation carries the Request it belongs to and an ask about the Lagos
 * move does not belong in the thread about their probate.
 */
async function directThreadWith(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  contactId: string,
  requestId: string | null,
): Promise<string | null> {
  const { data: theirs } = await supabase
    .from("whitbyos_message_participants")
    .select("thread_id")
    .eq("participant_type", "contact")
    .eq("participant_id", contactId)
    .is("removed_at", null);

  const ids = [...new Set((theirs ?? []).map((row) => row.thread_id as string))];
  if (ids.length === 0) return null;

  const [{ data: direct }, { data: everyone }] = await Promise.all([
    supabase
      .from("whitbyos_message_threads")
      .select("id, last_message_at, created_at, request_id")
      .in("id", ids)
      .eq("workspace_id", workspaceId)
      .eq("kind", "direct"),
    supabase
      .from("whitbyos_message_participants")
      .select("thread_id, participant_type")
      .in("thread_id", ids)
      .is("removed_at", null),
  ]);

  const contacts = new Map<string, number>();
  for (const row of everyone ?? []) {
    if (row.participant_type !== "contact") continue;
    const id = row.thread_id as string;
    contacts.set(id, (contacts.get(id) ?? 0) + 1);
  }

  const found = (direct ?? [])
    .filter((row) => contacts.get(row.id as string) === 1)
    .filter((row) => ((row.request_id as string | null) ?? null) === requestId)
    .sort((a, b) =>
      String(b.last_message_at ?? b.created_at).localeCompare(
        String(a.last_message_at ?? a.created_at),
      ),
    )[0];

  return (found?.id as string | null) ?? null;
}

async function postClientAskMessage(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspaceId: string;
  clientId: string;
  requestId: string;
  contactId: string | null;
  /** Who it is addressed to, for the greeting. Null where nobody is named. */
  contactName: string | null;
  planName: string;
  count: number;
  /** A chase rather than a new ask: nothing was added to the form. */
  remind: boolean;
  /** Added to a form the client already has, rather than the first ask. */
  followUp: boolean;
  href: string;
}) {
  const { supabase } = input;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    /*
     * Three messages, because three different things happen.
     *
     * One body served all of them, so a plan asked for four more things sent
     * the client the same six lines it had sent an hour earlier, headed "We
     * have everything on our side ready" over work already under way. Three
     * identical bubbles in a row is how somebody learns to stop reading them.
     *
     * The link is gone with it. This is read inside the portal, where a bare
     * "/client-portal/forms/82b6566f…" is not clickable and not a sentence;
     * the bell notice carries the link and opens it on a press.
     */
    const items = input.count === 1 ? "one item" : `${input.count} items`;

    /*
     * Written as a letter, not as a notification.
     *
     * It arrives in the client's Messages, between things people typed, and
     * it was one unbroken paragraph beginning "We have started on Test 06" —
     * no greeting, no close, three separate points run together. That reads
     * as a system talking, and the whole product's case is that a person is
     * handling this.
     *
     * A greeting, a paragraph per point, and a close. The blank lines survive
     * both sides: the bubble is `whitespace-pre-wrap` in the portal and in
     * the firm's own Messages.
     */
    const hello = input.contactName ? `Hello ${input.contactName},` : "Hello,";

    // Every one of the three says where to go. A message that names something
    // to do and not the screen to do it on leaves somebody hunting for it.
    const where = "You will find the form under Forms in your portal.";

    const body = input.remind
      ? [
          hello,
          `This is a reminder about the form we sent you for ${input.planName}. It is still waiting, and anything you are able to send now will help the next steps along.`,
          `You do not have to complete it all at once. ${where}`,
          "Thank you.",
        ].join("\n\n")
      : input.followUp
        ? [
            hello,
            `We have added ${items} to the form we sent you for ${input.planName}.`,
            `Everything you have already sent is still on it, and you can complete the new items in any order. ${where}`,
            "Thank you.",
          ].join("\n\n")
        : [
            hello,
            `We have now started ${input.planName}, and there ${input.count === 1 ? "is" : "are"} ${items} we need from you before we can proceed with the next steps.`,
            `All the required information is included in one form, and you can complete the items in any order. ${where}`,
            "Please complete the form at your convenience. Once it has been submitted, we can proceed with the next steps.",
            "Thank you.",
          ].join("\n\n");

    let threadId = input.contactId
      ? await directThreadWith(supabase, input.workspaceId, input.contactId, input.requestId)
      : null;

    // Nobody to write to: fall back to the conversation this Request already
    // has. With a contact, a conversation of their own is started below rather
    // than dropping an ask meant for one person into whatever else is filed
    // under this Request.
    if (!threadId && !input.contactId) {
      const { data: open } = await supabase
        .from("whitbyos_message_threads")
        .select("id")
        .eq("request_id", input.requestId)
        .eq("client_id", input.clientId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      threadId = (open?.id as string | null) ?? null;
    }

    if (!threadId) {
      const { data: thread } = await supabase
        .from("whitbyos_message_threads")
        .insert({
          workspace_id: input.workspaceId,
          subject: `What we need from you: ${input.planName}`,
          /*
           * You and one client contact is a direct conversation, and was being
           * written as a group — so an ask sent from a Work Plan arrived on
           * the Group tab, under a name nobody had made, beside the groups
           * somebody had. With nobody to name it is addressed to the account,
           * which is the one case a group is what it is.
           */
          kind: input.contactId ? "direct" : "group",
          request_id: input.requestId,
          client_id: input.clientId,
          last_message_at: new Date().toISOString(),
          created_by_user_id: user.id,
        })
        .select("id")
        .single();

      if (!thread) return;
      threadId = thread.id as string;

      // Without participants the thread has no recipients and the client
      // cannot see it, so it is taken back rather than left standing.
      const people = [
        {
          thread_id: threadId,
          participant_type: "user",
          participant_id: user.id,
          added_by_user_id: user.id,
          last_read_at: new Date().toISOString(),
        },
        ...(input.contactId
          ? [
              {
                thread_id: threadId,
                participant_type: "contact",
                participant_id: input.contactId,
                added_by_user_id: user.id,
              },
            ]
          : []),
      ];

      const { error: peopleError } = await supabase
        .from("whitbyos_message_participants")
        .insert(people);

      if (peopleError) {
        await supabase.from("whitbyos_message_threads").delete().eq("id", threadId);
        return;
      }
    }

    await supabase.from("whitbyos_messages").insert({
      workspace_id: input.workspaceId,
      thread_id: threadId,
      request_id: input.requestId,
      client_id: input.clientId,
      sender_type: "user",
      sender_id: user.id,
      body,
      status: "sent",
      source: "whitbyos",
    });

    await supabase
      .from("whitbyos_message_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);
  } catch {
    // Same contract as notify.ts: a notice that fails must not fail the thing
    // it was about.
  }
}

/**
 * Asking for something no task named.
 *
 * The drafter is a good first pass, not the last word. Work turns things up
 * after a plan is drawn — a registrar wants a photograph, a school wants a
 * reference — and until now the only way to ask a client for one of those was
 * to go and edit a task's required inputs, which changes the plan in order to
 * change a message.
 *
 * Kept on the plan (migration 079) rather than written back into a task for
 * exactly that reason.
 */
export async function addClientNeed(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) redirect(LIST);

  const back = returnTo(formData, planId);
  const { supabase } = await requirePlan(planId);

  const label = String(formData.get("label") ?? "").trim();
  const raw = String(formData.get("kind") ?? "document");
  const kind = NEED_KINDS.has(raw) ? raw : "document";
  /* What it is for, where they said. Optional: somebody with the client on
     the phone should not be stopped by a second box. */
  const why = String(formData.get("why") ?? "").trim().slice(0, 200);

  if (label.length < 3) {
    backWithError(back, "ask=1", "Say what to ask the client for, in a few words at least.");
  }

  const slug = needSlug(label);
  if (!slug) {
    backWithError(
      back,
      "ask=1",
      "That name is all punctuation, so there is nothing to file it under. Use some words.",
    );
  }

  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("client_ask_extra, client_ask_skip")
    .eq("id", planId)
    .maybeSingle();

  const edits = readNeedEdits(plan?.client_ask_extra, plan?.client_ask_skip);
  const extra = edits.extra ?? [];

  if (extra.some((one) => one.slug === slug)) {
    backWithError(back, "ask=1", "That is already on the list.");
  }

  const { error } = await supabase
    .from("whitbyos_workplans")
    .update({
      client_ask_extra: [...extra, { slug, label, kind, why: why || null }],
      // Adding something back that was removed is how somebody undoes a
      // removal, so the skip has to let go of it or nothing would appear.
      client_ask_skip: (edits.skip ?? []).filter((one) => one !== slug),
    })
    .eq("id", planId);

  if (error) backWithError(back, "ask=1", error.message);

  revalidatePath(ROUTE, "page");
  redirect(back);
}

/**
 * Taking something off the list.
 *
 * The requirement stays on its task: it is still true that the work needs it,
 * and the only thing being decided here is whether this client is the one to
 * produce it. What does go is the question itself — if the ask has already
 * been sent, the field comes off the form, because leaving it there asks the
 * client for something the firm has decided not to want.
 */
export async function dropClientNeed(bound: string, formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) redirect(LIST);

  const back = returnTo(formData, planId);
  const { supabase } = await requirePlan(planId);

  /*
   * Bound into the action, not posted as the button's own name and value.
   *
   * A button carrying `formAction={someServerAction}` has its `name` taken by
   * React to encode which action to run, so a `name="slug"` on it is both
   * overwritten on the server and left alone on the client: the page warns
   * about a hydration mismatch, and the slug never arrives, so pressing the
   * button did nothing at all. Binding is how a per-row server action is given
   * its row.
   */
  const slug = bound.trim();
  if (!slug) redirect(back);

  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("client_ask_extra, client_ask_skip, client_ask_submission_id")
    .eq("id", planId)
    .maybeSingle();

  const edits = readNeedEdits(plan?.client_ask_extra, plan?.client_ask_skip);
  const skip = edits.skip ?? [];

  const { error } = await supabase
    .from("whitbyos_workplans")
    .update({
      // Dropped from both: one for a gathered need, the other for one added by
      // hand. A need that was added and then removed should leave no trace.
      client_ask_extra: (edits.extra ?? []).filter((one) => one.slug !== slug),
      client_ask_skip: skip.includes(slug) ? skip : [...skip, slug],
    })
    .eq("id", planId);

  if (error) backWithError(back, "ask=1", error.message);

  const submissionId = (plan?.client_ask_submission_id as string | null) ?? null;
  if (submissionId) {
    const { data: submission } = await supabase
      .from("whitbyos_form_submissions")
      .select("form_id, form:whitbyos_forms!form_id (fields)")
      .eq("id", submissionId)
      .maybeSingle();

    const form = Array.isArray(submission?.form) ? submission.form[0] : submission?.form;
    const fields = Array.isArray(form?.fields) ? form.fields : [];
    const fieldId = needFieldId(slug);
    const left = fields.filter((field) => (field as { id?: unknown })?.id !== fieldId);

    // Only when it was actually on the form. An untouched form is not rewritten
    // and its `updated_at` does not move.
    if (left.length !== fields.length) {
      await supabase
        .from("whitbyos_forms")
        .update({ fields: left, updated_at: new Date().toISOString() })
        .eq("id", submission!.form_id);
    }
  }

  revalidatePath(ROUTE, "page");
  redirect(back);
}

/**
 * A task dropped somewhere: into another column, or between two others.
 *
 * One action for every view, because a drop means the same thing wherever it
 * happens — this task now sits here. What "here" is depends on what the board
 * is grouped by, which the caller says: a status column sets the status, a
 * stream column moves it into that Work Stream, an owner column hands it over.
 * The list, the table and the grid group by nothing and only reorder.
 *
 * Order is a float between the neighbours it was dropped between (091), so a
 * drop writes one row rather than renumbering the column under it. Dropped at
 * the end, it takes the last order plus one; dropped at the top, half the
 * first.
 */
export async function dropTask(input: {
  planId: string;
  taskId: string;
  /** What the board is grouped by, where it is grouped at all. */
  group?: "status" | "stream" | "owner" | null;
  /** The column it was dropped into: a status, a stream id, or a user id. */
  lane?: string | null;
  /** The task it was dropped above, or null for the end of the column. */
  beforeId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  await stopIfReadOnly();

  const { supabase } = await requirePlan(input.planId);
  const streams = await planStreamIds(supabase, input.planId);

  const { data: task } = await supabase
    .from("whitbyos_tasks")
    .select("id, workstream_id, status, owner_user_id")
    .eq("id", input.taskId)
    .maybeSingle();

  if (!task || !streams.has(task.workstream_id as string)) {
    return { ok: false, error: "That task is not on this plan." };
  }

  const patch: Record<string, unknown> = {};

  if (input.group === "status" && input.lane) {
    if (!TASK_STATUSES.has(input.lane)) return { ok: false, error: "Unknown column." };
    patch.status = input.lane;
    // The same rule every other status write follows: finishing stamps the
    // day, reopening clears it.
    patch.completed_at = DONE.has(input.lane) ? new Date().toISOString() : null;
  }

  if (input.group === "stream" && input.lane) {
    if (!streams.has(input.lane)) return { ok: false, error: "That Work Stream is not on this plan." };
    patch.workstream_id = input.lane;
  }

  if (input.group === "owner") {
    // An empty lane key is the "Unassigned" column, which is a real answer.
    patch.owner_user_id = input.lane || null;
  }

  /*
   * Where it sits among the tasks it landed beside.
   *
   * Read from the column it is now in — its new stream where one was chosen,
   * its own otherwise — because that is the list the neighbours belong to.
   */
  const streamId = (patch.workstream_id as string) ?? (task.workstream_id as string);

  const { data: siblings } = await supabase
    .from("whitbyos_tasks")
    .select("id, sort_order, created_at")
    .eq("workstream_id", streamId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at");

  const ordered = (siblings ?? []).filter((row) => row.id !== input.taskId);

  /** Where a row sits now, falling back to its place in the read order. */
  const orderOf = (row: { sort_order: number | null }, index: number) =>
    row.sort_order ?? index + 1;

  let place: number;

  if (!input.beforeId) {
    const last = ordered[ordered.length - 1];
    place = ordered.length === 0 ? 1 : orderOf(last as never, ordered.length - 1) + 1;
  } else {
    const at = ordered.findIndex((row) => row.id === input.beforeId);
    if (at === -1) {
      const last = ordered[ordered.length - 1];
      place = ordered.length === 0 ? 1 : orderOf(last as never, ordered.length - 1) + 1;
    } else {
      const after = orderOf(ordered[at] as never, at);
      const before = at === 0 ? after - 2 : orderOf(ordered[at - 1] as never, at - 1);
      place = (before + after) / 2;
    }
  }

  patch.sort_order = place;

  const { error } = await supabase
    .from("whitbyos_tasks")
    .update(patch)
    .eq("id", input.taskId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(ROUTE, "page");
  return { ok: true };
}

/**
 * A Work Stream dragged into a different place in the plan.
 *
 * The Grid is a card per stream, so what moves there is the stream itself, and
 * `sort_order` is what every view already reads them in.
 *
 * Renumbered rather than given a midpoint: this column is an integer and a
 * plan has a handful of streams, so writing 1..n is both correct and cheap.
 * A task's order is a float precisely because there can be hundreds of them.
 */
export async function dropWorkstream(input: {
  planId: string;
  streamId: string;
  /** The stream it was dropped in front of, or null for the end. */
  beforeId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  await stopIfReadOnly();

  const { supabase } = await requirePlan(input.planId);

  const { data: rows } = await supabase
    .from("whitbyos_workstreams")
    .select("id, sort_order")
    .eq("workplan_id", input.planId)
    .order("sort_order");

  const all = (rows ?? []).map((row) => row.id as string);
  if (!all.includes(input.streamId)) {
    return { ok: false, error: "That Work Stream is not on this plan." };
  }

  const without = all.filter((id) => id !== input.streamId);
  const at = input.beforeId ? without.indexOf(input.beforeId) : -1;

  const next =
    at === -1
      ? [...without, input.streamId]
      : [...without.slice(0, at), input.streamId, ...without.slice(at)];

  for (const [index, id] of next.entries()) {
    const { error } = await supabase
      .from("whitbyos_workstreams")
      .update({ sort_order: index + 1 })
      .eq("id", id);

    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(ROUTE, "page");
  return { ok: true };
}

/**
 * The drafting itself, once it is settled that it should happen.
 *
 * Lifted out of `buildWithWhitby` so the two ways into it read the same:
 * a description that left nothing to ask about goes straight here, and one
 * that raised questions comes here after they are answered or waved past.
 * Everything it reads, it reads itself — it runs inside `after`, where a
 * handful of quick queries costs nothing and passing eight arguments
 * through a second path costs a bug.
 */
async function runPlanDrafting({
  planId,
  planName,
  workspaceId,
  userId,
  requestId,
  name,
  prompt,
  clientId,
  clientName,
  targetDate,
  shape,
  answers,
}: {
  planId: string;
  planName: string;
  workspaceId: string;
  userId: string;
  requestId: string;
  name: string | null;
  prompt: string;
  clientId: string | null;
  clientName: string | null;
  targetDate: string | null;
  shape: { urgency: string; complexity: string; size: string };
  /** What came back from the questions, where there were any. */
  answers?: { question: string; answer: string }[];
}) {
  const service = await createClient();

  try {
    const [providers, workTypes, emailContext, knowledgeContext, { data: request }] =
      await Promise.all([
        listDraftableProviders(),
        getWorkTypes(),
        clientEmailContext(clientId),
        workspaceKnowledgeContext([name, prompt].filter(Boolean).join("\n"), clientId),
        /* What the Request already settles. It is read here rather than
           passed in because this runs from two places and one of them is a
           minute later, by which time an argument would be stale. */
        service
          .from("whitbyos_requests")
          .select("desired_outcome, definition_of_done")
          .eq("id", requestId)
          .maybeSingle(),
      ]);

    /*
     * The answers, folded into the description rather than sent beside it.
     *
     * `draftWorkplan` takes a description and several named contexts, and a
     * fifth context would be a fifth thing for its prompt to weigh. These
     * answers are not background: they are the professional correcting the
     * brief, so they belong in the brief, under a heading that says the
     * model asked for them.
     */
    const described = [
      prompt,
      request?.desired_outcome
        ? `\nWhat the Request says this is for:\n${request.desired_outcome as string}`
        : null,
      request?.definition_of_done
        ? `\nWhat the Request says finished looks like:\n${request.definition_of_done as string}`
        : null,
      answers?.length
        ? ["", "You asked about this work before drafting, and were told:", ...answers.map(
            (row) => `- ${row.question}\n  ${row.answer}`,
          )].join("\n")
        : null,
    ]
      .filter((part) => part !== null)
      .join("\n");

    const drafted = await draftWorkplan({
      workspaceId,
      providers,
      requestTitle: prompt.split("\n")[0]!.slice(0, 120),
      description: described,
      clientName: clientName ?? "the firm itself",
      workTypes,
      emailContext,
      knowledgeContext,
      shape,
      targetDate: targetDate || undefined,
    });

    if (!drafted.ok) {
      await service
        .from("whitbyos_workplans")
        .update({ drafting_state: "failed", drafting_error: drafted.error })
        .eq("id", planId);

      await notifyPeople({
        workspaceId,
        userIds: [userId],
        kind: "workplan_failed",
        title: `${planName} could not be drafted`,
        body: drafted.error,
        href: `${LIST}/${planId}`,
        entityType: "workplan",
        entityId: planId,
      });
      return;
    }

    const saved = await saveDraftedPlan({
      requestId,
      ownerUserId: userId,
      plan: drafted.data,
      name: name || null,
      targetDate: targetDate || null,
      intoWorkplanId: planId,
    });

    if (!saved.ok) {
      await service
        .from("whitbyos_workplans")
        .update({ drafting_state: "failed", drafting_error: saved.error })
        .eq("id", planId);
      return;
    }

    if (saved.gaps.length > 0) {
      const what: Record<string, string> = {
        steps: "the steps for its tasks",
        dates: "the dates worked back from the deadline",
        dependencies: "which tasks wait on which",
      };

      await service.from("whitbyos_considerations").insert({
        workplan_id: planId,
        type: "missing_info",
        body: `This plan was drafted but ${saved.gaps
          .map((gap) => what[gap] ?? gap)
          .join(" and ")} could not be saved. Ask Whitby to redo it, or fill them in by hand.`,
        source_reference: "Whitby, checking the plan after it was saved",
        status: "open",
      });
    }

    await service
      .from("whitbyos_workplans")
      .update({ drafting_state: "ready", drafting_error: null })
      .eq("id", planId);

    await notifyPeople({
      workspaceId,
      userIds: [userId],
      kind: "workplan_ready",
      title: `${planName} is ready`,
      body: clientName
        ? `Drafted for ${clientName}. Review and adjust before saving.`
        : "Review and adjust before saving.",
      href: `${LIST}/${planId}?review=whitby&whitby=1`,
      entityType: "workplan",
      entityId: planId,
    });
  } catch (error) {
    await service
      .from("whitbyos_workplans")
      .update({
        drafting_state: "failed",
        drafting_error:
          error instanceof Error ? error.message : "The drafting stopped unexpectedly.",
      })
      .eq("id", planId);
  }
}

/**
 * The answers, and then the drafting.
 *
 * One action for both buttons. "Skip for now" is the same submit with every
 * field left empty, rather than a second path: a plan drafted after three
 * answers and one blank is the same plan drafted after four blanks, and
 * writing that twice is how the two come to disagree.
 *
 * What is not answered is not lost. Each blank becomes a `missing_info`
 * consideration on the plan, which is where the model's own uncertainty has
 * always gone and what Insights already counts. Skipping moves the question
 * rather than dropping it.
 */
export async function answerPlanQuestions(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("id, name, request_id, drafting_state, drafting_questions, request:whitbyos_requests!request_id (workspace_id)")
    .eq("id", planId)
    .maybeSingle();

  const parent = Array.isArray(plan?.request) ? plan?.request[0] : plan?.request;
  if (!plan || parent?.workspace_id !== workspaceId) redirect(LIST);

  /* Already answered, or never asked. Pressing back and submitting again
     must not start a second drafting run over the first one's plan. */
  if (plan.drafting_state !== "asking") redirect(`${LIST}/${planId}`);

  const held = (plan.drafting_questions ?? {}) as {
    questions?: { question: string }[];
    ask?: {
      prompt?: string;
      name?: string | null;
      clientId?: string | null;
      clientName?: string | null;
      targetDate?: string | null;
      shape?: { urgency: string; complexity: string; size: string };
    };
  };

  const questions = held.questions ?? [];
  const ask = held.ask ?? {};

  const answered: { question: string; answer: string }[] = [];
  const unanswered: string[] = [];

  questions.forEach((row, index) => {
    const answer = String(formData.get(`answer_${index}`) ?? "").trim();
    if (answer) answered.push({ question: row.question, answer });
    else unanswered.push(row.question);
  });

  const planName = (plan.name as string | null) || "Your Work Plan";

  await supabase
    .from("whitbyos_workplans")
    .update({
      drafting_state: "drafting",
      drafting_answers: answered,
    })
    .eq("id", planId);

  /*
   * The blanks, on the plan, before it is written.
   *
   * Inserted now rather than after the save because the plan row already
   * exists and `saveDraftedPlan` only ever adds considerations, never
   * clears them — so these stand alongside whatever the model raises, which
   * is right: they are the same kind of thing from a different moment.
   */
  if (unanswered.length > 0) {
    await supabase.from("whitbyos_considerations").insert(
      unanswered.map((question) => ({
        workplan_id: planId,
        type: "missing_info",
        body: `${question} This was asked before the plan was drafted and left unanswered, so the plan assumes an answer.`,
        source_reference: "Whitby, before drafting",
        status: "open",
      })),
    );
  }

  after(async () => {
    await runPlanDrafting({
      planId,
      planName,
      workspaceId,
      userId: user.id,
      requestId: plan.request_id as string,
      name: ask.name ?? null,
      prompt: ask.prompt ?? "",
      clientId: ask.clientId ?? null,
      clientName: ask.clientName ?? null,
      targetDate: ask.targetDate ?? null,
      shape: ask.shape ?? { urgency: "medium", complexity: "moderate", size: "standard" },
      answers: answered,
    });

    revalidatePath(ROUTE, "page");
  });

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}/${planId}?drafting=1`);
}

/**
 * Keep the questions, come back later.
 *
 * The other half of the pair on that screen, and the only thing that makes
 * two buttons honest: this one does not draft. The plan stays in `asking`
 * with its questions against it, whatever has been typed is kept so it is
 * there on the way back, and the professional goes and finds out the answer
 * they did not have.
 *
 * Without it "Skip" and "Draft" were one outcome wearing two labels.
 */
export async function holdPlanQuestions(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("id, drafting_state, drafting_questions, request:whitbyos_requests!request_id (workspace_id)")
    .eq("id", planId)
    .maybeSingle();

  const parent = Array.isArray(plan?.request) ? plan?.request[0] : plan?.request;
  if (!plan || parent?.workspace_id !== workspaceId) redirect(LIST);
  if (plan.drafting_state !== "asking") redirect(`${LIST}/${planId}`);

  const questions =
    ((plan.drafting_questions ?? {}) as { questions?: { question: string }[] }).questions ?? [];

  const answered = questions
    .map((row, index) => ({
      question: row.question,
      answer: String(formData.get(`answer_${index}`) ?? "").trim(),
    }))
    .filter((row) => row.answer);

  await supabase
    .from("whitbyos_workplans")
    .update({ drafting_answers: answered })
    .eq("id", planId);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?held=${planId}`);
}

/**
 * Taking Whitby's draft off a task.
 *
 * The draft is reversible internal work (SRS 12.1.4), and "reversible" has to
 * mean a button. Whitby works from the plan and the task's own brief, so some
 * of these will be wrong, unhelpful, or about a task somebody has already
 * done differently; a draft that cannot be got rid of is a draft that makes
 * the task page longer forever.
 *
 * Dismissed rather than deleted. The plan's summary panel counts what Whitby
 * did, and a row that vanished from the table would quietly change a number
 * the professional had already read. The reader in `lib/work-plans.ts` treats
 * a dismissed draft as none, so nothing offers it again.
 */
export async function dismissWhitbyDraft(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  const taskId = String(formData.get("task_id") ?? "").trim();
  if (!planId || !taskId) redirect(LIST);

  const back = returnTo(formData, planId);
  const { supabase } = await requirePlan(planId);

  /* The task has to be on this plan. Without it, a task id from anywhere in
     the workspace would be dismissable by anyone who can open any plan. */
  const streams = await planStreamIds(supabase, planId);
  const { data: task } = await supabase
    .from("whitbyos_tasks")
    .select("id, workstream_id")
    .eq("id", taskId)
    .maybeSingle();

  if (!task || !streams.has(task.workstream_id as string)) redirect(back);

  await supabase
    .from("whitbyos_tasks")
    .update({ whitby_draft_dismissed_at: new Date().toISOString() })
    .eq("id", taskId);

  revalidatePath(ROUTE, "page");
  redirect(back);
}

/**
 * Whitby doing its share now, on a plan that never had it done.
 *
 * The drafts are written when a plan is adopted. Every plan adopted before
 * migration 101 never got that moment, and a plan can also gain an `auto` task
 * afterwards, by hand or by a refinement. Without this those tasks sit exactly
 * as they did before: work Whitby decided needed no person, waiting on one.
 *
 * Deliberately a button rather than a schedule. It spends the workspace's
 * credits, and the plan's research has the same shape for the same reason:
 * "Look it up again" is pressed, never triggered.
 */
export async function runWhitbyDraftsNow(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) redirect(LIST);

  /* No `returnTo`: this stays on the page it was pressed on. */
  const { workspaceId } = await requirePlan(planId);

  /*
   * Awaited, not handed to `after`.
   *
   * It ran in the background and redirected immediately, so the page
   * navigated, came back unchanged, and told the professional to refresh.
   * Three things to watch instead of one result. The button says it is
   * working for as long as it is, the same as the three beside it, and the
   * drafts are simply there when it stops.
   *
   * Adoption still uses `after`, and should: nobody is looking at that
   * screen by then.
   */
  await runWhitbyFirstDrafts(planId, workspaceId);

  revalidatePath(ROUTE, "page");
}

/**
 * Drafting the firm's own first version, for the half of the list it can.
 *
 * Every client-facing ask this product sent was a label and an empty box.
 * That is the right question for a passport and the wrong one for a menu: the
 * menu is the client's to decide and the firm's to draft, and sending it blank
 * is handing the work back to the person paying for it.
 *
 * Only the needs marked `proposable` (migration 101's field, guarded again in
 * `proposableOf`), and only those with nothing suggested yet: a suggestion
 * somebody has edited by hand is not overwritten by a second opinion.
 *
 * Nothing goes out. The suggestion is stored on the plan and read on the
 * firm's own screen; the client sees it only when somebody presses the button
 * that has always sent the ask. SRS 12.1.5.
 */
export async function proposeClientItems(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) redirect(LIST);

  const back = returnTo(formData, planId);
  const { supabase, workspaceId, requestId } = await requirePlan(planId);

  const plan = await getWorkPlan(planId);
  if (!plan) redirect(back);

  const { edits, proposals } = await getClientAsk(planId);
  const needs = clientNeeds(plan.workstreams, edits).filter(
    (need) => need.proposable && !proposals[need.slug],
  );

  if (needs.length === 0) redirect(back);

  const { data: request } = await supabase
    .from("whitbyos_requests")
    .select("desired_outcome, definition_of_done")
    .eq("id", requestId)
    .maybeSingle();

  const result = await draftProposals({
    needs: needs.map((need) => ({
      label: need.label,
      why: need.why,
      neededBy: need.neededBy,
    })),
    planName: plan.name,
    clientName: plan.client_name,
    requestOutcome: (request?.desired_outcome as string | null) ?? null,
    /* What finished looks like, which is the closest thing the Request
       holds to a brief for the suggestion. There is no `detail` column. */
    requestDetail: (request?.definition_of_done as string | null) ?? null,
    /* The deadline the professional already gave. Without it the first
       suggestion back was "Date: [date to be confirmed]" on a plan whose
       date was on the form. */
    targetDate: plan.target_date,
    workspaceId,
  });

  if (!result.ok) {
    backWithError(back, "ask=1", "Whitby could not draft the suggestions. Try again.");
  }

  /* Matched by slug, the same way two spellings of a label are one need
     everywhere else. A suggestion that matches nothing on the list is
     dropped rather than stored under a key no screen reads. */
  const wanted = new Set(needs.map((need) => need.slug));
  const written = { ...proposals };
  for (const row of result.data ?? []) {
    const slug = needSlug(row.label);
    if (wanted.has(slug)) written[slug] = row.text;
  }

  await supabase
    .from("whitbyos_workplans")
    .update({ client_ask_proposals: written })
    .eq("id", planId);

  /*
   * Revalidated, not redirected.
   *
   * These three run from buttons inside the panel and change nothing about
   * where anybody is. A redirect to the page somebody is already on is still
   * a navigation: the screen blanks and comes back, which on a button that
   * has already emptied the boxes in front of them reads as the page
   * reloading itself for no reason. Revalidating re-renders in place.
   */
  revalidatePath(ROUTE, "page");
}

/**
 * The professional writing or correcting the suggestions themselves.
 *
 * The requirement is that the professional or Whitby can put the first
 * version forward, and a draft nobody can edit is a draft that gets thrown
 * away whole. This is also the only way to propose anything on a plan where
 * the AI is off.
 *
 * All of them at once, from the boxes on the panel, because they are read
 * together: a menu and a running order for the same evening are corrected in
 * one sitting. Emptying a box removes that suggestion, which turns the need
 * back into the blank ask it was. That is the honest undo, since there is no
 * "unpropose" state separate from having nothing to propose.
 *
 * Reached by `formAction` from the same form as the ask, so it inherits the
 * plan id and the return path rather than repeating them.
 */
export async function saveClientProposals(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) redirect(LIST);

  /* No `returnTo` here: this stays on the page it was pressed on. */
  const { supabase } = await requirePlan(planId);

  const { proposals } = await getClientAsk(planId);
  const written = { ...proposals };

  /* Only the boxes that were actually on the screen. A need whose row was
     not drawn must not have its suggestion deleted by a form that never
     carried it. */
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("proposal_")) continue;

    const slug = key.slice("proposal_".length);
    if (!slug) continue;

    const text = String(value ?? "").trim();
    if (text) written[slug] = text;
    else delete written[slug];
  }

  await supabase
    .from("whitbyos_workplans")
    .update({ client_ask_proposals: written })
    .eq("id", planId);

  /*
   * Revalidated, not redirected.
   *
   * These three run from buttons inside the panel and change nothing about
   * where anybody is. A redirect to the page somebody is already on is still
   * a navigation: the screen blanks and comes back, which on a button that
   * has already emptied the boxes in front of them reads as the page
   * reloading itself for no reason. Revalidating re-renders in place.
   */
  revalidatePath(ROUTE, "page");
}

/**
 * Clearing the suggestions and starting again.
 *
 * Six drafts that all read wrong is one press to be rid of, not six. After
 * this the needs are blank asks again and the panel offers to draft them,
 * which is the loop somebody wants when the first attempt missed.
 *
 * Only what the form actually posted. A suggestion already on the client's
 * form is drawn read-only and has no box, so its key never arrives and it
 * cannot be cleared here: taking it off our screen would leave the firm
 * saying one thing and the client looking at another.
 */
export async function clearClientProposals(formData: FormData) {
  await stopIfReadOnly();

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) redirect(LIST);

  /* No `returnTo` here: this stays on the page it was pressed on. */
  const { supabase } = await requirePlan(planId);

  const { proposals } = await getClientAsk(planId);
  const written = { ...proposals };

  for (const key of formData.keys()) {
    if (!key.startsWith("proposal_")) continue;
    const slug = key.slice("proposal_".length);
    if (slug) delete written[slug];
  }

  await supabase
    .from("whitbyos_workplans")
    .update({ client_ask_proposals: written })
    .eq("id", planId);

  /*
   * Revalidated, not redirected.
   *
   * These three run from buttons inside the panel and change nothing about
   * where anybody is. A redirect to the page somebody is already on is still
   * a navigation: the screen blanks and comes back, which on a button that
   * has already emptied the boxes in front of them reads as the page
   * reloading itself for no reason. Revalidating re-renders in place.
   */
  revalidatePath(ROUTE, "page");
}

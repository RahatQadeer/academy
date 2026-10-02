import { createClient } from "@/base/lib/supabase/server";
import { draftAutoTask } from "@/whitbyos/lib/ai/auto-draft";

/**
 * Whitby working through the tasks it said needed nobody.
 *
 * `kind` has been on every task since migration 012 and the drafter has been
 * setting it honestly ever since: `auto` for organising, researching,
 * summarising or drafting internal material, reversible, nothing leaving the
 * firm. No code ever read the value. Whitby would decide a task needed no
 * person and then hand it to one.
 *
 * This runs once, when the professional adopts the plan. Not at drafting time:
 * a plan under review may be thrown away or rewritten, and doing its work
 * first spends the workspace's credits on tasks that may never exist. Adoption
 * is the moment the work becomes real, and it is also the moment the
 * professional has stopped looking, which is when an assistant should be
 * getting on with things.
 *
 * Nothing here completes a task, and nothing here reaches a client. The draft
 * is written onto the task and the task stays open: SRS 12.1.4 allows Whitby
 * to create reversible internal work, and 12.1.5 keeps every external send
 * behind a person. The professional reads it, corrects it, or dismisses it.
 */

/**
 * How many tasks one plan is allowed to draft.
 *
 * A large plan can carry twenty `auto` tasks, and drafting all of them at
 * adoption is a bill the professional did not ask for and a wall of material
 * nobody reads. The earliest ones are the ones that matter: they are what the
 * plan starts with.
 */
const MOST_TASKS = 8;

/** Run a few at a time. Enough to be quick, few enough not to be a spike. */
const AT_ONCE = 3;

type Row = {
  id: string;
  title: string;
  description: string | null;
  rationale: string | null;
  expected_output: string | null;
  required_inputs: unknown;
  workstream_id: string;
};

/**
 * Draft every `auto` task on a plan that has not been drafted already.
 *
 * Never throws. This runs inside `after()`, where there is no screen left to
 * show an error on, and a plan whose adoption appeared to fail because an
 * optional convenience did not work is worse than a plan with no drafts.
 * A task that fails simply has none, and the panel counts what exists.
 */
export async function runWhitbyFirstDrafts(planId: string, workspaceId: string | null) {
  try {
    const service = await createClient();

    const { data: streams } = await service
      .from("whitbyos_workstreams")
      .select("id, name")
      .eq("workplan_id", planId);

    if (!streams || streams.length === 0) return;

    const streamName = new Map(
      streams.map((row) => [row.id as string, (row.name as string | null) ?? null]),
    );

    const { data: tasks } = await service
      .from("whitbyos_tasks")
      .select(
        "id, title, description, rationale, expected_output, required_inputs, workstream_id",
      )
      .in(
        "workstream_id",
        streams.map((row) => row.id as string),
      )
      .eq("kind", "auto")
      /* Something already finished by hand does not want a draft of itself,
         and a second run must not overwrite a draft somebody has read. */
      .neq("status", "complete")
      .is("whitby_draft_at", null)
      .order("created_at", { ascending: true })
      .limit(MOST_TASKS);

    if (!tasks || tasks.length === 0) return;

    /* The plan and its client, for context the task rows do not carry. One
       query rather than one per task. */
    const { data: plan } = await service
      .from("whitbyos_workplans")
      .select("name, request_id")
      .eq("id", planId)
      .maybeSingle();

    let clientName: string | null = null;
    let requestOutcome: string | null = null;

    if (plan?.request_id) {
      const { data: request } = await service
        .from("whitbyos_requests")
        .select("desired_outcome, client_id")
        .eq("id", plan.request_id as string)
        .maybeSingle();

      requestOutcome = (request?.desired_outcome as string | null) ?? null;

      if (request?.client_id) {
        const { data: client } = await service
          .from("whitbyos_clients")
          .select("name")
          .eq("id", request.client_id as string)
          .maybeSingle();
        clientName = (client?.name as string | null) ?? null;
      }
    }

    /* The steps already written for each task. They are the closest thing to
       a brief the task has, and drafting without them produces a second,
       different set of steps rather than the work itself. */
    const { data: checklists } = await service
      .from("whitbyos_checklists")
      .select("task_id, items")
      .in(
        "task_id",
        tasks.map((row) => row.id as string),
      );

    const steps = new Map<string, string[]>();
    for (const row of checklists ?? []) {
      const items = Array.isArray(row.items) ? row.items : [];
      steps.set(
        row.task_id as string,
        items
          .map((item) =>
            typeof item === "string" ? item : String((item as { text?: unknown })?.text ?? ""),
          )
          .filter(Boolean),
      );
    }

    const queue = tasks as Row[];

    for (let at = 0; at < queue.length; at += AT_ONCE) {
      await Promise.all(
        queue.slice(at, at + AT_ONCE).map((task) =>
          draftOne({
            task,
            steps: steps.get(task.id) ?? [],
            streamName: streamName.get(task.workstream_id) ?? null,
            planName: (plan?.name as string | null) ?? null,
            clientName,
            requestOutcome,
            workspaceId,
          }),
        ),
      );
    }
  } catch {
    /* Adoption already happened and the professional is looking at the plan.
       Whatever went wrong here, it is not their problem to see. */
  }
}

async function draftOne({
  task,
  steps,
  streamName,
  planName,
  clientName,
  requestOutcome,
  workspaceId,
}: {
  task: Row;
  steps: string[];
  streamName: string | null;
  planName: string | null;
  clientName: string | null;
  requestOutcome: string | null;
  workspaceId: string | null;
}) {
  try {
    const result = await draftAutoTask({
      title: task.title,
      description: task.description,
      rationale: task.rationale,
      expectedOutput: task.expected_output,
      steps,
      requiredInputs: Array.isArray(task.required_inputs)
        ? (task.required_inputs as {
            label: string;
            from?: string | null;
            why?: string | null;
            alreadyHeld?: boolean | null;
          }[])
        : [],
      streamName,
      planName,
      clientName,
      requestOutcome,
      workspaceId,
    });

    /* `tidy` returns null where nothing usable came back, and a null draft is
       not written: the panel says Whitby did N things, and an empty one would
       make that number a lie. */
    if (!result.ok || !result.data) return;

    const service = await createClient();
    await service
      .from("whitbyos_tasks")
      .update({
        whitby_draft: result.data,
        whitby_draft_at: new Date().toISOString(),
        whitby_draft_dismissed_at: null,
      })
      .eq("id", task.id);
  } catch {
    /* One task's draft failing leaves the others alone. */
  }
}

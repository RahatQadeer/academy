"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { createServiceClient } from "@/base/lib/supabase/service";
import { listTasks } from "@/client-portal/lib/data/tasks";
import { listRequestPlans } from "@/client-portal/lib/data/plans";
import { TOASTS } from "@/client-portal/lib/toasts";
import { IN_APP, notifyWorkspaceMembers } from "@/whitbyos/lib/notify";
import { requireWrite, toastUrl } from "./guard";

const TASKS_PATH = "/client-portal/tasks";

/**
 * Where the client was standing when they ticked the box.
 *
 * A task is listed on three screens — Home's Action Needed, a Request's Tasks
 * tab, and /client-portal/tasks — and the tick has to put them back on the one
 * they were reading, with its tab and its search intact. The value comes off a
 * hidden field, so it is checked rather than trusted: anything that is not a
 * path inside the portal is replaced with the Tasks screen.
 */
function backTo(form: FormData): string {
  const raw = form.get("return_to");
  if (typeof raw !== "string") return TASKS_PATH;
  // A leading "//" is a protocol-relative URL to somebody else's host.
  if (!raw.startsWith("/client-portal") || raw.startsWith("//")) return TASKS_PATH;
  return raw;
}

/**
 * The client marking their own task done, and unticking one they ticked by
 * mistake.
 *
 * Until now only the professional could: `client-portal/migrations/005` gave
 * the client the read of a client-visible Task and no write at all, so a task
 * asking them for something sat open on their screen until somebody in the
 * firm closed it. This is the other half — the same `status`, `completed_at`
 * and `updated_at` that Whitby's own Mark Complete writes (7.1), reached
 * through one definer function that can change nothing else on the row.
 *
 * Reversible on purpose. §12.1.4 treats this kind of record as reversible
 * internal work, and the same button undoes itself: a tick nobody can untick
 * makes a mis-click something the client has to write a message about.
 *
 * Three checks, in this order, because each answers a different question:
 *
 *   `requireWrite`  may this person write in this area at all — the area grant
 *                   and view-only, which live in the portal's own permissions
 *   `listTasks()`   is this task one of theirs — the RLS-scoped, area-gated
 *                   reader every screen already renders from, so the action
 *                   authorises against exactly what the client can see
 *   the function    the database's own answer to the same question, which is
 *                   what stands if either of the above is ever wrong
 */
export async function setTaskDone(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "").trim();
  const requestId = String(formData.get("request_id") ?? "").trim();
  const done = String(formData.get("done") ?? "") === "1";
  const back = backTo(formData);

  if (!taskId) redirect(back);

  const guard = await requireWrite("requests");
  if ("reason" in guard) redirect(toastUrl(back, guard.reason));
  const { ctx } = guard;

  // Not a fresh query: `listTasks` is the reader the screens draw from, cached
  // for this request, RLS-scoped to the account and gated on the Requests
  // area. A task absent from it is one this person cannot see, whatever the
  // form said — a stale tab, or access narrowed while they were reading.
  const task = await findTask(taskId, requestId);
  if (!task) {
    redirect(toastUrl(back, "That task is no longer on your account."));
  }

  const saved = await writeStatus(task, done);
  if (!saved) {
    redirect(toastUrl(back, "Could not save that just now. Please try again."));
  }

  // The firm hears about it. A task the client was asked to do is a task
  // somebody is waiting on, and the whole point of letting them tick it is
  // that nobody has to ask again — which only works if the firm is told.
  await notifyWorkspaceMembers({
    workspaceId: ctx.workspaceId,
    event: IN_APP.clientTaskUpdate,
    // Completing and reopening are separate news about the same task, so they
    // are separate kinds: the second is not suppressed as a repeat of the
    // first while the first is still unread.
    kind: done ? "client_task_done" : "client_task_reopened",
    title: done ? "A client marked a task complete" : "A client reopened a task",
    body: `${ctx.accountName}: ${task.title}`,
    href: task.requestId ? `/whitbyos/requests/${task.requestId}` : `/whitbyos/tasks?task=${taskId}`,
    entityType: "task",
    entityId: taskId,
  });

  revalidate(task);
  redirect(toastUrl(back, done ? TOASTS.taskCompleted : TOASTS.taskReopened));
}

/** A task this client may tick, and which route made it theirs. */
type Tickable = {
  id: string;
  title: string;
  requestId: string | null;
  completedAt: string | null;
  /** True when it reached the client through a shared Work Plan only. */
  viaPlan: boolean;
};

/**
 * The task, if this client can see it — by either of the two reads that put a
 * task on their screen.
 *
 * `listTasks()` is the client-visible tasks (005). A Request's Tasks tab also
 * lists every task in a Work Plan shared on it (`listRequestPlans()`), most of
 * which are not client-visible: the professional shared the plan, not each
 * task. Those are theirs to tick too (client-portal/023), and they are looked
 * up on the Request the form names — the same RLS-scoped, definer-filtered
 * read the tab was drawn from, so the form cannot name a plan the client was
 * not shown.
 */
async function findTask(taskId: string, requestId: string): Promise<Tickable | null> {
  const shared = (await listTasks()).find((row) => row.id === taskId);
  if (shared) {
    return {
      id: shared.id,
      title: shared.title,
      requestId: shared.requestId,
      completedAt: shared.completedAt,
      viaPlan: false,
    };
  }

  if (!requestId) return null;
  for (const plan of await listRequestPlans(requestId)) {
    for (const stream of plan.streams) {
      const task = stream.tasks.find((row) => row.id === taskId);
      if (task) {
        return {
          id: task.id,
          title: task.title,
          requestId,
          completedAt: task.completedAt,
          viaPlan: true,
        };
      }
    }
  }
  return null;
}

/**
 * The write itself, through `portal_set_task_done`
 * (client-portal/migrations/020).
 *
 * The function is the route, and the service role is the fallback for a
 * database that has not had 020 applied yet — this folder's files are
 * proposals folded into the shared migration set by hand, and without a
 * fallback the button would be dead on every environment until that happened.
 * A plain update as the signed-in client is *not* a fallback: `whitbyos_tasks`
 * has no UPDATE policy for a client, so it matches no rows and reports no
 * error, which is the one failure that looks exactly like success.
 *
 * The caller has already established that this task is one the client may
 * change, by finding it in their own RLS-scoped read. That is what makes the
 * service-role path safe: it writes the row the client can see, and only the
 * three columns the function writes.
 */
async function writeStatus(task: Tickable, done: boolean): Promise<boolean> {
  const taskId = task.id;
  const supabase = await createClient();

  const { error } = await supabase.rpc("portal_set_task_done", {
    p_task_id: taskId,
    p_done: done,
  });

  if (!error) return true;

  const service = createServiceClient();
  if (!service) {
    console.error("Could not complete the task", error.message);
    return false;
  }

  const stamp = new Date().toISOString();
  let update = service
    .from("whitbyos_tasks")
    .update({
      status: done ? "complete" : "in_progress",
      // Same rule as `completionStamp` in whitbyos/lib/tasks.ts: finishing
      // stamps the day, and only reopening clears it.
      completed_at: done ? (task.completedAt ?? stamp) : null,
      updated_at: stamp,
    })
    .eq("id", taskId);
  // A plan task was found in the shared plan's own read, which is its
  // authority; any other must still be client-visible.
  if (!task.viaPlan) update = update.eq("visibility", "client_visible");
  const { error: fallback } = await update;

  if (fallback) {
    console.error("Could not complete the task", fallback.message);
    return false;
  }

  return true;
}

/**
 * Every screen the task is on, not only the one it was ticked from.
 *
 * A task shows on Home twice — Action Needed and Recent Activity — on the
 * Tasks screen, and on its Request's tab and progress bar. Revalidating only
 * the page that submitted would leave the same task open on the others until
 * something else happened to refresh them.
 */
function revalidate(task: Tickable) {
  revalidatePath("/client-portal");
  revalidatePath(TASKS_PATH);
  if (task.requestId) {
    revalidatePath(`/client-portal/requests/${task.requestId}`);
  }
}

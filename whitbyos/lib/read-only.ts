import "server-only";
import { redirect } from "next/navigation";
import { getCurrentWorkspacePlan } from "@/whitbyos/lib/workspace";
import { isInactive } from "@/whitbyos/lib/billing-vocab";
import type { DialogResult } from "@/whitbyos/components/DialogForm";

/**
 * A workspace whose subscription has ended can be read and not written.
 *
 * `inactive` is what a workspace becomes when the paid subscription stops: not
 * back on Trial, which would hand out a second free run, and not still on the
 * plan nobody is paying for. Everything already in it stays readable, exportable
 * and searchable. Nothing new can be made, changed or sent until a plan is
 * chosen again.
 *
 * ONE GUARD, NOT A CHECK PER ACTION.
 * Before this there was a single limit check, on creating a client workspace,
 * and the banner on the billing screen claimed "nothing new can be created" —
 * which was untrue everywhere else. Requests, tasks, invoices, messages and the
 * rest all wrote happily. So the question "may this workspace be written to?"
 * is answered here, once, and every mutating action asks it rather than
 * re-deciding what inactive means.
 *
 * The three helpers below exist because the actions do not share a failure
 * idiom: some redirect, some return a `DialogResult` for a dialog to show, and
 * some return their own shape. They are the same answer in three envelopes.
 */
export const READ_ONLY_MESSAGE =
  "This workspace is inactive because its subscription ended. Everything already here stays readable, and nothing new can be created or changed until a plan is chosen under Settings, Billing & Plan.";

/** The single source of truth. Everything else in this file is a wrapper. */
export async function isWorkspaceReadOnly(): Promise<boolean> {
  return isInactive(await getCurrentWorkspacePlan());
}

/**
 * For an action that reports through a dialog.
 *
 * Returns the refusal to hand straight back, or null to carry on:
 *
 *   const stop = await readOnlyDialogResult();
 *   if (stop) return stop;
 */
export async function readOnlyDialogResult(): Promise<DialogResult | null> {
  return (await isWorkspaceReadOnly())
    ? { ok: false, error: READ_ONLY_MESSAGE }
    : null;
}

/**
 * For an action that redirects.
 *
 * Returns the path to send them to, or null to carry on. The caller redirects
 * rather than this doing it, so the refusal lands on whichever screen the
 * action was pressed from.
 */
export async function readOnlyRedirect(path: string): Promise<string | null> {
  return (await isWorkspaceReadOnly())
    ? `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(READ_ONLY_MESSAGE)}`
    : null;
}

/**
 * For everything else: stop the action and send them where they can fix it.
 *
 *   await stopIfReadOnly();
 *
 * `redirect` throws, so nothing after this line runs. Billing & Plan is the
 * destination on purpose — it is the one screen that can end the state the
 * refusal is about, and arriving anywhere else would leave someone reading
 * "choose a plan" with no way to.
 */
export async function stopIfReadOnly(): Promise<void> {
  if (await isWorkspaceReadOnly()) {
    redirect(
      `/whitbyos/settings/billing?error=${encodeURIComponent(READ_ONLY_MESSAGE)}`,
    );
  }
}

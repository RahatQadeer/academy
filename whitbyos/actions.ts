"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { getCurrentWorkspaceId, WORKSPACE_COOKIE } from "@/whitbyos/lib/workspace";
import { WIDGETS, WIDGET_KEYS } from "@/whitbyos/lib/widget-vocab";
import type { DialogResult } from "@/whitbyos/components/DialogForm";
import { readOnlyDialogResult, stopIfReadOnly } from "@/whitbyos/lib/read-only";

const HOME = "/whitbyos";
const ROUTE = "/[product]/[[...slug]]";

/**
 * Screen 1.1c — switching workspace.
 *
 * Checked against their own memberships before it is written, so the cookie can
 * only ever name somewhere they belong. `getCurrentWorkspaceId` checks it again
 * on the way out, which means a cookie that goes stale — access revoked, say —
 * degrades to their first workspace rather than to nothing.
 */
export async function switchWorkspace(formData: FormData) {
  const workspaceId = String(formData.get("workspace_id") ?? "").trim();
  if (!workspaceId) redirect(HOME);

  const profile = await getSessionProfile();
  const mine = profile?.workspaces ?? [];
  if (!mine.some((workspace) => workspace.id === workspaceId)) redirect(HOME);

  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath(ROUTE, "page");
  redirect(HOME);
}

/**
 * Screen 1.3 — which widgets are on Home.
 *
 * Only what is switched off is stored, so a new account gets the full set
 * without anything having written six rows for it.
 */
export async function saveWidgets(formData: FormData) {
  await stopIfReadOnly();

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(HOME);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const off = WIDGETS.filter((widget) => formData.get(widget.key) !== "on");
  const offKeys = new Set<string>(off.map((widget) => widget.key));

  if (off.length > 0) {
    await supabase.from("whitbyos_dashboard_widgets").upsert(
      off.map((widget) => ({
        user_id: user.id,
        workspace_id: workspaceId,
        widget_key: widget.key,
        enabled: false,
      })),
      { onConflict: "user_id,workspace_id,widget_key" },
    );
  }

  const on = [...WIDGET_KEYS].filter((key) => !offKeys.has(key));
  if (on.length > 0) {
    await supabase
      .from("whitbyos_dashboard_widgets")
      .delete()
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .in("widget_key", on);
  }

  revalidatePath(ROUTE, "page");
  redirect(HOME);
}

/**
 * Screen 1.2b — logging a communication that happened outside Whitby.
 *
 * `whitbyos_communications` already existed with everything this needs, so
 * nothing had to be added for it: a call is a row with a kind, a summary and
 * the time it actually happened, optionally against a Request or a Client.
 */
export async function logCommunication(
  _previous: DialogResult,
  formData: FormData,
): Promise<DialogResult> {
  const stop = await readOnlyDialogResult();
  if (stop) return stop;

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const summary = String(formData.get("summary") ?? "").trim();
  if (!summary) return { ok: false, error: "Say what was discussed." };

  const kind = String(formData.get("kind") ?? "call").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const occurredAt = String(formData.get("occurredAt") ?? "").trim();

  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("whitbyos_communications").insert({
    workspace_id: workspaceId,
    request_id: requestId || null,
    client_id: clientId || null,
    type: kind,
    summary,
    logged_by_user_id: profile?.user.id ?? null,
    // An empty control means it happened now, which is the common case for
    // something being written down straight after it ended.
    occurred_at: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };

  // No revalidatePath: it remounts this page, and with it the dialog holding
  // the result nobody has read yet. The navigation below fetches fresh anyway.
  return { ok: true, to: `${HOME}?logged=communication` };
}

/**
 * Screen 1.2c — a note from Quick Add.
 *
 * Migration 055 is what lets this have neither a Request nor a Client: the
 * table used to require a Request, and a thought worth writing down does not
 * always belong to one yet.
 */
export async function saveQuickNote(
  _previous: DialogResult,
  formData: FormData,
): Promise<DialogResult> {
  const stop = await readOnlyDialogResult();
  if (stop) return stop;

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false, error: "Write something first." };

  const requestId = String(formData.get("requestId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();

  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("whitbyos_notes").insert({
    workspace_id: workspaceId,
    request_id: requestId || null,
    client_id: clientId || null,
    type: "note",
    body,
    // 1.2c calls it "a quick internal thought". Internal is what that means.
    visibility: "internal",
    created_by_user_id: profile?.user.id ?? null,
  });

  if (error) return { ok: false, error: error.message };

  return { ok: true, to: `${HOME}?logged=note` };
}

/**
 * 1.9's "Go to my dashboard", and 1.4 to 1.8's "Skip tour".
 *
 * Both mean the same thing: this person has seen it. Stored on the user
 * rather than the workspace, so switching workspace does not start it again.
 */
export async function finishTour() {
  const profile = await getSessionProfile();
  if (!profile) return;

  const supabase = await createClient();
  await supabase
    .from("users")
    .update({ tour_seen_at: new Date().toISOString() })
    .eq("id", profile.user.id);
}

/** Settings, Workspace: "Revisit this tour", which 1.9 promises. */
export async function restartTour() {
  const profile = await getSessionProfile();
  if (!profile) redirect(HOME);

  const supabase = await createClient();
  await supabase.from("users").update({ tour_seen_at: null }).eq("id", profile.user.id);

  redirect(HOME);
}

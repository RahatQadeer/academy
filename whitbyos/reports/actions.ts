"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { REPORT_TYPES, buildContents, typeLabel } from "@/whitbyos/lib/reports";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";

const LIST = "/whitbyos/reports";
const ROUTE = "/[product]/[[...slug]]";
const TYPES = new Set(REPORT_TYPES.map((row) => row.value));

function backWithError(message: string): never {
  redirect(`${LIST}?new=1&error=${encodeURIComponent(message)}`);
}

/**
 * Screen 15.1 — Generate Report.
 *
 * The figures are worked out now and kept. A report is a statement about a
 * period, and someone may send it to a client — recomputing it later from live
 * rows would quietly rewrite what they read.
 *
 * A scheduled report is the same row with no figures yet and a date it is due.
 * There is nothing running that would generate it on that date; it is recorded
 * so the professional can see what is meant to happen, and the list says so.
 */
export async function generateReport(formData: FormData) {
  await stopIfReadOnly();

  const type = String(formData.get("type") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const from = String(formData.get("period_start") ?? "").trim();
  const to = String(formData.get("period_end") ?? "").trim();
  const share = formData.get("share") === "on";
  const scheduleFor = String(formData.get("scheduled_for") ?? "").trim();

  if (!TYPES.has(type)) backWithError("Choose what kind of report this is.");

  // A period that ends before it starts is not a period. Nothing stopped one
  // being saved, and the Timeline view lays its streams out on exactly this
  // window — so a backwards range produced a report about nothing, drawn as if
  // it meant something.
  if (from && to && to < from) {
    backWithError("The end of the period is before its start.");
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) backWithError("Create your workspace first.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let clientName = "All Clients";
  if (clientId) {
    const { data: client } = await supabase
      .from("whitbyos_clients")
      .select("id, name")
      .eq("id", clientId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!client) backWithError("That client is not in this workspace.");
    clientName = client.name as string;
  }

  const scheduled = Boolean(scheduleFor);
  const contents = scheduled
    ? {}
    : await buildContents(clientId || null, workspaceId, from || null, to || null);

  const { data, error } = await supabase
    .from("whitbyos_reports")
    .insert({
      workspace_id: workspaceId,
      title: `${clientName}: ${typeLabel(type)}`,
      type,
      client_id: clientId || null,
      period_start: from || null,
      period_end: to || null,
      contents,
      shared_with_client: share,
      scheduled_for: scheduleFor || null,
      generated_at: scheduled ? null : new Date().toISOString(),
      created_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) backWithError(error?.message ?? "Could not generate the report.");

  revalidatePath(ROUTE, "page");
  redirect(scheduled ? `${LIST}?scheduled=1` : `${LIST}/${data.id}?generated=1`);
}

/** 15.3's Share with Client — §11.2 keeps this the professional's decision. */
export async function shareReport(formData: FormData) {
  await stopIfReadOnly();

  const reportId = String(formData.get("report_id") ?? "").trim();
  if (!reportId) redirect(LIST);

  // The same button both ways. A report already in the client's portal has one
  // useful thing left to do — take it back out — and a greyed-out button that
  // says it is shared says the same thing the badge beside it already says.
  const withdraw = String(formData.get("withdraw") ?? "") === "1";

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { error } = await supabase
    .from("whitbyos_reports")
    .update({ shared_with_client: !withdraw })
    .eq("id", reportId)
    .eq("workspace_id", workspaceId);

  if (error) redirect(`${LIST}/${reportId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}/${reportId}?${withdraw ? "withdrawn=1" : "shared=1"}`);
}

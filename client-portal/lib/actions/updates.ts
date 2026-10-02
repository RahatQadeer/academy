"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { TOASTS } from "@/client-portal/lib/toasts";
import { requireWrite, text, toastUrl } from "./guard";

const UPDATES_PATH = "/client-portal/updates";
const PLANS_TAB = `${UPDATES_PATH}?tab=plans`;

/**
 * Plans & Updates — the client telling the professional something (a trip, a
 * household change). Explicitly never creates a Request: the professional links
 * or opens one later if coordination is actually needed (SRS 13.7.4).
 */
export async function sharePlanUpdate(formData: FormData) {
  const body = text(formData, "body");
  if (!body) {
    redirect(toastUrl(`${PLANS_TAB}&compose=1`, "Write something to share."));
  }

  const guard = await requireWrite("updates");
  if ("reason" in guard) redirect(toastUrl(PLANS_TAB, guard.reason));
  const { ctx } = guard;

  const supabase = await createClient();
  const { error } = await supabase.from("whitbyos_updates").insert({
    client_id: ctx.clientId,
    request_id: null,
    type: "plans_update",
    body,
    // Client-authored, so it is immediately visible to both sides rather than
    // sitting in the professional's draft/review pipeline.
    status: "published",
    published_at: new Date().toISOString(),
  });

  if (error) {
    redirect(toastUrl(PLANS_TAB, "Could not share that. Please try again."));
  }

  revalidatePath(UPDATES_PATH);
  redirect(toastUrl(PLANS_TAB, TOASTS.planShared));
}

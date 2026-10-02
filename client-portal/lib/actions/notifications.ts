"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";

const ROUTE = "/[product]/[[...slug]]";

/** Only back into the portal: the bell is opened on a portal page. */
function safeBack(value: unknown) {
  const back = String(value ?? "").trim();
  return back.startsWith("/client-portal") ? back : "/client-portal";
}

/**
 * Mark everything in the portal's bell as seen.
 *
 * Whitby's own `readAllNotices` cannot serve here: it reads the rows addressed
 * to a *user* inside the current workspace, and a client is neither. These are
 * the rows addressed to the contact this login is, which is exactly what
 * `whitbyos_notifications_portal` (whitbyos/052) lets them update.
 */
export async function readAllPortalNotices(formData: FormData) {
  const here = safeBack(formData.get("back"));

  const ctx = await getPortalContext();
  if (ctx.mode !== "live" || !ctx.contactId) redirect(here);

  const supabase = await createClient();
  await supabase
    .from("whitbyos_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_contact_id", ctx.contactId)
    .is("read_at", null);

  revalidatePath(ROUTE, "page");
  redirect(here);
}

/**
 * Mark the one the client opened.
 *
 * The portal's counterpart to Whitby's `readNotice`, and separate for the same
 * reason `readAllPortalNotices` is: these rows are addressed to a contact, not
 * to a workspace member, and Whitby's version would match nothing here and
 * quietly leave the dot where it was.
 */
export async function readPortalNotice(noticeId: string) {
  const id = noticeId.trim();
  if (!id) return;

  const ctx = await getPortalContext();
  if (ctx.mode !== "live" || !ctx.contactId) return;

  const supabase = await createClient();
  await supabase
    .from("whitbyos_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_contact_id", ctx.contactId)
    .is("read_at", null);

  revalidatePath(ROUTE, "page");
}

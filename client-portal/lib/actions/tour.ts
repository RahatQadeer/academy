"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { TOUR_KEY } from "@/client-portal/lib/data/tour";
import { requireLiveContext } from "./guard";

const HOME = "/client-portal";

/**
 * The closing card's "Go to my portal", and every step's "Skip tour".
 *
 * Both mean the same thing: this person has seen it. Best-effort, like the
 * rest of the portal's own-account writes — a client who dismisses the tour on
 * a sample session, or while their identity is still being linked, must not be
 * left with it on the screen because there was nowhere to record the answer.
 */
export async function finishPortalTour() {
  const ctx = await requireLiveContext();
  if (!ctx) return;

  await writeTour(ctx.contactId, new Date().toISOString());
}

/** Preferences: "Show me around again", which the closing card promises. */
export async function restartPortalTour() {
  const ctx = await requireLiveContext();
  if (ctx) await writeTour(ctx.contactId, null);

  // `?tour=1` rather than relying on the flag alone, so the sample account —
  // which has no contact to write to — gets the tour from this button too.
  revalidatePath(HOME);
  redirect(`${HOME}?tour=1`);
}

/** Reads the jsonb back before writing it, so nothing else stored there is lost. */
async function writeTour(contactId: string, value: string | null) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("contacts")
    .select("enrichment_data")
    .eq("id", contactId)
    .maybeSingle();

  await supabase
    .from("contacts")
    .update({
      enrichment_data: {
        ...((existing?.enrichment_data as Record<string, unknown>) ?? {}),
        [TOUR_KEY]: value,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId);
}

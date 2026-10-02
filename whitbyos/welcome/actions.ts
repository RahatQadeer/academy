"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { AVATAR_BUCKET, storeAvatar } from "@/whitbyos/lib/avatar";

const WELCOME = "/welcome";

/**
 * The photo step's only write.
 *
 * It comes back to this screen rather than going on to the app: choosing a file
 * is not the same press as saying you are done, and someone who picks the wrong
 * photo should see that before they leave. Continue is the press that leaves.
 */
export async function addWelcomePhoto(formData: FormData) {
  const failed = await storeAvatar(formData.get("photo"));
  if (failed) redirect(`${WELCOME}?error=${encodeURIComponent(failed)}`);

  redirect(WELCOME);
}

/** Replace the one just added, without having to go to Settings to do it. */
export async function dropWelcomePhoto() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.storage.from(AVATAR_BUCKET).remove([`${user.id}/photo`]);
  await supabase.from("users").update({ avatar_url: null }).eq("id", user.id);

  redirect(WELCOME);
}

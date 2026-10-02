"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";

const SECURITY = "/whitbyos/settings/security";
const ROUTE = "/[product]/[[...slug]]";

function back(message: string, key: "toast" | "error" = "toast"): never {
  redirect(`${SECURITY}?${key}=${encodeURIComponent(message)}`);
}

/*
 * Enrolling happens in the browser, not here.
 *
 * `enroll` hands out the QR and the secret once, in its own response — so a
 * factor created on the server could never be drawn on the screen, and the
 * panel enrolled a second one to get a code it could show. Two factors, one
 * scanned and the other verified. The panel owns the whole act now; this file
 * keeps what genuinely belongs on the server: checking the code, turning it
 * off, and the session controls.
 */

/**
 * Turning it off.
 *
 * Deliberately not behind a typed confirmation: this weakens the account rather
 * than destroying anything, it can be turned straight back on, and asking
 * someone to type a word to remove a security control they are locked out by is
 * how people end up locked out.
 */
export async function disableTwoFactor(formData: FormData) {
  const factorId = String(formData.get("factor_id") ?? "").trim();
  if (!factorId) redirect(SECURITY);

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });

  if (error) back(error.message, "error");

  revalidatePath(ROUTE, "page");
  back("Two-factor authentication is off.");
}

/**
 * 17.6's session limit.
 *
 * One active session at a time is a Supabase project setting, not something an
 * app can switch per user — the auth service is what would have to refuse the
 * second sign-in. So the preference is recorded against the workspace and the
 * screen says what it does and does not do, rather than a toggle that looks
 * like it enforces something.
 */
export async function saveSessionLimit(formData: FormData) {
  const single = formData.get("single_session") === "on";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { getCurrentWorkspaceId } = await import("@/whitbyos/lib/workspace");
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) back("No workspace found.", "error");

  const { error } = await supabase
    .from("whitbyos_workspace_settings")
    .upsert(
      { workspace_id: workspaceId, single_session: single },
      { onConflict: "workspace_id" },
    );

  if (error) back(error.message, "error");

  revalidatePath(ROUTE, "page");
  back("Saved.");
}

/**
 * 17.6's "Log out of all other sessions".
 *
 * The reference lists every device with a Log out beside each; Supabase gives
 * the app no session list to draw, and no way to end one in particular. It does
 * give this — every session but the one asking — which is the whole reason the
 * button exists: somebody who thinks they are signed in somewhere they should
 * not be wants them all gone, not a tidy list.
 */
export async function signOutOtherSessions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase.auth.signOut({ scope: "others" });

  redirect(
    `${SECURITY}?toast=${encodeURIComponent(
      error
        ? `Those sessions could not be ended: ${error.message}`
        : "Every other session has been signed out. This one is still open.",
    )}`,
  );
}

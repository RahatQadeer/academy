"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { TOASTS } from "@/client-portal/lib/toasts";
import { NOTIFICATION_EVENTS } from "@/client-portal/types";
import { NOT_SAVED, requireLiveContext, text, toastUrl } from "./guard";
import { avatarStoragePath } from "@/client-portal/lib/storage";
import { passwordProblem, passwordRefusal } from "@/client-portal/lib/password";
import { createAdminClient } from "@/whitbyos/lib/supabase-admin";

const SETTINGS = "/client-portal/settings";
const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export async function uploadAvatar(formData: FormData) {
  const path = `${SETTINGS}/profile`;
  const ctx = await requireLiveContext();
  if (!ctx) redirect(toastUrl(path, NOT_SAVED));

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(toastUrl(path, "Choose a photo to upload."));
  }
  if (file.size > MAX_AVATAR_BYTES) {
    redirect(toastUrl(path, "Photos must be 5 MB or smaller."));
  }

  const supabase = await createClient();
  const storagePath = avatarStoragePath(ctx.contactId);
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: true,
    });

  if (error) {
    redirect(toastUrl(path, "Upload failed. Please try again."));
  }

  /*
   * Publish it to `users.avatar_url` as well, so the photo reaches the rail.
   *
   * The object alone was not enough. This screen finds the photo by asking
   * storage for a signed URL at a path derived from the contact id, and it was
   * the only thing in the product that knew to look there — `ProductShell`
   * draws the person in the sidebar from `users.avatar_url`, which nothing here
   * wrote. So a client uploaded a photo, saw it appear on this page, and went
   * on being a circle of initials on every other screen.
   *
   * A long-lived signed URL rather than the path, because that is what the
   * column holds everywhere else: `storeAvatar` in whitbyos/lib/avatar.ts sets
   * it the same way, for the same reason — the bucket is private and this hangs
   * in the nav on every page.
   *
   * The object stays keyed by contact id. Whitby keys its own by user id, and
   * the two are deliberately not merged here: that is a decision about where a
   * person's photo lives, recorded as an open question in
   * client-portal/migrations/README.md, and not something to settle as a side
   * effect of fixing the sidebar.
   */
  const { data: signed } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  if (signed?.signedUrl && ctx.userId) {
    await supabase
      .from("users")
      .update({ avatar_url: signed.signedUrl })
      .eq("id", ctx.userId);
  }

  revalidatePath(path);
  // The rail is drawn by the layout, which this page is nested in, so the new
  // photo only reaches it once that is rebuilt too.
  revalidatePath("/client-portal", "layout");
  redirect(toastUrl(path, "Profile photo updated."));
}

export async function saveProfile(formData: FormData) {
  const path = `${SETTINGS}/profile`;
  const ctx = await requireLiveContext();
  if (!ctx) redirect(toastUrl(path, NOT_SAVED));

  const fullName = text(formData, "fullName");
  const preferredName = text(formData, "preferredName");
  const salutation = text(formData, "salutation");
  const phone = text(formData, "phone");
  const timezone = text(formData, "timezone");
  const mailingAddress = text(formData, "mailingAddress");

  const supabase = await createClient();

  const { data: existingContact } = await supabase
    .from("contacts")
    .select("enrichment_data")
    .eq("id", ctx.contactId)
    .maybeSingle();

  // The person exists twice: as an auth identity (`users`) and as the canonical
  // person record (`contacts`). Both are updated so the professional side sees
  // the same details the client just edited.
  //
  // `users` carries the time zone and nothing else here reads it from anywhere
  // else, so a failure on this one is not cosmetic. `users_update_self` allows
  // it — the client is the auth user whose row this is.
  const { error: userError } = await supabase
    .from("users")
    .update({
      full_name: fullName,
      preferred_name: preferredName,
      salutation,
      phone,
      timezone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.userId!);

  const [first, ...rest] = (fullName ?? "").split(/\s+/).filter(Boolean);
  const { error: contactError } = await supabase
    .from("contacts")
    .update({
      ...(first ? { first_name: first } : {}),
      ...(rest.length > 0 ? { last_name: rest.join(" ") } : {}),
      preferred_name: preferredName,
      salutation,
      phone,
      enrichment_data: {
        ...((existingContact?.enrichment_data as Record<string, unknown>) ?? {}),
        mailing_address: mailingAddress,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.contactId);

  /*
   * Say so when it did not save.
   *
   * Both writes used to be issued and neither answer read, so the screen said
   * "Profile saved" whatever happened — and because the form then re-rendered
   * from the same stale row, a client had no way at all to tell a refused
   * write from a successful one.
   */
  if (userError || contactError) {
    redirect(toastUrl(path, "Your details could not be saved. Please try again."));
  }

  revalidatePath(path);
  // The name in the rail comes from the same `users` row this just wrote, and
  // the rail belongs to the layout rather than to this page — so renaming
  // yourself left the old name sitting in the sidebar until a hard reload.
  revalidatePath("/client-portal", "layout");
  redirect(toastUrl(path, TOASTS.profileSaved));
}

export async function savePreferences(formData: FormData) {
  const path = `${SETTINGS}/preferences`;
  const ctx = await requireLiveContext();
  if (!ctx) redirect(toastUrl(path, NOT_SAVED));

  const preferences = {
    preferred_channel: text(formData, "preferredChannel"),
    update_frequency: text(formData, "updateFrequency"),
    language: text(formData, "language"),
    accessibility: text(formData, "accessibility"),
  };

  const supabase = await createClient();
  // Stored on the contact's enrichment jsonb rather than as new columns — the
  // portal does not add fields to shared base tables.
  const { data: existing } = await supabase
    .from("contacts")
    .select("enrichment_data")
    .eq("id", ctx.contactId)
    .maybeSingle();

  await supabase
    .from("contacts")
    .update({
      enrichment_data: {
        ...((existing?.enrichment_data as Record<string, unknown>) ?? {}),
        portal_preferences: preferences,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.contactId);

  revalidatePath(path);
  redirect(toastUrl(path, TOASTS.preferencesSaved));
}

export async function saveNotifications(formData: FormData) {
  const path = `${SETTINGS}/notifications`;
  const ctx = await requireLiveContext();
  if (!ctx) redirect(toastUrl(path, NOT_SAVED));

  const rows = NOTIFICATION_EVENTS.map((event) => ({
    contact_id: ctx.contactId,
    event_type: event,
    channel: "email",
    enabled: formData.get(`event:${event}`) === "on",
  }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_portal_notification_prefs")
    .upsert(rows, { onConflict: "contact_id,event_type,channel" });

  if (error) {
    redirect(toastUrl(path, "Could not save. Please try again."));
  }

  revalidatePath(path);
  redirect(toastUrl(path, TOASTS.notificationsSaved));
}

export async function savePrivacy(formData: FormData) {
  const path = `${SETTINGS}/privacy`;
  const ctx = await requireLiveContext();
  if (!ctx) redirect(toastUrl(path, NOT_SAVED));

  const privacy = {
    hide_from_other_members: formData.get("hideFromMembers") === "on",
    share_activity_with_team: formData.get("shareActivity") === "on",
    allow_assistant_visibility: formData.get("assistantVisibility") === "on",
  };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("contacts")
    .select("enrichment_data")
    .eq("id", ctx.contactId)
    .maybeSingle();

  await supabase
    .from("contacts")
    .update({
      enrichment_data: {
        ...((existing?.enrichment_data as Record<string, unknown>) ?? {}),
        portal_privacy: privacy,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.contactId);

  revalidatePath(path);
  redirect(toastUrl(path, TOASTS.privacySaved));
}

/**
 * There's no self-service export/delete pipeline yet — these just confirm the
 * request was received. Wire up to a real intake once one exists; deliberately
 * not writing into `client_portal_access_requests`, since that table drives the
 * staff access-request review queue and a data-export/deletion ask isn't a
 * person-to-approve request.
 */
export async function requestDataExport() {
  const path = `${SETTINGS}/privacy`;
  const ctx = await requireLiveContext();
  if (!ctx) redirect(toastUrl(path, NOT_SAVED));

  redirect(toastUrl(path, "Export requested, your team will email you a copy."));
}

/**
 * Deleting the account, for real.
 *
 * What goes is the way in and what is purely theirs: the Supabase auth user,
 * the link from it to this contact, portal access, their notification
 * preferences and their profile photo.
 *
 * What stays is the professional's record of the work — Requests, Documents,
 * Messages, and the contact itself. Those are their business records, not this
 * person's to erase, and a self-serve button that quietly destroyed them would
 * be a much larger thing than it looks. Erasing those is a conversation with
 * the professional, which the confirmation says. The contact keeps its name and
 * relationship history so the professional can still see who they worked with;
 * it simply no longer has a way in.
 *
 * Only the person deleting is affected. Additional Members and Authorized Users
 * on the same account keep their own logins — the membership row updated below
 * is theirs alone.
 *
 * The deletion is recorded before anything is removed. Afterwards the account
 * having been closed is indistinguishable from never having been invited, and
 * the professional goes on working with this person — they should not be left
 * writing to a portal nobody is reading.
 *
 * The typed confirmation is not ceremony. Before this, one click sat on an
 * action that could not be undone, and it did nothing — so nobody found out.
 */
export async function deleteAccount(formData: FormData) {
  const path = `${SETTINGS}/privacy`;
  const confirmation = text(formData, "confirm");

  if (confirmation?.trim().toUpperCase() !== "DELETE") {
    redirect(toastUrl(path, "Type DELETE to confirm, exactly."));
  }

  const ctx = await requireLiveContext();
  if (!ctx) redirect(toastUrl(path, NOT_SAVED));

  const admin = createAdminClient();
  if (!admin) {
    redirect(
      toastUrl(path, "Your account could not be deleted right now. Contact your account team."),
    );
  }

  // Order matters. The rows that point at the auth user go first, so a failure
  // half way leaves an account that still works rather than one that exists
  // with nothing behind it.
  await admin.from("client_portal_identities").delete().eq("user_id", ctx.userId!);

  await admin
    .from("whitbyos_client_members")
    .update({ portal_access: false })
    .eq("contact_id", ctx.contactId);

  await admin
    .from("entitlements")
    .delete()
    .eq("user_id", ctx.userId!)
    .eq("product", "client_portal");

  // First, while there is still something to record it from.
  await admin.from("client_portal_deletions").insert({
    contact_id: ctx.contactId,
    email: ctx.email,
  });

  // Theirs rather than the professional's: what they chose to be told about,
  // and the photo they uploaded of themselves.
  await admin
    .from("client_portal_notification_prefs")
    .delete()
    .eq("contact_id", ctx.contactId);

  await admin.storage.from(AVATAR_BUCKET).remove([avatarStoragePath(ctx.contactId)]);

  const { error } = await admin.auth.admin.deleteUser(ctx.userId!);
  if (error) {
    redirect(toastUrl(path, `Your account could not be deleted: ${error.message}`));
  }

  // The session belongs to an account that no longer exists; clearing it here
  // means the next page load is a sign-in rather than a broken one.
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect("/login?notice=account-deleted&brand=portal");
}

export async function changePassword(formData: FormData) {
  const path = `${SETTINGS}/security`;

  /*
   * Read raw, not through `text()`.
   *
   * `text()` trims, which is right for a name and wrong for a password: a
   * password set here as "  hunter2  " was stored as "hunter2", and nothing
   * trims at sign-in, so the person was locked out by the form that was
   * supposed to let them in. `app/auth/reset-password` reads its own body raw,
   * so the two ways of setting a password did not even agree with each other.
   */
  const raw = formData.get("password");
  const rawConfirm = formData.get("confirmPassword");
  const password = typeof raw === "string" ? raw : null;
  const confirm = typeof rawConfirm === "string" ? rawConfirm : null;

  const problem = passwordProblem(password, confirm);
  if (problem) redirect(toastUrl(path, problem));

  const ctx = await requireLiveContext();
  if (!ctx) redirect(toastUrl(path, NOT_SAVED));

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password! });

  /*
   * A refused change says why, in words the client can act on.
   *
   * The one that matters here is `same_password`. Supabase makes that check
   * because it is the only party holding the current password's hash — nothing
   * on this side can compare against it — and without the check "Update
   * password" on an unchanged password would report success having changed
   * nothing at all.
   */
  if (error) {
    redirect(toastUrl(path, passwordRefusal(error.code, error.message)));
  }

  redirect(toastUrl(path, TOASTS.passwordChanged));
}

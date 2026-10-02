"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DialogResult } from "@/whitbyos/components/DialogForm";
import { createClient } from "@/base/lib/supabase/server";
import { checkEmail } from "@/base/auth/email";
import { createAdminClient } from "@/whitbyos/lib/supabase-admin";
import { getCurrentWorkspaceId, getCurrentWorkspacePlan } from "@/whitbyos/lib/workspace";
import { inviteOrigin } from "@/base/auth/site";
import { randomUUID } from "crypto";
import { NOT_CONNECTED, planIncludesClientPortal } from "@/whitbyos/lib/billing-vocab";
import {
  INVITABLE_ROLES,
  NOTIFICATION_EVENTS,
  ROLE_LABELS,
  mayAdminister,
  type Role,
} from "@/whitbyos/lib/settings-vocab";
import { sendSignInLink } from "@/whitbyos/lib/invite-mail";
import { AVATAR_BUCKET, storeAvatar } from "@/whitbyos/lib/avatar";
import { openBillingPortal, startPlanChange } from "@/whitbyos/lib/stripe/checkout";
import { permanentlyReleaseAccountEmail } from "@/base/identity/closeAccount";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";
import { passwordIsCurrent } from "@/whitbyos/lib/verify-password";
import {
  SLUG_TAKEN,
  isSlugTakenError,
  slugifyWorkspaceUrl,
  workspaceUrlError,
} from "@/whitbyos/lib/workspace-url";

const SETTINGS = "/whitbyos/settings";

/** Your own account, which is no longer what Settings opens on. */
const PROFILE = "/whitbyos/settings/profile";
const ROUTE = "/[product]/[[...slug]]";

/** §9.4.3 — an invitation expires rather than standing open indefinitely. */
const INVITE_DAYS = 14;

function back(message: string): never {
  redirect(`${PROFILE}?toast=${encodeURIComponent(message)}`);
}

function backWithError(message: string): never {
  redirect(`${PROFILE}?error=${encodeURIComponent(message)}`);
}

/**
 * Screen 17 — your name. Role and email are shown but not editable.
 *
 * The email used to be a field, and editing it changed the row in `users`
 * while leaving what you actually sign in with untouched — that lives in auth
 * and needs a confirmation sent to the new address, which this product cannot
 * send. So it offered a change it could not make, and said so in a sentence
 * afterwards. The field is gone; the address is read at the top of the screen
 * with the name and the role.
 */
export async function saveProfile(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!fullName) backWithError("Your name cannot be empty.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("users")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) backWithError(error.message);

  revalidatePath(ROUTE, "page");
  back("Your profile changes have been saved.");
}

/** 17's Change password, which the export draws as a button and nothing else. */
export async function changeOwnPassword(formData: FormData) {
  const current = String(formData.get("current_password") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!current) backWithError("Enter your current password.");
  if (password.length < 8) backWithError("Use at least 8 characters.");
  if (password !== confirm) backWithError("Those passwords do not match.");
  if (password === current) backWithError("That is your current password. Choose a different one.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  /*
   * The current password is checked, not taken on trust.
   *
   * Supabase's own reauthentication is off for this project, so
   * `updateUser({ password })` would change it for anyone holding the session
   * — a borrowed laptop, a window left open — without ever knowing the old
   * one. Asking for it is what makes the field mean something.
   */
  if (!(await passwordIsCurrent(user.email ?? "", current))) {
    backWithError("That is not your current password.");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) backWithError(error.message);

  back("Your password has been changed.");
}

export async function uploadAvatar(formData: FormData) {
  const failed = await storeAvatar(formData.get("photo"));
  if (failed) backWithError(failed);

  revalidatePath(ROUTE, "page");
  back("Your photo has been updated.");
}

export async function removeAvatar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.storage.from(AVATAR_BUCKET).remove([`${user.id}/photo`]);
  await supabase.from("users").update({ avatar_url: null }).eq("id", user.id);

  revalidatePath(ROUTE, "page");
  back("Your photo has been removed.");
}

const SENIORITY = ["owner", "admin", "team_lead", "coordinator", "billing", "marketing", "viewer"];

/**
 * Closing a professional's own account.
 *
 * The row in `public.users` is not deleted, and cannot be. Some thirty tables
 * reference it with NO ACTION and several of those columns are NOT NULL —
 * `workspaces.owner_user_id`, `whitbyos_clients.owner_user_id`,
 * `audit_log.actor_user_id`, `invitations.created_by`. That is the schema
 * saying something true: an audit entry with no actor is worthless, and a
 * client with no owner is incoherent. Attribution outlives the account.
 *
 * So the schema's own answer is used — `user_status` has been `active |
 * suspended | deleted` all along. The person is marked deleted, their auth
 * login is revoked so it can never be signed into again, and their membership
 * and entitlements go. What they did stays attributed to them.
 *
 * The workspace and everything in it stays regardless: clients, Requests, Work
 * Plans, Documents, Messages, billing history. Ownership passes to whoever
 * holds the most senior role, and no client's portal access is touched — one
 * person leaving a firm is no reason to shut that firm's clients out.
 *
 * Order is deliberate. Revoking the login comes first, and nothing is taken
 * away until it succeeds. Doing it the other way round — which this did — left
 * an account signed in, stripped of every workspace, with nothing on screen but
 * an error.
 */
export async function deleteOwnAccount(formData: FormData) {
  const confirmation = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (confirmation !== "DELETE") backWithError("Type DELETE to confirm, exactly.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) backWithError("Your account could not be closed right now. Contact support.");

  const { data: memberships } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  // Hand each workspace over, or record that nobody is left in it. Both are
  // safe to do before the point of no return: an owner change is a change the
  // workspace survives either way, and a review row is only a note.
  for (const membership of memberships ?? []) {
    const workspaceId = membership.workspace_id as string;

    const { data: others } = await admin
      .from("workspace_members")
      .select("user_id, role")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .neq("user_id", user.id);

    if ((others ?? []).length > 0) {
      await handOver(admin, workspaceId, user.id, others as Successor[]);
    } else {
      await flagForReview(admin, workspaceId, user.email ?? null);
    }
  }

  // The point of no return, and the first thing that must actually work.
  //
  // This used to be a hundred-year ban with the address left on the row, which
  // revoked the login and took the email with it. Nothing could be done with
  // that address afterwards: not a new account, not accepting an invitation to
  // one — the person was told "User is banned" by a service they had never
  // heard of. Closing an account is not a reason to hold its owner's email
  // forever. The address is released and the login revoked by rewriting the
  // stored credential instead, which is what closeAccount has always done for
  // the rest of the products.
  const released = await permanentlyReleaseAccountEmail(user.id);

  if (!released.ok) {
    // Nothing has been taken from them yet, so there is nothing to undo.
    backWithError(`Your account could not be closed: ${released.message}`);
  }

  await admin.from("workspace_members").delete().eq("user_id", user.id);
  await admin.from("entitlements").delete().eq("user_id", user.id);
  await admin.storage.from(AVATAR_BUCKET).remove([`${user.id}/photo`]);

  await supabase.auth.signOut();
  redirect("/login?notice=account-deleted");
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Successor = { user_id: string; role: string | null };

/** Ownership passes to whoever already holds the most senior role. */
async function handOver(
  admin: Admin,
  workspaceId: string,
  leavingUserId: string,
  others: Successor[],
) {
  const { data: workspace } = await admin
    .from("workspaces")
    .select("owner_user_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspace?.owner_user_id !== leavingUserId) return;

  const rank = (role: string | null) => {
    const index = SENIORITY.indexOf(role ?? "");
    return index === -1 ? SENIORITY.length : index;
  };

  const successor = [...others].sort((a, b) => rank(a.role) - rank(b.role))[0];
  if (!successor) return;

  await admin
    .from("workspaces")
    .update({ owner_user_id: successor.user_id })
    .eq("id", workspaceId);

  // Whoever inherits a workspace has to be able to administer it.
  await admin
    .from("workspace_members")
    .update({ role: "owner" })
    .eq("workspace_id", workspaceId)
    .eq("user_id", successor.user_id);
}

/** The last person out of a workspace that still has work in it. */
async function flagForReview(admin: Admin, workspaceId: string, email: string | null) {
  const [{ count: clients }, { count: requests }] = await Promise.all([
    admin
      .from("whitbyos_clients")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    admin
      .from("whitbyos_requests")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .not("status", "in", '("completed","cancelled","closed")'),
  ]);

  await admin.from("workspace_reviews").insert({
    workspace_id: workspaceId,
    reason: "owner_deleted_no_team",
    raised_by_email: email,
    open_client_count: clients ?? 0,
    open_request_count: requests ?? 0,
  });
}


/** Where each tab sends its own toasts and errors. */
/**
 * Screen 17.1b — the firm's own professional profile.
 *
 * One form and one upsert, because these are one thing: who the firm is
 * professionally, what of that a client may see, what an engagement starts
 * from, and what its time is booked at internally. Splitting them into three
 * saves would be three chances to lose two-thirds of a change.
 *
 * The rate arrives as a typed amount and is stored in minor units. It is
 * internal: nothing in the Client Portal reads this column.
 */
export async function saveOrganization(formData: FormData) {
  await stopIfReadOnly();

  const field = (name: string) => String(formData.get(name) ?? "").trim();
  const orNull = (value: string) => (value === "" ? null : value);

  /*
   * Two screens post here and each sends its own half.
   *
   * The firm's own records — a registration number, a tax reference, what its
   * time is booked at — are edited on a different day by a different person
   * from the outward-facing ones. A field that was not sent is left alone
   * rather than written back as null, which is how saving a contract term
   * could have cleared a tax reference.
   */
  const section = field("section") || "professional";
  const professional = section === "professional";
  const which = professional ? "organization" : "public-information";

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) toTab(which, "No workspace found.", "error");

  if (!mayAdminister(await myRole(workspaceId))) {
    toTab(
      "organization",
      "Only an Owner or an Admin can change organization settings.",
      "error",
    );
  }

  const foundedInput = field("founded_year");
  const foundedYear = foundedInput === "" ? null : Number(foundedInput);
  if (foundedYear !== null && (!Number.isInteger(foundedYear) || foundedYear < 1800 || foundedYear > 2200)) {
    toTab(which, "Founded should be a year, like 2016.", "error");
  }

  /*
   * "1,250" and "1250.00" are the same rate typed by two people.
   *
   * Parsed here rather than trusted, and rounded rather than truncated, so a
   * rate of 99.995 does not quietly become 9999 cents.
   */
  const rateInput = field("internal_rate").replace(/[^0-9.]/g, "");
  const rateUnit = field("internal_rate_unit") || "hour";
  let rateCents: number | null = null;
  if (rateInput !== "") {
    const amount = Number(rateInput);
    if (!Number.isFinite(amount) || amount < 0) {
      toTab(which, "The internal rate should be an amount, like 250.", "error");
    }
    rateCents = Math.round(amount * 100);
  }

  const supabase = await createClient();

  const half = professional
    ? {
        legal_name: orNull(field("legal_name")),
        practice_type: orNull(field("practice_type")),
        registration_number: orNull(field("registration_number")),
        tax_id: orNull(field("tax_id")),
        founded_year: foundedYear,
        professional_email: orNull(field("professional_email")),
        professional_phone: orNull(field("professional_phone")),
        office_address: orNull(field("office_address")),
        service_areas: orNull(field("service_areas")),
        internal_rate_cents: rateCents,
        // A unit with no rate behind it says nothing, and the column's own
        // constraint refuses a rate with no unit.
        internal_rate_unit: rateCents === null ? null : rateUnit,
        internal_rate_note: orNull(field("internal_rate_note")),
      }
    : {
        public_profile_url: orNull(field("public_profile_url")),
        public_summary: orNull(field("public_summary")),
        standard_contract_terms: orNull(field("standard_contract_terms")),
        notice_period: orNull(field("notice_period")),
        ranking: orNull(field("ranking")),
        accreditations: orNull(field("accreditations")),
      };

  const { error } = await supabase.from("whitbyos_workspace_settings").upsert(
    { workspace_id: workspaceId, ...half },
    { onConflict: "workspace_id" },
  );

  if (error) toTab(which, error.message, "error");

  revalidatePath(ROUTE, "page");
  toTab(which, professional ? "Professional information saved." : "Public and contract information saved.");
}

function tabPath(tab: string) {
  // The organization holds the bare path — it is what this area opens on —
  // and the tab that kept the name "workspace" is at /workspace.
  if (tab === "workspace") return SETTINGS;
  if (tab === "workspace-defaults") return `${SETTINGS}/workspace`;
  return `${SETTINGS}/${tab}`;
}

function toTab(tab: string, message: string, key: "toast" | "error" = "toast"): never {
  redirect(`${tabPath(tab)}?${key}=${encodeURIComponent(message)}`);
}

/** The acting user's role here, which decides what 17.2 lets them do. */
async function myRole(workspaceId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  return (data?.role as string) ?? null;
}

/**
 * Screen 17.1 — Workspace.
 *
 * Name and URL are the same row the Client Portal reads for the professional's
 * firm: changing the name here is what the client sees, and the URL is unique
 * so two professionals cannot claim `whitby.app/the-same-slug`.
 */
export async function saveWorkspace(formData: FormData) {
  await stopIfReadOnly();

  /*
   * Two screens post here, and each sends half of this.
   *
   * Identity — name, mark, address on the web — is one question; how the
   * workspace counts — time zone, currency, what a client can be — is
   * another, and they are on separate screens now. A field that was not sent
   * is a field nobody was editing, so it is left alone rather than written
   * back as an empty string, which is how saving a name used to be able to
   * clear a currency.
   */
  const identity = formData.has("name");
  const defaults = formData.has("timezone");
  const which = identity ? "workspace" : "workspace-defaults";

  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("urlSlug") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const classifications = formData
    .getAll("classification")
    .map((value) => String(value).trim())
    .filter(Boolean);

  /*
   * The portal's starting areas, only if a form actually sent them.
   *
   * No screen edits them at the moment — the Client Portal section is the
   * open/closed switch and nothing else — and `getAll` on a field nobody
   * posted returns an empty list, which would have written "a new portal
   * person starts with nothing" every time somebody saved a currency. The
   * marker is what tells the two apart, and leaves the column alone until a
   * screen means to change it.
   */
  const portalAreas = formData.has("portal_area_present")
    ? formData
        .getAll("portal_area")
        .map((value) => String(value).trim())
        .filter(Boolean)
    : null;

  let urlSlug = "";
  if (identity) {
    if (!name) toTab(which, "The organization needs a name.", "error");

    const slugProblem = workspaceUrlError(slugInput);
    if (slugProblem) toTab(which, slugProblem, "error");
    urlSlug = slugifyWorkspaceUrl(slugInput);
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) toTab(which, "No workspace found.", "error");

  if (!mayAdminister(await myRole(workspaceId))) {
    toTab(which, "Only an Owner or an Admin can change these settings.", "error");
  }

  const supabase = await createClient();

  const shared: Record<string, unknown> = {};
  if (identity) {
    shared.name = name;
    shared.url_slug = urlSlug;
  }
  if (defaults) shared.timezone = timezone;

  if (Object.keys(shared).length > 0) {
    const { error } = await supabase.from("workspaces").update(shared).eq("id", workspaceId);

    if (isSlugTakenError(error)) toTab(which, SLUG_TAKEN, "error");
    if (error) toTab(which, error.message, "error");
  }

  if (defaults) {
    const usesPosted = formData.has("uses_client_workspaces");
    const usesClients = formData.get("uses_client_workspaces") === "yes";
    const clientFields = formData.has("client_fields");

    const { error: settingsError } = await supabase
      .from("whitbyos_workspace_settings")
      .upsert(
        {
          workspace_id: workspaceId,
          default_currency: currency || "USD",
          ...(clientFields
            ? {
                client_classifications: classifications,
                ...(planIncludesClientPortal(await getCurrentWorkspacePlan())
                  ? { portal_enabled: formData.get("portal_enabled") === "on" }
                  : {}),
              }
            : {}),
          ...(portalAreas ? { portal_default_areas: portalAreas } : {}),
          ...(usesPosted ? { uses_client_workspaces: usesClients } : {}),
        },
        { onConflict: "workspace_id" },
      );

    if (settingsError) toTab(which, settingsError.message, "error");

    if (usesPosted) {
      const { ensureFirmClientId } = await import("@/whitbyos/lib/client-workspace");
      // No creates the hidden holder. Yes only flags one that already exists,
      // so turning the setting back on does not invent a new client.
      await ensureFirmClientId(usesClients ? false : true);
    }
  }

  revalidatePath(ROUTE, "page");
  revalidatePath("/client-portal");
  toTab(
    which,
    identity ? "Your organization changes have been saved." : "Your workspace changes have been saved.",
  );
}

/**
 * Writes the invitation row and gets the link out, for a first send and a
 * resend alike.
 *
 * Reports what happened rather than redirecting, because the two callers say
 * different things about the same outcome — a first invitation is on its way,
 * a resend is on its way *again*, and only one of them should mention the role.
 *
 * `created` and `emailed` are separate answers because they fail separately and
 * mean different things. A row that exists with no email sent is a working
 * invitation nobody has been told about, and its link can still be pasted into
 * a message by hand; a row that was never written is nothing at all.
 */
async function deliverTeamInvitation(invite: {
  email: string;
  role: string;
  workspaceId: string;
  inviterId: string;
}): Promise<{ created: boolean; emailed: boolean; reason: string | null; token: string }> {
  const supabase = await createClient();
  const token = randomUUID();

  const { error } = await supabase.from("invitations").insert({
    token,
    inviter_user_id: invite.inviterId,
    invitee_email: invite.email,
    context_type: "team_member",
    context_id: invite.workspaceId,
    role_or_relationship: invite.role,
    status: "pending",
    sent_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    created_by: invite.inviterId,
  });

  if (error) {
    return {
      created: false,
      emailed: false,
      reason: `The invitation could not be created: ${error.message}`,
      token,
    };
  }

  const link = `${inviteOrigin()}/invite/${token}`;

  const admin = createAdminClient();
  if (!admin) {
    return {
      created: true,
      emailed: false,
      reason: "no email was sent, the mail key is not set on this environment.",
      token,
    };
  }

  try {
    const { error: mailError } = await admin.auth.admin.inviteUserByEmail(invite.email, {
      redirectTo: link,
    });
    if (mailError) throw mailError;
    return { created: true, emailed: true, reason: null, token };
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : String(thrown);

    // Supabase will not "invite" an address that already has a login, and it is
    // right not to: there is no account to create. That is the normal case for
    // a resend — the first invitation created the account — and it happens on a
    // first invitation too, for someone who already uses another product. Both
    // want the same thing: a way in, not a way to sign up.
    if (/already been registered|already exists|email_exists/i.test(message)) {
      return (await sendSignInLink(invite.email, link))
        ? { created: true, emailed: true, reason: null, token }
        : {
            created: true,
            emailed: false,
            reason: `they already have an account, and the sign-in link to it could not be sent either. Send them this link yourself, it works the same way: ${link}`,
            token,
          };
    }

    if (/rate limit|too many|over_email_send_rate/i.test(message)) {
      return {
        created: true,
        emailed: false,
        reason: "Supabase's hourly email limit was reached. Try again in an hour, or send them the invitation link yourself.",
        token,
      };
    }

    return { created: true, emailed: false, reason: `the email could not be sent: ${message}`, token };
  }
}

/** Screen 17.2a — Invite Teammate. §4.4, and the same machinery as onboarding. */
export async function inviteTeammate(formData: FormData) {
  await stopIfReadOnly();

  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();

  const checked = checkEmail(email);
  if (!checked.ok) toTab("team", checked.reason, "error");
  if (!INVITABLE_ROLES.includes(role as Role)) {
    toTab("team", "Choose a role for them.", "error");
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) toTab("team", "No workspace found.", "error");

  if (!mayAdminister(await myRole(workspaceId))) {
    toTab("team", "Only an Owner or an Admin can invite teammates.", "error");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const outcome = await deliverTeamInvitation({
    email,
    role,
    workspaceId,
    inviterId: user.id,
  });

  if (!outcome.created) toTab("team", outcome.reason ?? "The invitation could not be created.", "error");

  revalidatePath(ROUTE, "page");

  // The invitation is real and its link works whatever the mailer did, so a
  // delivery failure is reported as one rather than as a failure to invite.
  toTab(
    "team",
    outcome.emailed
      ? `An invitation is on its way to ${email}.`
      : `${email} was invited, but ${outcome.reason}`,
  );
}

/**
 * 17.2's ⋯ on someone who has not accepted — send the invitation again, with
 * the chance to correct the role on the way out.
 *
 * The role is editable *here* and only here. Until someone accepts there is no
 * membership row to update, so the invitation is the sole record of what they
 * were offered, and re-issuing it is the only thing that can rewrite it. That
 * is why the pending ⋯ has no Change role list of its own: it would have
 * nothing to write to.
 *
 * The new invitation is created before the standing ones are revoked. The other
 * order — revoke, then create — leaves the invitee with nothing at all if the
 * insert fails, and the failure they would see is on the inviter's screen, not
 * theirs.
 */
export async function resendTeamInvitation(formData: FormData) {
  await stopIfReadOnly();

  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();

  const checked = checkEmail(email);
  if (!checked.ok) toTab("team", checked.reason, "error");
  if (!INVITABLE_ROLES.includes(role as Role)) {
    toTab("team", "Choose a role for them.", "error");
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) toTab("team", "No workspace found.", "error");

  if (!mayAdminister(await myRole(workspaceId))) {
    toTab("team", "Only an Owner or an Admin can invite teammates.", "error");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Only an invitation this workspace actually has outstanding. The address
  // arrives from a form, and without this check the ⋯ menu of one workspace
  // could issue an invitation into another.
  const { data: standing } = await supabase
    .from("invitations")
    .select("id")
    .eq("context_type", "team_member")
    .eq("context_id", workspaceId)
    .eq("invitee_email", email)
    .eq("status", "pending")
    .limit(1);

  if (!standing?.length) {
    toTab(
      "team",
      `There is no invitation to ${email} waiting to be sent again. Invite them from the top of this screen.`,
      "error",
    );
  }

  const outcome = await deliverTeamInvitation({
    email,
    role,
    workspaceId,
    inviterId: user.id,
  });

  if (!outcome.created) toTab("team", outcome.reason ?? "The invitation could not be created.", "error");

  // Now that a replacement exists. Two live links into one workspace is one
  // more than anyone needs, and the older one carries the older role — which is
  // exactly what may have just been corrected.
  await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("context_type", "team_member")
    .eq("context_id", workspaceId)
    .eq("invitee_email", email)
    .eq("status", "pending")
    .neq("token", outcome.token);

  revalidatePath(ROUTE, "page");

  const as = ROLE_LABELS[role] ?? "Member";

  toTab(
    "team",
    outcome.emailed
      ? `The invitation to ${email} has been sent again, as ${as}.`
      : `${email} was invited again as ${as}, but ${outcome.reason}`,
  );
}

/** 17.2's ⋯ — changing what someone may do. */
export async function changeTeammateRole(formData: FormData) {
  await stopIfReadOnly();

  const userId = String(formData.get("user_id") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  if (!userId || !INVITABLE_ROLES.includes(role as Role)) toTab("team", "Choose a role.", "error");

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) toTab("team", "No workspace found.", "error");

  if (!mayAdminister(await myRole(workspaceId))) {
    toTab("team", "Only an Owner or an Admin can change roles.", "error");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A workspace has to keep an owner, and someone demoting themselves out of
  // the last owner seat would lock the whole firm out of its own settings.
  if (user?.id === userId) {
    toTab("team", "You cannot change your own role.", "error");
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) toTab("team", error.message, "error");

  revalidatePath(ROUTE, "page");
  toTab("team", "Their role has been changed.");
}

/** 17.2's ⋯ — taking someone out of the workspace. */
export async function removeTeammate(formData: FormData) {
  await stopIfReadOnly();

  const userId = String(formData.get("user_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) toTab("team", "No workspace found.", "error");

  if (!mayAdminister(await myRole(workspaceId))) {
    toTab("team", "Only an Owner or an Admin can remove people.", "error");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id === userId) {
    toTab("team", "You cannot remove yourself. Close your account from Profile instead.", "error");
  }

  // Someone who never accepted has no membership to remove — what exists is
  // the invitation, and revoking it is what stops them arriving.
  if (!userId && email) {
    await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("context_type", "team_member")
      .eq("context_id", workspaceId)
      .eq("invitee_email", email)
      .eq("status", "pending");

    revalidatePath(ROUTE, "page");
    toTab("team", `The invitation to ${email} has been withdrawn.`);
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("owner_user_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspace?.owner_user_id === userId) {
    toTab("team", "The workspace owner cannot be removed. Pass ownership on first.", "error");
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) toTab("team", error.message, "error");

  // Their access to this workspace goes with their membership.
  await supabase
    .from("entitlements")
    .delete()
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);

  revalidatePath(ROUTE, "page");
  toTab("team", "They no longer have access to this workspace.");
}

/**
 * Screen 17.3.
 *
 * Only what is off gets stored. An unchecked box is a row saying so; a checked
 * one has its row removed, which is what keeps a new account on the defaults
 * the export draws without anything having written them first.
 */
export async function saveNotifications(formData: FormData) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) toTab("notifications", "No workspace found.", "error");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const off = NOTIFICATION_EVENTS.filter(
    (event) => formData.get(`${event.channel}:${event.key}`) !== "on",
  );

  const offKeys = new Set(off.map((event) => `${event.channel}:${event.key}`));
  const on = NOTIFICATION_EVENTS.filter(
    (event) => !offKeys.has(`${event.channel}:${event.key}`),
  );

  /*
   * Both writes are checked.
   *
   * They were not: a refused insert or a delete that hit a policy left the
   * screen saying "Your notification settings have been saved", and the next
   * notice arrived anyway. A switch that reports a change it did not make is
   * worse than one that admits it failed.
   */
  if (off.length > 0) {
    const { error } = await supabase.from("whitbyos_notification_prefs").upsert(
      off.map((event) => ({
        user_id: user.id,
        workspace_id: workspaceId,
        event_type: event.key,
        channel: event.channel,
        enabled: false,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,workspace_id,event_type,channel" },
    );

    if (error) toTab("notifications", error.message, "error");
  }

  /* Back on is the row's absence, not a row saying true: 17.3 treats "nothing
     recorded" as on, so leaving one behind would be a second way to say the
     same thing and a way for the two to disagree. */
  if (on.length > 0) {
    const { error } = await supabase
      .from("whitbyos_notification_prefs")
      .delete()
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      /* By key alone, and safely: every event key in NOTIFICATION_EVENTS
         belongs to exactly one channel, so naming the keys names the pairs.
         Filtering on both as separate `in` lists would be a cross product the
         day two channels ever share a key. */
      .in(
        "event_type",
        on.map((event) => event.key),
      );

    if (error) toTab("notifications", error.message, "error");
  }

  revalidatePath(ROUTE, "page");
  toTab("notifications", "Your notification settings have been saved.");
}


/**
 * Screens 17.4a and 17.4b — buying credits and changing plan.
 *
 * Both stop where money would move. Nothing here can charge anyone: no billing
 * provider is connected in any environment (§11.1.5), and granting the credits
 * or the plan anyway would mean giving away what someone is meant to pay for
 * and telling them an invoice is coming that never will.
 *
 * So the screens exist, the choice is made, and what happens next is stated
 * plainly. When a provider is connected, this is where its call goes.
 */
export async function buyCredits(formData: FormData) {
  const credits = Number(formData.get("credits") ?? 0);
  const path = tabPath("billing");

  if (!Number.isFinite(credits) || credits <= 0) {
    redirect(`${path}?error=${encodeURIComponent("Choose how many credits to add.")}`);
  }

  redirect(
    `${path}?blocked=${encodeURIComponent(
      `${credits.toLocaleString()} credits were not added. ${NOT_CONNECTED}`,
    )}`,
  );
}

/**
 * 17.4's Confirm change.
 *
 * Whitby does not take the money: it hands off to Stripe Checkout, which owns
 * the card, the proration and the receipt. A workspace that already has a
 * subscription goes to Stripe's own portal instead, because changing a live
 * subscription is a different operation from starting one and Stripe does it
 * properly, including the proration this screen used to have to apologise for.
 */
/**
 * Returns where to go rather than going there.
 *
 * Both destinations are a move the App Router will not make on its own: Stripe
 * is another origin, and the in-place change lands back on the very path this
 * dialog is open on, which a server-action redirect does not shift. So the
 * caller navigates, the way every other dialog in this product does.
 */
export async function changePlan(
  _previous: DialogResult,
  formData: FormData,
): Promise<DialogResult> {
  const plan = String(formData.get("plan") ?? "").trim();
  const path = tabPath("billing");

  if (!plan) return { ok: false, error: "Choose a plan." };

  if (!mayAdminister(await myRole((await getCurrentWorkspaceId()) ?? ""))) {
    return { ok: false, error: "Only an Owner or an Admin can change the plan." };
  }

  const result = await startPlanChange(plan);
  if (!result.ok) return { ok: false, error: result.error };

  // A workspace that already subscribes has had its subscription changed in
  // place and never leaves the product; only a first purchase goes to Stripe.
  return "changed" in result
    ? { ok: true, to: `${path}?changed=${encodeURIComponent(plan)}` }
    : { ok: true, to: result.url };
}

/** 17.4's Manage billing: Stripe's own portal, where the card lives. */
export async function manageBilling() {
  const path = tabPath("billing");

  if (!mayAdminister(await myRole((await getCurrentWorkspaceId()) ?? ""))) {
    redirect(`${path}?error=${encodeURIComponent("Only an Owner or an Admin can manage billing.")}`);
  }

  const result = await openBillingPortal();
  if (!result.ok) redirect(`${path}?error=${encodeURIComponent(result.error)}`);
  redirect(result.url);
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * The workspace's mark, changed after onboarding.
 *
 * Onboarding could set one and nothing could ever change it, so a workspace
 * created in a hurry kept its initials for good. Stored as a path rather than
 * a signed URL, which is what `getWorkspaceLogoUrl` expects and what
 * onboarding already writes.
 */
export async function uploadWorkspaceLogo(formData: FormData) {
  await stopIfReadOnly();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    toTab("workspace", "Choose a logo to upload.", "error");
  }
  if (file.size > MAX_LOGO_BYTES) {
    toTab("workspace", "Logos must be 2 MB or smaller.", "error");
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) toTab("workspace", "No workspace found.", "error");

  if (!mayAdminister(await myRole(workspaceId))) {
    toTab("workspace", "Only an Owner or an Admin can change the logo.", "error");
  }

  const supabase = await createClient();
  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `workspace-logos/${workspaceId}.${extension}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });

  if (error) toTab("workspace", error.message, "error");

  const { error: saveError } = await supabase
    .from("workspaces")
    .update({ logo_url: path })
    .eq("id", workspaceId);

  if (saveError) toTab("workspace", saveError.message, "error");

  revalidatePath(ROUTE, "page");
  toTab("workspace", "The workspace logo has been updated.");
}

export async function removeWorkspaceLogo() {
  await stopIfReadOnly();

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) toTab("workspace", "No workspace found.", "error");

  if (!mayAdminister(await myRole(workspaceId))) {
    toTab("workspace", "Only an Owner or an Admin can change the logo.", "error");
  }

  const supabase = await createClient();

  // The extension is part of the stored path, so the row is read rather than
  // guessed at. A file left behind would be served again by the next upload
  // of a different type.
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("logo_url")
    .eq("id", workspaceId)
    .maybeSingle();

  const path = workspace?.logo_url as string | null;
  if (path && !path.startsWith("http")) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  }

  await supabase.from("workspaces").update({ logo_url: null }).eq("id", workspaceId);

  revalidatePath(ROUTE, "page");
  toTab("workspace", "The workspace logo has been removed.");
}

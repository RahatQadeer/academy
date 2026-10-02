"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/base/lib/supabase/server";
import { siteUrl } from "@/base/auth/site";
import { createAdminClient } from "@/whitbyos/lib/supabase-admin";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { PLANS, TRIAL_DAYS } from "@/whitbyos/lib/billing-vocab";
import {
  SLUG_TAKEN,
  isSlugTakenError,
  slugifyWorkspaceUrl,
  workspaceUrlError,
} from "@/whitbyos/lib/workspace-url";
import {
  ensureFirmClientId,
  setUsesClientWorkspaces,
} from "@/whitbyos/lib/client-workspace";

const READY = "/onboarding/ready";
const INVITE_DAYS = 14;

const ROLES = new Set(["admin", "team_lead", "coordinator", "billing", "viewer"]);

function backWithError(message: string): never {
  redirect(`/onboarding/invite?error=${encodeURIComponent(message)}`);
}

function backToStepOne(message: string): never {
  redirect(`/onboarding/workspace?error=${encodeURIComponent(message)}`);
}

/**
 * SRS §4.2 — workspace basics.
 *
 * Sign-up already created a workspace automatically so the app had somewhere
 * to put things, named "<Name>'s workspace". If that one is still untouched,
 * this *renames* it rather than creating a second: otherwise every professional
 * would end up owning two workspaces, one of them named for them by accident.
 *
 * Going Back and Continue again is the same workspace. The URL they already
 * chose is theirs, so it must not be refused as taken. A genuinely new one is
 * only created from "+ Create workspace", which posts `createNew`.
 */
export async function saveWorkspaceBasics(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("urlSlug") ?? "").trim();
  const teamSize = String(formData.get("teamSize") ?? "").trim() || "Just me";
  const timezone = String(formData.get("timezone") ?? "").trim() || "UTC";
  const primaryContact = String(formData.get("primaryContact") ?? "").trim();
  const logo = formData.get("logo");
  const createNew = String(formData.get("createNew") ?? "") === "1";
  // 4.1 asks what kind of work they coordinate on this step, not its own.
  const workTypes = formData.getAll("workType").map((value) => String(value));

  if (!name) backToStepOne("Organization name is required.");

  const slugProblem = workspaceUrlError(slugInput || name);
  if (slugProblem) backToStepOne(slugProblem);
  const urlSlug = slugifyWorkspaceUrl(slugInput || name);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) backToStepOne("Your session expired. Sign in and try again.");

  let workspaceId: string | undefined;

  if (!createNew) {
    const currentId = await getCurrentWorkspaceId();
    if (currentId) {
      const { data: current } = await supabase
        .from("workspaces")
        .select("id, owner_user_id")
        .eq("id", currentId)
        .maybeSingle();
      if (current?.owner_user_id === user.id) {
        workspaceId = current.id as string;
      }
    }

    if (!workspaceId) {
      const { data: existing } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_user_id", user.id)
        .is("team_size", null)
        .limit(1)
        .maybeSingle();
      workspaceId = existing?.id as string | undefined;
    }
  }

  if (workspaceId) {
    const { error } = await supabase
      .from("workspaces")
      .update({ name, url_slug: urlSlug, team_size: teamSize, timezone })
      .eq("id", workspaceId);

    if (isSlugTakenError(error)) backToStepOne(SLUG_TAKEN);
    if (error) backToStepOne(error.message);
  } else {
    const { data: workspace, error } = await supabase
      .from("workspaces")
      .insert({
        name,
        url_slug: urlSlug,
        team_size: teamSize,
        timezone,
        owner_user_id: user.id,
        // 4.3: "You're starting on the 14-Day Free Trial." The date is stamped
        // when the trial begins rather than worked out later from a created_at
        // that may not mean the same thing.
        plan: "trial",
        trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString(),
      })
      .select("id")
      .single();

    if (isSlugTakenError(error)) backToStepOne(SLUG_TAKEN);
    if (error) backToStepOne(error.message);
    workspaceId = workspace.id as string;

    await supabase.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: "owner",
      status: "active",
    });

    await supabase.from("entitlements").insert({
      user_id: user.id,
      product: "whitbyos",
      workspace_id: workspaceId,
      status: "trial",
      is_default_landing: true,
    });
  }

  await saveLogo(supabase, workspaceId, logo);
  await savePrimaryContact(supabase, workspaceId, primaryContact);

  if (workTypes.length > 0) {
    await supabase.from("whitbyos_workspace_settings").upsert(
      {
        workspace_id: workspaceId,
        work_types: workTypes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" },
    );
  }

  // Promote shared → Whitby referral and advance to In Progress on product trial
  // (Stripe subscription trial remains a separate idempotent path).
  try {
    const { ensurePlatformReferralOnEntry } = await import(
      "@/partner-center/lib/referral-capture/ensure-platform-on-entry"
    );
    await ensurePlatformReferralOnEntry({ workspaceId });
  } catch {
    // Attribution must never block onboarding.
  }

  redirect("/onboarding/client-workspace");
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** SRS §4.2.6 — optional, and never allowed to block the step. */
async function saveLogo(
  supabase: Supabase,
  workspaceId: string,
  logo: FormDataEntryValue | null,
) {
  if (!(logo instanceof File) || logo.size === 0) return;

  const extension = logo.name.split(".").pop()?.toLowerCase() || "png";
  const path = `workspace-logos/${workspaceId}.${extension}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, logo, { upsert: true, contentType: logo.type });

  // An upload problem must not cost the professional their workspace setup.
  if (error) return;

  await supabase.from("workspaces").update({ logo_url: path }).eq("id", workspaceId);
}

/**
 * SRS §4.2.2 — the workspace's primary contact.
 *
 * Stored as a canonical base `contacts` row rather than a column, because
 * `workspaces` has no primary_contact_id to point at one. The record is real
 * and reusable, but the link back from the workspace is implicit until that
 * column exists — flagged for Laiba rather than duplicated locally.
 */
async function savePrimaryContact(
  supabase: Supabase,
  workspaceId: string,
  fullName: string,
) {
  if (!fullName) return;

  const parts = fullName.split(/\s+/);
  const firstName = parts.length === 1 ? parts[0]! : parts.slice(0, -1).join(" ");
  const lastName = parts.length === 1 ? "" : parts.at(-1)!;

  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("created_by_workspace_id", workspaceId)
    .eq("source", "workspace_primary_contact")
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("contacts")
      .update({ first_name: firstName, last_name: lastName })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("contacts").insert({
    first_name: firstName,
    last_name: lastName,
    source: "workspace_primary_contact",
    created_by_workspace_id: workspaceId,
  });
}

/**
 * SRS §4.4 — creates the team invitations, then moves on.
 *
 * Rows go into the shared base `invitations` table, the one generic mechanism
 * reused for team, client and partner invites (SRS §24.2). The accept side
 * already exists at /invite/[token] and /auth/accept-invite, which adds the
 * person to workspace_members and grants their entitlement — so a created row
 * is immediately usable.
 *
 * The whole step is optional and skippable (§4.4.3): submitting with no rows
 * filled in simply continues.
 */
export async function createTeamInvites(formData: FormData) {
  const emails = formData.getAll("email").map((v) => String(v).trim());
  const roles = formData.getAll("role").map((v) => String(v).trim());

  const invites = emails
    .map((email, index) => ({ email, role: roles[index] ?? "coordinator" }))
    .filter((invite) => invite.email.length > 0);

  if (invites.length === 0) redirect(READY);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) backWithError("Create your workspace before inviting people.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 4.4 — the invite step is the one the export draws this on.
  if (!user) redirect("/onboarding/invite?expired=1");

  const expiresAt = new Date(
    Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const rows = invites.map((invite) => ({
    token: randomUUID(),
    inviter_user_id: user.id,
    invitee_email: invite.email,
    context_type: "team_member" as const,
    context_id: workspaceId,
    role_or_relationship: ROLES.has(invite.role) ? invite.role : "coordinator",
    status: "pending" as const,
    sent_at: new Date().toISOString(),
    expires_at: expiresAt,
    // RLS on `invitations` requires created_by to be the acting user.
    created_by: user.id,
  }));

  const { error } = await supabase.from("invitations").insert(rows);
  if (error) backWithError(error.message);

  await sendInviteEmails(rows);

  redirect(READY);
}

/**
 * Emails each invitation through Supabase Auth's admin API (SRS §4.9.2 —
 * Whitby sends the invitation). The link lands on /invite/<token>, the accept
 * page that already exists.
 *
 * Deliberately best-effort: the invitation rows are already saved and their
 * links work regardless, so a mail failure — an address that already has an
 * account, or Supabase's hourly send limit — must not cost the professional
 * their setup. Step 4 shows the links either way.
 */
async function sendInviteEmails(
  rows: { invitee_email: string; token: string }[],
) {
  const admin = createAdminClient();
  if (!admin) return;

  const origin = siteUrl();

  await Promise.all(
    rows.map(async (row) => {
      try {
        await admin.auth.admin.inviteUserByEmail(row.invitee_email, {
          redirectTo: `${origin}/invite/${row.token}`,
        });
      } catch {
        // Link still works; nothing to recover here.
      }
    }),
  );
}

/**
 * SRS §4.3 — the work types that personalise Playbooks, examples and Whitby's
 * guidance. Stored per workspace in whitbyos_workspace_settings.
 *
 * §4.3.2 makes the step optional, so an empty selection is saved as an empty
 * list rather than treated as an error.
 */


/**
 * Screen 4 — Onboarding Step 1/5, Your Account.
 *
 * Their own profile, before anything about a company. The email is the one they
 * signed up with and is shown rather than asked for; changing it is an identity
 * change and belongs in Settings, not in a setup wizard.
 */
export async function saveAccountBasics(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const photo = formData.get("photo");

  const back = (message: string): never =>
    redirect(`/onboarding/account?error=${encodeURIComponent(message)}`);

  if (!fullName) back("Your name is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) back("Your session expired. Sign in and try again.");

  const { error } = await supabase
    .from("users")
    .update({ full_name: fullName, phone: phone || null, title_role: role || null })
    .eq("id", user!.id);

  if (error) back(error.message);

  // Optional, and never allowed to block the step — the same rule the logo
  // follows on the next one.
  try {
    const { storeAvatar } = await import("@/whitbyos/lib/avatar");
    if (photo instanceof File && photo.size > 0) await storeAvatar(photo);
  } catch {
    // A photo that would not store is not a reason to stop somebody signing up.
  }

  redirect("/onboarding/workspace");
}

const CLIENT_TYPES = new Set(["individual", "family", "company", "organization"]);

/** Figma offers Household; the enum does not. Family is the same relationship. */
function onboardingClientType(value: string) {
  if (value === "household") return "family";
  return CLIENT_TYPES.has(value) ? value : "family";
}

/**
 * Screen 4.2 — Onboarding Step 3/5, Client Workspace: Yes or No.
 *
 * No is a real answer: the organization works as one workspace, client-specific
 * nav is hidden, and no dummy client is invented for the wizard. Yes can still
 * continue without naming a first client.
 */
export async function createOnboardingClient(formData: FormData) {
  const uses = String(formData.get("usesClientWorkspaces") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const rawType = String(formData.get("clientType") ?? "").trim();
  const clientType = onboardingClientType(rawType);
  const classification =
    rawType === "household"
      ? "Household"
      : rawType === "individual"
        ? "Individual"
        : rawType === "company"
          ? "Company"
          : rawType === "organization"
            ? "Organization"
            : "Family";
  const primaryContact = String(formData.get("primaryContact") ?? "").trim();
  const primaryContactEmail = String(formData.get("primaryContactEmail") ?? "").trim();
  const primaryContactPhone = String(formData.get("primaryContactPhone") ?? "").trim();

  const back = (message: string): never =>
    redirect(`/onboarding/client-workspace?error=${encodeURIComponent(message)}`);

  if (uses !== "yes" && uses !== "no") {
    back("Choose Workspace: Yes or Workspace: No.");
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/onboarding/workspace");

  const enabled = uses === "yes";
  await setUsesClientWorkspaces(enabled);

  if (!enabled) {
    await ensureFirmClientId();
    redirect("/onboarding/plan");
  }

  if (!name) redirect("/onboarding/plan");
  if (!rawType) back("Classification is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ownerId = user?.id;
  if (!ownerId) back("Your session expired. Sign in and try again.");

  const { data: existing } = await supabase
    .from("whitbyos_clients")
    .select("id, primary_contact_id")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let clientId = existing?.id as string | undefined;

  if (clientId) {
    const { error } = await supabase
      .from("whitbyos_clients")
      .update({ name, client_type: clientType, classification })
      .eq("id", clientId);
    if (error) back(error.message);
  } else {
    const { data: client, error } = await supabase
      .from("whitbyos_clients")
      .insert({
        workspace_id: workspaceId,
        name,
        client_type: clientType,
        classification,
        status: "active",
        // `owner_user_id` is not null. Leaving it out failed every signup at this
        // step with the constraint's own words. The person setting the client up
        // during onboarding is its owner, which is what `createClientRecord` does
        // from the Clients screen too.
        owner_user_id: ownerId,
      })
      .select("id")
      .single();

    if (error || !client) back(error?.message ?? "Could not create the workspace.");
    clientId = client!.id as string;
  }

  if (primaryContact) {
    const [first, ...rest] = primaryContact.split(/\s+/);
    const contactFields = {
      first_name: first ?? primaryContact,
      last_name: rest.join(" "),
      /* Without it the contact cannot be invited to the portal, which is
         the next thing this person will be asked to do. */
      email: primaryContactEmail || null,
      phone: primaryContactPhone || null,
    };

    let contactId = existing?.primary_contact_id as string | undefined;

    if (contactId) {
      const { error } = await supabase.from("contacts").update(contactFields).eq("id", contactId);
      if (error) back(error.message);
    } else {
      const { data: contact } = await supabase
        .from("contacts")
        .insert({
          ...contactFields,
          created_by_workspace_id: workspaceId,
        })
        .select("id")
        .single();

      if (contact) {
        contactId = contact.id as string;
        await supabase
          .from("whitbyos_clients")
          .update({ primary_contact_id: contactId })
          .eq("id", clientId);
      }
    }

    if (contactId) {
      // `role`, not `relationship`: there is no such column, so this insert
      // had always been rejected. Nothing checked its error, so the contact was
      // written, the client pointed at them, and they appeared on the Contacts
      // list with no client and no role beside their name.
      const { data: member } = await supabase
        .from("whitbyos_client_members")
        .select("id")
        .eq("client_id", clientId)
        .eq("contact_id", contactId)
        .maybeSingle();

      if (!member) {
        const { error: memberError } = await supabase.from("whitbyos_client_members").insert({
          client_id: clientId,
          contact_id: contactId,
          role: "primary_contact",
          portal_access: false,
        });
        if (memberError) back(memberError.message);
      }
    }
  }

  redirect("/onboarding/plan");
}

/**
 * Screen 4.3 — Onboarding Step 4/5, Choose your plan.
 *
 * Writes the choice and nothing else. Billing is connected nowhere (§11.1.5),
 * so choosing Standard here records an intention rather than taking money — and
 * the trial the workspace is already on continues until something can charge.
 *
 * Choosing a card stays on this step. Continue is what leaves it.
 */
async function saveChosenPlan(formData: FormData) {
  const plan = String(formData.get("plan") ?? "").trim();
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/onboarding/workspace");

  if (PLANS.some((row) => row.value === plan)) {
    const supabase = await createClient();
    await supabase.from("workspaces").update({ plan }).eq("id", workspaceId);
  }

  return workspaceId;
}

export async function selectPlan(formData: FormData) {
  await saveChosenPlan(formData);
  revalidatePath("/onboarding/plan");
  redirect("/onboarding/plan");
}

export async function continueFromPlan(formData: FormData) {
  await saveChosenPlan(formData);
  redirect("/onboarding/invite");
}

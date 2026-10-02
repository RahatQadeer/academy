import { NextResponse } from "next/server";
import { getConfiguredClient, jsonError, missingConfig } from "@/base/auth/http";
import { createAdminClient } from "@/whitbyos/lib/supabase-admin";
import { findInvitationByToken } from "@/base/auth/invitation";
// Not `emailHasActiveAccount`, which base calls here before signing the invitee
// up. Its rule — one email, one active account — is right, but this is the one
// route where the address is *expected* to have an account already: Whitby
// creates it at the moment it invites, through `inviteUserByEmail`. Base's
// guard would turn every Whitby invitation into a 409. The same invariant is
// enforced further down instead, against the account that actually signed in.
import {
  EMAIL_ALREADY_REGISTERED,
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  normalizeEmail,
} from "@/base/lib/email";

/** The two invitation kinds that lead into the Client Portal rather than a workspace. */
const CLIENT_KINDS = ["client_member", "client_authorized_user"];

type Db = NonNullable<Awaited<ReturnType<typeof getConfiguredClient>>>;

/**
 * Writes the entitlement that decides which product this account lands in.
 *
 * Read-then-write rather than an upsert, because the upsert this replaced could
 * not do either half of its job and said nothing about it. The unique index
 * behind these rows is on `coalesce(workspace_id, '000…')`, not on the three
 * columns, so `onConflict: "user_id,product,workspace_id"` matched no
 * constraint and Postgres rejected the whole statement; and `entitlements` has
 * an insert policy but no update policy, so run as the user it could never have
 * updated a row anyway. `bootstrap` gives every new account a trial row per
 * product, so there is nearly always a row to update. The result was that
 * accepting an invitation granted nothing, and the person who accepted was left
 * on the switcher looking at four products instead of in the one they were
 * invited to.
 *
 * Service role for the same reason the rest of this route uses it: the account
 * is seconds old and cannot grant itself anything.
 */
async function grantEntitlement(
  db: Db,
  grant: { userId: string; product: string; workspaceId: string | null },
) {
  // One landing at a time, or `resolveLandingPath` picks between defaults by
  // whichever row comes back first, which is to say arbitrarily.
  await db
    .from("entitlements")
    .update({ is_default_landing: false })
    .eq("user_id", grant.userId)
    .eq("is_default_landing", true);

  const match = db
    .from("entitlements")
    .select("id")
    .eq("user_id", grant.userId)
    .eq("product", grant.product);

  const { data: existing } = await (grant.workspaceId
    ? match.eq("workspace_id", grant.workspaceId)
    : match.is("workspace_id", null)
  ).maybeSingle();

  if (existing) {
    await db
      .from("entitlements")
      .update({ status: "active", is_default_landing: true })
      .eq("id", existing.id as string);
    return;
  }

  await db.from("entitlements").insert({
    user_id: grant.userId,
    product: grant.product,
    workspace_id: grant.workspaceId,
    status: "active",
    is_default_landing: true,
  });
}

/**
 * GoTrue says "User is banned" for an account that was closed, and that is the
 * whole of what somebody accepting an invitation used to be told: the name of a
 * service they have never heard of, and a word nobody applied to them. Whoever
 * sent the invitation is the only person who can do anything about it, so say
 * that instead.
 */
function acceptError(message: string) {
  return /banned/i.test(message)
    ? jsonError(
        "This email belongs to a closed account, so the invitation cannot be accepted with it. Ask whoever invited you to send the invitation to a different address.",
      )
    : jsonError(message);
}

export async function POST(request: Request) {
  const supabase = await getConfiguredClient();
  if (!supabase) return missingConfig();

  const body = (await request.json()) as {
    token?: string;
    password?: string;
    fullName?: string;
    role?: string;
  };

  void body.role;

  if (!body.token || !body.password) {
    return jsonError("Invitation token and password are required.");
  }

  // Same reason as the page that led here: the person accepting has no session
  // to read the row with. The token is what proves they may.
  const invitation = await findInvitationByToken(body.token);
  if (!invitation) return jsonError("This invitation is not valid.");

  // Needed twice below: to link a client to their contact, and to mark the
  // invitation accepted — both of which the brand-new account cannot do itself.
  const admin = createAdminClient();
  if (invitation.status !== "pending") {
    return jsonError("This invitation is no longer active.");
  }
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return jsonError("This invitation has expired.");
  }

  const inviteEmail = normalizeEmail(invitation.invitee_email);

  const { data: existing } = await supabase.auth.getUser();

  if (existing.user) {
    // Already signed in, because the emailed link signs you in on the way here.
    // The password they just typed has to be set on that account — otherwise
    // the form takes a password, says nothing, and does nothing with it, and
    // they can never sign in again without another emailed link.
    const { error } = await supabase.auth.updateUser({
      password: body.password,
      data: body.fullName ? { full_name: body.fullName } : undefined,
    });
    if (error) return jsonError(error.message);
  } else {
    // No session, because this link was opened directly rather than through the
    // emailed one — copied out of the client's Contacts tab, or opened later in
    // another browser. `signUp` cannot carry this branch on its own.
    //
    // Whitby creates the auth account at the moment it invites, through
    // `inviteUserByEmail`, so by the time anyone reaches this form the address
    // almost always exists already. Supabase answers a sign-up for an existing
    // address with 200, no error and no session — deliberately, so a sign-up
    // form cannot be used to test which addresses have accounts. Read as a
    // failure to create the account, which is what the code below it did, that
    // silence became "Could not create the invited account" for the one case
    // that is entirely normal here.
    //
    // The token is proof of the address, exactly as it is for the branch above,
    // so the account is settled through the service role — created if it is
    // somehow missing, given the password they just typed if it is not — and
    // then signed into with that password to get the session the rest of this
    // route needs.
    if (!admin) {
      const { error } = await supabase.auth.signUp({
        email: invitation.invitee_email,
        password: body.password,
        options: { data: { full_name: body.fullName } },
      });
      if (error) return acceptError(error.message);
    } else {
      const { data: account } = await admin
        .from("users")
        .select("id")
        .ilike("email", invitation.invitee_email.trim())
        .maybeSingle();

      // `email_confirm` because the invitation is the confirmation: it only
      // ever went to this address, and requiring a second round trip through
      // the inbox to finish accepting one is a dead end, not a check.
      const { error } = account
        ? await admin.auth.admin.updateUserById(account.id as string, {
            password: body.password,
            email_confirm: true,
            user_metadata: body.fullName ? { full_name: body.fullName } : undefined,
          })
        : await admin.auth.admin.createUser({
            email: invitation.invitee_email,
            password: body.password,
            email_confirm: true,
            user_metadata: body.fullName ? { full_name: body.fullName } : {},
          });
      if (error) return acceptError(error.message);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.invitee_email,
        password: body.password,
      });
      if (signInError) return acceptError(signInError.message);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError(
      "Your invitation is valid, but the account could not be signed in. Ask whoever invited you to send a new invitation.",
    );
  }

  // `handle_new_user` fills `public.users.full_name` from the local part of the
  // address when the invitation creates the account, so it reads as "j.smith"
  // until somebody says otherwise. This form is where they say otherwise, and
  // this row is what the portal greets them by, so the name they typed goes in.
  if (body.fullName && admin) {
    await admin.from("users").update({ full_name: body.fullName }).eq("id", user.id);
  }

  // One email, one active account — base's rule, checked where it can be true
  // here: the session belongs to somebody other than the invitee.
  if (normalizeEmail(user.email) && normalizeEmail(user.email) !== inviteEmail) {
    return jsonError(EMAIL_ALREADY_REGISTERED_MESSAGE, 409, EMAIL_ALREADY_REGISTERED);
  }

  if (invitation.context_type === "team_member") {
    // `workspace_members` is unique on the pair, but an upsert that does not say
    // so conflicts on the primary key instead — and with no id supplied that is
    // an insert, which fails on anyone already in the workspace.
    //
    // Through the service role, and read for an error, because this one write
    // is what "they have arrived" means. Their own client can insert the row
    // but not update one, and RLS turns an upsert into an update the moment a
    // half-finished earlier attempt left something behind: the accept then
    // reported success, signed them in, and left Team & Access saying Invited
    // about somebody already inside the workspace. The token was checked
    // above, and that is the authorisation.
    const { error: memberError } = await (admin ?? supabase)
      .from("workspace_members")
      .upsert(
        {
          workspace_id: invitation.context_id,
          user_id: user.id,
          role: invitation.role_or_relationship || "viewer",
          status: "active",
        },
        { onConflict: "workspace_id,user_id" },
      );

    if (memberError) {
      return jsonError(
        "Your account is ready, but you could not be added to the workspace. Ask whoever invited you to send the invitation again.",
      );
    }
    await grantEntitlement(admin ?? supabase, {
      userId: user.id,
      product: "whitbyos",
      workspaceId: invitation.context_id,
    });
  }

  // A client accepting is joining a household, not a workspace, so none of the
  // team branch applies: what they need is the link from this brand-new account
  // to the contact record the professional already created for them.
  //
  // `resolveContact` in the portal can also fall back to matching on email, but
  // that is explicitly a stopgap there — emails change and alias — so the
  // explicit link is written here, which is what makes it authoritative.
  //
  // This runs through the service role. The account was made a moment ago and
  // owns nothing yet: it cannot see the client, its members, or its contacts
  // under RLS, and it should not be given the right to. The token was already
  // checked above, and that is the authorisation.
  if (CLIENT_KINDS.includes(invitation.context_type)) {
    if (!admin) {
      return jsonError(
        "Your account was created, but it could not be linked to your household. Ask whoever invited you to try again.",
      );
    }

    const { data: client } = await admin
      .from("whitbyos_clients")
      .select("id, workspace_id")
      .eq("id", invitation.context_id)
      .maybeSingle();

    const { data: members } = await admin
      .from("whitbyos_client_members")
      .select("id, contact_id, contacts (email)")
      .eq("client_id", invitation.context_id);

    const wanted = invitation.invitee_email.trim().toLowerCase();
    const member = (members ?? []).find((row) => {
      const contact = row.contacts as unknown as { email: string | null } | null;
      return (contact?.email ?? "").trim().toLowerCase() === wanted;
    });

    if (!member) {
      return jsonError(
        "Your account was created, but this invitation no longer matches a contact on the account. Ask whoever invited you to send a new one.",
      );
    }

    await admin
      .from("client_portal_identities")
      .upsert({ user_id: user.id, contact_id: member.contact_id }, { onConflict: "user_id" });

    // The professional granted this when they invited; re-asserting it here
    // means an invitation that was sent still lets them in if it was turned
    // off and on again in between.
    await admin
      .from("whitbyos_client_members")
      .update({ portal_access: true })
      .eq("id", member.id);

    if (client) {
      await grantEntitlement(admin, {
        userId: user.id,
        product: "client_portal",
        workspaceId: client.workspace_id as string | null,
      });
    }
  }

  if (invitation.context_type === "academy_instructor") {
    const { createAdminClient, isSupabaseAdminConfigured } = await import(
      "@/base/lib/supabase/admin"
    );
    if (!isSupabaseAdminConfigured()) {
      return jsonError("Academy instructor invitations are not configured yet.");
    }
    const admin = createAdminClient();
    const { error: acceptError } = await admin.rpc("academy_accept_instructor_invitation", {
      p_token: body.token,
      p_user_id: user.id,
    });
    if (acceptError) {
      return jsonError(acceptError.message || "Could not complete the instructor invitation.");
    }

    return NextResponse.json({ redirect: "/academy/instructor" });
  }

  if (invitation.context_type === "academy_admin") {
    const { createAdminClient, isSupabaseAdminConfigured } = await import(
      "@/base/lib/supabase/admin"
    );
    if (!isSupabaseAdminConfigured()) {
      return jsonError("Academy admin invitations are not configured yet.");
    }
    const admin = createAdminClient();
    const { error: acceptError } = await admin.rpc("academy_accept_admin_invitation", {
      p_token: body.token,
      p_user_id: user.id,
    });
    if (acceptError) {
      return jsonError(acceptError.message || "Could not complete the admin invitation.");
    }

    return NextResponse.json({ redirect: "/academy/admin" });
  }

  await supabase
    .from("invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  // A teammate goes through the photo step on the way in; everyone else lands
  // where they always did. It is one screen, it is skippable, and it is the
  // only moment where asking for a photo is not an interruption of something
  // else they were doing.
  const landing = CLIENT_KINDS.includes(invitation.context_type)
    ? "/client-portal"
    : invitation.context_type === "team_member"
      ? "/welcome"
      : "/switcher";

  return NextResponse.json({ redirect: landing });
}

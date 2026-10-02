import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvitationRecord } from "@/base/auth/invitation";
import { decodePartnerTeamInvite } from "@/partner-center/team/lib/invite-payload";
import type { PartnerAccessLevel } from "@/partner-center/team/types";
import type { PartnerTeamFunction } from "@/partner-center/types/partner";

type AcceptUser = {
  id: string;
  email?: string | null;
};

export type AcceptPartnerTeamInviteResult = { error?: string };

function splitName(fullName: string | null | undefined, email: string) {
  const trimmed = fullName?.trim() || "";
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { first_name: parts[0], last_name: "" };
    return {
      first_name: parts[0]!,
      last_name: parts.slice(1).join(" "),
    };
  }
  const local = email.split("@")[0]?.trim() || "Partner";
  return { first_name: local, last_name: "" };
}

function mergePreferredMethod(
  enrichment: Record<string, unknown> | null | undefined,
  preferred: string,
): Record<string, unknown> | null {
  const base =
    enrichment && typeof enrichment === "object" && !Array.isArray(enrichment)
      ? { ...enrichment }
      : {};
  if (preferred) {
    base.preferred_contact_method = preferred;
  }
  return Object.keys(base).length > 0 ? base : null;
}

async function grantPartnerEntitlement(
  admin: SupabaseClient,
  userId: string,
): Promise<{ error?: string }> {
  await admin
    .from("entitlements")
    .update({ is_default_landing: false })
    .eq("user_id", userId)
    .eq("is_default_landing", true);

  const { data: existing } = await admin
    .from("entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("product", "partner_center")
    .is("workspace_id", null)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("entitlements")
      .update({ status: "active", is_default_landing: true })
      .eq("id", existing.id as string);
    return error ? { error: partnerFacingError("Could not accept the invite.", error.message) } : {};
  }

  const { error } = await admin.from("entitlements").insert({
    user_id: userId,
    product: "partner_center",
    workspace_id: null,
    status: "active",
    is_default_landing: true,
  });
  return error ? { error: partnerFacingError("Could not accept the invite.", error.message) } : {};
}

/**
 * Completes a partner_team invitation: contact + membership + entitlement + audit.
 *
 * Preconditions: status must be pending; expires_at must not be in the past.
 * Membership insert uses ON CONFLICT (partner_profile_id, contact_id) DO NOTHING
 * (requires partner_team_members_profile_contact_uidx).
 *
 * Audit fail-closed: only when this call created a new membership row.
 */
export async function acceptPartnerTeamInvite(input: {
  admin: SupabaseClient;
  invitation: InvitationRecord;
  user: AcceptUser;
  fullName?: string | null;
}): Promise<AcceptPartnerTeamInviteResult> {
  const { admin, invitation, user, fullName } = input;

  if (invitation.context_type !== "partner_team") {
    return { error: "This invitation is not a Partner Center team invite." };
  }
  if (invitation.status !== "pending") {
    return { error: "This invitation is no longer active." };
  }
  if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
    return { error: "This invitation has expired." };
  }
  if (!invitation.context_id) {
    return { error: "This invitation is missing a partner profile." };
  }

  const profileId = invitation.context_id;
  const email = invitation.invitee_email.trim().toLowerCase();
  if (!email) return { error: "This invitation is missing an email address." };

  const decoded = decodePartnerTeamInvite(invitation.role_or_relationship);
  const fn: PartnerTeamFunction = decoded?.function ?? "referral_contact";
  const access: PartnerAccessLevel = decoded?.access_level ?? "standard";
  const titleRole = decoded?.title_role ?? "";
  const salutation = decoded?.salutation?.trim() || "";
  const phone = decoded?.phone?.trim() || "";
  const preferred = decoded?.preferred_contact_method || "";
  const inviteName = invitation.invitee_name?.trim() || fullName || null;

  const { data: existingContact } = await admin
    .from("contacts")
    .select("id, title_role, salutation, phone, enrichment_data")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  let contactId = existingContact?.id as string | undefined;
  if (!contactId) {
    const names = splitName(inviteName, email);
    const enrichment = mergePreferredMethod(null, preferred);
    const { data: created, error } = await admin
      .from("contacts")
      .insert({
        first_name: names.first_name,
        last_name: names.last_name || names.first_name,
        email,
        title_role: titleRole || null,
        salutation: salutation || null,
        phone: phone || null,
        enrichment_data: enrichment,
        source: "partner_team_invite",
        created_by_workspace_id: null,
      })
      .select("id")
      .single();
    if (error || !created) {
      return { error: partnerFacingError("Could not create the contact record.", error?.message) };
    }
    contactId = created.id as string;
  } else {
    const patch: Record<string, unknown> = {};
    if (titleRole && !(existingContact?.title_role as string | null)?.trim()) {
      patch.title_role = titleRole;
    }
    if (salutation && !(existingContact?.salutation as string | null)?.trim()) {
      patch.salutation = salutation;
    }
    if (phone && !(existingContact?.phone as string | null)?.trim()) {
      patch.phone = phone;
    }
    if (preferred) {
      const current =
        (existingContact?.enrichment_data as Record<string, unknown> | null) ??
        null;
      const existingPreferred =
        current && typeof current.preferred_contact_method === "string"
          ? current.preferred_contact_method
          : "";
      if (!existingPreferred) {
        patch.enrichment_data = mergePreferredMethod(current, preferred);
      }
    }
    if (Object.keys(patch).length > 0) {
      await admin.from("contacts").update(patch).eq("id", contactId);
    }
  }

  const insertPayload = {
    partner_profile_id: profileId,
    contact_id: contactId,
    function: fn,
    access_level: access,
  };

  const { data: inserted, error: insertError } = await admin
    .from("partner_team_members")
    .upsert(insertPayload, {
      onConflict: "partner_profile_id,contact_id",
      ignoreDuplicates: true,
    })
    .select("id, partner_profile_id, contact_id, function, access_level")
    .maybeSingle();

  // ignoreDuplicates + select: when conflict, PostgREST often returns no row.
  let membership = inserted;
  let createdMembership = Boolean(inserted?.id);

  if (insertError) {
    return { error: partnerFacingError("Could not accept the invite.", insertError.message) };
  }

  if (!membership) {
    const { data: existingMember, error: selectError } = await admin
      .from("partner_team_members")
      .select("id, partner_profile_id, contact_id, function, access_level")
      .eq("partner_profile_id", profileId)
      .eq("contact_id", contactId)
      .maybeSingle();
    if (selectError || !existingMember) {
      return {
        error:
          selectError?.message ||
          "Could not load the partner team membership after accept.",
      };
    }
    membership = existingMember;
    createdMembership = false;
  }

  const entitled = await grantPartnerEntitlement(admin, user.id);
  if (entitled.error) return { error: entitled.error };

  const snapshot = {
    function: membership.function,
    access_level: membership.access_level,
    contact_id: membership.contact_id,
    partner_profile_id: membership.partner_profile_id,
  };

  const { error: auditError } = await admin.from("audit_log").insert({
    actor_user_id: user.id,
    entity_type: "partner_team_member",
    entity_id: membership.id,
    action: "accept_invite",
    previous_value: null,
    new_value: snapshot,
    reason: null,
  });

  if (auditError && createdMembership) {
    await admin.from("partner_team_members").delete().eq("id", membership.id);
    return {
      error: partnerFacingError("Could not finish saving. Try again.", auditError.message),
    };
  }

  return {};
}

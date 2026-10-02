/**
 * Company & Team mutations.
 *
 * Session client only (`createClient`) for every domain write and audit_log
 * insert — same auth context as checklist partnerWriter. Do not use
 * createAdminClient here (contrast application-actions, which needs admin for
 * pre-membership profile insert).
 *
 * App-level gate: access_level === "admin". RLS only encodes membership.
 */
"use server";

import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import {
  partnerTeamInviteEmailRedirect,
  partnerTeamInvitePath,
} from "@/partner-center/lib/invite-url";
import { resolvePartner } from "@/partner-center/lib/resolve-partner";
import type { PartnerContext } from "@/partner-center/types/partner";
import type { PartnerTeamFunction } from "@/partner-center/types/partner";
import {
  createLocationId,
  parseLocations,
  serializeLocations,
  serializeMarkets,
} from "@/partner-center/team/lib/addresses";
import { writeTeamAudit } from "@/partner-center/team/lib/audit";
import { encodePartnerTeamInvite } from "@/partner-center/team/lib/invite-payload";
import type { CompanyLocation, PartnerAccessLevel } from "@/partner-center/team/types";
import {
  ACCESS_LEVELS,
  PREFERRED_CONTACT_METHODS,
  TEAM_FUNCTIONS,
  isAdminAccess,
} from "@/partner-center/team/lib/labels";
import type { PreferredContactMethod } from "@/partner-center/team/lib/labels";

type ActionResult = {
  error?: string;
  ok?: boolean;
  warning?: string;
  invitePath?: string;
};

type WriterOk = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: PartnerContext;
  userId: string;
};

const TEAM_PATH = "/partner-center/team";
const FUNCTION_SET = new Set(TEAM_FUNCTIONS.map((item) => item.value));
const ACCESS_SET = new Set(ACCESS_LEVELS.map((item) => item.value));
const METHOD_SET = new Set(PREFERRED_CONTACT_METHODS.map((item) => item.value));

function mergePreferredMethod(
  enrichment: Record<string, unknown> | null | undefined,
  preferred: PreferredContactMethod | "",
): Record<string, unknown> | null {
  const base =
    enrichment && typeof enrichment === "object" && !Array.isArray(enrichment)
      ? { ...enrichment }
      : {};
  if (preferred) {
    base.preferred_contact_method = preferred;
  } else {
    delete base.preferred_contact_method;
  }
  return Object.keys(base).length > 0 ? base : null;
}

async function teamWriter(): Promise<{ error: string } | WriterOk> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to continue." };
  }
  const session = await getSessionProfile();
  if (!session) return { error: "Sign in to continue." };
  const entitled = session.entitlements.some(
    (item) =>
      item.product === "partner_center" &&
      (item.status === "active" || item.status === "trial"),
  );
  if (!entitled) {
    return { error: "Partner Center access is not available for this account." };
  }
  const supabase = await createClient();
  const context = await resolvePartner(session.user, session.entitlements);
  if (!context?.profile) return { error: "No partner profile was found." };
  if (!isAdminAccess(context.teamMember?.access_level)) {
    return { error: "Only Partner Center admins can manage company and team." };
  }
  return { supabase, context, userId: session.user.id };
}

function revalidateTeam() {
  revalidatePath(TEAM_PATH, "page");
}

async function failClosedAudit(
  supabase: WriterOk["supabase"],
  audit: Parameters<typeof writeTeamAudit>[1],
  revert: () => Promise<{ error?: string }>,
): Promise<ActionResult> {
  const audited = await writeTeamAudit(supabase, audit);
  if (!audited.error) return { ok: true };

  const reverted = await revert();
  if (reverted.error) {
    return {
      error: `${audited.error} The change may have applied without an audit row — contact support. Revert also failed: ${reverted.error}`,
    };
  }
  return { error: audited.error };
}

async function countAdmins(
  supabase: WriterOk["supabase"],
  profileId: string,
): Promise<{ count: number; error?: string }> {
  const { data, error } = await supabase
    .from("partner_team_members")
    .select("id")
    .eq("partner_profile_id", profileId)
    .eq("access_level", "admin");
  if (error) return { count: 0, error: partnerFacingError("Could not update team details.", error.message) };
  return { count: (data ?? []).length };
}

export async function updateCompanyDetails(incoming: {
  legal_name: string;
  website: string;
  business_type: string;
  markets: string;
  audience_served: string;
}): Promise<ActionResult> {
  const loaded = await teamWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, context, userId } = loaded;
  const companyId = context.company?.id ?? context.profile?.company_id;
  if (!companyId) return { error: "No company record was found." };

  const legal_name = incoming.legal_name.trim();
  if (!legal_name) return { error: "Enter a legal business name." };

  const { data: before } = await supabase
    .from("companies")
    .select("name, website, industry_type, markets, audience_served")
    .eq("id", companyId)
    .maybeSingle();

  const previous = {
    name: before?.name ?? null,
    website: before?.website ?? null,
    industry_type: before?.industry_type ?? null,
    markets: before?.markets ?? null,
    audience_served: before?.audience_served ?? null,
  };
  const next = {
    name: legal_name,
    website: incoming.website.trim() || null,
    industry_type: incoming.business_type.trim() || null,
    markets: serializeMarkets(incoming.markets),
    audience_served: incoming.audience_served.trim() || null,
  };

  const { error } = await supabase.from("companies").update(next).eq("id", companyId);
  if (error) return { error: partnerFacingError("Could not update team details.", error.message) };

  const result = await failClosedAudit(
    supabase,
    {
      actorUserId: userId,
      entityType: "company",
      entityId: companyId,
      action: "company.update_details",
      previousValue: previous,
      newValue: next,
    },
    async () => {
      const { error: revertError } = await supabase
        .from("companies")
        .update(previous)
        .eq("id", companyId);
      return revertError ? { error: partnerFacingError("Could not update team details.", revertError.message) } : {};
    },
  );
  if (result.error) return result;
  revalidateTeam();
  return { ok: true };
}

export async function saveCompanyLocation(incoming: {
  location_id?: string | null;
  label: string;
  street: string;
  postal_code: string;
  country: string;
}): Promise<ActionResult> {
  const loaded = await teamWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, context, userId } = loaded;
  const companyId = context.company?.id ?? context.profile?.company_id;
  if (!companyId) return { error: "No company record was found." };

  const label = incoming.label.trim();
  const street = incoming.street.trim();
  if (!label) return { error: "Enter a country." };
  if (!street) return { error: "Enter a street address." };

  const { data: company } = await supabase
    .from("companies")
    .select("addresses")
    .eq("id", companyId)
    .maybeSingle();

  const previousAddresses = parseLocations(company?.addresses);
  const previousSerialized = serializeLocations(previousAddresses);
  const nextLoc: CompanyLocation = {
    id: incoming.location_id?.trim() || createLocationId(),
    label,
    street,
    postal_code: incoming.postal_code.trim(),
    country: incoming.country.trim() || "United States",
  };

  let nextAddresses: CompanyLocation[];
  const existingIndex = previousAddresses.findIndex((loc) => loc.id === nextLoc.id);
  if (existingIndex >= 0) {
    nextAddresses = previousAddresses.map((loc, i) =>
      i === existingIndex ? nextLoc : loc,
    );
  } else {
    nextAddresses = [...previousAddresses, nextLoc];
  }
  const nextSerialized = serializeLocations(nextAddresses);

  const { error } = await supabase
    .from("companies")
    .update({ addresses: nextSerialized })
    .eq("id", companyId);
  if (error) return { error: partnerFacingError("Could not update team details.", error.message) };

  const result = await failClosedAudit(
    supabase,
    {
      actorUserId: userId,
      entityType: "company",
      entityId: companyId,
      action: existingIndex >= 0 ? "company.update_location" : "company.add_location",
      previousValue: { addresses: previousSerialized },
      newValue: { addresses: nextSerialized },
    },
    async () => {
      const { error: revertError } = await supabase
        .from("companies")
        .update({ addresses: previousSerialized })
        .eq("id", companyId);
      return revertError ? { error: partnerFacingError("Could not update team details.", revertError.message) } : {};
    },
  );
  if (result.error) return result;
  revalidateTeam();
  return { ok: true };
}

export async function inviteTeamMember(incoming: {
  email: string;
  name: string;
  role_title: string;
  salutation: string;
  phone: string;
  preferred_contact_method: string;
  function: string;
  access_level: string;
}): Promise<ActionResult> {
  const loaded = await teamWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, context, userId } = loaded;
  const profile = context.profile;
  if (!profile) return { error: "No partner profile was found." };

  const email = incoming.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "Enter a valid email address." };

  const fn = incoming.function.trim();
  let access = incoming.access_level.trim();
  if (!FUNCTION_SET.has(fn as PartnerTeamFunction)) {
    return { error: "Choose a valid contact function." };
  }
  // Contact function "Read Only" must mean read-only Partner Center access.
  if (fn === "read_only") access = "read_only";
  if (!ACCESS_SET.has(access as PartnerAccessLevel)) {
    return { error: "Choose a valid access level." };
  }

  const preferredRaw = incoming.preferred_contact_method.trim();
  const preferred = METHOD_SET.has(preferredRaw as PreferredContactMethod)
    ? (preferredRaw as PreferredContactMethod)
    : "";

  const reader = createAdminClient() ?? supabase;
  const { data: existingContacts } = await reader
    .from("contacts")
    .select("id, email")
    .ilike("email", email);
  const contactIds = (existingContacts ?? []).map((c) => c.id as string);
  if (contactIds.length > 0) {
    const { data: existingMembers } = await reader
      .from("partner_team_members")
      .select("id")
      .eq("partner_profile_id", profile.id)
      .in("contact_id", contactIds)
      .limit(1);
    if ((existingMembers ?? []).length > 0) {
      return { error: "Already on the team." };
    }
  }

  const { data: pendingInvites } = await supabase
    .from("invitations")
    .select("id")
    .eq("context_type", "partner_team")
    .eq("context_id", profile.id)
    .eq("status", "pending")
    .ilike("invitee_email", email)
    .limit(1);
  if ((pendingInvites ?? []).length > 0) {
    return { error: "Invite already pending." };
  }

  const inviteeName = incoming.name.trim() || null;
  const token = randomUUID();
  const rolePayload = encodePartnerTeamInvite({
    function: fn as PartnerTeamFunction,
    access_level: access as PartnerAccessLevel,
    title_role: incoming.role_title,
    salutation: incoming.salutation,
    phone: incoming.phone,
    preferred_contact_method: preferred,
  });
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const inviteRow = {
    token,
    inviter_user_id: userId,
    invitee_email: email,
    invitee_name: inviteeName,
    context_type: "partner_team" as const,
    context_id: profile.id,
    role_or_relationship: rolePayload,
    status: "pending" as const,
    sent_at: new Date().toISOString(),
    expires_at: expiresAt,
    created_by: userId,
  };

  const { data: created, error } = await supabase
    .from("invitations")
    .insert(inviteRow)
    .select("id")
    .single();
  if (error || !created) {
    return { error: partnerFacingError("Could not create the invitation.", error?.message) };
  }

  const invitationId = created.id as string;
  const result = await failClosedAudit(
    supabase,
    {
      actorUserId: userId,
      entityType: "invitation",
      entityId: invitationId,
      action: "partner_team.invite",
      previousValue: null,
      newValue: {
        invitee_email: email,
        invitee_name: inviteeName,
        function: fn,
        access_level: access,
        title_role: incoming.role_title.trim(),
        salutation: incoming.salutation.trim() || null,
        phone: incoming.phone.trim() || null,
        preferred_contact_method: preferred || null,
      },
    },
    async () => {
      const { error: revertError } = await supabase
        .from("invitations")
        .delete()
        .eq("id", invitationId);
      return revertError ? { error: partnerFacingError("Could not update team details.", revertError.message) } : {};
    },
  );
  if (result.error) return result;

  const invitePath = partnerTeamInvitePath(token);
  // Invitation row is authoritative. Mail is best-effort — never fail the
  // action after row + audit landed; surface a warning + copyable path instead.
  const admin = createAdminClient();
  if (!admin) {
    revalidateTeam();
    return {
      ok: true,
      warning:
        "Invitation created, but no email was sent — the mail service key is not set. Share the invite link below.",
      invitePath,
    };
  }

  try {
    const { error: mailError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: partnerTeamInviteEmailRedirect(token),
    });
    if (mailError) {
      const message = mailError.message || String(mailError);
      revalidateTeam();
      return {
        ok: true,
        warning: /already been registered|already exists|email_exists/i.test(message)
          ? `${email} already has an account, so no invitation email was sent. Share the invite link below.`
          : `Invitation created, but the email could not be sent: ${message}. Share the invite link below.`,
        invitePath,
      };
    }
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    revalidateTeam();
    return {
      ok: true,
      warning: /already been registered|already exists|email_exists/i.test(message)
        ? `${email} already has an account, so no invitation email was sent. Share the invite link below.`
        : `Invitation created, but the email could not be sent: ${message}. Share the invite link below.`,
      invitePath,
    };
  }

  revalidateTeam();
  return { ok: true, invitePath };
}

export async function updateTeamMember(incoming: {
  member_id: string;
  function: string;
  access_level: string;
  role_title: string;
  salutation: string;
  phone: string;
  preferred_contact_method: string;
}): Promise<ActionResult> {
  const loaded = await teamWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, context, userId } = loaded;
  const profile = context.profile;
  if (!profile) return { error: "No partner profile was found." };

  const memberId = incoming.member_id.trim();
  if (!memberId) return { error: "Missing team member." };

  const fn = incoming.function.trim();
  let access = incoming.access_level.trim();
  if (!FUNCTION_SET.has(fn as PartnerTeamFunction)) {
    return { error: "Choose a valid contact function." };
  }
  // Contact function "Read Only" must mean read-only Partner Center access.
  if (fn === "read_only") access = "read_only";
  if (!ACCESS_SET.has(access as PartnerAccessLevel)) {
    return { error: "Choose a valid access level." };
  }

  const preferredRaw = incoming.preferred_contact_method.trim();
  const preferred = METHOD_SET.has(preferredRaw as PreferredContactMethod)
    ? (preferredRaw as PreferredContactMethod)
    : "";

  const { data: member } = await supabase
    .from("partner_team_members")
    .select("*")
    .eq("id", memberId)
    .eq("partner_profile_id", profile.id)
    .maybeSingle();
  if (!member) return { error: "Team member not found." };

  const contactId = member.contact_id as string;
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, salutation, phone, title_role, enrichment_data")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return { error: "Contact record not found." };

  const previousMember = {
    function: member.function as string,
    access_level: member.access_level as string | null,
  };
  const nextMember = { function: fn, access_level: access };

  if (previousMember.access_level === "admin" && access !== "admin") {
    const admins = await countAdmins(supabase, profile.id);
    if (admins.error) return { error: admins.error };
    if (admins.count <= 1) {
      return {
        error: "Cannot remove admin access from the last Partner Center admin.",
      };
    }
  }

  const previousContact = {
    salutation: (contact.salutation as string | null) ?? null,
    phone: (contact.phone as string | null) ?? null,
    title_role: (contact.title_role as string | null) ?? null,
    enrichment_data:
      (contact.enrichment_data as Record<string, unknown> | null) ?? null,
  };
  const nextContact = {
    salutation: incoming.salutation.trim() || null,
    phone: incoming.phone.trim() || null,
    title_role: incoming.role_title.trim() || null,
    enrichment_data: mergePreferredMethod(
      previousContact.enrichment_data,
      preferred,
    ),
  };

  const { error: memberError } = await supabase
    .from("partner_team_members")
    .update(nextMember)
    .eq("id", memberId);
  if (memberError) return { error: partnerFacingError("Could not update team details.", memberError.message) };

  const { error: contactError } = await supabase
    .from("contacts")
    .update(nextContact)
    .eq("id", contactId);
  if (contactError) {
    await supabase
      .from("partner_team_members")
      .update(previousMember)
      .eq("id", memberId);
    return { error: partnerFacingError("Could not update team details.", contactError.message) };
  }

  const result = await failClosedAudit(
    supabase,
    {
      actorUserId: userId,
      entityType: "partner_team_member",
      entityId: memberId,
      action: "partner_team.update_member",
      previousValue: { member: previousMember, contact: previousContact },
      newValue: { member: nextMember, contact: nextContact },
    },
    async () => {
      const { error: memberRevert } = await supabase
        .from("partner_team_members")
        .update(previousMember)
        .eq("id", memberId);
      const { error: contactRevert } = await supabase
        .from("contacts")
        .update(previousContact)
        .eq("id", contactId);
      if (memberRevert || contactRevert) {
        return {
          error: partnerFacingError(
            "Could not update team details.",
            [memberRevert?.message, contactRevert?.message]
              .filter(Boolean)
              .join(" "),
          ),
        };
      }
      return {};
    },
  );
  if (result.error) return result;
  revalidateTeam();
  return { ok: true };
}

export async function removeTeamMember(incoming: {
  member_id: string;
}): Promise<ActionResult> {
  const loaded = await teamWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, context, userId } = loaded;
  const profile = context.profile;
  if (!profile) return { error: "No partner profile was found." };

  const memberId = incoming.member_id.trim();
  if (!memberId) return { error: "Missing team member." };

  const { data: member } = await supabase
    .from("partner_team_members")
    .select("*")
    .eq("id", memberId)
    .eq("partner_profile_id", profile.id)
    .maybeSingle();
  if (!member) return { error: "Team member not found." };

  if (member.access_level === "admin") {
    const admins = await countAdmins(supabase, profile.id);
    if (admins.error) return { error: admins.error };
    if (admins.count <= 1) {
      return {
        error: "Cannot remove the last Partner Center admin from the team.",
      };
    }
  }

  const snapshot = {
    id: member.id,
    partner_profile_id: member.partner_profile_id,
    contact_id: member.contact_id,
    function: member.function,
    access_level: member.access_level,
  };

  const { error } = await supabase
    .from("partner_team_members")
    .delete()
    .eq("id", memberId);
  if (error) return { error: partnerFacingError("Could not update team details.", error.message) };

  const result = await failClosedAudit(
    supabase,
    {
      actorUserId: userId,
      entityType: "partner_team_member",
      entityId: memberId,
      action: "partner_team.remove_member",
      previousValue: snapshot,
      newValue: null,
      reason: "removed_from_team",
    },
    async () => {
      const { error: revertError } = await supabase
        .from("partner_team_members")
        .insert({
          id: snapshot.id,
          partner_profile_id: snapshot.partner_profile_id,
          contact_id: snapshot.contact_id,
          function: snapshot.function,
          access_level: snapshot.access_level,
        });
      return revertError ? { error: partnerFacingError("Could not update team details.", revertError.message) } : {};
    },
  );
  if (result.error) return result;
  revalidateTeam();
  return { ok: true };
}

export async function setPrimaryContact(incoming: {
  member_id: string;
}): Promise<ActionResult> {
  const loaded = await teamWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, context, userId } = loaded;
  const profile = context.profile;
  if (!profile) return { error: "No partner profile was found." };

  const memberId = incoming.member_id.trim();
  if (!memberId) return { error: "Missing team member." };

  const { data: member } = await supabase
    .from("partner_team_members")
    .select("id, contact_id")
    .eq("id", memberId)
    .eq("partner_profile_id", profile.id)
    .maybeSingle();
  if (!member) return { error: "Team member not found." };

  const contactId = member.contact_id as string;
  const previous = { primary_contact_id: profile.primary_contact_id };
  const next = { primary_contact_id: contactId };

  if (previous.primary_contact_id === contactId) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("partner_profiles")
    .update(next)
    .eq("id", profile.id);
  if (error) return { error: partnerFacingError("Could not update team details.", error.message) };

  const result = await failClosedAudit(
    supabase,
    {
      actorUserId: userId,
      entityType: "partner_profile",
      entityId: profile.id,
      action: "partner_team.set_primary_contact",
      previousValue: previous,
      newValue: next,
    },
    async () => {
      const { error: revertError } = await supabase
        .from("partner_profiles")
        .update(previous)
        .eq("id", profile.id);
      return revertError ? { error: partnerFacingError("Could not update team details.", revertError.message) } : {};
    },
  );
  if (result.error) return result;
  revalidateTeam();
  return { ok: true };
}

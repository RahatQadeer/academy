import { createClient } from "@/base/lib/supabase/server";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import type { LoadResult } from "@/partner-center/lib/load-result";
import type { PartnerContext, PartnerTeamMember } from "@/partner-center/types/partner";
import type { Contact } from "@/base/types";
import {
  marketsToLabel,
  marketsToRaw,
  parseLocations,
} from "@/partner-center/team/lib/addresses";
import { isIndividualPartner } from "@/partner-center/lib/partner-type";
import {
  isAdminAccess,
  programLabel,
  readPreferredContactMethod,
} from "@/partner-center/team/lib/labels";
import type {
  PrimaryContactSummary,
  TeamMemberRow,
  TeamPageData,
} from "@/partner-center/team/types";

function contactName(contact: Contact | null | undefined) {
  if (!contact) return "Unknown";
  const preferred = contact.preferred_name?.trim();
  if (preferred) return preferred;
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || "Unknown";
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export async function loadTeamPage(
  context: PartnerContext,
): Promise<LoadResult<TeamPageData>> {
  const profile = context.profile;
  if (!profile) {
    return { ok: false, error: "Company and team could not be loaded." };
  }

  const supabase = await createClient();
  const reader = createAdminClient() ?? supabase;
  const primaryContactId = profile.primary_contact_id;

  const [
    { data: company, error: companyError },
    { data: programRows, error: programsError },
    { data: memberRows, error: membersError },
  ] = await Promise.all([
      profile.company_id
        ? supabase.from("companies").select("*").eq("id", profile.company_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      reader
        .from("partner_programs")
        .select("program, active")
        .eq("partner_profile_id", profile.id),
      reader
        .from("partner_team_members")
        .select("*")
        .eq("partner_profile_id", profile.id)
        .order("created_at", { ascending: true }),
    ]);

  if (companyError || programsError || membersError) {
    return { ok: false, error: "Company and team could not be loaded." };
  }

  const members = (memberRows ?? []) as PartnerTeamMember[];
  const contactIds = [
    ...new Set(
      [...members.map((m) => m.contact_id), primaryContactId]
        .filter(Boolean) as string[],
    ),
  ];

  let contactsById = new Map<string, Contact>();
  if (contactIds.length > 0) {
    const { data: contacts } = await reader
      .from("contacts")
      .select("*")
      .in("id", contactIds);
    contactsById = new Map(
      ((contacts ?? []) as Contact[]).map((c) => [c.id, c]),
    );
  }

  const memberViews: TeamMemberRow[] = members.map((member) => {
    const contact = contactsById.get(member.contact_id) ?? null;
    const name = contactName(contact);
    return {
      id: member.id,
      contactId: member.contact_id,
      name,
      email: contact?.email?.trim() || "—",
      roleTitle: contact?.title_role?.trim() || "—",
      salutation: contact?.salutation?.trim() || null,
      phone: contact?.phone?.trim() || null,
      preferredContactMethod: readPreferredContactMethod(contact?.enrichment_data),
      function: member.function,
      accessLevel: member.access_level,
      initials: initials(name),
      isPrimary: Boolean(primaryContactId && member.contact_id === primaryContactId),
    };
  });

  let primaryContact: PrimaryContactSummary = null;
  if (primaryContactId) {
    const contact = contactsById.get(primaryContactId) ?? null;
    const member = members.find((m) => m.contact_id === primaryContactId);
    if (contact) {
      primaryContact = {
        contactId: primaryContactId,
        name: contactName(contact),
        email: contact.email?.trim() || "—",
        phone: contact.phone?.trim() || null,
        roleTitle: contact.title_role?.trim() || "—",
        function: member?.function ?? null,
      };
    }
  }

  const programs = [
    ...new Set(
      ((programRows ?? []) as { program: string; active: boolean }[])
        .filter((row) => row.active)
        .map((row) => programLabel(row.program)),
    ),
  ];

  const companyRow = company as {
    id: string;
    name: string;
    website: string | null;
    industry_type: string | null;
    addresses: unknown;
    markets: unknown;
    audience_served: string | null;
  } | null;

  return {
    ok: true,
    data: {
      companyId: companyRow?.id ?? profile.company_id ?? null,
      companyName: companyRow?.name?.trim() || context.company?.name || "Company",
      website: companyRow?.website ?? null,
      businessType: companyRow?.industry_type ?? null,
      marketsLabel: marketsToLabel(companyRow?.markets),
      marketsRaw: marketsToRaw(companyRow?.markets),
      audienceServed: companyRow?.audience_served ?? null,
      partnerSince: profile.created_at,
      status: profile.status,
      programs,
      locations: parseLocations(companyRow?.addresses),
      members: memberViews,
      primaryContact,
      canManage: isAdminAccess(context.teamMember?.access_level),
      profileId: profile.id,
      isIndividual: isIndividualPartner(profile),
    },
  };
}

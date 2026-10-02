import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/base/lib/supabase/server";
import type { Company, Contact, Entitlement, User } from "@/base/types";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { ensureActivePartnerPrograms } from "@/partner-center/lib/enable-programs";
import type { PartnerContext, PartnerProfile, PartnerTeamMember } from "@/partner-center/types/partner";

/** Latest company linked to this contact. Used when no profile exists yet so
 *  a failed onboarding save does not keep inserting extra companies rows. */
export async function findLinkedCompany(
  supabase: SupabaseClient,
  contactId: string,
): Promise<Company | null> {
  const { data: links } = await supabase
    .from("company_contacts")
    .select("company_id")
    .eq("contact_id", contactId);
  const companyIds = [
    ...new Set((links ?? []).map((row) => row.company_id as string).filter(Boolean)),
  ];
  if (companyIds.length === 0) return null;

  const { data } = await supabase
    .from("companies")
    .select("*")
    .in("id", companyIds)
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0] as Company | undefined) ?? null;
}

function hasPartnerEntitlement(entitlements: Entitlement[]) {
  return entitlements.find(
    (item) =>
      item.product === "partner_center" &&
      (item.status === "active" || item.status === "trial"),
  );
}

/** Deduped per request — layout badges + access gates both call this. */
export const resolvePartner = cache(async function resolvePartner(
  user: Pick<User, "id" | "email">,
  entitlements: Entitlement[],
): Promise<PartnerContext | null> {
  const entitlement = hasPartnerEntitlement(entitlements);
  if (!entitlement) return null;

  const supabase = await createClient();
  const reader = createAdminClient() ?? supabase;
  const email = user.email.trim();

  let contact: Contact | null = null;
  if (email) {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    contact = (data as Contact | null) ?? null;
  }

  let teamMember: PartnerTeamMember | null = null;
  let profile: PartnerProfile | null = null;

  if (contact) {
    const [{ data: membership }, { data: primaryProfile }] = await Promise.all([
      reader
        .from("partner_team_members")
        .select("*")
        .eq("contact_id", contact.id)
        .limit(1)
        .maybeSingle(),
      reader
        .from("partner_profiles")
        .select("*")
        .eq("primary_contact_id", contact.id)
        .limit(1)
        .maybeSingle(),
    ]);
    teamMember = (membership as PartnerTeamMember | null) ?? null;

    if (teamMember) {
      const { data } = await reader
        .from("partner_profiles")
        .select("*")
        .eq("id", teamMember.partner_profile_id)
        .maybeSingle();
      profile = (data as PartnerProfile | null) ?? null;
    }

    if (!profile) {
      profile = (primaryProfile as PartnerProfile | null) ?? null;
    }
  }

  let company: Company | null = null;
  if (profile) {
    const companyPromise = supabase
      .from("companies")
      .select("*")
      .eq("id", profile.company_id)
      .maybeSingle();

    if (!contact && profile.primary_contact_id) {
      const [{ data: companyRow }, { data: contactRow }] = await Promise.all([
        companyPromise,
        supabase
          .from("contacts")
          .select("*")
          .eq("id", profile.primary_contact_id)
          .maybeSingle(),
      ]);
      company = (companyRow as Company | null) ?? null;
      contact = (contactRow as Contact | null) ?? null;
    } else {
      const { data } = await companyPromise;
      company = (data as Company | null) ?? null;
    }
  } else if (contact) {
    company = await findLinkedCompany(supabase, contact.id);
  }

  // SRS §17.13.5 — Active partners must have programs enabled. Idempotent no-op
  // when rows already active; repairs legacy Active profiles missing enrollment.
  if (profile?.status === "active") {
    const admin = createAdminClient();
    if (admin) {
      const healed = await ensureActivePartnerPrograms(
        admin,
        profile.id,
        profile.application_data,
      );
      if (healed.error) {
        console.warn(
          "[partner-programs] ensure on resolve skipped",
          profile.id,
          healed.error,
        );
      }
    }
  }

  return {
    entitlement,
    contact,
    teamMember,
    profile,
    company,
  };
});

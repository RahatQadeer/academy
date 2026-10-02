import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { closeExpiredReferrals } from "@/partner-center/lib/attribution/close-expired-referrals";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import {
  referralDisplayId,
  sourceLabel,
} from "@/partner-center/referrals/lib/format";
import type {
  ReferralListData,
  ReferralListFilters,
  ReferralListItem,
} from "@/partner-center/referrals/types";
import { tabFromStatus } from "@/partner-center/referrals/types";
import type { LoadResult } from "@/partner-center/lib/load-result";
import type { PartnerContext } from "@/partner-center/types/partner";

function contactDisplayName(contact: {
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
}): string | null {
  const preferred = contact.preferred_name?.trim();
  if (preferred) return preferred;
  const composed = [contact.first_name, contact.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return composed || null;
}

export async function loadReferrals(
  context: PartnerContext | null,
  filters: ReferralListFilters,
): Promise<LoadResult<ReferralListData>> {
  const activeTab = tabFromStatus(filters.status);

  const profile = context?.profile;
  if (!profile || !isSupabaseConfigured()) {
    return { ok: false, error: "Referrals could not be loaded." };
  }

  const supabase = await createClient();

  // Prefer service role so expire always persists; fall back to member client.
  const expireClient = createAdminClient() ?? supabase;
  await closeExpiredReferrals(expireClient, {
    partnerProfileId: profile.id,
    limit: 200,
  });

  const [{ data: rows, error }, { data: linkRow, error: linkError }] =
    await Promise.all([
    supabase
      .from("partner_referrals")
      .select(
        "id, program, product, status, source, referral_date, conversion_event_date, created_at, referred_contact_id, referral_code_id",
      )
      .eq("partner_profile_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_links_codes")
      .select("code")
      .eq("partner_profile_id", profile.id)
      .eq("type", "referral_link")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    ]);

  if (error) {
    return { ok: false, error: "Referrals could not be loaded." };
  }

  const referralCode = linkError
    ? null
    : ((linkRow?.code as string | undefined) ?? null);
  const rowsSafe = rows ?? [];

  const contactIds = [
    ...new Set(
      rowsSafe
        .map((row) => row.referred_contact_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const contactNameById = new Map<string, string>();
  const companyNameByContactId = new Map<string, string>();

  if (contactIds.length > 0) {
    const [{ data: contacts }, { data: links }] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, first_name, last_name, preferred_name")
        .in("id", contactIds),
      supabase
        .from("company_contacts")
        .select("contact_id, company_id, is_primary")
        .in("contact_id", contactIds),
    ]);

    for (const contact of contacts ?? []) {
      const name = contactDisplayName({
        preferred_name: contact.preferred_name as string | null,
        first_name: contact.first_name as string | null,
        last_name: contact.last_name as string | null,
      });
      if (name) contactNameById.set(contact.id as string, name);
    }

    const companyIds = [
      ...new Set(
        (links ?? [])
          .map((row) => row.company_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);

      const companyNameById = new Map<string, string>();
      for (const company of companies ?? []) {
        const name = (company.name as string | null)?.trim();
        if (name) companyNameById.set(company.id as string, name);
      }

      const primaryByContact = new Map<string, string>();
      const anyByContact = new Map<string, string>();
      for (const link of links ?? []) {
        const contactId = link.contact_id as string;
        const companyName = companyNameById.get(link.company_id as string);
        if (!companyName) continue;
        if (!anyByContact.has(contactId)) {
          anyByContact.set(contactId, companyName);
        }
        if (link.is_primary) primaryByContact.set(contactId, companyName);
      }
      for (const contactId of contactIds) {
        const name =
          primaryByContact.get(contactId) ?? anyByContact.get(contactId);
        if (name) companyNameByContactId.set(contactId, name);
      }
    }
  }

  const allItems: ReferralListItem[] = rowsSafe.map((row) => {
    const contactId = row.referred_contact_id as string | null;
    return {
      id: row.id as string,
      displayId: referralDisplayId(row.id as string),
      contactName: contactId ? contactNameById.get(contactId) ?? null : null,
      companyName: contactId
        ? companyNameByContactId.get(contactId) ?? null
        : null,
      program: row.program as string,
      product: (row.product as string | null) ?? null,
      source: (row.source as string | null) ?? null,
      sourceLabel: sourceLabel(row.source as string | null),
      referralDate: (row.referral_date as string) || (row.created_at as string),
      conversionDate: (row.conversion_event_date as string | null) ?? null,
      status: row.status as string,
    };
  });

  // All secondary filters (status, program, range, search) apply client-side
  // so dropdown changes take effect immediately — same pattern as Documents.
  return {
    ok: true,
    data: {
      items: allItems,
      isEmpty: allItems.length === 0,
      referralCode,
      filters,
      activeTab,
    },
  };
}

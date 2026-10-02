import { createClient } from "@/base/lib/supabase/server";
import { contactDisplayName } from "@/partner-center/earnings/lib/format";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type ReferralSource = {
  program: string;
  product: string | null;
  contactName: string | null;
  companyName: string | null;
};

export type OpportunitySource = {
  companyName: string | null;
};

export async function loadEarningSources(
  supabase: ServerClient,
  referralIds: string[],
  opportunityIds: string[],
): Promise<{
  referrals: Map<string, ReferralSource>;
  opportunities: Map<string, OpportunitySource>;
}> {
  const referrals = new Map<string, ReferralSource>();
  const opportunities = new Map<string, OpportunitySource>();

  const [{ data: referralRows }, { data: oppRows }] = await Promise.all([
    referralIds.length > 0
      ? supabase
          .from("partner_referrals")
          .select("id, program, product, referred_contact_id")
          .in("id", referralIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    opportunityIds.length > 0
      ? supabase
          .from("partner_opportunities")
          .select("id, company_id")
          .in("id", opportunityIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const contactIds = [
    ...new Set(
      (referralRows ?? [])
        .map((row) => row.referred_contact_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const companyIds = [
    ...new Set(
      (oppRows ?? [])
        .map((row) => row.company_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const contactNameById = new Map<string, string>();
  const companyNameByContactId = new Map<string, string>();
  const companyNameById = new Map<string, string>();

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

    const linkedCompanyIds = [
      ...new Set(
        (links ?? [])
          .map((row) => row.company_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const allCompanyIds = [...new Set([...companyIds, ...linkedCompanyIds])];

    if (allCompanyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", allCompanyIds);
      for (const company of companies ?? []) {
        const name = (company.name as string | null)?.trim();
        if (name) companyNameById.set(company.id as string, name);
      }
    }

    const primaryByContact = new Map<string, string>();
    const anyByContact = new Map<string, string>();
    for (const link of links ?? []) {
      const contactId = link.contact_id as string;
      const companyName = companyNameById.get(link.company_id as string);
      if (!companyName) continue;
      if (!anyByContact.has(contactId)) anyByContact.set(contactId, companyName);
      if (link.is_primary) primaryByContact.set(contactId, companyName);
    }
    for (const contactId of contactIds) {
      const name =
        primaryByContact.get(contactId) ?? anyByContact.get(contactId);
      if (name) companyNameByContactId.set(contactId, name);
    }
  } else if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .in("id", companyIds);
    for (const company of companies ?? []) {
      const name = (company.name as string | null)?.trim();
      if (name) companyNameById.set(company.id as string, name);
    }
  }

  for (const row of referralRows ?? []) {
    const contactId = row.referred_contact_id as string | null;
    referrals.set(row.id as string, {
      program: row.program as string,
      product: (row.product as string | null) ?? null,
      contactName: contactId ? contactNameById.get(contactId) ?? null : null,
      companyName: contactId
        ? companyNameByContactId.get(contactId) ?? null
        : null,
    });
  }

  for (const row of oppRows ?? []) {
    opportunities.set(row.id as string, {
      companyName: companyNameById.get(row.company_id as string) ?? null,
    });
  }

  return { referrals, opportunities };
}

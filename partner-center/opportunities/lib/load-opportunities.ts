import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import type {
  OpportunityListData,
  OpportunityListFilters,
  OpportunityListItem,
} from "@/partner-center/opportunities/types";
import { tabFromStatus } from "@/partner-center/opportunities/types";
import { partnerCanMutateOpportunities } from "@/partner-center/opportunities/lib/can-mutate";
import { loadProductInterestOptions } from "@/partner-center/opportunities/lib/product-interest-options";
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

export async function loadOpportunities(
  context: PartnerContext | null,
  filters: OpportunityListFilters,
): Promise<LoadResult<OpportunityListData>> {
  const activeTab = tabFromStatus(filters.status);

  const profile = context?.profile;
  if (!profile || !isSupabaseConfigured()) {
    return { ok: false, error: "Opportunities could not be loaded." };
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("partner_opportunities")
    .select(
      "id, company_id, primary_contact_id, product_interest, estimated_seats, estimated_value, status, protected_until, created_at",
    )
    .eq("partner_profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error: "Opportunities could not be loaded." };
  }

  const rowsSafe = rows ?? [];
  const companyIds = [
    ...new Set(
      rowsSafe
        .map((row) => row.company_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const contactIds = [
    ...new Set(
      rowsSafe
        .map((row) => row.primary_contact_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const companyNameById = new Map<string, string>();
  const contactById = new Map<
    string,
    { name: string | null; title: string | null }
  >();

  const [companiesRes, contactsRes] = await Promise.all([
    companyIds.length > 0
      ? supabase.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: null }),
    contactIds.length > 0
      ? supabase
          .from("contacts")
          .select(
            "id, first_name, last_name, preferred_name, title_role",
          )
          .in("id", contactIds)
      : Promise.resolve({ data: null }),
  ]);

  for (const company of companiesRes.data ?? []) {
    const name = (company.name as string | null)?.trim();
    if (name) companyNameById.set(company.id as string, name);
  }

  for (const contact of contactsRes.data ?? []) {
    contactById.set(contact.id as string, {
      name: contactDisplayName({
        preferred_name: contact.preferred_name as string | null,
        first_name: contact.first_name as string | null,
        last_name: contact.last_name as string | null,
      }),
      title: (contact.title_role as string | null)?.trim() || null,
    });
  }

  const items: OpportunityListItem[] = rowsSafe.map((row) => {
    const companyId = row.company_id as string;
    const contactId = row.primary_contact_id as string;
    const contact = contactById.get(contactId);
    const valueRaw = row.estimated_value;
    const estimatedValue =
      valueRaw == null || valueRaw === ""
        ? null
        : Number(valueRaw);

    return {
      id: row.id as string,
      companyName: companyNameById.get(companyId) ?? "—",
      contactName: contact?.name ?? null,
      contactTitle: contact?.title ?? null,
      productInterest: (row.product_interest as string | null) ?? null,
      estimatedSeats:
        row.estimated_seats == null ? null : Number(row.estimated_seats),
      estimatedValue:
        estimatedValue != null && Number.isFinite(estimatedValue)
          ? estimatedValue
          : null,
      submittedAt: row.created_at as string,
      protectedUntil: (row.protected_until as string | null) ?? null,
      status: row.status as string,
    };
  });

  return {
    ok: true,
    data: {
      items,
      isEmpty: items.length === 0,
      canSubmit: partnerCanMutateOpportunities(context),
      filters,
      activeTab,
      productInterestOptions: (
        await loadProductInterestOptions(supabase, { activeOnly: false })
      ).map((option) => ({ value: option.value, label: option.label })),
    },
  };
}

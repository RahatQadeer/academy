import { closeExpiredReferrals } from "@/partner-center/lib/attribution/close-expired-referrals";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { getActivePartnerAdmin } from "@/partner-center/admin/lib/require-partner-admin";
import {
  createAdminClient,
  isAdminDataConfigured,
} from "@/super-admin/partner-center/lib/admin-client";
import { getStaffSession } from "@/super-admin/lib/staff-session";
import { redirect } from "next/navigation";
import { loadAdminProductInterestOptions } from "@/super-admin/partner-center/services/saveProductInterestOptions";
import { humanizeProductInterest } from "@/partner-center/opportunities/lib/product-interest-options";
import {
  formatShortDate,
  isApplicationQueueStatus,
  isPartnerRosterStatus,
  programInterestLabel,
} from "@/super-admin/partner-center/lib/format";
import type {
  ApplicationDetail,
  ApplicationListItem,
  ApplicationTab,
  AdminOpportunityAttributionItem,
  AdminOpportunityDetail,
  AdminOpportunityListItem,
  AdminPartnerOption,
  AdminReferralDetail,
  AdminReferralListItem,
  DashboardStats,
  OpportunityTab,
  PartnerDetail,
  PartnerListItem,
  PayablePartnerListItem,
  PartnerPayoutHistoryItem,
  ReferralTab,
} from "@/super-admin/partner-center/types";

/** Super Admin cookie or active Partner Admin may read shared admin loaders. */
async function requirePcStaffAccess() {
  const staff = await getStaffSession();
  if (staff?.email) return;
  const partnerAdmin = await getActivePartnerAdmin();
  if (partnerAdmin) return;
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const pathname =
    headerList.get("x-pathname") || headerList.get("x-pa-pathname") || "";
  if (pathname.startsWith("/partner-center/admin")) {
    redirect("/partner-center/admin/signin");
  }
  redirect("/super-admin/signin");
}

type ProfileRow = {
  id: string;
  company_id: string | null;
  primary_contact_id: string | null;
  status: string;
  application_data: unknown;
  agreement_status: string | null;
  tax_profile_status: string;
  payment_setup_status: string | null;
  payout_eligibility: string;
  created_at: string;
  updated_at: string;
};

function contactName(contact: {
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
} | null): string {
  if (!contact) return "—";
  const preferred = contact.preferred_name?.trim();
  if (preferred) return preferred;
  const composed = [contact.first_name, contact.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return composed || "—";
}

async function loadContactsAndCompanies(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  companyIds: string[],
  contactIds: string[],
) {
  const companyNameById = new Map<string, string>();
  const contactById = new Map<
    string,
    {
      name: string;
      email: string | null;
      phone: string | null;
      title: string | null;
    }
  >();

  await Promise.all([
    companyIds.length > 0
      ? admin
          .from("companies")
          .select("id, name")
          .in("id", companyIds)
          .then(({ data }) => {
            for (const row of data ?? []) {
              const name = (row.name as string | null)?.trim();
              if (name) companyNameById.set(row.id as string, name);
            }
          })
      : Promise.resolve(),
    contactIds.length > 0
      ? admin
          .from("contacts")
          .select(
            "id, first_name, last_name, preferred_name, email, phone, title_role",
          )
          .in("id", contactIds)
          .then(({ data }) => {
            for (const row of data ?? []) {
              contactById.set(row.id as string, {
                name: contactName(row as Parameters<typeof contactName>[0]),
                email: (row.email as string | null) ?? null,
                phone: (row.phone as string | null) ?? null,
                title: (row.title_role as string | null) ?? null,
              });
            }
          })
      : Promise.resolve(),
  ]);

  return { companyNameById, contactById };
}

function applicationFromRow(
  row: ProfileRow,
  companyNameById: Map<string, string>,
  contactById: Map<string, { name: string; email: string | null; phone: string | null }>,
): ApplicationListItem {
  const application = parseApplicationData(row.application_data);
  const companyName =
    (row.company_id && companyNameById.get(row.company_id)) ||
    application.legal_name.trim() ||
    "—";
  const contact = row.primary_contact_id
    ? contactById.get(row.primary_contact_id)
    : undefined;

  return {
    id: row.id,
    companyName,
    contactName: contact?.name || application.primary_contact_name || "—",
    contactEmail: contact?.email || application.email || "—",
    status: row.status,
    submittedAt: row.updated_at || row.created_at,
    productsLabel: programInterestLabel(application.products_of_interest),
    infoRequestActive: application.info_request?.active === true,
  };
}

export async function loadDashboardStats(): Promise<DashboardStats> {
  await requirePcStaffAccess();
  if (!isAdminDataConfigured()) {
    return {
      pendingApplications: 0,
      submittedOpportunities: 0,
      activePartners: 0,
      failedPayouts: 0,
      configured: false,
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      pendingApplications: 0,
      submittedOpportunities: 0,
      activePartners: 0,
      failedPayouts: 0,
      configured: false,
    };
  }

  const [profilesRes, oppsRes, payoutsRes] = await Promise.all([
    admin.from("partner_profiles").select("id, status, application_data"),
    admin
      .from("partner_opportunities")
      .select("id, status")
      .eq("status", "submitted"),
    admin
      .from("partner_payouts")
      .select("id, status")
      .eq("status", "failed"),
  ]);

  const profiles = profilesRes.data ?? [];
  // Match Applications → Pending: queue status AND actually submitted (not drafts).
  const pendingApplications = profiles.filter((row) => {
    if (!isApplicationQueueStatus(row.status as string)) return false;
    return parseApplicationData(row.application_data).submitted === true;
  }).length;
  const activePartners = profiles.filter((row) =>
    isPartnerRosterStatus(row.status as string),
  ).length;

  return {
    pendingApplications,
    submittedOpportunities: oppsRes.data?.length ?? 0,
    activePartners,
    failedPayouts: payoutsRes.data?.length ?? 0,
    configured: true,
  };
}

export async function loadApplications(
  tab: ApplicationTab,
): Promise<{ items: ApplicationListItem[]; configured: boolean; error?: string }> {
  await requirePcStaffAccess();
  if (!isAdminDataConfigured()) {
    return { items: [], configured: false };
  }

  const admin = createAdminClient();
  if (!admin) return { items: [], configured: false };

  const { data, error } = await admin
    .from("partner_profiles")
    .select(
      "id, company_id, primary_contact_id, status, application_data, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) return { items: [], configured: true, error: error.message };

  const rows = (data ?? []) as ProfileRow[];
  const companyIds = [
    ...new Set(rows.map((r) => r.company_id).filter(Boolean) as string[]),
  ];
  const contactIds = [
    ...new Set(rows.map((r) => r.primary_contact_id).filter(Boolean) as string[]),
  ];
  const { companyNameById, contactById } = await loadContactsAndCompanies(
    admin,
    companyIds,
    contactIds,
  );

  let items = rows
    .map((row) => applicationFromRow(row, companyNameById, contactById))
    .filter((item) => {
      const application = parseApplicationData(
        rows.find((r) => r.id === item.id)?.application_data,
      );
      if (!application.submitted && tab !== "all") return false;
      return true;
    });

  if (tab === "pending") {
    items = items.filter((item) => isApplicationQueueStatus(item.status));
  } else if (tab === "approved") {
    items = items.filter(
      (item) => item.status === "approved" || item.status === "active",
    );
  } else if (tab === "declined") {
    items = items.filter((item) => item.status === "declined");
  }

  return { items, configured: true };
}

export async function loadApplicationDetail(
  id: string,
): Promise<{ data: ApplicationDetail | null; configured: boolean; error?: string }> {
  await requirePcStaffAccess();
  if (!isAdminDataConfigured()) {
    return { data: null, configured: false };
  }

  const admin = createAdminClient();
  if (!admin) return { data: null, configured: false };

  const { data: row, error } = await admin
    .from("partner_profiles")
    .select(
      "id, company_id, primary_contact_id, status, application_data, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, configured: true, error: error.message };
  if (!row) return { data: null, configured: true };

  const profile = row as ProfileRow;
  const companyIds = profile.company_id ? [profile.company_id] : [];
  const contactIds = profile.primary_contact_id ? [profile.primary_contact_id] : [];
  const { companyNameById, contactById } = await loadContactsAndCompanies(
    admin,
    companyIds,
    contactIds,
  );

  const application = parseApplicationData(profile.application_data);
  const contact = profile.primary_contact_id
    ? contactById.get(profile.primary_contact_id)
    : undefined;

  return {
    configured: true,
    data: {
      id: profile.id,
      status: profile.status,
      application,
      companyName:
        (profile.company_id && companyNameById.get(profile.company_id)) ||
        application.legal_name ||
        "—",
      contactName: contact?.name || application.primary_contact_name || "—",
      contactEmail: contact?.email || application.email || "—",
      contactPhone: contact?.phone || application.phone || "—",
      createdAt: formatShortDate(profile.created_at),
      updatedAt: formatShortDate(profile.updated_at),
    },
  };
}

export async function loadPartners(): Promise<{
  items: PartnerListItem[];
  configured: boolean;
  error?: string;
}> {
  await requirePcStaffAccess();
  if (!isAdminDataConfigured()) {
    return { items: [], configured: false };
  }

  const admin = createAdminClient();
  if (!admin) return { items: [], configured: false };

  const { data, error } = await admin
    .from("partner_profiles")
    .select(
      "id, company_id, primary_contact_id, status, application_data, payout_eligibility, updated_at",
    )
    .in("status", ["approved", "active"])
    .order("updated_at", { ascending: false });

  if (error) return { items: [], configured: true, error: error.message };

  const rows = (data ?? []) as ProfileRow[];
  const companyIds = [
    ...new Set(rows.map((r) => r.company_id).filter(Boolean) as string[]),
  ];
  const contactIds = [
    ...new Set(rows.map((r) => r.primary_contact_id).filter(Boolean) as string[]),
  ];
  const profileIds = rows.map((r) => r.id);

  const { companyNameById, contactById } = await loadContactsAndCompanies(
    admin,
    companyIds,
    contactIds,
  );

  const programsByProfile = new Map<string, string[]>();
  if (profileIds.length > 0) {
    const { data: programRows } = await admin
      .from("partner_programs")
      .select("partner_profile_id, program, active")
      .in("partner_profile_id", profileIds)
      .eq("active", true);
    for (const row of programRows ?? []) {
      const id = row.partner_profile_id as string;
      const list = programsByProfile.get(id) ?? [];
      list.push(row.program as string);
      programsByProfile.set(id, list);
    }
  }

  const items: PartnerListItem[] = rows.map((row) => {
    const application = parseApplicationData(row.application_data);
    const contact = row.primary_contact_id
      ? contactById.get(row.primary_contact_id)
      : undefined;
    return {
      id: row.id,
      companyName:
        (row.company_id && companyNameById.get(row.company_id)) ||
        application.legal_name ||
        "—",
      contactName: contact?.name || application.primary_contact_name || "—",
      contactEmail: contact?.email || application.email || "—",
      status: row.status,
      programsLabel: programInterestLabel(programsByProfile.get(row.id) ?? []),
      payoutEligibility: row.payout_eligibility,
      activatedAt: row.status === "active" ? formatShortDate(row.updated_at) : null,
    };
  });

  return { items, configured: true };
}

export async function loadPartnerDetail(
  id: string,
): Promise<{ data: PartnerDetail | null; configured: boolean; error?: string }> {
  await requirePcStaffAccess();
  if (!isAdminDataConfigured()) {
    return { data: null, configured: false };
  }

  const admin = createAdminClient();
  if (!admin) return { data: null, configured: false };

  const { data: row, error } = await admin
    .from("partner_profiles")
    .select(
      "id, company_id, primary_contact_id, status, application_data, agreement_status, tax_profile_status, payment_setup_status, payout_eligibility, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, configured: true, error: error.message };
  if (!row) return { data: null, configured: true };

  const profile = row as ProfileRow & {
    agreement_status: string | null;
    tax_profile_status: string;
    payment_setup_status: string | null;
    payout_eligibility: string;
  };

  let website: string | null = null;
  if (profile.company_id) {
    const { data: company } = await admin
      .from("companies")
      .select("name, website")
      .eq("id", profile.company_id)
      .maybeSingle();
    website = (company?.website as string | null) ?? null;
  }

  const companyIds = profile.company_id ? [profile.company_id] : [];
  const contactIds = profile.primary_contact_id ? [profile.primary_contact_id] : [];
  const { companyNameById, contactById } = await loadContactsAndCompanies(
    admin,
    companyIds,
    contactIds,
  );

  const { data: programRows } = await admin
    .from("partner_programs")
    .select("program, active")
    .eq("partner_profile_id", profile.id);

  const application = parseApplicationData(profile.application_data);
  const contact = profile.primary_contact_id
    ? contactById.get(profile.primary_contact_id)
    : undefined;

  return {
    configured: true,
    data: {
      id: profile.id,
      status: profile.status,
      companyName:
        (profile.company_id && companyNameById.get(profile.company_id)) ||
        application.legal_name ||
        "—",
      website,
      contactName: contact?.name || application.primary_contact_name || "—",
      contactEmail: contact?.email || application.email || "—",
      contactPhone: contact?.phone || application.phone || null,
      programs: (programRows ?? []).map((p) => ({
        program: p.program as string,
        active: Boolean(p.active),
      })),
      taxProfileStatus: profile.tax_profile_status,
      paymentSetupStatus: profile.payment_setup_status,
      payoutEligibility: profile.payout_eligibility,
      agreementStatus: profile.agreement_status,
      createdAt: formatShortDate(profile.created_at),
      updatedAt: formatShortDate(profile.updated_at),
    },
  };
}

export async function loadAdminOpportunities(
  tab: OpportunityTab = "all",
): Promise<{
  items: AdminOpportunityListItem[];
  submittedCount: number;
  configured: boolean;
  error?: string;
}> {
  await requirePcStaffAccess();
  if (!isAdminDataConfigured()) {
    return { items: [], submittedCount: 0, configured: false };
  }

  const admin = createAdminClient();
  if (!admin) return { items: [], submittedCount: 0, configured: false };

  const { data, error } = await admin
    .from("partner_opportunities")
    .select(
      "id, partner_profile_id, company_id, primary_contact_id, product_interest, status, protected_until, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return { items: [], submittedCount: 0, configured: true, error: error.message };
  }

  const rows = data ?? [];
  const companyIds = [
    ...new Set(rows.map((r) => r.company_id).filter(Boolean) as string[]),
  ];
  const contactIds = [
    ...new Set(rows.map((r) => r.primary_contact_id).filter(Boolean) as string[]),
  ];
  const profileIds = [
    ...new Set(rows.map((r) => r.partner_profile_id).filter(Boolean) as string[]),
  ];

  const { companyNameById, contactById } = await loadContactsAndCompanies(
    admin,
    companyIds,
    contactIds,
  );

  const partnerCompanyByProfile = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles } = await admin
      .from("partner_profiles")
      .select("id, company_id, application_data")
      .in("id", profileIds);
    const partnerCompanyIds = [
      ...new Set(
        (profiles ?? [])
          .map((p) => p.company_id as string | null)
          .filter(Boolean) as string[],
      ),
    ];
    if (partnerCompanyIds.length > 0) {
      const { data: companies } = await admin
        .from("companies")
        .select("id, name")
        .in("id", partnerCompanyIds);
      const nameById = new Map(
        (companies ?? []).map((c) => [c.id as string, (c.name as string) || "—"]),
      );
      for (const profile of profiles ?? []) {
        const app = parseApplicationData(profile.application_data);
        partnerCompanyByProfile.set(
          profile.id as string,
          (profile.company_id && nameById.get(profile.company_id as string)) ||
            app.legal_name ||
            "Partner",
        );
      }
    }
  }

  const items: AdminOpportunityListItem[] = rows.map((row) => {
    const contact = row.primary_contact_id
      ? contactById.get(row.primary_contact_id as string)
      : undefined;
    return {
      id: row.id as string,
      partnerProfileId: row.partner_profile_id as string,
      partnerCompanyName:
        partnerCompanyByProfile.get(row.partner_profile_id as string) || "Partner",
      companyName:
        companyNameById.get(row.company_id as string) || "—",
      contactName: contact?.name ?? null,
      productInterest: (row.product_interest as string | null) ?? null,
      status: row.status as string,
      submittedAt: row.created_at as string,
      protectedUntil: (row.protected_until as string | null) ?? null,
    };
  });

  const submittedCount = items.filter(
    (item) => item.status.toLowerCase() === "submitted",
  ).length;

  const filtered =
    tab === "all"
      ? items
      : items.filter((item) => {
          const key = item.status.toLowerCase();
          if (tab === "submitted") return key === "submitted";
          if (tab === "accepted") return key === "accepted";
          if (tab === "in_progress") return key === "in_progress";
          if (tab === "converted") return key === "converted";
          if (tab === "closed") return key === "not_moving_forward";
          return true;
        });

  return { items: filtered, submittedCount, configured: true };
}

export async function loadAdminOpportunityDetail(
  id: string,
): Promise<{
  data: AdminOpportunityDetail | null;
  partners: AdminPartnerOption[];
  configured: boolean;
  error?: string;
}> {
  await requirePcStaffAccess();
  if (!isAdminDataConfigured()) {
    return { data: null, partners: [], configured: false };
  }

  const admin = createAdminClient();
  if (!admin) return { data: null, partners: [], configured: false };

  const { data: row, error } = await admin
    .from("partner_opportunities")
    .select(
      "id, partner_profile_id, company_id, primary_contact_id, product_interest, estimated_seats, estimated_value, status, notes, permission_to_contact, attachment_document_id, accepted_at, protected_until, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, partners: [], configured: true, error: error.message };
  }
  if (!row) return { data: null, partners: [], configured: true };

  const { unpackOpportunityNotes } = await import(
    "@/partner-center/opportunities/lib/notes"
  );

  const companyIds = row.company_id ? [row.company_id as string] : [];
  const contactIds = row.primary_contact_id ? [row.primary_contact_id as string] : [];
  const { companyNameById, contactById } = await loadContactsAndCompanies(
    admin,
    companyIds,
    contactIds,
  );

  const { data: partnerProfile } = await admin
    .from("partner_profiles")
    .select("id, company_id, application_data")
    .eq("id", row.partner_profile_id as string)
    .maybeSingle();

  let partnerCompanyName = "Partner";
  if (partnerProfile) {
    const app = parseApplicationData(partnerProfile.application_data);
    if (partnerProfile.company_id) {
      const { data: company } = await admin
        .from("companies")
        .select("name")
        .eq("id", partnerProfile.company_id as string)
        .maybeSingle();
      partnerCompanyName =
        (company?.name as string | undefined) || app.legal_name || "Partner";
    } else {
      partnerCompanyName = app.legal_name || "Partner";
    }
  }

  const contact = row.primary_contact_id
    ? contactById.get(row.primary_contact_id as string)
    : undefined;
  const { timing, context } = unpackOpportunityNotes(row.notes as string | null);

  let attachmentTitle: string | null = null;
  if (row.attachment_document_id) {
    const { data: doc } = await admin
      .from("documents")
      .select("title")
      .eq("id", row.attachment_document_id as string)
      .maybeSingle();
    attachmentTitle = (doc?.title as string | null) ?? null;
  }

  const { data: attributionEvents } = await admin
    .from("partner_attribution_events")
    .select(
      "id, external_payment_id, amount_collected_cents, event_timestamp",
    )
    .eq("opportunity_id", id)
    .order("event_timestamp", { ascending: false });

  const eventIds = (attributionEvents ?? []).map((event) => event.id as string);
  const earningsByEventId = new Map<
    string,
    { id: string; amount: number; status: string }
  >();

  if (eventIds.length > 0) {
    const { data: earnings } = await admin
      .from("partner_earnings")
      .select("id, attribution_event_id, amount, status")
      .in("attribution_event_id", eventIds);

    for (const earning of earnings ?? []) {
      earningsByEventId.set(earning.attribution_event_id as string, {
        id: earning.id as string,
        amount: Number(earning.amount) || 0,
        status: earning.status as string,
      });
    }
  }

  const attributionItems: AdminOpportunityAttributionItem[] = (
    attributionEvents ?? []
  ).map((event) => {
    const earning = earningsByEventId.get(event.id as string);
    const centsRaw = event.amount_collected_cents;
    const cents =
      centsRaw == null || centsRaw === ""
        ? null
        : typeof centsRaw === "number"
          ? centsRaw
          : Number(centsRaw);
    return {
      eventId: event.id as string,
      externalPaymentId: (event.external_payment_id as string | null) ?? null,
      amountCollectedUsd:
        cents == null || !Number.isFinite(cents) ? null : cents / 100,
      eventTimestamp:
        (event.event_timestamp as string) || new Date().toISOString(),
      earningId: earning?.id ?? null,
      earningAmount: earning?.amount ?? null,
      earningStatus: earning?.status ?? null,
    };
  });

  const hasPaidEarnings = attributionItems.some(
    (item) => item.earningStatus === "paid",
  );
  const partners = await loadAdminPartnerOptions(admin);
  const interestOptions = await loadAdminProductInterestOptions(admin);
  const productInterestValue =
    (row.product_interest as string | null) ?? null;
  const productInterestLabel = productInterestValue
    ? interestOptions.find((option) => option.value === productInterestValue)
        ?.label ?? humanizeProductInterest(productInterestValue)
    : null;

  return {
    configured: true,
    partners,
    data: {
      id: row.id as string,
      partnerProfileId: row.partner_profile_id as string,
      partnerCompanyName,
      companyName: companyNameById.get(row.company_id as string) || "—",
      contactName: contact?.name ?? null,
      contactEmail: contact?.email ?? null,
      contactTitle: contact?.title ?? null,
      productInterest: productInterestValue,
      productInterestLabel,
      estimatedSeats: (() => {
        if (row.estimated_seats == null) return null;
        const n = Number(row.estimated_seats);
        return Number.isFinite(n) ? n : null;
      })(),
      estimatedValue: (() => {
        if (row.estimated_value == null) return null;
        const n = Number(row.estimated_value);
        return Number.isFinite(n) ? n : null;
      })(),
      expectedTiming: timing,
      additionalContext: context,
      status: row.status as string,
      submittedAt: row.created_at as string,
      acceptedAt: (row.accepted_at as string | null) ?? null,
      protectedUntil: (row.protected_until as string | null) ?? null,
      permissionToContact: Boolean(row.permission_to_contact),
      attachmentTitle,
      attributionItems,
      hasPaidEarnings,
    },
  };
}

export function parseApplicationTab(
  value: string | string[] | undefined,
): ApplicationTab {
  const raw = typeof value === "string" ? value : undefined;
  if (raw === "all" || raw === "approved" || raw === "declined") return raw;
  return "pending";
}

export function parseOpportunityTab(
  value: string | string[] | undefined,
): OpportunityTab {
  const raw = typeof value === "string" ? value : undefined;
  if (
    raw === "submitted" ||
    raw === "accepted" ||
    raw === "in_progress" ||
    raw === "converted" ||
    raw === "closed"
  ) {
    return raw;
  }
  return "all";
}

export function parseReferralTab(
  value: string | string[] | undefined,
): ReferralTab {
  const raw = typeof value === "string" ? value : undefined;
  if (
    raw === "referred" ||
    raw === "in_progress" ||
    raw === "converted" ||
    raw === "not_converted"
  ) {
    return raw;
  }
  return "all";
}

async function partnerCompanyNamesByProfile(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  profileIds: string[],
): Promise<Map<string, string>> {
  const partnerCompanyByProfile = new Map<string, string>();
  if (profileIds.length === 0) return partnerCompanyByProfile;

  const { data: profiles } = await admin
    .from("partner_profiles")
    .select("id, company_id, application_data")
    .in("id", profileIds);
  const partnerCompanyIds = [
    ...new Set(
      (profiles ?? [])
        .map((p) => p.company_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];
  const nameById = new Map<string, string>();
  if (partnerCompanyIds.length > 0) {
    const { data: companies } = await admin
      .from("companies")
      .select("id, name")
      .in("id", partnerCompanyIds);
    for (const c of companies ?? []) {
      nameById.set(c.id as string, (c.name as string) || "—");
    }
  }
  for (const profile of profiles ?? []) {
    const app = parseApplicationData(profile.application_data);
    partnerCompanyByProfile.set(
      profile.id as string,
      (profile.company_id && nameById.get(profile.company_id as string)) ||
        app.legal_name ||
        "Partner",
    );
  }
  return partnerCompanyByProfile;
}

export async function loadAdminReferrals(
  tab: ReferralTab = "all",
): Promise<{
  items: AdminReferralListItem[];
  partners: AdminPartnerOption[];
  configured: boolean;
  error?: string;
}> {
  await requirePcStaffAccess();
  if (!isAdminDataConfigured()) {
    return { items: [], partners: [], configured: false };
  }

  const admin = createAdminClient();
  if (!admin) return { items: [], partners: [], configured: false };

  await closeExpiredReferrals(admin, { limit: 500 });

  const { data, error } = await admin
    .from("partner_referrals")
    .select(
      "id, partner_profile_id, program, status, source, referral_date, referred_user_id, referred_contact_id",
    )
    .order("referral_date", { ascending: false });

  if (error) {
    return { items: [], partners: [], configured: true, error: error.message };
  }

  const rows = data ?? [];
  const profileIds = [
    ...new Set(rows.map((r) => r.partner_profile_id).filter(Boolean) as string[]),
  ];
  const contactIds = [
    ...new Set(
      rows.map((r) => r.referred_contact_id).filter(Boolean) as string[],
    ),
  ];
  const userIds = [
    ...new Set(
      rows.map((r) => r.referred_user_id).filter(Boolean) as string[],
    ),
  ];

  const partnerCompanyByProfile = await partnerCompanyNamesByProfile(
    admin,
    profileIds,
  );
  const { contactById } = await loadContactsAndCompanies(admin, [], contactIds);

  const emailByUserId = new Map<string, string>();
  const nameByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await admin
      .from("users")
      .select("id, email, full_name, preferred_name")
      .in("id", userIds);
    for (const user of users ?? []) {
      emailByUserId.set(user.id as string, (user.email as string) || "");
      const preferred = (user.preferred_name as string | null)?.trim();
      const full = (user.full_name as string | null)?.trim();
      nameByUserId.set(user.id as string, preferred || full || "");
    }
  }

  const items: AdminReferralListItem[] = rows.map((row) => {
    const contact = row.referred_contact_id
      ? contactById.get(row.referred_contact_id as string)
      : undefined;
    const userId = row.referred_user_id as string | null;
    return {
      id: row.id as string,
      partnerProfileId: row.partner_profile_id as string,
      partnerCompanyName:
        partnerCompanyByProfile.get(row.partner_profile_id as string) ||
        "Partner",
      program: (row.program as string) || "—",
      status: row.status as string,
      source: (row.source as string | null) ?? null,
      referralDate: row.referral_date as string,
      referredEmail:
        contact?.email ||
        (userId ? emailByUserId.get(userId) || null : null),
      referredName:
        contact?.name ||
        (userId ? nameByUserId.get(userId) || null : null) ||
        null,
    };
  });

  const filtered =
    tab === "all"
      ? items
      : items.filter((item) => item.status.toLowerCase() === tab);

  const partners = await loadAdminPartnerOptions(admin);

  return { items: filtered, partners, configured: true };
}

export async function loadAdminPartnerOptions(
  adminClient?: NonNullable<ReturnType<typeof createAdminClient>>,
): Promise<AdminPartnerOption[]> {
  await requirePcStaffAccess();
  const admin = adminClient ?? createAdminClient();
  if (!admin) return [];

  const { data: partnerRows } = await admin
    .from("partner_profiles")
    .select("id, company_id, application_data, status")
    .in("status", ["approved", "active"])
    .order("updated_at", { ascending: false })
    .limit(200);

  const optionIds = (partnerRows ?? []).map((p) => p.id as string);
  const names = await partnerCompanyNamesByProfile(admin, optionIds);
  return optionIds.map((partnerId) => ({
    id: partnerId,
    companyName: names.get(partnerId) || "Partner",
  }));
}

export async function loadAdminReferralDetail(
  id: string,
): Promise<{
  data: AdminReferralDetail | null;
  partners: AdminPartnerOption[];
  configured: boolean;
  error?: string;
}> {
  await requirePcStaffAccess();
  if (!isAdminDataConfigured()) {
    return { data: null, partners: [], configured: false };
  }

  const admin = createAdminClient();
  if (!admin) return { data: null, partners: [], configured: false };

  const { data: row, error } = await admin
    .from("partner_referrals")
    .select(
      "id, partner_profile_id, program, status, source, product, referral_date, conversion_event_date, referred_user_id, referred_contact_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, partners: [], configured: true, error: error.message };
  }
  if (!row) return { data: null, partners: [], configured: true };

  const partnerCompanyByProfile = await partnerCompanyNamesByProfile(admin, [
    row.partner_profile_id as string,
  ]);
  const contactIds = row.referred_contact_id
    ? [row.referred_contact_id as string]
    : [];
  const { contactById } = await loadContactsAndCompanies(admin, [], contactIds);
  const contact = row.referred_contact_id
    ? contactById.get(row.referred_contact_id as string)
    : undefined;

  let referredEmail = contact?.email ?? null;
  let referredName = contact?.name ?? null;
  if (row.referred_user_id) {
    const { data: user } = await admin
      .from("users")
      .select("email, full_name, preferred_name")
      .eq("id", row.referred_user_id as string)
      .maybeSingle();
    if (user) {
      referredEmail = referredEmail || ((user.email as string) ?? null);
      referredName =
        referredName ||
        (user.preferred_name as string | null)?.trim() ||
        (user.full_name as string | null)?.trim() ||
        null;
    }
  }

  const { data: events } = await admin
    .from("partner_attribution_events")
    .select("id")
    .eq("referral_id", id);
  const eventIds = (events ?? []).map((event) => event.id as string);
  let hasPaidEarnings = false;
  if (eventIds.length > 0) {
    const { data: paid } = await admin
      .from("partner_earnings")
      .select("id")
      .in("attribution_event_id", eventIds)
      .eq("status", "paid")
      .limit(1);
    hasPaidEarnings = (paid ?? []).length > 0;
  }

  const partners = await loadAdminPartnerOptions(admin);

  return {
    configured: true,
    partners,
    data: {
      id: row.id as string,
      partnerProfileId: row.partner_profile_id as string,
      partnerCompanyName:
        partnerCompanyByProfile.get(row.partner_profile_id as string) ||
        "Partner",
      program: (row.program as string) || "—",
      status: row.status as string,
      source: (row.source as string | null) ?? null,
      product: (row.product as string | null) ?? null,
      referralDate: row.referral_date as string,
      conversionEventDate: (row.conversion_event_date as string | null) ?? null,
      referredUserId: (row.referred_user_id as string | null) ?? null,
      referredEmail,
      referredName,
      hasPaidEarnings,
    },
  };
}

export async function loadPayablePartners(): Promise<{
  items: PayablePartnerListItem[];
  configured: boolean;
  error?: string;
}> {
  await requirePcStaffAccess();
  if (!isAdminDataConfigured()) {
    return { items: [], configured: false };
  }

  const admin = createAdminClient();
  if (!admin) return { items: [], configured: false };

  const { data: earnings, error } = await admin
    .from("partner_earnings")
    .select("partner_profile_id, amount, status")
    .in("status", ["payable", "approved"]);

  if (error) return { items: [], configured: true, error: error.message };

  const totals = new Map<string, { total: number; count: number }>();
  for (const row of earnings ?? []) {
    const id = row.partner_profile_id as string;
    const bucket = totals.get(id) ?? { total: 0, count: 0 };
    bucket.total += Number(row.amount) || 0;
    bucket.count += 1;
    totals.set(id, bucket);
  }

  const profileIds = [...totals.keys()];
  if (profileIds.length === 0) {
    return { items: [], configured: true };
  }

  const { data: profiles, error: profileError } = await admin
    .from("partner_profiles")
    .select(
      "id, company_id, application_data, payout_eligibility, tax_profile_status, payment_setup_status, preferred_payout_method, stripe_connect_account_id",
    )
    .in("id", profileIds);

  if (profileError) {
    return { items: [], configured: true, error: profileError.message };
  }

  const companyIds = [
    ...new Set(
      (profiles ?? [])
        .map((row) => row.company_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];

  const companyNameById = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companies } = await admin
      .from("companies")
      .select("id, name")
      .in("id", companyIds);
    for (const row of companies ?? []) {
      companyNameById.set(row.id as string, (row.name as string) || "—");
    }
  }

  const items: PayablePartnerListItem[] = (profiles ?? [])
    .map((profile) => {
      const totalsForPartner = totals.get(profile.id as string);
      if (!totalsForPartner) return null;
      const application = parseApplicationData(profile.application_data);
      return {
        id: profile.id as string,
        companyName:
          (profile.company_id &&
            companyNameById.get(profile.company_id as string)) ||
          application.legal_name ||
          "—",
        payableTotal: totalsForPartner.total,
        payableCount: totalsForPartner.count,
        payoutEligibility: profile.payout_eligibility as string,
        taxProfileStatus: profile.tax_profile_status as string,
        paymentSetupStatus: profile.payment_setup_status as string | null,
        preferredPayoutMethod:
          (profile.preferred_payout_method as string | null) ?? null,
        stripeConnected:
          Boolean(
            (profile.stripe_connect_account_id as string | null)?.trim(),
          ) &&
          (profile.payment_setup_status as string | null)?.toLowerCase() ===
            "ready",
      };
    })
    .filter((item): item is PayablePartnerListItem => item !== null)
    .sort((a, b) => b.payableTotal - a.payableTotal);

  return { items, configured: true };
}

export async function loadPartnerPayoutHistory(): Promise<{
  items: PartnerPayoutHistoryItem[];
  configured: boolean;
  error?: string;
}> {
  await requirePcStaffAccess();
  if (!isAdminDataConfigured()) {
    return { items: [], configured: false };
  }

  const admin = createAdminClient();
  if (!admin) return { items: [], configured: false };

  const { data: payouts, error } = await admin
    .from("partner_payouts")
    .select(
      "id, partner_profile_id, amount, method, status, reference, paid_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { items: [], configured: true, error: error.message };

  const rows = payouts ?? [];
  if (rows.length === 0) {
    return { items: [], configured: true };
  }

  const profileIds = [
    ...new Set(rows.map((row) => row.partner_profile_id as string)),
  ];

  const { data: profiles, error: profileError } = await admin
    .from("partner_profiles")
    .select("id, company_id, application_data")
    .in("id", profileIds);

  if (profileError) {
    return { items: [], configured: true, error: profileError.message };
  }

  const companyIds = [
    ...new Set(
      (profiles ?? [])
        .map((row) => row.company_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];

  const companyNameById = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companies } = await admin
      .from("companies")
      .select("id, name")
      .in("id", companyIds);
    for (const row of companies ?? []) {
      companyNameById.set(row.id as string, (row.name as string) || "—");
    }
  }

  const nameByProfileId = new Map<string, string>();
  for (const profile of profiles ?? []) {
    const application = parseApplicationData(profile.application_data);
    nameByProfileId.set(
      profile.id as string,
      (profile.company_id &&
        companyNameById.get(profile.company_id as string)) ||
        application.legal_name ||
        "—",
    );
  }

  const items: PartnerPayoutHistoryItem[] = rows.map((row) => ({
    id: row.id as string,
    partnerProfileId: row.partner_profile_id as string,
    companyName: nameByProfileId.get(row.partner_profile_id as string) ?? "—",
    amount: Number(row.amount) || 0,
    method: (row.method as string) || "—",
    status: (row.status as string) || "—",
    reference: (row.reference as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }));

  return { items, configured: true };
}

import { createClient } from "@/base/lib/supabase/server";
import { getWorkspaceLogoUrl } from "@/base/lib/logo";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";

/**
 * The firm's own profile — the thing Whitby knew least about.
 *
 * Every client here has a type, a classification, contacts, a portal, a
 * billing history and a timeline. The firm doing the work had a name, a logo
 * and a timezone. These are its professional details, the part of them a
 * client is allowed to see, the terms an engagement starts from, and what an
 * hour of its time costs internally.
 *
 * Read as strings rather than as nullable columns: every one of these is a
 * text input on a form, and `?? ""` at eighteen call sites is eighteen chances
 * to print "null" into a field.
 */
export type OrganizationProfile = {
  workspaceId: string;
  name: string;
  logoUrl: string | null;
  /** The workspace's own currency — the internal rate is quoted in it. */
  currency: string;

  legalName: string;
  practiceType: string;
  registrationNumber: string;
  taxId: string;
  foundedYear: string;
  professionalEmail: string;
  professionalPhone: string;
  officeAddress: string;
  serviceAreas: string;

  publicProfileUrl: string;
  publicSummary: string;
  standardContractTerms: string;
  noticePeriod: string;
  ranking: string;
  accreditations: string;

  /** Minor units, like every other amount in this schema. */
  internalRateCents: number | null;
  internalRateUnit: string;
  internalRateNote: string;
};

/** What a rate can be per. The check constraint on the column says the same. */
export const RATE_UNITS = [
  { value: "hour", label: "per hour" },
  { value: "day", label: "per day" },
  { value: "week", label: "per week" },
  { value: "month", label: "per month" },
  { value: "engagement", label: "per engagement" },
] as const;

export function rateUnitLabel(unit: string) {
  return RATE_UNITS.find((row) => row.value === unit)?.label ?? "";
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function getOrganizationProfile(): Promise<OrganizationProfile | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();

  const [{ data: workspace }, { data: settings }] = await Promise.all([
    supabase.from("workspaces").select("id, name, logo_url").eq("id", workspaceId).maybeSingle(),
    supabase
      .from("whitbyos_workspace_settings")
      .select(
        "default_currency, legal_name, practice_type, registration_number, tax_id, founded_year, professional_email, professional_phone, office_address, service_areas, public_profile_url, public_summary, standard_contract_terms, notice_period, ranking, accreditations, internal_rate_cents, internal_rate_unit, internal_rate_note",
      )
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  ]);

  if (!workspace) return null;

  const year = settings?.founded_year as number | null | undefined;

  return {
    workspaceId,
    name: text(workspace.name),
    // Signed here rather than in the page: the bucket is private and the
    // stored value is a path.
    logoUrl: await getWorkspaceLogoUrl(workspace.logo_url as string | null),
    currency: text(settings?.default_currency) || "USD",

    legalName: text(settings?.legal_name),
    practiceType: text(settings?.practice_type),
    registrationNumber: text(settings?.registration_number),
    taxId: text(settings?.tax_id),
    foundedYear: year ? String(year) : "",
    professionalEmail: text(settings?.professional_email),
    professionalPhone: text(settings?.professional_phone),
    officeAddress: text(settings?.office_address),
    serviceAreas: text(settings?.service_areas),

    publicProfileUrl: text(settings?.public_profile_url),
    publicSummary: text(settings?.public_summary),
    standardContractTerms: text(settings?.standard_contract_terms),
    noticePeriod: text(settings?.notice_period),
    ranking: text(settings?.ranking),
    accreditations: text(settings?.accreditations),

    internalRateCents: (settings?.internal_rate_cents as number | null) ?? null,
    internalRateUnit: text(settings?.internal_rate_unit) || "hour",
    internalRateNote: text(settings?.internal_rate_note),
  };
}

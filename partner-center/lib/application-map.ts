import type {
  ApplicationData,
  ApplyingAs,
  ExpectedActivityLevel,
  InfoRequest,
  PartnerProgramFamily,
  WizardStep,
} from "@/partner-center/types/application";

const PROGRAMS: PartnerProgramFamily[] = ["academy", "platform", "enterprise"];
const ACTIVITY: ExpectedActivityLevel[] = [
  "exploring",
  "a_few_a_month",
  "regular_source",
  "high_volume",
  "enterprise_scale",
];

export function emptyApplication(email = ""): ApplicationData {
  return {
    current_step: 1,
    submitted: false,
    applying_as: "company",
    legal_name: "",
    website: "",
    business_type: "",
    business_type_other: "",
    primary_contact_name: "",
    phone: "",
    email,
    market: "",
    audience_served: "",
    address: "",
    products_of_interest: [],
    referral_approach: "",
    expected_activity_level: "",
    additional_context: "",
    terms_accepted: false,
  };
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStep(value: unknown): WizardStep {
  return value === 2 || value === 3 || value === 4 ? value : 1;
}

function asApplyingAs(value: unknown): ApplyingAs {
  return value === "individual" ? "individual" : "company";
}

function asPrograms(value: unknown): PartnerProgramFamily[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PartnerProgramFamily =>
    PROGRAMS.includes(item as PartnerProgramFamily),
  );
}

function asActivity(value: unknown): ExpectedActivityLevel | "" {
  return ACTIVITY.includes(value as ExpectedActivityLevel)
    ? (value as ExpectedActivityLevel)
    : "";
}

function asInfoRequest(value: unknown): InfoRequest | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const message = asString(source.message);
  const response = asString(source.response) || undefined;
  return {
    active: source.active === true,
    message,
    ...(response ? { response } : {}),
  };
}

export function parseApplicationData(
  raw: unknown,
  emailFallback = "",
): ApplicationData {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const base = emptyApplication(emailFallback);

  return {
    current_step: asStep(source.current_step),
    submitted: source.submitted === true,
    applying_as: asApplyingAs(source.applying_as),
    legal_name: asString(source.legal_name),
    website: asString(source.website),
    business_type: asString(source.business_type),
    business_type_other: asString(source.business_type_other),
    primary_contact_name: asString(source.primary_contact_name),
    phone: asString(source.phone),
    email: asString(source.email, emailFallback),
    market: asString(source.market),
    audience_served: asString(source.audience_served),
    address: asString(source.address) || addressFromUnknown(source.addresses),
    products_of_interest: asPrograms(source.products_of_interest),
    referral_approach: asString(source.referral_approach),
    expected_activity_level: asActivity(source.expected_activity_level),
    additional_context: asString(source.additional_context),
    terms_accepted: source.terms_accepted === true,
    info_request: asInfoRequest(source.info_request),
    decline_reason: asString(source.decline_reason) || undefined,
    agreement_signed_at: asString(source.agreement_signed_at) || undefined,
    programs_confirmed_at: asString(source.programs_confirmed_at) || undefined,
    guide_acknowledged_at: asString(source.guide_acknowledged_at) || undefined,
  };
}

export function addressFromUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value) || value.length === 0) return "";
  const first = value[0];
  if (typeof first === "string") return first;
  if (!first || typeof first !== "object" || Array.isArray(first)) return "";
  const row = first as Record<string, unknown>;
  return (
    asString(row.label) ||
    asString(row.address) ||
    asString(row.line1) ||
    [row.street, row.city, row.region, row.postal_code]
      .filter((part) => typeof part === "string" && part.trim())
      .join(", ")
  );
}

export function isApplicationSubmitted(raw: unknown): boolean {
  return parseApplicationData(raw).submitted;
}

/** Human-quotable code for a partner profile. Derived, so it stays stable
 *  without adding a column to `partner_profiles`. */
export function applicationReference(profileId: string | null | undefined): string | null {
  if (!profileId) return null;
  let hash = 0;
  for (let i = 0; i < profileId.length; i += 1) {
    hash = (hash * 31 + profileId.charCodeAt(i)) % 100000;
  }
  return `APP-${String(hash).padStart(5, "0")}`;
}

export function splitContactName(name: string): { first_name: string; last_name: string } {
  const trimmed = name.trim();
  if (!trimmed) return { first_name: "", last_name: "" };
  const index = trimmed.lastIndexOf(" ");
  if (index <= 0) return { first_name: trimmed, last_name: "" };
  return {
    first_name: trimmed.slice(0, index).trim(),
    last_name: trimmed.slice(index + 1).trim(),
  };
}

export function toContactFields(data: ApplicationData) {
  const names = splitContactName(data.primary_contact_name);
  return {
    first_name: names.first_name,
    last_name: names.last_name,
    email: data.email.trim() || null,
    phone: data.phone.trim() || null,
    source: "partner_application",
    created_by_workspace_id: null,
  };
}

/** Label for review/admin when the applicant picked Other. */
export function displayBusinessType(data: ApplicationData): string {
  const type = data.business_type.trim();
  if (!type) return "";
  if (type === "Other") {
    const other = data.business_type_other.trim();
    return other ? `Other — ${other}` : "Other";
  }
  return type;
}

export function toCompanyFields(data: ApplicationData) {
  const industry =
    data.business_type.trim() === "Other"
      ? data.business_type_other.trim() || "Other"
      : data.business_type.trim();
  return {
    name: data.legal_name.trim() || "Partner applicant",
    website: data.website.trim() || null,
    industry_type: industry || null,
    markets: data.market.trim() ? [{ label: data.market.trim() }] : null,
    audience_served: data.audience_served.trim() || null,
    addresses: data.address.trim() ? [{ label: data.address.trim() }] : null,
    created_by_workspace_id: null,
  };
}

function looksLikePersonOrCompanyName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2) return false;
  return /[A-Za-z]/.test(trimmed);
}

/** Accepts bare domains or http(s) URLs. Empty is allowed (optional field). */
export function isValidOptionalWebsite(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/\s/.test(trimmed)) return false;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return Boolean(url.hostname.includes("."));
  } catch {
    return false;
  }
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Per-field messages for the current wizard step — empty object means the step is valid. */
export function errorsForStep(
  step: WizardStep,
  data: ApplicationData,
): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};

  if (step === 1) {
    const nameLabel =
      data.applying_as === "individual" ? "your name" : "the company or legal name";
    if (!data.legal_name.trim()) {
      errors.legal_name = `Enter ${nameLabel}.`;
    } else if (!looksLikePersonOrCompanyName(data.legal_name)) {
      errors.legal_name = `Enter a valid ${nameLabel}.`;
    }
    if (!isValidOptionalWebsite(data.website)) {
      errors.website = "Enter a valid website (for example, example.com).";
    }
    if (!data.business_type.trim()) {
      errors.business_type = "Select a business type.";
    } else if (
      data.business_type.trim() === "Other" &&
      !data.business_type_other.trim()
    ) {
      errors.business_type_other = "Describe your business type.";
    }
  }

  if (step === 2) {
    if (!data.primary_contact_name.trim()) {
      errors.primary_contact_name = "Enter the primary contact name.";
    } else if (!looksLikePersonOrCompanyName(data.primary_contact_name)) {
      errors.primary_contact_name = "Enter a valid primary contact name.";
    }
    if (!data.phone.trim()) {
      errors.phone = "Enter a phone number.";
    } else if (!isValidPhone(data.phone)) {
      errors.phone = "Enter a valid phone number (at least 7 digits).";
    }
    if (!data.email.trim()) {
      errors.email = "Sign in again so we can use your account email.";
    }
    if (!data.market.trim()) {
      errors.market = "Enter your market or location.";
    }
    if (!data.audience_served.trim()) {
      errors.audience_served = "Tell us more about your company.";
    }
  }

  if (step === 3) {
    if (!data.referral_approach.trim()) {
      errors.referral_approach = "Describe how you plan to refer customers.";
    }
    if (data.products_of_interest.length === 0) {
      errors.products_of_interest = "Select at least one product of interest.";
    }
    if (!data.expected_activity_level) {
      errors.expected_activity_level = "Select an expected activity level.";
    }
  }

  if (step === 4 && !data.terms_accepted) {
    errors.terms_accepted = "Agree to the Partner Program Terms to submit.";
  }

  return errors;
}

export function validateStep(step: WizardStep, data: ApplicationData): string | null {
  const errors = errorsForStep(step, data);
  return Object.values(errors)[0] ?? null;
}

export function validateSubmission(data: ApplicationData): string | null {
  return (
    validateStep(1, data) ||
    validateStep(2, data) ||
    validateStep(3, data) ||
    validateStep(4, data)
  );
}

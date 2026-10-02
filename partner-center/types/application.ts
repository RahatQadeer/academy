export type ApplyingAs = "individual" | "company";

export type PartnerProgramFamily = "academy" | "platform" | "enterprise";

export type WizardStep = 1 | 2 | 3 | 4;

export type ExpectedActivityLevel =
  | "exploring"
  | "a_few_a_month"
  | "regular_source"
  | "high_volume"
  | "enterprise_scale";

export type InfoRequest = {
  active: boolean;
  /** What the admin asked the applicant to clarify. */
  message: string;
  /** Applicant's free-text reply when they resubmit. */
  response?: string;
};

export type ApplicationData = {
  current_step: WizardStep;
  submitted: boolean;
  applying_as: ApplyingAs;
  legal_name: string;
  website: string;
  business_type: string;
  /** Required when `business_type` is "Other" — what the applicant means by Other. */
  business_type_other: string;
  primary_contact_name: string;
  phone: string;
  email: string;
  market: string;
  audience_served: string;
  address: string;
  products_of_interest: PartnerProgramFamily[];
  referral_approach: string;
  expected_activity_level: ExpectedActivityLevel | "";
  additional_context: string;
  terms_accepted: boolean;
  info_request?: InfoRequest;
  decline_reason?: string;
  agreement_signed_at?: string;
  programs_confirmed_at?: string;
  guide_acknowledged_at?: string;
};

export const BUSINESS_TYPES = [
  "Wealth management firm",
  "Family office",
  "Relocation services",
  "Independent consultant",
  "Other",
] as const;

export const ACTIVITY_LEVELS: { value: ExpectedActivityLevel; label: string }[] = [
  { value: "exploring", label: "Just exploring" },
  { value: "a_few_a_month", label: "A few referrals a month" },
  { value: "regular_source", label: "Regular referral source" },
  { value: "high_volume", label: "High volume" },
  { value: "enterprise_scale", label: "Enterprise-scale" },
];

export const PROGRAM_OPTIONS: { value: PartnerProgramFamily; label: string }[] = [
  { value: "academy", label: "Academy" },
  { value: "platform", label: "Whitby" },
  { value: "enterprise", label: "Enterprise" },
];

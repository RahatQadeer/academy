"use client";

import { Checkbox } from "@/partner-center/components/Checkbox";
import { displayBusinessType } from "@/partner-center/lib/application-map";
import type { ApplicationData } from "@/partner-center/types/application";
import { ACTIVITY_LEVELS, PROGRAM_OPTIONS } from "@/partner-center/types/application";
import type { StepFieldProps } from "@/partner-center/onboarding/components/step-field-props";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mt-5 block text-[11.5px] font-semibold uppercase tracking-[0.05em] first:mt-0"
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-start justify-between gap-6 py-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span className="text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </span>
      <span className="text-right text-[13.5px] font-medium">{value || "—"}</span>
    </div>
  );
}

export function StepReviewSubmit({
  data,
  onChange,
  fieldError,
  onBlurField,
}: {
  data: ApplicationData;
  onChange: (partial: Partial<ApplicationData>) => void;
} & Pick<StepFieldProps, "fieldError" | "onBlurField">) {
  const products = PROGRAM_OPTIONS.filter((option) =>
    data.products_of_interest.includes(option.value),
  )
    .map((option) => option.label)
    .join(", ");

  const activity =
    ACTIVITY_LEVELS.find((option) => option.value === data.expected_activity_level)?.label ?? "";

  const primaryContact = [data.primary_contact_name.trim(), data.email.trim()]
    .filter(Boolean)
    .join(" · ");

  const termsError = fieldError("terms_accepted");

  return (
    <div>
      <SectionLabel>Business</SectionLabel>
      <Row label="Applying as" value={data.applying_as === "individual" ? "Individual" : "Company"} />
      <Row
        label={data.applying_as === "individual" ? "Name" : "Company or legal name"}
        value={data.legal_name}
      />
      <Row
        label="Website"
        value={data.website}
      />
      <Row label="Business type" value={displayBusinessType(data)} />

      <SectionLabel>Contact &amp; market</SectionLabel>
      <Row label="Primary contact" value={primaryContact} />
      <Row label="Market" value={data.market} />

      <SectionLabel>Referral approach</SectionLabel>
      <Row label="Products of interest" value={products} />
      <Row label="Expected activity" value={activity} />

      <div className="mt-6 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
        <Checkbox
          checked={data.terms_accepted}
          onChange={(terms_accepted) => {
            onChange({ terms_accepted });
            onBlurField("terms_accepted");
          }}
        >
          I agree to the Partner Program Terms and confirm the information above is accurate.
        </Checkbox>
        {termsError ? (
          <p
            className="mt-2 text-[12.5px]"
            style={{ color: "var(--danger-fg)" }}
            role="alert"
          >
            {termsError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { Chip } from "@/base/components/Chip";
import { Select } from "@/partner-center/components/Select";
import { Textarea } from "@/partner-center/components/Textarea";
import type { ApplicationData, PartnerProgramFamily } from "@/partner-center/types/application";
import { ACTIVITY_LEVELS, PROGRAM_OPTIONS } from "@/partner-center/types/application";
import type { StepFieldProps } from "@/partner-center/onboarding/components/step-field-props";

export function StepReferralProducts({
  data,
  onChange,
  fieldError,
  onBlurField,
}: {
  data: ApplicationData;
  onChange: (partial: Partial<ApplicationData>) => void;
} & StepFieldProps) {
  function toggle(value: PartnerProgramFamily) {
    const selected = data.products_of_interest.includes(value)
      ? data.products_of_interest.filter((item) => item !== value)
      : [...data.products_of_interest, value];
    onChange({ products_of_interest: selected });
    onBlurField("products_of_interest");
  }

  const productsError = fieldError("products_of_interest");

  return (
    <div className="space-y-[18px]">
      <Textarea
        label="How do you plan to refer customers?"
        name="referral_approach"
        placeholder="Through client conversations, our newsletter, and event sponsorships"
        value={data.referral_approach}
        onChange={(event) => onChange({ referral_approach: event.target.value })}
        onBlur={() => onBlurField("referral_approach")}
        error={fieldError("referral_approach")}
        className="min-h-[64px] resize-none"
        rows={3}
      />
      <div>
        <span
          className="mb-2 block text-[12.5px] font-medium"
          style={{ color: "var(--text-tertiary)" }}
        >
          Products of interest
        </span>
        <div className="flex flex-wrap gap-2.5">
          {PROGRAM_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              selected={data.products_of_interest.includes(option.value)}
              onClick={() => toggle(option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
        {productsError ? (
          <p
            className="mt-1.5 text-[12.5px]"
            style={{ color: "var(--danger-fg)" }}
            role="alert"
          >
            {productsError}
          </p>
        ) : null}
      </div>
      <Select
        label="Expected activity level"
        name="expected_activity_level"
        value={data.expected_activity_level}
        onChange={(event) => {
          onChange({
            expected_activity_level:
              event.target.value as ApplicationData["expected_activity_level"],
          });
          onBlurField("expected_activity_level");
        }}
        onBlur={() => onBlurField("expected_activity_level")}
        error={fieldError("expected_activity_level")}
      >
        <option value="">Select an activity level</option>
        {ACTIVITY_LEVELS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Textarea
        label="Additional context (optional)"
        name="additional_context"
        placeholder="Anything else we should know"
        value={data.additional_context}
        onChange={(event) => onChange({ additional_context: event.target.value })}
        className="min-h-[56px] resize-none"
        rows={2}
      />
    </div>
  );
}

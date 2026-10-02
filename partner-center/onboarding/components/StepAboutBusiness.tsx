"use client";

import { Input } from "@/base/components/Input";
import { ChoiceChip } from "@/partner-center/components/ChoiceChip";
import { Select } from "@/partner-center/components/Select";
import {
  BUSINESS_TYPES,
  type ApplicationData,
  type ApplyingAs,
} from "@/partner-center/types/application";
import type { StepFieldProps } from "@/partner-center/onboarding/components/step-field-props";

export function StepAboutBusiness({
  data,
  onChange,
  fieldError,
  onBlurField,
}: {
  data: ApplicationData;
  onChange: (partial: Partial<ApplicationData>) => void;
} & StepFieldProps) {
  function selectType(applying_as: ApplyingAs) {
    onChange({ applying_as });
  }

  const asIndividual = data.applying_as === "individual";
  const otherSelected = data.business_type === "Other";

  return (
    <div className="space-y-[18px]">
      <div>
        <span
          className="mb-2 block text-[12.5px] font-medium"
          style={{ color: "var(--text-tertiary)" }}
        >
          Applying as
        </span>
        <div className="flex gap-2.5">
          <ChoiceChip
            selected={data.applying_as === "individual"}
            onClick={() => selectType("individual")}
          >
            Individual
          </ChoiceChip>
          <ChoiceChip
            selected={data.applying_as === "company"}
            onClick={() => selectType("company")}
          >
            Company
          </ChoiceChip>
        </div>
      </div>
      <Input
        label={asIndividual ? "Name" : "Company or legal name"}
        name="legal_name"
        placeholder={asIndividual ? "Jordan Hale" : "Rowan Partners LLC"}
        value={data.legal_name}
        onChange={(event) => onChange({ legal_name: event.target.value })}
        onBlur={() => onBlurField("legal_name")}
        error={fieldError("legal_name")}
        required
      />
      <Input
        label="Website"
        name="website"
        placeholder={asIndividual ? "www.jordanhale.com" : "www.rowanpartners.com"}
        value={data.website}
        onChange={(event) => onChange({ website: event.target.value })}
        onBlur={() => onBlurField("website")}
        error={fieldError("website")}
        hint={
          fieldError("website")
            ? undefined
            : "Optional. Use a full domain, like example.com"
        }
      />
      <Select
        label="Business type"
        name="business_type"
        value={data.business_type}
        onChange={(event) => {
          const business_type = event.target.value;
          onChange({
            business_type,
            ...(business_type !== "Other" ? { business_type_other: "" } : {}),
          });
        }}
        onBlur={() => onBlurField("business_type")}
        error={fieldError("business_type")}
        required
      >
        <option value="">Select a business type</option>
        {BUSINESS_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </Select>
      {otherSelected ? (
        <Input
          label="Describe your business type"
          name="business_type_other"
          placeholder="e.g. Boutique travel advisory"
          value={data.business_type_other}
          onChange={(event) =>
            onChange({ business_type_other: event.target.value })
          }
          onBlur={() => onBlurField("business_type_other")}
          error={fieldError("business_type_other")}
          required
        />
      ) : null}
    </div>
  );
}

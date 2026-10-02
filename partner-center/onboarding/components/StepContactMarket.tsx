"use client";

import { Input } from "@/base/components/Input";
import { Textarea } from "@/partner-center/components/Textarea";
import type { ApplicationData } from "@/partner-center/types/application";
import type { StepFieldProps } from "@/partner-center/onboarding/components/step-field-props";

export function StepContactMarket({
  data,
  onChange,
  accountEmail,
  fieldError,
  onBlurField,
}: {
  data: ApplicationData;
  onChange: (partial: Partial<ApplicationData>) => void;
  /** Signed-in account email — locked on this step. */
  accountEmail: string;
} & StepFieldProps) {
  return (
    <div className="space-y-[18px]">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Primary contact name"
          name="primary_contact_name"
          placeholder="Alex Rowan"
          value={data.primary_contact_name}
          onChange={(event) => onChange({ primary_contact_name: event.target.value })}
          onBlur={() => onBlurField("primary_contact_name")}
          error={fieldError("primary_contact_name")}
          autoComplete="name"
          required
        />
        <Input
          label="Phone"
          name="phone"
          type="tel"
          placeholder="(555) 010-2938"
          value={data.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          onBlur={() => onBlurField("phone")}
          error={fieldError("phone")}
          autoComplete="tel"
          required
        />
      </div>
      <Input
        label="Email address"
        name="email"
        type="email"
        value={accountEmail}
        readOnly
        tabIndex={-1}
        autoComplete="email"
        error={fieldError("email")}
        className="cursor-default bg-[var(--surface-soft)] text-[rgba(55,53,47,0.75)]"
      />
      <Input
        label="Market / location"
        name="market"
        placeholder="New York, NY — Northeast US"
        value={data.market}
        onChange={(event) => onChange({ market: event.target.value })}
        onBlur={() => onBlurField("market")}
        error={fieldError("market")}
        required
      />
      <Textarea
        label="Tell us more about your company"
        name="audience_served"
        placeholder="Who you work with, what you do, and where you’re focused"
        value={data.audience_served}
        onChange={(event) => onChange({ audience_served: event.target.value })}
        onBlur={() => onBlurField("audience_served")}
        error={fieldError("audience_served")}
        className="min-h-[64px] resize-none"
        rows={3}
        required
      />
    </div>
  );
}

"use client";

import { useState } from "react";

import { OrganizationUrlField } from "@/whitbyos/settings/components/OrganizationUrlField";
import { ONBOARDING_CONTROL, OnboardingField } from "@/whitbyos/onboarding/components/OnboardingShell";

/** Name and URL together, so the URL can follow the name until it is edited. */
export function OrganizationIdentityFields({
  name: held = "",
  urlSlug = "",
}: {
  /** What the step was told last time, so Back does not empty it. */
  name?: string;
  urlSlug?: string;
}) {
  const [name, setName] = useState(held);

  return (
    <>
      <OnboardingField label="Organization Name" htmlFor="name" required>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter your organization name"
          className={ONBOARDING_CONTROL}
        />
      </OnboardingField>

      <OrganizationUrlField size="onboarding" suggestedFrom={name} defaultSlug={urlSlug} />
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { FormError } from "@/base/components/AuthControls";
import { saveCompanyProfile } from "@/partner-center/lib/checklist-actions";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import {
  BackToChecklist,
  SetupCanvas,
} from "@/partner-center/onboarding/components/ChecklistNavBar";
import { SetupHeading } from "@/partner-center/onboarding/components/OnboardingChecklist";

export function CompanyProfileForm({
  legalName,
  website,
  address,
  market,
  audienceServed,
}: {
  legalName: string;
  website: string;
  address: string;
  market: string;
  audienceServed: string;
}) {
  const router = useRouter();
  const [legal_name, setLegalName] = useState(legalName);
  const [site, setSite] = useState(website);
  const [line, setLine] = useState(address);
  const [region, setRegion] = useState(market);
  const [audience, setAudience] = useState(audienceServed);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSave() {
    setPending(true);
    setError(null);
    try {
      const result = await saveCompanyProfile({
        legal_name,
        website: site,
        address: line,
        market: region,
        audience_served: audience,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(result.redirect || PARTNER_PATHS.checklist);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save company profile.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SetupCanvas navRight={<BackToChecklist />}>
      <SetupHeading
        title="Company profile"
        description="Confirm the details customers and Private Attaché staff will see."
      />
      <div
        className="rounded-[10px] bg-surface p-6"
        style={{ border: "1px solid var(--border)" }}
      >
        <div className="space-y-[18px]">
          <Input
            label="Company name"
            name="legal_name"
            value={legal_name}
            onChange={(event) => setLegalName(event.target.value)}
            required
          />
          <Input
            label="Website"
            name="website"
            value={site}
            onChange={(event) => setSite(event.target.value)}
          />
          <Input
            label="Address"
            name="address"
            value={line}
            onChange={(event) => setLine(event.target.value)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Markets served"
              name="market"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
            />
            <Input
              label="Audience served"
              name="audience_served"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
            />
          </div>
        </div>
      </div>
      <FormError message={error} />
      <div className="mt-6 flex items-center justify-between">
        <Button href={PARTNER_PATHS.checklist} variant="ghost">
          Cancel
        </Button>
        <Button type="button" variant="primary" disabled={pending} onClick={() => void onSave()}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </SetupCanvas>
  );
}

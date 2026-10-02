"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { FormError } from "@/base/components/AuthControls";
import { savePrimaryContact } from "@/partner-center/lib/checklist-actions";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import {
  BackToChecklist,
  SetupCanvas,
} from "@/partner-center/onboarding/components/ChecklistNavBar";
import { SetupHeading } from "@/partner-center/onboarding/components/OnboardingChecklist";

export function PrimaryContactForm({
  name,
  phone,
  email,
}: {
  name: string;
  phone: string;
  email: string;
}) {
  const router = useRouter();
  const [primary_contact_name, setName] = useState(name);
  const [phoneValue, setPhone] = useState(phone);
  const [emailValue, setEmail] = useState(email);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSave() {
    setPending(true);
    setError(null);
    try {
      const result = await savePrimaryContact({
        primary_contact_name,
        phone: phoneValue,
        email: emailValue,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(result.redirect || PARTNER_PATHS.checklist);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save primary contact.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SetupCanvas navRight={<BackToChecklist />}>
      <SetupHeading
        title="Primary contact"
        description="The person we reach for referrals, agreements, and payouts."
      />
      <div
        className="rounded-[10px] bg-surface p-6"
        style={{ border: "1px solid var(--border)" }}
      >
        <div className="space-y-[18px]">
          <Input
            label="Name"
            name="primary_contact_name"
            value={primary_contact_name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={emailValue}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            value={phoneValue}
            onChange={(event) => setPhone(event.target.value)}
          />
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

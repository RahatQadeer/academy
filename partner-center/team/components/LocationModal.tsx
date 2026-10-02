"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { FormError } from "@/base/components/AuthControls";
import { TeamModal } from "@/partner-center/team/components/TeamModal";
import { saveCompanyLocation } from "@/partner-center/team/lib/actions";
import type { CompanyLocation } from "@/partner-center/team/types";

export function LocationModal({
  companyName,
  location,
  onClose,
}: {
  companyName: string;
  location?: CompanyLocation | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const editing = Boolean(location);
  const [country, setCountry] = useState(location?.label || location?.country || "");
  const [street, setStreet] = useState(location?.street ?? "");
  const [postal, setPostal] = useState(location?.postal_code ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSave() {
    setPending(true);
    setError(null);
    try {
      const result = await saveCompanyLocation({
        location_id: location?.id ?? null,
        label: country,
        street,
        postal_code: postal,
        country,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save location.");
    } finally {
      setPending(false);
    }
  }

  return (
    <TeamModal
      title={editing ? "Edit location" : "Add location"}
      description={
        editing
          ? `Update this office or service location for ${companyName}.`
          : `Add another office or service location for ${companyName}.`
      }
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={() => void onSave()} disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add location"}
          </Button>
        </>
      }
    >
      <Input
        label="Country"
        name="country"
        value={country}
        onChange={(event) => setCountry(event.target.value)}
        placeholder="e.g. United States"
      />
      <Input
        label="Street address"
        name="street"
        value={street}
        onChange={(event) => setStreet(event.target.value)}
        placeholder="Street, city, state"
      />
      <Input
        label="ZIP / postal code"
        name="postal_code"
        value={postal}
        onChange={(event) => setPostal(event.target.value)}
        placeholder="00000"
      />
      <FormError message={error} />
    </TeamModal>
  );
}

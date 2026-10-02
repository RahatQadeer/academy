"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { FormError } from "@/base/components/AuthControls";
import { Select } from "@/partner-center/components/Select";
import { Textarea } from "@/partner-center/components/Textarea";
import { TeamModal } from "@/partner-center/team/components/TeamModal";
import { updateCompanyDetails } from "@/partner-center/team/lib/actions";
import { BUSINESS_TYPE_OPTIONS } from "@/partner-center/team/lib/labels";
import { usePartnerAction } from "@/partner-center/lib/use-partner-action";

export function EditCompanyModal({
  companyName,
  legalName,
  website,
  businessType,
  markets,
  audienceServed,
  individual = false,
  onClose,
}: {
  companyName: string;
  legalName: string;
  website: string;
  businessType: string;
  markets: string;
  audienceServed: string;
  individual?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { runAction } = usePartnerAction();
  const [name, setName] = useState(legalName);
  const [site, setSite] = useState(website);
  const [type, setType] = useState(businessType || "LLC");
  const [market, setMarket] = useState(markets);
  const [audience, setAudience] = useState(audienceServed);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSave() {
    setPending(true);
    setError(null);
    const result = await runAction(
      () =>
        updateCompanyDetails({
          legal_name: name,
          website: site,
          business_type: type,
          markets: market,
          audience_served: audience,
        }),
      { onValidationError: setError, onRetry: () => void onSave() },
    );
    setPending(false);
    if (result.error) return;
    router.refresh();
    onClose();
  }

  const known = new Set<string>(BUSINESS_TYPE_OPTIONS);
  const typeOptions = known.has(type)
    ? [...BUSINESS_TYPE_OPTIONS]
    : type
      ? [type, ...BUSINESS_TYPE_OPTIONS]
      : [...BUSINESS_TYPE_OPTIONS];

  return (
    <TeamModal
      title={individual ? "Edit partner details" : "Edit company details"}
      description={
        individual
          ? `Profile information for ${companyName}.`
          : `Legal and display information for ${companyName}.`
      }
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={() => void onSave()} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <Input
        label={individual ? "Name" : "Legal business name"}
        name="legal_name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      <Input
        label="Website"
        name="website"
        value={site}
        onChange={(event) => setSite(event.target.value)}
        placeholder="example.com"
      />
      <Select
        label="Business type"
        name="business_type"
        value={type}
        onChange={(event) => setType(event.target.value)}
      >
        {typeOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      <Input
        label="Markets served"
        name="markets"
        value={market}
        onChange={(event) => setMarket(event.target.value)}
        placeholder="New York, NY — Northeast US"
      />
      <Textarea
        label="Audience served"
        name="audience_served"
        value={audience}
        onChange={(event) => setAudience(event.target.value)}
        placeholder="Ultra-high-net-worth families, corporate boards"
        className="min-h-[64px] resize-none"
        rows={3}
      />
      <FormError message={error} />
    </TeamModal>
  );
}

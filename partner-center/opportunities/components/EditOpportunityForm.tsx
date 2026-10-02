"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { FormError } from "@/base/components/AuthControls";
import { Checkbox } from "@/partner-center/components/Checkbox";
import { ChoiceChip } from "@/partner-center/components/ChoiceChip";
import { Select } from "@/partner-center/components/Select";
import { Textarea } from "@/partner-center/components/Textarea";
import { updateOpportunity } from "@/partner-center/opportunities/lib/update-opportunity";
import {
  COUNTRY_DIAL_CODES,
  formatPhoneWithCountry,
  isValidEmail,
  isValidPhoneLocal,
  parsePhoneWithCountry,
} from "@/partner-center/opportunities/lib/contact-fields";
import {
  EXPECTED_TIMING_OPTIONS,
  type OpportunityDetail,
} from "@/partner-center/opportunities/types";
import {
  parseProductInterests,
  serializeProductInterests,
  type ProductInterestOption,
} from "@/partner-center/opportunities/lib/product-interest-shared";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import { usePartnerAction } from "@/partner-center/lib/use-partner-action";

export function EditOpportunityForm({
  data,
  productInterestOptions,
}: {
  data: OpportunityDetail;
  productInterestOptions: ProductInterestOption[];
}) {
  const router = useRouter();
  const { runAction } = usePartnerAction();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialPhone = parsePhoneWithCountry(data.contactPhone);
  const [companyName, setCompanyName] = useState(data.companyName);
  const [website, setWebsite] = useState(data.website ?? "");
  const [contactName, setContactName] = useState(data.contactName ?? "");
  const [contactTitle, setContactTitle] = useState(data.contactTitle ?? "");
  const [contactEmail, setContactEmail] = useState(data.contactEmail ?? "");
  const [phoneCountryCode, setPhoneCountryCode] = useState(
    initialPhone.dialCode,
  );
  const [contactPhone, setContactPhone] = useState(initialPhone.local);
  const [productInterests, setProductInterests] = useState<string[]>(() => {
    const parsed = parseProductInterests(data.productInterest);
    const allowed = new Set(productInterestOptions.map((o) => o.value));
    const known = parsed.filter((v) => allowed.has(v));
    return known.length > 0 ? known : parsed;
  });
  const [estimatedSeats, setEstimatedSeats] = useState(
    data.estimatedSeats != null ? String(data.estimatedSeats) : "",
  );
  const [estimatedValue, setEstimatedValue] = useState(
    data.estimatedValue != null ? String(data.estimatedValue) : "",
  );
  const [expectedTiming, setExpectedTiming] = useState(
    data.expectedTiming ?? "",
  );
  const [additionalContext, setAdditionalContext] = useState(
    data.additionalContext ?? "",
  );
  const [attachmentName, setAttachmentName] = useState<string | null>(
    data.attachment?.title ?? null,
  );
  const [clearExistingAttachment, setClearExistingAttachment] = useState(false);
  const [permissionToContact, setPermissionToContact] = useState(
    data.permissionToContact,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const emailTrimmed = contactEmail.trim();
  const emailValid = isValidEmail(emailTrimmed);
  const phoneLocal = contactPhone.trim();
  const phoneEmpty = phoneLocal.length === 0;
  const phoneValid = phoneEmpty || isValidPhoneLocal(phoneLocal);
  const emailError =
    emailTouched && emailTrimmed.length > 0 && !emailValid
      ? "Enter a valid email address."
      : emailTouched && emailTrimmed.length === 0
        ? "Contact email is required."
        : null;
  const phoneError =
    phoneTouched && !phoneEmpty && !phoneValid
      ? "Enter a valid phone number (digits only, 7–15 digits)."
      : null;

  function toggleProductInterest(value: string) {
    setProductInterests((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  }

  const canSubmit =
    companyName.trim().length > 0 &&
    contactName.trim().length > 0 &&
    emailValid &&
    phoneValid &&
    productInterests.length > 0 &&
    permissionToContact;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setEmailTouched(true);
    setPhoneTouched(true);
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("companyName", companyName);
    formData.set("website", website);
    formData.set("contactName", contactName);
    formData.set("contactTitle", contactTitle);
    formData.set("contactEmail", contactEmail);
    formData.set(
      "contactPhone",
      formatPhoneWithCountry(phoneCountryCode, contactPhone),
    );
    formData.set("productInterest", serializeProductInterests(productInterests));
    formData.set("estimatedSeats", estimatedSeats);
    formData.set("estimatedValue", estimatedValue);
    formData.set("expectedTiming", expectedTiming);
    formData.set("additionalContext", additionalContext);
    formData.set(
      "permissionToContact",
      permissionToContact ? "true" : "false",
    );
    const file = fileInputRef.current?.files?.[0];
    if (file) formData.set("attachment", file);

    const result = await runAction(
      () => updateOpportunity(data.id, formData),
      {
        onValidationError: setError,
        onRetry: () => void onSubmit(event),
      },
    );
    setPending(false);
    if (result.error) return;
    router.push(`/partner-center/opportunities/${data.id}`);
  }

  function clearAttachment() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAttachmentName(null);
    setClearExistingAttachment(true);
  }

  return (
    <div className="flex min-h-full flex-col px-5 pt-6 pb-20 sm:px-6 sm:pb-24 lg:px-8 xl:px-12">
      <PartnerChrome
        title="Edit opportunity"
        subtitle="You can edit while this opportunity is Submitted or Accepted. Editing locks once it moves to In Progress."
      />
      <Link
        href={`/partner-center/opportunities/${data.id}`}
        className="mb-5 inline-flex w-fit text-[13.5px] no-underline"
        style={{ color: "var(--text-secondary)" }}
      >
        ← Back to opportunity
      </Link>

      <form
        onSubmit={onSubmit}
        encType="multipart/form-data"
        className="mt-2 max-w-[720px] space-y-5 pb-8"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Company name *"
            name="company_name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
          <Input
            label="Website"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="example.com"
          />
          <Input
            label="Contact name *"
            name="contact_name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
          />
          <Input
            label="Contact title"
            name="contact_title"
            value={contactTitle}
            onChange={(e) => setContactTitle(e.target.value)}
          />
          <div className="sm:col-span-2">
            <Input
              label="Contact email *"
              name="contact_email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              error={emailError}
              required
              autoComplete="email"
            />
          </div>
          <div className="grid grid-cols-[minmax(7.5rem,9rem)_minmax(0,1fr)] gap-2.5 sm:col-span-2">
            <Select
              label="Country code"
              name="phone_country_code"
              value={phoneCountryCode}
              onChange={(e) => setPhoneCountryCode(e.target.value)}
            >
              {COUNTRY_DIAL_CODES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Contact phone"
              name="contact_phone"
              type="tel"
              inputMode="numeric"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              onBlur={() => setPhoneTouched(true)}
              error={phoneError}
              placeholder="Optional"
              autoComplete="tel-national"
            />
          </div>
        </div>

        <div>
          <div
            className="mb-1.5 text-[12.5px] font-medium uppercase tracking-[0.05em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Product interest *
          </div>
          <p
            className="mb-2 text-[12.5px]"
            style={{ color: "var(--text-soft, var(--text-tertiary))" }}
          >
            Select all that apply.
          </p>
          <div className="flex flex-wrap gap-2.5">
            {productInterestOptions.map((option) => (
              <ChoiceChip
                key={option.value}
                selected={productInterests.includes(option.value)}
                onClick={() => toggleProductInterest(option.value)}
              >
                {option.label}
              </ChoiceChip>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Estimated users"
            name="estimated_seats"
            inputMode="numeric"
            value={estimatedSeats}
            onChange={(e) => setEstimatedSeats(e.target.value)}
            placeholder="e.g. 85"
          />
          <Input
            label="Estimated value (optional)"
            name="estimated_value"
            inputMode="decimal"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            placeholder="USD — not commission basis"
            hint="An estimate only. Commission is based on eligible collected payment."
          />
          <Select
            label="Expected timing"
            name="expected_timing"
            value={expectedTiming}
            onChange={(e) => setExpectedTiming(e.target.value)}
          >
            <option value="">Select timing</option>
            {EXPECTED_TIMING_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>

        <Textarea
          label="Additional context"
          name="additional_context"
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          placeholder="Context that helps Private Attaché evaluate this opportunity."
        />

        <div>
          <div
            className="mb-1.5 text-[12.5px] font-medium uppercase tracking-[0.05em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Attachment (optional)
          </div>
          <div
            className="rounded-[10px] bg-surface px-4 py-3"
            style={{ border: "1px solid var(--border)" }}
          >
            <input
              ref={fileInputRef}
              type="file"
              name="attachment"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setAttachmentName(file?.name ?? null);
                setClearExistingAttachment(false);
              }}
            />
            {attachmentName && !clearExistingAttachment ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div
                    className="truncate text-[14px] font-medium"
                    style={{ color: "var(--ink)" }}
                  >
                    {attachmentName}
                  </div>
                  <div
                    className="mt-0.5 text-[12.5px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Leave as-is or replace with a new file (up to 25 MB).
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3 py-[7px] text-[13px]"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-3 py-[7px] text-[13px]"
                    onClick={clearAttachment}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p
                  className="m-0 text-[13.5px] leading-[1.45]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Attach a supporting file for this opportunity.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-3 py-[7px] text-[13px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose file
                </Button>
              </div>
            )}
          </div>
        </div>

        <Checkbox
          checked={permissionToContact}
          onChange={setPermissionToContact}
        >
          I have permission to share this contact&apos;s information with
          Private Attaché for outreach purposes. *
        </Checkbox>

        {error ? <FormError message={error} /> : null}

        <div className="flex flex-wrap items-center gap-3 pt-1 pb-6">
          <Button type="submit" disabled={pending || !canSubmit}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            href={`/partner-center/opportunities/${data.id}`}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

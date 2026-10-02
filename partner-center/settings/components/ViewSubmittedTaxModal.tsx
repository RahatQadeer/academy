"use client";

import Link from "next/link";
import { Button } from "@/base/components/Button";
import { TeamModal } from "@/partner-center/team/components/TeamModal";
import type { TaxProfileRow } from "@/partner-center/settings/lib/load-tax-payment";
import {
  collectionSourceLabel,
  formatTaxDate,
  formTypeLabel,
} from "@/partner-center/settings/lib/tax-presentation";

export function ViewSubmittedTaxModal({
  open,
  onClose,
  tax,
  taxDocumentId,
}: {
  open: boolean;
  onClose: () => void;
  tax: TaxProfileRow;
  taxDocumentId: string | null;
}) {
  if (!open) return null;

  const tin =
    tax.tin_last4 && tax.tin_last4.trim()
      ? `•••-••-${tax.tin_last4.trim()}`
      : "Collected by Stripe — only last four digits are shown here when available.";

  return (
    <TeamModal
      title="Submitted tax form"
      description="Safe summary only. Private Attaché never shows full taxpayer IDs."
      onClose={onClose}
      width={480}
      footer={
        <>
          {taxDocumentId ? (
            <Button
              href={`/partner-center/documents/${taxDocumentId}`}
              variant="secondary"
              unsized
              className="px-3.5 py-2 text-[13px]"
            >
              Open restricted copy
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            unsized
            className="px-3.5 py-2 text-[13px]"
            onClick={onClose}
          >
            Close
          </Button>
        </>
      }
    >
      <dl className="m-0 space-y-3 text-[13.5px]">
        <Row label="Legal name" value={tax.legal_payee_name || "—"} />
        <Row label="Business / DBA" value={tax.business_dba_name || "—"} />
        <Row
          label="Classification"
          value={tax.entity_classification || "—"}
        />
        <Row label="Mailing address" value={tax.mailing_address || "—"} />
        <Row label="Country" value={tax.country || "—"} />
        <Row label="TIN" value={tin} />
        <Row label="Form type" value={formTypeLabel(tax.form_type)} />
        <Row
          label="Collected via"
          value={collectionSourceLabel(tax.collection_source)}
        />
        <Row
          label="Certified"
          value={formatTaxDate(tax.certified_at || tax.last_reviewed_at)}
        />
      </dl>
      {!taxDocumentId ? (
        <p
          className="mt-4 mb-0 text-[12.5px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          A downloadable copy is available only when the collection system
          stores a restricted document.{" "}
          <Link
            href="mailto:righttailorg@gmail.com?subject=Partner%20tax%20form%20copy"
            className="font-medium no-underline"
            style={{ color: "var(--accent)" }}
          >
            Contact support
          </Link>{" "}
          if you need a copy from Stripe.
        </p>
      ) : null}
    </TeamModal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt style={{ color: "rgba(55,53,47,.5)" }}>{label}</dt>
      <dd className="m-0 max-w-[60%] text-right font-medium">{value}</dd>
    </div>
  );
}

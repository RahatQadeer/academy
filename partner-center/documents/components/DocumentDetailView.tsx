"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import { AddLabelControl } from "@/partner-center/documents/components/AddLabelControl";
import { StaffUpdatePlaceholder } from "@/partner-center/documents/components/DocumentActionPlaceholders";
import { DocumentPreview } from "@/partner-center/documents/components/DocumentPreview";
import { ReplaceDocumentModal } from "@/partner-center/documents/components/ReplaceDocumentModal";
import {
  actionLabelFor,
  documentStatusLabel,
  documentStatusTone,
  isAppPathFileUrl,
} from "@/partner-center/documents/lib/format";
import { downloadPartnerDocumentForm } from "@/partner-center/documents/lib/actions";
import type { DocumentDetailData } from "@/partner-center/documents/types";

/** F47 Document detail — layout from Partner Center HTML reference. */
export function DocumentDetailView({
  data,
  previewUrl,
}: {
  data: DocumentDetailData;
  previewUrl: string | null;
}) {
  const [modal, setModal] = useState<"update" | "staff" | null>(null);

  const needsPartnerAction =
    data.canMutate &&
    data.status === "action_needed" &&
    (data.neededAction === "sign_externally" ||
      data.neededAction === "upload" ||
      data.neededAction === "update" ||
      data.neededAction === "review");

  const actionCtaLabel = actionLabelFor(data.neededAction, data.status);
  const canSignInApp =
    data.neededAction === "sign_externally" && Boolean(data.fileUrl?.trim());

  function openNeededAction() {
    if (data.neededAction === "upload" || data.neededAction === "update") {
      setModal(data.isOwnUpload ? "update" : "staff");
    }
  }

  function closeModal() {
    setModal(null);
  }

  return (
    <div className="flex min-h-full flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <PartnerChrome title={data.title} />
      <Link
        href="/partner-center/documents"
        className="mb-4 inline-block text-[13px] font-semibold no-underline"
        style={{ color: "var(--accent)" }}
      >
        ← Back to Documents
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-[5px]">
          {data.labels.map((label) => (
            <span
              key={label}
              className="rounded px-2 py-0.5 text-[10.5px] font-medium"
              style={{
                background: "var(--canvas)",
                color: "rgba(55,53,47,.65)",
              }}
            >
              {label}
            </span>
          ))}
          <AddLabelControl
            documentId={data.id}
            canMutate={data.canMutate}
          />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <DocumentPreview
          previewUrl={previewUrl}
          kind={data.previewKind}
          appPath={
            isAppPathFileUrl(data.fileUrl) ? data.fileUrl : null
          }
        />

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {needsPartnerAction && data.neededAction === "sign_externally" && canSignInApp ? (
              <Button
                href={`/partner-center/documents/${data.id}?sign=1`}
                variant="primary"
              >
                Sign
              </Button>
            ) : null}
            {needsPartnerAction &&
            data.neededAction !== "review" &&
            data.neededAction !== "sign_externally" ? (
              <Button type="button" variant="primary" onClick={openNeededAction}>
                {actionCtaLabel}
              </Button>
            ) : null}
            <form action={downloadPartnerDocumentForm}>
              <input type="hidden" name="documentId" value={data.id} />
              <Button type="submit" variant="secondary">
                Download
              </Button>
            </form>
          </div>

          <div className="mb-4 pa-partner-card p-[22px]">
            <div
              className="mb-3.5 text-[13.5px] font-semibold"
              style={{ color: "var(--ink)" }}
            >
              {data.documentKind === "agreement"
                ? "Agreement details"
                : "Document details"}
            </div>
            <dl className="m-0 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <dt
                  className="m-0 shrink-0 text-[13px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Status
                </dt>
                <dd className="m-0">
                  <Pill tone={documentStatusTone(data.status)}>
                    {documentStatusLabel(data.status)}
                  </Pill>
                </dd>
              </div>
              <DetailRow label="Type" value={data.typeLabel} />
              <DetailRow label="Version" value={`v${data.version}`} />
              {hasDetailValue(data.effectiveDateLabel) ? (
                <DetailRow
                  label="Effective date"
                  value={data.effectiveDateLabel}
                />
              ) : null}
              {hasDetailValue(data.expirationDateLabel) ? (
                <DetailRow
                  label="Expiration / renewal"
                  value={data.expirationDateLabel}
                />
              ) : null}
              {hasDetailValue(data.signedDateLabel) ? (
                <DetailRow
                  label="Accepted / signed"
                  value={data.signedDateLabel}
                />
              ) : null}
              {hasDetailValue(data.externalSignatureRef) ? (
                <DetailRow
                  label="Signature / reference"
                  value={data.externalSignatureRef}
                />
              ) : null}
              {hasDetailValue(data.supersedesTitle) ? (
                <DetailRow
                  label="Supersedes"
                  value={data.supersedesTitle as string}
                />
              ) : null}
              <DetailRow label="Shared by" value={data.sharedByLabel} />
            </dl>
          </div>

          {data.showGovernsTerms ? (
            <div
              className="rounded-[10px] px-5 py-[18px]"
              style={{
                border: "1px solid var(--border)",
                background: "#fbfdff",
              }}
            >
              <div
                className="mb-1 text-[13.5px] font-semibold"
                style={{ color: "var(--ink)" }}
              >
                Governs current terms
              </div>
              <p
                className="mb-2.5 mt-0 text-[13px] leading-[1.5]"
                style={{ color: "var(--text-secondary)" }}
              >
                This agreement authorizes the commission rates and payout terms
                shown on your Program Terms summary.
              </p>
              <Link
                href="/partner-center/documents/terms"
                className="text-[13px] font-semibold no-underline"
                style={{ color: "var(--accent)" }}
              >
                View Program Terms →
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {modal === "staff" ? (
        <StaffUpdatePlaceholder onClose={closeModal} />
      ) : null}
      {modal === "update" ? (
        <ReplaceDocumentModal
          documentId={data.id}
          title={data.title}
          onClose={closeModal}
        />
      ) : null}
    </div>
  );
}

function hasDetailValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed !== "—";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt
        className="m-0 shrink-0 text-[13px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </dt>
      <dd className="m-0 text-right text-[13px]" style={{ color: "var(--ink)" }}>
        {value}
      </dd>
    </div>
  );
}

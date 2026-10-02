"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { credentialTypeLabel, formatCredentialDate } from "../utils/labels";
import { credentialVerifyPath } from "../utils/publicId";
import { isCredentialRenewalOpen } from "@/academy/lib/credentialRenewal/eligibility";
import type { CredentialDetailData } from "../types/detail";
import { AdminCredentialNote } from "./AdminCredentialNote";
import { AppreciationCertificateTemplate } from "./AppreciationCertificateTemplate";
import { EndorsementCertificateTemplate } from "./EndorsementCertificateTemplate";
import { ProfessionalCertificationTemplate } from "./ProfessionalCertificationTemplate";

export function CredentialAwardedView({ data }: { data: CredentialDetailData }) {
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared" | "error">("idle");
  const issuedOn = data.awardedAt ? formatCredentialDate(data.awardedAt) : "—";
  const isCpa = data.type === "cpa_credential";
  const certificateTitle = credentialTypeLabel(data.type);
  const awardNote = data.awardNote?.trim() ?? "";

  function verificationUrl() {
    const id = data.certificateNumber || data.publicId;
    return `${window.location.origin}${credentialVerifyPath(id)}`;
  }

  async function shareCertificate() {
    const url = verificationUrl();
    const title = `${certificateTitle} — ${data.programName}`;
    const id = data.certificateNumber || data.publicId;
    const text = `${data.learnerName} earned a Private Attaché Academy credential (${id}). Verify authenticity:`;

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        setShareState("shared");
        window.setTimeout(() => setShareState("idle"), 2200);
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 2200);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setShareState("copied");
        window.setTimeout(() => setShareState("idle"), 2200);
      } catch {
        setShareState("error");
        window.setTimeout(() => setShareState("idle"), 2800);
      }
    }
  }

  function printCertificate() {
    window.print();
  }

  const shareLabel =
    shareState === "copied"
      ? "Link copied"
      : shareState === "shared"
        ? "Shared"
        : shareState === "error"
          ? "Copy failed"
          : "Share";

  const renewalOpen = isCredentialRenewalOpen(data.expiresAt);
  const renewLabel = data.termExpiresLabel
    ? `Available ${data.termExpiresLabel}`
    : data.expiresAt
      ? `Available ${formatCredentialDate(data.expiresAt)}`
      : "Renewal not available";

  // Fit the stage: width from container height so the sheet never overflows the header/note.
  const sheetClassName =
    "h-auto max-h-full w-[min(100%,calc(100cqh*1024/729))] max-w-full";

  // Three distinct professional sheets by credential type — never interchange them.
  const certificateSheet =
    data.type === "cpa_credential" ? (
      <ProfessionalCertificationTemplate
        className={sheetClassName}
        learnerName={data.learnerName}
        programName={data.programName}
        issuedOn={issuedOn}
        credentialId={data.publicId}
      />
    ) : data.type === "specialty_endorsement" ? (
      <EndorsementCertificateTemplate
        className={sheetClassName}
        learnerName={data.learnerName}
        programName={data.programName}
        issuedOn={issuedOn}
        credentialId={data.publicId}
      />
    ) : (
      <AppreciationCertificateTemplate
        className={sheetClassName}
        learnerName={data.learnerName}
        programName={data.programName}
        issuedOn={issuedOn}
        credentialId={data.publicId}
      />
    );

  return (
    <div className="certificate-page flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden px-5 py-4 lg:px-8">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.28in; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }
          aside,
          .certificate-no-print {
            display: none !important;
          }
          [data-academy-role],
          main,
          main > div {
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .certificate-page {
            display: block !important;
            position: static !important;
            height: auto !important;
            max-height: none !important;
            min-height: 0 !important;
            max-width: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
          }
          .certificate-stage {
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            container-type: normal !important;
          }
          .certificate-sheet {
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            height: auto !important;
            margin: 0 !important;
            box-shadow: none !important;
            break-inside: avoid;
            page-break-inside: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <header className="certificate-no-print relative z-20 flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href="/academy/credentials"
            className="text-[13px] no-underline hover:text-accent-hover"
            style={{ color: "var(--accent)" }}
          >
            ← Certificates & Credentials
          </Link>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-[16px] font-semibold tracking-[-0.2px]">{data.programName}</h1>
            <Pill tone="success">Awarded</Pill>
            {data.termExpiresLabel && isCpa ? (
              <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                Renews or expires {data.termExpiresLabel}
              </span>
            ) : data.termExpiresLabel ? (
              <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                Expires {data.termExpiresLabel}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {data.expiresAt ? (
            renewalOpen ? (
              <Button href={`/academy/credentials/${data.id}/renew`} variant="primary">
                Renew certificate
              </Button>
            ) : (
              <span className="inline-flex flex-col items-stretch gap-1 sm:items-end">
                <Button
                  type="button"
                  variant="secondary"
                  disabled
                  className="pointer-events-none opacity-50"
                  aria-disabled="true"
                  title={renewLabel}
                >
                  {renewLabel}
                </Button>
                <span className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                  Renew unlocks on the expiration date
                </span>
              </span>
            )
          ) : null}
          <Button type="button" variant={data.expiresAt ? "secondary" : "primary"} onClick={printCertificate}>
            Download PDF
          </Button>
          <Button href={credentialVerifyPath(data.certificateNumber || data.publicId)} variant="secondary">
            Verify
          </Button>
          <Button type="button" variant="secondary" onClick={shareCertificate}>
            {shareLabel}
          </Button>
        </div>
      </header>

      <div
        className="certificate-stage relative z-0 mt-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        style={{ containerType: "size" }}
      >
        {certificateSheet}
      </div>

      {awardNote ? (
        <div className="certificate-no-print relative z-20 mx-auto mt-3 w-full max-w-[920px] shrink-0">
          <AdminCredentialNote title="Note from Academy Admin" variant="caption">
            {awardNote}
          </AdminCredentialNote>
        </div>
      ) : null}
    </div>
  );
}
